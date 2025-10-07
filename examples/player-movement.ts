import { HyperfySDK } from '../src/sdk/hyperfy-sdk';
import { PlayerManager } from '../src/managers/player-manager';
import { InputSystem } from '../src/systems/input-system';
import { PhysicsSystem } from '../src/systems/physics-system';
import { PlayerMode, PlayerRank } from '../src/types';

/**
 * Comprehensive Player Movement Example
 *
 * This example demonstrates all player movement and interaction features:
 * - Basic movement (walk, run, jump, fly)
 * - Input handling (keyboard, mouse, gamepad, touch)
 * - Physics simulation (gravity, collision, forces)
 * - Multiplayer synchronization
 * - Proximity interactions
 * - VR/AR support
 * - Emotes and animations
 * - Camera controls
 */

export class PlayerMovementExample {
  private sdk: HyperfySDK;
  private playerManager?: PlayerManager;
  private inputSystem?: InputSystem;
  private physicsSystem?: PhysicsSystem;
  private localPlayer?: any;
  private stats: {
    movementDistance: number;
    jumpCount: number;
    timeActive: number;
    lastPosition: any;
  };

  constructor() {
    this.sdk = new HyperfySDK({
      apiUrl: 'https://api.hyperfy.com',
      wsUrl: 'wss://ws.hyperfy.com',
      logLevel: 'info'
    });

    this.stats = {
      movementDistance: 0,
      jumpCount: 0,
      timeActive: 0,
      lastPosition: null
    };
  }

  async initialize(): Promise<void> {
    console.log('🎮 Initializing Player Movement Example...');

    try {
      // Connect to Hyperfy world
      await this.sdk.connect();
      console.log('✅ Connected to Hyperfy world');

      // Initialize systems
      await this.initializeSystems();

      // Setup local player
      await this.setupLocalPlayer();

      // Setup event listeners
      this.setupEventListeners();

      // Setup UI controls
      this.setupUIControls();

      // Start update loop
      this.startUpdateLoop();

      console.log('🚀 Player Movement Example initialized successfully!');

    } catch (error) {
      console.error('❌ Failed to initialize:', error);
      throw error;
    }
  }

  private async initializeSystems(): Promise<void> {
    // Create DOM element for input system
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.background = 'linear-gradient(to bottom, #87CEEB, #98FB98)';
    document.body.appendChild(canvas);

    // Initialize input system
    this.inputSystem = new InputSystem(canvas);
    console.log('🎯 Input system initialized');

    // Initialize physics system
    this.physicsSystem = new PhysicsSystem();

    // Add ground physics
    this.physicsSystem.addBody({
      id: 'ground',
      position: { x: 0, y: 0, z: 0 },
      size: { x: 100, y: 1, z: 100 },
      layer: this.physicsSystem.layers.STATIC,
      shape: 'box',
      isKinematic: true
    });

    // Add some platforms
    this.addPhysicsPlatforms();
    console.log('⚛️ Physics system initialized');

    // Initialize player manager
    this.playerManager = new PlayerManager({
      maxPlayers: 20,
      spawnPoints: [
        { x: 0, y: 2, z: 0 },
        { x: 5, y: 2, z: 0 },
        { x: -5, y: 2, z: 0 },
        { x: 0, y: 2, z: 5 },
        { x: 0, y: 2, z: -5 },
        { x: 10, y: 5, z: 0 },
        { x: -10, y: 5, z: 0 }
      ],
      movementSettings: {
        walkSpeed: 3,
        runSpeed: 6,
        jumpHeight: 1.5,
        flySpeed: 15,
        gravity: 20,
        mass: 1,
        friction: 0.1,
        airControl: 0.3,
        groundCheckDistance: 0.2,
        maxSlopeAngle: 60,
        capsuleRadius: 0.3,
        capsuleHeight: 1.6
      },
      voiceChatEnabled: true,
      textChatEnabled: true
    });

    // Connect systems
    this.playerManager.initialize(
      this.inputSystem,
      this.physicsSystem,
      this.sdk.network
    );

    console.log('👥 Player manager initialized');
  }

  private addPhysicsPlatforms(): void {
    if (!this.physicsSystem) return;

    // Add floating platforms
    const platforms = [
      { pos: { x: 10, y: 3, z: 0 }, size: { x: 4, y: 0.5, z: 4 } },
      { pos: { x: -10, y: 3, z: 0 }, size: { x: 4, y: 0.5, z: 4 } },
      { pos: { x: 0, y: 5, z: 10 }, size: { x: 6, y: 0.5, z: 4 } },
      { pos: { x: 0, y: 7, z: -10 }, size: { x: 4, y: 0.5, z: 6 } },
      { pos: { x: 15, y: 8, z: 15 }, size: { x: 5, y: 0.5, z: 5 } },
      { pos: { x: -15, y: 8, z: -15 }, size: { x: 5, y: 0.5, z: 5 } }
    ];

    platforms.forEach((platform, index) => {
      this.physicsSystem!.addBody({
        id: `platform_${index}`,
        position: platform.pos,
        size: platform.size,
        layer: this.physicsSystem!.layers.STATIC,
        shape: 'box',
        isKinematic: true
      });
    });

    // Add moving platforms
    this.addMovingPlatforms();
  }

  private addMovingPlatforms(): void {
    if (!this.physicsSystem) return;

    // Create a moving platform that will demonstrate physics interactions
    const movingPlatform = this.physicsSystem.addBody({
      id: 'moving_platform',
      position: { x: 0, y: 3, z: 20 },
      size: { x: 4, y: 0.5, z: 4 },
      layer: this.physicsSystem.layers.DYNAMIC,
      shape: 'box',
      isKinematic: false,
      mass: 10
    });

    // Animate the moving platform
    let time = 0;
    const animatePlatform = () => {
      if (!this.physicsSystem) return;

      time += 0.016; // ~60 FPS
      const body = this.physicsSystem.getBody('moving_platform');
      if (body) {
        body.position.x = Math.sin(time) * 5;
        body.position.z = 20 + Math.cos(time * 0.5) * 3;
        body.position.y = 3 + Math.sin(time * 2) * 0.5;
      }
      requestAnimationFrame(animatePlatform);
    };
    animatePlatform();
  }

  private async setupLocalPlayer(): Promise<void> {
    if (!this.playerManager) return;

    // Create local player
    this.localPlayer = this.playerManager.addLocalPlayer({
      name: 'Demo Player',
      avatar: 'asset://avatar.vrm',
      rank: PlayerRank.MEMBER
    });

    console.log('🎭 Local player created:', this.localPlayer.name);

    // Setup player event listeners
    this.setupPlayerEvents();
  }

  private setupPlayerEvents(): void {
    if (!this.localPlayer) return;

    // Movement events
    this.localPlayer.on('move', (data: any) => {
      // Track movement distance
      if (this.stats.lastPosition) {
        const distance = this.stats.lastPosition.distanceTo(data.position);
        this.stats.movementDistance += distance;
      }
      this.stats.lastPosition = data.position.clone();
    });

    // Jump events
    this.localPlayer.on('jump', (data: any) => {
      this.stats.jumpCount++;
      this.showFloatingText('Jump! 🦘', this.localPlayer.position);
    });

    // Land events
    this.localPlayer.on('land', (data: any) => {
      if (data.fallDistance > 2) {
        this.showFloatingText(`Ouch! Fall: ${data.fallDistance.toFixed(1)}m`, this.localPlayer.position);
      }
    });

    // Teleport events
    this.localPlayer.on('teleport', (data: any) => {
      this.showFloatingText('✨ Teleported!', data.position);
    });

    // Emote events
    this.localPlayer.on('emote', (data: any) => {
      this.showFloatingText(`${data.emote} ${this.getEmoteEmoji(data.emote)}`, this.localPlayer.position);
    });

    // Health events
    this.localPlayer.on('health', (data: any) => {
      if (data.change < 0) {
        this.showFloatingText(`-${Math.abs(data.change)} HP`, this.localPlayer.position, 'red');
      } else {
        this.showFloatingText(`+${data.change} HP`, this.localPlayer.position, 'green');
      }
    });
  }

  private setupEventListeners(): void {
    if (!this.playerManager) return;

    // Player join/leave events
    this.playerManager.on('remotePlayerAdded', (data: any) => {
      console.log('👋 Remote player joined:', data.player.name);
      this.showNotification(`${data.player.name} joined the world`);
    });

    this.playerManager.on('playerRemoved', (data: any) => {
      console.log('👋 Player left:', data.player.name);
      this.showNotification(`${data.player.name} left the world`);
    });

    // Proximity events
    this.playerManager.on('playerEnterProximity', (data: any) => {
      this.showNotification(`${data.player.name} is nearby`);
    });

    this.playerManager.on('playerLeaveProximity', (data: any) => {
      this.showNotification(`${data.target.name} is no longer nearby`);
    });

    // Player interaction events
    this.playerManager.on('playerInteraction', (data: any) => {
      console.log('🤝 Player interaction:', data.interaction.type, 'from', data.from.name, 'to', data.to.name);
    });

    // Input system events
    if (this.inputSystem) {
      this.inputSystem.on('keyPress', (data: any) => {
        this.handleKeyPress(data.key);
      });

      this.inputSystem.on('mouseDown', (data: any) => {
        this.handleMousePress(data.button);
      });

      this.inputSystem.on('gamepadConnected', (data: any) => {
        this.showNotification('🎮 Gamepad connected!');
      });
    }

    // Physics system events
    if (this.physicsSystem) {
      this.physicsSystem.on('collision', (data: any) => {
        this.handlePhysicsCollision(data);
      });
    }

    // Window resize
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private handleKeyPress(key: string): void {
    switch (key) {
      case 'keyR':
        this.respawnPlayer();
        break;
      case 'keyF':
        this.toggleFlying();
        break;
      case 'keyT':
        this.openChat();
        break;
      case 'keyE':
        this.interactWithNearbyPlayer();
        break;
      case 'keyH':
        this.toggleHelp();
        break;
      case 'digit1':
        this.playEmote('wave');
        break;
      case 'digit2':
        this.playEmote('dance');
        break;
      case 'digit3':
        this.playEmote('point');
        break;
      case 'digit4':
        this.playEmote('thumbsup');
        break;
      case 'digit5':
        this.playEmote('laugh');
        break;
      case 'escape':
        this.exitPointerLock();
        break;
    }
  }

  private handleMousePress(button: string): void {
    if (button === 'left') {
      this.requestPointerLock();
    } else if (button === 'right') {
      this.pushNearbyPlayer();
    }
  }

  private handlePhysicsCollision(data: any): void {
    // Handle player collisions with physics objects
    if (data.bodyA.id?.startsWith('player_') || data.bodyB.id?.startsWith('player_')) {
      const playerId = data.bodyA.id?.startsWith('player_')
        ? data.bodyA.id.replace('player_', '')
        : data.bodyB.id.replace('player_', '');

      const player = this.playerManager?.getPlayer(playerId);
      if (player) {
        // Add collision effect
        this.showFloatingText('💥', player.position, 'yellow');
      }
    }
  }

  private handleResize(): void {
    const canvas = this.inputSystem?.element;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }

  private setupUIControls(): void {
    // Create control panel
    const controlPanel = document.createElement('div');
    controlPanel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px;
      border-radius: 10px;
      font-family: Arial, sans-serif;
      z-index: 1000;
      min-width: 250px;
    `;

    controlPanel.innerHTML = `
      <h3 style="margin-top: 0;">🎮 Player Controls</h3>
      <div style="margin-bottom: 15px;">
        <strong>Movement:</strong><br>
        WASD/Arrows - Move<br>
        Shift - Run<br>
        Space - Jump<br>
        F - Toggle Flying<br>
        Mouse - Look Around
      </div>
      <div style="margin-bottom: 15px;">
        <strong>Emotes:</strong><br>
        1 - Wave 👋<br>
        2 - Dance 💃<br>
        3 - Point 👉<br>
        4 - Thumbs Up 👍<br>
        5 - Laugh 😂
      </div>
      <div style="margin-bottom: 15px;">
        <strong>Other:</strong><br>
        R - Respawn<br>
        T - Chat<br>
        E - Interact<br>
        H - Toggle Help<br>
        Right Click - Push Player
      </div>
      <div style="margin-bottom: 15px;">
        <strong>Stats:</strong><br>
        <div id="stats-display">
          Distance: 0m<br>
          Jumps: 0<br>
          Time: 0s
        </div>
      </div>
      <div>
        <button id="help-toggle" style="background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
          Show Help
        </button>
      </div>
    `;

    document.body.appendChild(controlPanel);

    // Add help modal (hidden by default)
    this.addHelpModal();

    // Setup button handlers
    document.getElementById('help-toggle')?.addEventListener('click', () => {
      this.toggleHelp();
    });

    console.log('🎨 UI controls created');
  }

  private addHelpModal(): void {
    const helpModal = document.createElement('div');
    helpModal.id = 'help-modal';
    helpModal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      color: white;
      padding: 30px;
      border-radius: 15px;
      font-family: Arial, sans-serif;
      z-index: 2000;
      display: none;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
    `;

    helpModal.innerHTML = `
      <h2 style="margin-top: 0;">🎮 Player Movement Guide</h2>

      <h3>Basic Movement</h3>
      <p><strong>WASD/Arrow Keys:</strong> Move in four directions</p>
      <p><strong>Shift:</strong> Hold to run (faster movement)</p>
      <p><strong>Space:</strong> Jump (double jump in build mode to fly)</p>
      <p><strong>F:</strong> Toggle flying mode</p>

      <h3>Camera Controls</h3>
      <p><strong>Mouse:</strong> Look around when pointer is locked</p>
      <p><strong>Left Click:</strong> Request pointer lock for mouse control</p>
      <p><strong>Mouse Wheel:</strong> Zoom in/out</p>
      <p><strong>Escape:</strong> Exit pointer lock</p>

      <h3>Social Features</h3>
      <p><strong>T:</strong> Open chat</p>
      <p><strong>E:</strong> Interact with nearby player</p>
      <p><strong>Right Click:</strong> Push nearby player</p>
      <p><strong>Number Keys 1-5:</strong> Quick emotes</p>

      <h3>Advanced Features</h3>
      <p><strong>R:</strong> Respawn at spawn point</p>
      <p><strong>Gamepad:</strong> Full controller support when connected</p>
      <p><strong>Touch:</strong> On-screen controls for mobile devices</p>

      <h3>Physics</h3>
      <p>The world includes:</p>
      <ul>
        <li>Gravity and ground detection</li>
        <li>Slope climbing limits</li>
        <li>Platform interaction</li>
        <li>Collision detection</li>
        <li>Momentum and inertia</li>
      </ul>

      <button id="close-help" style="background: #f44336; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 20px;">
        Close Help
      </button>
    `;

    document.body.appendChild(helpModal);

    // Close button handler
    document.getElementById('close-help')?.addEventListener('click', () => {
      helpModal.style.display = 'none';
    });
  }

  private startUpdateLoop(): void {
    const update = (timestamp: number) => {
      // Update stats
      this.stats.timeActive += 0.016; // ~60 FPS

      // Update systems
      this.inputSystem?.update(0.016);
      this.physicsSystem?.update(0.016);
      this.playerManager?.update(0.016);

      // Update stats display
      this.updateStatsDisplay();

      // Continue loop
      requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
    console.log('🔄 Update loop started');
  }

  private updateStatsDisplay(): void {
    const statsDisplay = document.getElementById('stats-display');
    if (statsDisplay) {
      statsDisplay.innerHTML = `
        Distance: ${this.stats.movementDistance.toFixed(1)}m<br>
        Jumps: ${this.stats.jumpCount}<br>
        Time: ${Math.floor(this.stats.timeActive)}s
      `;
    }
  }

  // Action methods
  private requestPointerLock(): void {
    this.inputSystem?.requestPointerLock();
    this.showNotification('🖱️ Click to control camera');
  }

  private exitPointerLock(): void {
    this.inputSystem?.exitPointerLock();
  }

  private toggleFlying(): void {
    if (this.localPlayer && this.playerManager) {
      const controller = this.playerManager.controllers.get(this.localPlayer.id);
      if (controller) {
        controller.toggleFlying();
        const flying = controller.player.flying;
        this.showNotification(flying ? '✈️ Flying mode ON' : '🚶 Flying mode OFF');
      }
    }
  }

  private respawnPlayer(): void {
    if (this.localPlayer && this.playerManager) {
      this.playerManager.teleportPlayer(this.localPlayer.id, { x: 0, y: 2, z: 0 });
      this.localPlayer.setHealth(100);
      this.showNotification('🔄 Respawned!');
    }
  }

  private playEmote(emote: string): void {
    if (this.localPlayer && this.playerManager) {
      this.playerManager.setPlayerEmote(this.localPlayer.id, emote);
    }
  }

  private interactWithNearbyPlayer(): void {
    if (!this.localPlayer || !this.playerManager) return;

    const nearbyPlayer = this.playerManager.getNearestPlayer(
      this.localPlayer.position.toArray(),
      this.localPlayer.id
    );

    if (nearbyPlayer && this.localPlayer.position.distanceTo(nearbyPlayer.position) < 3) {
      this.playerManager.interactWithPlayer(
        this.localPlayer.id,
        nearbyPlayer.id,
        'emote',
        { emote: 'wave' }
      );
      this.showNotification(`🤝 Waved at ${nearbyPlayer.name}`);
    } else {
      this.showNotification('❌ No nearby players to interact with');
    }
  }

  private pushNearbyPlayer(): void {
    if (!this.localPlayer || !this.playerManager) return;

    const nearbyPlayer = this.playerManager.getNearestPlayer(
      this.localPlayer.position.toArray(),
      this.localPlayer.id
    );

    if (nearbyPlayer && this.localPlayer.position.distanceTo(nearbyPlayer.position) < 2) {
      // Calculate push force
      const pushDirection = nearbyPlayer.position.clone().sub(this.localPlayer.position).normalize();
      const pushForce = pushDirection.multiplyScalar(10);

      this.playerManager.pushPlayer(nearbyPlayer.id, pushForce.toArray());
      this.showNotification(`💨 Pushed ${nearbyPlayer.name}!`);
    } else {
      this.showNotification('❌ No nearby players to push');
    }
  }

  private openChat(): void {
    // This would open a chat interface
    this.showNotification('💬 Chat feature coming soon!');
  }

  private toggleHelp(): void {
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
      const isVisible = helpModal.style.display !== 'none';
      helpModal.style.display = isVisible ? 'none' : 'block';

      const helpButton = document.getElementById('help-toggle') as HTMLButtonElement;
      if (helpButton) {
        helpButton.textContent = isVisible ? 'Show Help' : 'Hide Help';
      }
    }
  }

  // UI helpers
  private showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${this.getNotificationColor(type)};
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      z-index: 3000;
      animation: slideDown 0.3s ease-out;
    `;
    notification.textContent = message;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from { transform: translate(-50%, -100px); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideDown 0.3s ease-out reverse';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  private showFloatingText(text: string, position: any, color: string = 'white'): void {
    const floatingText = document.createElement('div');
    floatingText.style.cssText = `
      position: fixed;
      color: ${color};
      font-size: 18px;
      font-weight: bold;
      font-family: Arial, sans-serif;
      z-index: 1500;
      pointer-events: none;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      animation: floatUp 2s ease-out forwards;
    `;
    floatingText.textContent = text;

    // Convert world position to screen position (simplified)
    const screenX = window.innerWidth / 2 + position.x * 10;
    const screenY = window.innerHeight / 2 - position.y * 10;

    floatingText.style.left = `${screenX}px`;
    floatingText.style.top = `${screenY}px`;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes floatUp {
        0% { transform: translateY(0px); opacity: 1; }
        100% { transform: translateY(-50px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(floatingText);

    // Auto-remove after animation
    setTimeout(() => {
      if (document.body.contains(floatingText)) {
        document.body.removeChild(floatingText);
      }
    }, 2000);
  }

  private getNotificationColor(type: string): string {
    switch (type) {
      case 'success': return '#4CAF50';
      case 'warning': return '#FF9800';
      case 'error': return '#f44336';
      default: return '#2196F3';
    }
  }

  private getEmoteEmoji(emote: string): string {
    const emotes: Record<string, string> = {
      wave: '👋',
      dance: '💃',
      point: '👉',
      thumbsup: '👍',
      clap: '👏',
      laugh: '😂',
      cry: '😢',
      angry: '😠',
      think: '🤔',
      sleep: '😴',
      sit: '🪑',
      stand: '🧍',
      walk: '🚶',
      run: '🏃',
      jump: '🦘',
      idle: '😌'
    };
    return emotes[emote] || '🎭';
  }

  // Cleanup
  async destroy(): Promise<void> {
    console.log('🧹 Cleaning up Player Movement Example...');

    try {
      // Disconnect from world
      await this.sdk.disconnect();

      // Cleanup systems
      this.playerManager?.destroy();
      this.inputSystem?.destroy();
      this.physicsSystem?.destroy();

      // Remove UI elements
      const elements = document.querySelectorAll('[style*="position: fixed"]');
      elements.forEach(el => el.remove());

      console.log('✅ Cleanup completed');

    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
}

// Export the example class
export default PlayerMovementExample;

// Auto-initialize if this file is loaded directly
if (typeof window !== 'undefined' && window.location.pathname.includes('player-movement')) {
  const example = new PlayerMovementExample();

  // Initialize on page load
  window.addEventListener('load', async () => {
    try {
      await example.initialize();
    } catch (error) {
      console.error('Failed to initialize example:', error);
    }
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', async () => {
    await example.destroy();
  });
}