import { Player } from '../entities/player';
import { PlayerController } from '../entities/player-controller';
import { InputSystem } from '../systems/input-system';
import { PhysicsSystem } from '../systems/physics-system';
import {
  PlayerData,
  PlayerState,
  PlayerMode,
  PlayerRank,
  PlayerManagerConfig,
  Vector3,
  EventEmitter,
  ProximityInfo,
  PlayerInteraction,
  PlayerSyncData,
  PlayerPrediction,
  NetworkClient
} from '../types';

// Utility vectors
const tempVector1 = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempVector3 = new THREE.Vector3();

// Default configuration
const DEFAULT_CONFIG: PlayerManagerConfig = {
  maxPlayers: 50,
  spawnPoints: [
    { x: 0, y: 2, z: 0 },
    { x: 5, y: 2, z: 0 },
    { x: -5, y: 2, z: 0 },
    { x: 0, y: 2, z: 5 },
    { x: 0, y: 2, z: -5 }
  ],
  defaultAvatar: 'asset://avatar.vrm',
  movementSettings: {
    walkSpeed: 3,
    runSpeed: 6,
    jumpHeight: 1.5,
    flySpeed: 10,
    gravity: 20,
    mass: 1,
    friction: 0.1,
    airControl: 0.3,
    groundCheckDistance: 0.2,
    maxSlopeAngle: 60,
    capsuleRadius: 0.3,
    capsuleHeight: 1.6
  },
  allowedEmotes: [
    'wave', 'dance', 'point', 'thumbsup', 'clap', 'laugh', 'cry', 'angry',
    'think', 'sleep', 'sit', 'stand', 'walk', 'run', 'jump', 'idle'
  ],
  voiceChatEnabled: true,
  textChatEnabled: true
};

export class PlayerManager implements EventEmitter {
  public config: PlayerManagerConfig;
  public players: Map<string, Player>;
  public controllers: Map<string, PlayerController>;
  public localPlayer?: Player;
  public localController?: PlayerController;

  // Systems
  public inputSystem?: InputSystem;
  public physicsSystem?: PhysicsSystem;
  public networkClient?: NetworkClient;

  // Spawn management
  private nextSpawnPoint: number = 0;
  private reservedSpawnPoints: Set<number> = new Set();

  // Proximity tracking
  private proximityThreshold: number = 10;
  private proximityChecks: Map<string, Set<string>> = new Map();
  private proximityInfo: Map<string, ProximityInfo[]> = new Map();

  // Player prediction and reconciliation
  private clientPrediction: boolean = true;
  private serverReconciliation: boolean = true;
  private inputHistory: Map<string, any[]> = new Map();
  private pendingMoves: Map<string, PlayerPrediction[]> = new Map();

  // Network sync
  private networkRate: number = 0.1; // 10 times per second
  private lastNetworkUpdate: number = 0;
  private interpolationDelay: number = 0.1; // 100ms delay for smooth interpolation

  // Events
  private events: Map<string, Function[]> = new Map();

  // Performance tracking
  private performance: {
    playerCount: number;
    updateCount: number;
    networkUpdates: number;
    proximityChecks: number;
    lastUpdate: number;
  };

  constructor(config: Partial<PlayerManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.players = new Map();
    this.controllers = new Map();

    // Initialize performance tracking
    this.performance = {
      playerCount: 0,
      updateCount: 0,
      networkUpdates: 0,
      proximityChecks: 0,
      lastUpdate: Date.now()
    };
  }

  // Event emitter implementation
  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in player manager event listener for ${event}:`, error);
        }
      });
    }
  }

  once(event: string, listener: (...args: any[]) => void): void {
    const onceWrapper = (...args: any[]) => {
      this.off(event, onceWrapper);
      listener(...args);
    };
    this.on(event, onceWrapper);
  }

  // System initialization
  initialize(
    inputSystem?: InputSystem,
    physicsSystem?: PhysicsSystem,
    networkClient?: NetworkClient
  ): void {
    this.inputSystem = inputSystem;
    this.physicsSystem = physicsSystem;
    this.networkClient = networkClient;

    // Setup network event listeners
    if (this.networkClient) {
      this.setupNetworkListeners();
    }

    // Setup physics event listeners
    if (this.physicsSystem) {
      this.setupPhysicsListeners();
    }
  }

  private setupNetworkListeners(): void {
    if (!this.networkClient) return;

    this.networkClient.on('playerJoined', (data: PlayerData) => {
      this.addRemotePlayer(data);
    });

    this.networkClient.on('playerLeft', (data: { playerId: string }) => {
      this.removePlayer(data.playerId);
    });

    this.networkClient.on('playerUpdate', (data: PlayerSyncData) => {
      this.updateRemotePlayer(data);
    });

    this.networkClient.on('playerTeleport', (data: { playerId: string; position: Vector3; rotation?: number }) => {
      this.teleportPlayer(data.playerId, data.position, data.rotation);
    });

    this.networkClient.on('playerEmote', (data: { playerId: string; emote: string }) => {
      this.setPlayerEmote(data.playerId, data.emote);
    });

    this.networkClient.on('playerPush', (data: { playerId: string; force: Vector3 }) => {
      this.pushPlayer(data.playerId, data.force);
    });
  }

  private setupPhysicsListeners(): void {
    if (!this.physicsSystem) return;

    this.physicsSystem.on('collision', (data: { bodyA: any; bodyB: any; contacts: any[] }) => {
      this.handlePhysicsCollision(data);
    });
  }

  // Player management
  addLocalPlayer(data: Partial<PlayerData>): Player {
    const spawnPoint = this.getNextSpawnPoint();
    const playerData: PlayerData = {
      id: data.id || this.generatePlayerId(),
      name: data.name || 'Local Player',
      position: spawnPoint,
      quaternion: [0, 0, 0, 1],
      scale: data.scale || { x: 1, y: 1, z: 1 },
      health: data.health || 100,
      avatar: data.avatar || this.config.defaultAvatar,
      rank: data.rank || PlayerRank.MEMBER,
      mode: PlayerMode.IDLE,
      axis: { x: 0, y: 0, z: 0 },
      gaze: { x: 0, y: 0, z: -1 },
      effect: data.effect
    };

    const player = new Player(playerData.id, playerData.name, true, playerData);
    const controller = new PlayerController(player, this.config.movementSettings);

    this.players.set(player.id, player);
    this.controllers.set(player.id, controller);
    this.localPlayer = player;
    this.localController = controller;

    // Setup input for local player
    if (this.inputSystem) {
      this.setupLocalPlayerInput(player, controller);
    }

    // Add physics body for player
    if (this.physicsSystem) {
      this.addPlayerPhysics(player);
    }

    // Initialize input history for prediction
    if (this.clientPrediction) {
      this.inputHistory.set(player.id, []);
      this.pendingMoves.set(player.id, []);
    }

    this.updatePerformance();
    this.emit('localPlayerAdded', { player });
    return player;
  }

  addRemotePlayer(data: PlayerData): Player {
    if (this.players.has(data.id)) {
      console.warn(`Remote player ${data.id} already exists`);
      return this.players.get(data.id)!;
    }

    const player = new Player(data.id, data.name, false, data);
    const controller = new PlayerController(player, this.config.movementSettings);

    this.players.set(player.id, player);
    this.controllers.set(player.id, controller);

    // Add physics body for remote player (kinematic)
    if (this.physicsSystem) {
      this.addPlayerPhysics(player, true);
    }

    this.updatePerformance();
    this.emit('remotePlayerAdded', { player });
    return player;
  }

  removePlayer(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    const controller = this.controllers.get(playerId);
    if (controller) {
      controller.destroy();
      this.controllers.delete(playerId);
    }

    // Remove physics body
    if (this.physicsSystem) {
      this.physicsSystem.removeBody(`player_${playerId}`);
    }

    this.players.delete(playerId);
    this.inputHistory.delete(playerId);
    this.pendingMoves.delete(playerId);
    this.proximityChecks.delete(playerId);
    this.proximityInfo.delete(playerId);

    if (this.localPlayer?.id === playerId) {
      this.localPlayer = undefined;
      this.localController = undefined;
    }

    this.updatePerformance();
    this.emit('playerRemoved', { player });
    return true;
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  getRemotePlayers(): Player[] {
    return Array.from(this.players.values()).filter(player => !player.isLocal);
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  // Spawn point management
  private getNextSpawnPoint(): Vector3 {
    const availablePoints = this.config.spawnPoints.filter((_, index) =>
      !this.reservedSpawnPoints.has(index)
    );

    if (availablePoints.length === 0) {
      // All points reserved, use the default one
      return { ...this.config.spawnPoints[0] };
    }

    const spawnPoint = availablePoints[this.nextSpawnPoint % availablePoints.length];
    this.nextSpawnPoint = (this.nextSpawnPoint + 1) % availablePoints.length;

    return { ...spawnPoint };
  }

  reserveSpawnPoint(index: number): void {
    this.reservedSpawnPoints.add(index);
  }

  releaseSpawnPoint(index: number): void {
    this.reservedSpawnPoints.delete(index);
  }

  // Input handling for local player
  private setupLocalPlayerInput(player: Player, controller: PlayerController): void {
    if (!this.inputSystem) return;

    // Keyboard input
    this.inputSystem.on('keyDown', (data: { key: string; code: string }) => {
      if (!this.localPlayer) return;

      controller.setKeyState(data.code, true);

      // Handle jump
      if (data.key === 'space' || data.key === 'arrowUp') {
        controller.input.jumpPressed = true;
        controller.input.jumpDown = true;
      }

      // Handle flying toggle (double jump in build mode)
      if (data.key === 'space') {
        const now = Date.now();
        const lastJump = player['lastJumpAt'] || -999;
        if (now - lastJump < 400) {
          controller.toggleFlying();
        }
        player['lastJumpAt'] = now;
      }
    });

    this.inputSystem.on('keyUp', (data: { key: string; code: string }) => {
      if (!this.localPlayer) return;

      controller.setKeyState(data.code, false);

      if (data.key === 'space' || data.key === 'arrowUp') {
        controller.input.jumpDown = false;
      }
    });

    // Mouse input
    this.inputSystem.on('mouseMove', (data: { position: THREE.Vector3; delta: THREE.Vector3 }) => {
      if (!this.localPlayer) return;

      controller.input.lookDelta = data.delta;
    });

    this.inputSystem.on('mouseDown', (data: { button: string }) => {
      if (!this.localPlayer) return;

      controller.setMouseState(data.button, true);
    });

    this.inputSystem.on('mouseUp', (data: { button: string }) => {
      if (!this.localPlayer) return;

      controller.setMouseState(data.button, false);
    });

    this.inputSystem.on('wheel', (data: { delta: number }) => {
      if (!this.localPlayer) return;

      controller.input.zoomDelta = data.delta;
    });

    // Gamepad input
    this.inputSystem.on('input', (data: { bindingId: string; type: string; pressed: boolean; value: number }) => {
      if (!this.localPlayer) return;

      // Handle gamepad input based on binding
      if (data.type === 'gamepad') {
        if (data.bindingId.includes('jump') && data.pressed) {
          controller.input.jumpPressed = true;
          controller.input.jumpDown = true;
        }
      }
    });

    // Touch input
    this.inputSystem.on('touchStart', (data: { touches: any[] }) => {
      if (!this.localPlayer) return;

      controller.setupTouchControls(
        this.inputSystem!.element.offsetWidth / 2,
        this.inputSystem!.element.offsetHeight / 2
      );
    });

    this.inputSystem.on('touchMove', (data: { touches: any[] }) => {
      if (!this.localPlayer) return;

      const touches = data.touches;
      if (touches.length > 0) {
        const touch = touches[0];
        controller.updateTouchControls(touch.position.x, touch.position.y);
      }
    });

    this.inputSystem.on('touchEnd', () => {
      if (!this.localPlayer) return;

      controller.updateTouchControls(0, 0, true);
    });
  }

  // Physics integration
  private addPlayerPhysics(player: Player, kinematic: boolean = false): void {
    if (!this.physicsSystem) return;

    const body = this.physicsSystem.addBody({
      id: `player_${player.id}`,
      position: player.position.clone(),
      velocity: player.velocity.clone(),
      mass: player.mass,
      friction: player.friction || 0.5,
      restitution: 0.1,
      linearDamping: 0.05,
      angularDamping: 0.05,
      layer: kinematic ? this.physicsSystem.layers.KINEMATIC : this.physicsSystem.layers.PLAYER,
      shape: 'capsule',
      size: new THREE.Vector3(
        player.capsuleRadius || 0.3,
        player.capsuleHeight || 1.6,
        player.capsuleRadius || 0.3
      ),
      quaternion: player.quaternion.clone(),
      isKinematic: kinematic,
      isTrigger: false,
      enabled: true
    });

    // Store reference to physics body
    player['physicsBody'] = body;
  }

  private handlePhysicsCollision(data: { bodyA: any; bodyB: any; contacts: any[] }): void {
    // Handle collisions involving players
    const [bodyA, bodyB] = [data.bodyA, data.bodyB];

    let player: Player | undefined;
    let otherEntity: any;

    if (bodyA.id?.startsWith('player_')) {
      const playerId = bodyA.id.replace('player_', '');
      player = this.players.get(playerId);
      otherEntity = bodyB;
    } else if (bodyB.id?.startsWith('player_')) {
      const playerId = bodyB.id.replace('player_', '');
      player = this.players.get(playerId);
      otherEntity = bodyA;
    }

    if (player && otherEntity) {
      this.emit('playerCollision', {
        player,
        entity: otherEntity,
        contacts: data.contacts
      });
    }
  }

  // Update loop
  update(delta: number): void {
    if (!this.enabled) return;

    const startTime = Date.now();

    // Update all players
    for (const [playerId, player] of this.players) {
      if (player.destroyed) continue;

      const controller = this.controllers.get(playerId);
      if (controller) {
        controller.update(delta);
      }
    }

    // Fixed update for physics and movement
    this.fixedUpdate(delta);

    // Update proximity tracking
    this.updateProximityTracking(delta);

    // Network synchronization
    this.updateNetworkSync(delta);

    // Update performance metrics
    this.performance.updateCount++;
    this.performance.lastUpdate = Date.now() - startTime;
  }

  fixedUpdate(delta: number): void {
    for (const [playerId, player] of this.players) {
      if (player.destroyed) continue;

      const controller = this.controllers.get(playerId);
      if (controller) {
        controller.fixedUpdate(delta);
      }
    }
  }

  // Proximity tracking
  private updateProximityTracking(delta: number): void {
    const players = Array.from(this.players.values());
    this.performance.proximityChecks = 0;

    for (let i = 0; i < players.length; i++) {
      const playerA = players[i];
      if (playerA.destroyed) continue;

      const nearbyPlayers: ProximityInfo[] = [];
      const nearbyIds = new Set<string>();

      for (let j = 0; j < players.length; j++) {
        if (i === j) continue;

        const playerB = players[j];
        if (playerB.destroyed) continue;

        const distance = playerA.position.distanceTo(playerB.position);
        const inRange = distance <= this.proximityThreshold;

        if (inRange) {
          nearbyIds.add(playerB.id);
          nearbyPlayers.push({
            playerId: playerB.id,
            distance,
            inRange,
            interactionType: this.getAvailableInteractions(playerA, playerB, distance)
          });
        }

        // Emit proximity events
        this.checkProximityEvents(playerA, playerB, distance, inRange);
      }

      this.proximityInfo.set(playerA.id, nearbyPlayers);
      this.proximityChecks++;
    }
  }

  private getAvailableInteractions(playerA: Player, playerB: Player, distance: number): string[] {
    const interactions: string[] = [];

    if (distance <= 2) {
      interactions.push('chat', 'emote', 'trade');
    }
    if (distance <= 1) {
      interactions.push('follow', 'push');
    }

    return interactions;
  }

  private checkProximityEvents(playerA: Player, playerB: Player, distance: number, inRange: boolean): void {
    const previousNearby = this.proximityChecks.get(playerA.id) || new Set();
    const isNearby = previousNearby.has(playerB.id);

    if (!isNearby && inRange) {
      // Player entered proximity
      this.emit('playerEnterProximity', {
        player: playerA,
        target: playerB,
        distance
      });
    } else if (isNearby && !inRange) {
      // Player left proximity
      this.emit('playerLeaveProximity', {
        player: playerA,
        target: playerB,
        distance
      });
    }
  }

  // Network synchronization
  private updateNetworkSync(delta: number): void {
    if (!this.networkClient) return;

    this.lastNetworkUpdate += delta;
    if (this.lastNetworkUpdate < this.networkRate) return;

    // Sync local player
    if (this.localPlayer && this.localController) {
      const syncData = this.localPlayer.getNetworkData();
      if (Object.keys(syncData).length > 1) { // More than just id
        this.networkClient.send('playerUpdate', syncData);
        this.performance.networkUpdates++;
      }
    }

    this.lastNetworkUpdate = 0;
  }

  private updateRemotePlayer(data: PlayerSyncData): void {
    const player = this.players.get(data.id);
    if (!player || player.isLocal) return;

    player.modify(data);
  }

  // Player actions
  teleportPlayer(playerId: string, position: Vector3, rotation?: number): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.teleport({ position, rotation: rotation || 0 });

    // Sync to network if local player
    if (player.isLocal && this.networkClient) {
      this.networkClient.send('playerTeleport', { playerId, position, rotation });
    }
  }

  setPlayerEmote(playerId: string, emote: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    // Check if emote is allowed
    if (!this.config.allowedEmotes.includes(emote)) {
      console.warn(`Emote "${emote}" is not allowed`);
      return;
    }

    player.setEmote(emote);

    // Sync to network if local player
    if (player.isLocal && this.networkClient) {
      this.networkClient.send('playerEmote', { playerId, emote });
    }
  }

  pushPlayer(playerId: string, force: Vector3): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.push(force);

    // Sync to network if local player
    if (player.isLocal && this.networkClient) {
      this.networkClient.send('playerPush', { playerId, force });
    }
  }

  setPlayerHealth(playerId: string, health: number): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.setHealth(health);
  }

  setPlayerRank(playerId: string, rank: PlayerRank): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.setRank(rank);
  }

  // Player interactions
  interactWithPlayer(fromPlayerId: string, toPlayerId: string, type: string, data?: any): void {
    const fromPlayer = this.players.get(fromPlayerId);
    const toPlayer = this.players.get(toPlayerId);

    if (!fromPlayer || !toPlayer) return;

    const interaction: PlayerInteraction = {
      type: type as any,
      targetId: toPlayerId,
      data,
      timestamp: new Date()
    };

    this.emit('playerInteraction', {
      from: fromPlayer,
      to: toPlayer,
      interaction
    });

    // Handle specific interaction types
    switch (type) {
      case 'follow':
        this.handleFollowInteraction(fromPlayer, toPlayer);
        break;
      case 'trade':
        this.handleTradeInteraction(fromPlayer, toPlayer);
        break;
      case 'teleport':
        this.handleTeleportInteraction(fromPlayer, toPlayer);
        break;
    }
  }

  private handleFollowInteraction(fromPlayer: Player, toPlayer: Player): void {
    // Implementation for follow functionality
    console.log(`${fromPlayer.name} is now following ${toPlayer.name}`);
  }

  private handleTradeInteraction(fromPlayer: Player, toPlayer: Player): void {
    // Implementation for trade functionality
    console.log(`${fromPlayer.name} wants to trade with ${toPlayer.name}`);
  }

  private handleTeleportInteraction(fromPlayer: Player, toPlayer: Player): void {
    // Implementation for teleport to player functionality
    fromPlayer.teleport({ position: toPlayer.position.toArray() });
  }

  // Utility methods
  private generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getPlayersInRadius(center: Vector3, radius: number): Player[] {
    const centerVec = tempVector1.copy(center);
    return Array.from(this.players.values()).filter(player =>
      player.position.distanceTo(centerVec) <= radius
    );
  }

  getNearestPlayer(position: Vector3, excludePlayerId?: string): Player | null {
    const pos = tempVector1.copy(position);
    let nearestPlayer: Player | null = null;
    let nearestDistance = Infinity;

    for (const player of this.players.values()) {
      if (player.id === excludePlayerId) continue;

      const distance = player.position.distanceTo(pos);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPlayer = player;
      }
    }

    return nearestPlayer;
  }

  getProximityInfo(playerId: string): ProximityInfo[] {
    return this.proximityInfo.get(playerId) || [];
  }

  private updatePerformance(): void {
    this.performance.playerCount = this.players.size;
  }

  getPerformance(): typeof this.performance {
    return { ...this.performance };
  }

  // Configuration
  updateConfig(config: Partial<PlayerManagerConfig>): void {
    Object.assign(this.config, config);

    // Update existing controllers with new movement settings
    if (config.movementSettings) {
      for (const controller of this.controllers.values()) {
        Object.assign(controller.settings, config.movementSettings);
      }
    }
  }

  setProximityThreshold(threshold: number): void {
    this.proximityThreshold = threshold;
  }

  setNetworkRate(rate: number): void {
    this.networkRate = rate;
  }

  // Cleanup
  destroy(): void {
    // Remove all players
    for (const [playerId] of this.players) {
      this.removePlayer(playerId);
    }

    // Clear references
    this.players.clear();
    this.controllers.clear();
    this.inputHistory.clear();
    this.pendingMoves.clear();
    this.proximityChecks.clear();
    this.proximityInfo.clear();
    this.events.clear();

    this.localPlayer = undefined;
    this.localController = undefined;
    this.inputSystem = undefined;
    this.physicsSystem = undefined;
    this.networkClient = undefined;
  }

  // Properties
  get enabled(): boolean {
    return true; // Could be extended to support enable/disable
  }
}