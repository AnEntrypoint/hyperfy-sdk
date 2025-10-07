import * as THREE from 'three';
import {
  PlayerData,
  PlayerState,
  PlayerMode,
  PlayerRank,
  PlayerAvatar,
  PlayerEffect,
  Vector3,
  EventEmitter,
  PlayerEvents
} from '../types';

// Utility vectors for calculations
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const FORWARD = new THREE.Vector3(0, 0, -1);
const BACKWARD = new THREE.Vector3(0, 0, 1);
const RIGHT = new THREE.Vector3(1, 0, 0);
const LEFT = new THREE.Vector3(-1, 0, 0);

const tempVector1 = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempQuaternion1 = new THREE.Quaternion();
const tempQuaternion2 = new THREE.Quaternion();
const tempEuler1 = new THREE.Euler(0, 0, 0, 'YXZ');
const tempMatrix4 = new THREE.Matrix4();

// Constants
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const DEFAULT_AVATAR_HEIGHT = 1.7;
const DEFAULT_CAM_HEIGHT = 1.2;
const DEFAULT_HEALTH = 100;
const NETWORK_UPDATE_RATE = 0.1; // 10 times per second

export class Player implements EventEmitter {
  public id: string;
  public name: string;
  public isLocal: boolean;
  public isPlayer: boolean;
  public isRemote: boolean;

  // Core properties
  public position: THREE.Vector3;
  public quaternion: THREE.Quaternion;
  public scale: THREE.Vector3;
  public velocity: THREE.Vector3;
  public angularVelocity: THREE.Vector3;

  // State
  public state: PlayerState;
  public data: PlayerData;
  public avatar?: PlayerAvatar;
  public effect?: PlayerEffect | null;

  // Movement
  public moveDir: THREE.Vector3;
  public axis: THREE.Vector3;
  public gaze: THREE.Vector3;
  public mode: PlayerMode;
  public grounded: boolean;
  public flying: boolean;
  public running: boolean;
  public jumpPressed: boolean;
  public jumpDown: boolean;
  public justLeftGround: boolean;
  public jumping: boolean;
  public falling: boolean;
  public airJumping: boolean;
  public airJumped: boolean;

  // Physics properties
  public mass: number;
  public gravity: number;
  public effectiveGravity: number;
  public jumpHeight: number;
  public capsuleRadius: number;
  public capsuleHeight: number;
  public friction: number;
  public groundNormal: THREE.Vector3;
  public groundAngle: number;
  public fallTimer: number;
  public fallDistance: number;
  public fallStartY: number;

  // Camera
  public camera: {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    rotation: THREE.Euler;
    zoom: number;
    height: number;
    firstPerson: boolean;
  };

  // Interaction
  public speaking: boolean;
  public muted: boolean;
  public emote?: string;
  public health: number;
  public rank: number;

  // Network
  public lastSendAt: number;
  public lastState?: Partial<PlayerState>;
  public teleportCount: number;

  // Event handling
  private events: Map<string, Function[]> = new Map();
  private destroyed: boolean = false;

  constructor(id: string, name: string, isLocal: boolean = false, data?: Partial<PlayerData>) {
    this.id = id;
    this.name = name;
    this.isLocal = isLocal;
    this.isPlayer = true;
    this.isRemote = !isLocal;

    // Initialize vectors
    this.position = new THREE.Vector3(0, DEFAULT_AVATAR_HEIGHT, 0);
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3(1, 1, 1);
    this.velocity = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3();
    this.moveDir = new THREE.Vector3();
    this.axis = new THREE.Vector3();
    this.gaze = new THREE.Vector3(0, 0, -1);
    this.groundNormal = UP.clone();

    // Initialize state
    this.mode = PlayerMode.IDLE;
    this.grounded = false;
    this.flying = false;
    this.running = false;
    this.jumpPressed = false;
    this.jumpDown = false;
    this.justLeftGround = false;
    this.jumping = false;
    this.falling = false;
    this.airJumping = false;
    this.airJumped = false;
    this.speaking = false;
    this.muted = false;

    // Physics properties
    this.mass = 1;
    this.gravity = 20;
    this.effectiveGravity = this.gravity * this.mass;
    this.jumpHeight = 1.5;
    this.capsuleRadius = 0.3;
    this.capsuleHeight = 1.6;
    this.friction = 0;
    this.groundAngle = 0;
    this.fallTimer = 0;
    this.fallDistance = 0;
    this.fallStartY = 0;

    // Camera
    this.camera = {
      position: new THREE.Vector3(0, DEFAULT_CAM_HEIGHT, 0),
      quaternion: new THREE.Quaternion(),
      rotation: new THREE.Euler(0, 0, 0, 'YXZ'),
      zoom: 1.5,
      height: DEFAULT_CAM_HEIGHT,
      firstPerson: false
    };

    // Stats
    this.health = DEFAULT_HEALTH;
    this.rank = PlayerRank.MEMBER;

    // Network
    this.lastSendAt = 0;
    this.teleportCount = 0;

    // Initialize data
    this.data = {
      id,
      name,
      position: this.position.toArray(),
      quaternion: this.quaternion.toArray(),
      scale: this.scale.toArray(),
      health: this.health,
      mode: this.mode,
      axis: this.axis,
      gaze: this.gaze,
      rank: this.rank,
      ...data
    };

    // Initialize state
    this.state = {
      id,
      position: this.position.clone(),
      quaternion: new THREE.Vector3().setFromQuaternion(this.quaternion),
      velocity: this.velocity.clone(),
      mode: this.mode,
      axis: this.axis.clone(),
      gaze: this.gaze.clone(),
      health: this.health,
      grounded: this.grounded,
      flying: this.flying,
      running: this.running,
      speaking: this.speaking,
      firstPerson: this.camera.firstPerson,
      rank: this.rank
    };

    // Update camera to match position
    this.updateCameraPosition();

    // Set initial gaze direction
    tempVector1.copy(FORWARD).applyQuaternion(this.quaternion);
    this.gaze.copy(tempVector1);
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
          console.error(`Error in player event listener for ${event}:`, error);
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

  // Movement methods
  setPosition(position: Vector3 | THREE.Vector3): void {
    const oldPosition = this.position.clone();
    this.position.copy(position);
    this.updateCameraPosition();
    this.emit('move', { position: this.position.clone(), velocity: this.velocity });
  }

  setRotation(quaternion: THREE.Quaternion | number[]): void {
    const oldQuaternion = this.quaternion.clone();
    if (Array.isArray(quaternion)) {
      this.quaternion.fromArray(quaternion);
    } else {
      this.quaternion.copy(quaternion);
    }
    this.updateCameraPosition();
    this.emit('rotate', {
      rotation: tempEuler1.setFromQuaternion(this.quaternion),
      quaternion: this.quaternion
    });
  }

  setRotationY(angle: number): void {
    tempEuler1.set(0, angle, 0);
    this.quaternion.setFromEuler(tempEuler1);
    this.updateCameraPosition();
    this.emit('rotate', {
      rotation: tempEuler1,
      quaternion: this.quaternion
    });
  }

  teleport(options: { position: Vector3; rotation?: number }): void {
    const { position, rotation } = options;
    this.setPosition(position);
    if (rotation !== undefined) {
      this.setRotationY(rotation);
    }
    this.teleportCount++;
    this.emit('teleport', { position: this.position.clone(), rotation });
  }

  push(force: Vector3 | THREE.Vector3): void {
    if (Array.isArray(force)) {
      this.velocity.fromArray(force);
    } else {
      this.velocity.add(force);
    }
    this.emit('push', { force: this.velocity.clone() });
  }

  jump(): void {
    if (this.grounded && !this.jumping && !this.effect?.snare && !this.effect?.freeze) {
      const jumpVelocity = Math.sqrt(2 * this.effectiveGravity * this.jumpHeight);
      this.velocity.y = jumpVelocity;
      this.jumped = true;
      this.emit('jump', { height: this.jumpHeight, velocity: this.velocity.clone() });
    }
  }

  toggleFlying(force?: boolean): void {
    const newValue = force !== undefined ? force : !this.flying;
    if (this.flying === newValue) return;

    this.flying = newValue;
    if (this.flying) {
      // Zero out vertical velocity when entering fly mode
      this.velocity.y = 0;
      this.mode = PlayerMode.FLY;
    } else {
      // Return to appropriate mode when exiting fly mode
      this.mode = this.grounded ? PlayerMode.IDLE : PlayerMode.FALL;
    }
    this.lastSendAt = -999; // Force immediate network update
    this.emit('state', { mode: this.mode, grounded: this.grounded, flying: this.flying });
  }

  // Avatar management
  setAvatar(avatarUrl: string): void {
    this.data.avatar = avatarUrl;
    this.applyAvatar();
  }

  setSessionAvatar(avatarUrl: string): void {
    this.data.sessionAvatar = avatarUrl;
    this.applyAvatar();
  }

  private applyAvatar(): void {
    const avatarUrl = this.data.sessionAvatar || this.data.avatar || 'asset://avatar.vrm';
    if (this.avatar?.url === avatarUrl) return;

    // In a real implementation, this would load the actual avatar model
    this.avatar = {
      url: avatarUrl,
      height: DEFAULT_AVATAR_HEIGHT,
      headToHeight: DEFAULT_CAM_HEIGHT,
      visible: !this.camera.firstPerson
    };

    this.camera.height = this.avatar.height * 0.9;
    this.updateCameraPosition();
  }

  // Health and rank management
  setHealth(health: number): void {
    const change = health - this.health;
    this.health = Math.max(0, Math.min(100, health));
    this.data.health = this.health;
    this.emit('health', { playerId: this.id, health: this.health, change });
  }

  setRank(rank: PlayerRank): void {
    this.rank = rank;
    this.data.rank = rank;
    this.emit('rank', { playerId: this.id, rank });
  }

  // Interaction methods
  setSpeaking(speaking: boolean): void {
    if (this.speaking === speaking) return;
    if (speaking && this.muted) return;

    this.speaking = speaking;
    if (this.speaking && !this.moving && !this.falling) {
      this.mode = PlayerMode.TALK;
    } else if (!this.speaking && this.mode === PlayerMode.TALK) {
      this.mode = PlayerMode.IDLE;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted && this.speaking) {
      this.setSpeaking(false);
    }
  }

  setEmote(emote: string): void {
    this.emote = emote;
    this.data.emote = emote;
    this.emit('emote', { playerId: this.id, emote, duration: 5000 });
  }

  chat(message: string): void {
    this.emit('chat', {
      playerId: this.id,
      message,
      timestamp: new Date()
    });
  }

  // State updates from network
  modify(data: Partial<PlayerData>): void {
    let positionChanged = false;
    let rotationChanged = false;
    let modeChanged = false;
    let avatarChanged = false;

    if (data.p) {
      this.data.position = data.p;
      this.position.fromArray(data.p);
      positionChanged = true;
    }

    if (data.q) {
      this.data.quaternion = data.q;
      this.quaternion.fromArray(data.q);
      rotationChanged = true;
    }

    if (data.m !== undefined) {
      this.data.mode = data.m;
      this.mode = data.m;
      modeChanged = true;
    }

    if (data.a) {
      this.data.axis = data.a;
      this.axis.fromArray(data.a);
    }

    if (data.g) {
      this.data.gaze = data.g;
      this.gaze.fromArray(data.g);
    }

    if (data.e !== undefined) {
      this.data.emote = data.e;
      this.emote = data.e;
    }

    if (data.name !== undefined) {
      this.data.name = data.name;
      this.name = data.name;
    }

    if (data.health !== undefined) {
      this.data.health = data.health;
      this.health = data.health;
    }

    if (data.avatar !== undefined) {
      this.data.avatar = data.avatar;
      avatarChanged = true;
    }

    if (data.sessionAvatar !== undefined) {
      this.data.sessionAvatar = data.sessionAvatar;
      avatarChanged = true;
    }

    if (data.rank !== undefined) {
      this.data.rank = data.rank;
      this.rank = data.rank;
    }

    if (data.ef !== undefined) {
      this.effect = data.ef;
    }

    if (positionChanged || rotationChanged) {
      this.updateCameraPosition();
    }

    if (avatarChanged) {
      this.applyAvatar();
    }

    // Emit events for significant changes
    if (positionChanged) {
      this.emit('move', { position: this.position.clone(), velocity: this.velocity });
    }

    if (rotationChanged) {
      this.emit('rotate', {
        rotation: tempEuler1.setFromQuaternion(this.quaternion),
        quaternion: this.quaternion
      });
    }

    if (modeChanged) {
      this.emit('state', { mode: this.mode, grounded: this.grounded, flying: this.flying });
    }
  }

  // Utility methods
  updateCameraPosition(): void {
    this.camera.position.copy(this.position);
    this.camera.position.y += this.camera.height;

    // In third person, position camera over shoulder
    if (!this.camera.firstPerson) {
      tempVector1.copy(FORWARD).applyQuaternion(this.camera.quaternion);
      tempVector2.crossVectors(tempVector1, UP).normalize();
      this.camera.position.add(tempVector2.multiplyScalar(0.3));
    }

    // Set camera rotation to match player
    this.camera.quaternion.copy(this.quaternion);
    tempEuler1.setFromQuaternion(this.camera.quaternion);
    this.camera.rotation.copy(tempEuler1);
  }

  getGroundNormal(): THREE.Vector3 {
    return this.groundNormal.clone();
  }

  getMoveSpeed(): number {
    if (this.flying) {
      return this.running ? 20 : 10;
    }
    return this.running ? 6 : 3;
  }

  hasRank(rank: PlayerRank): boolean {
    return this.rank >= rank;
  }

  outranks(otherPlayer: Player): boolean {
    return this.rank > otherPlayer.rank;
  }

  isAdmin(): boolean {
    return this.hasRank(PlayerRank.ADMIN);
  }

  isBuilder(): boolean {
    return this.hasRank(PlayerRank.BUILDER);
  }

  // State synchronization
  needsNetworkUpdate(delta: number): boolean {
    this.lastSendAt += delta;
    if (this.lastSendAt < NETWORK_UPDATE_RATE) return false;

    if (!this.lastState) {
      this.lastState = {
        position: this.position.clone(),
        quaternion: this.quaternion.clone(),
        mode: this.mode,
        axis: this.axis.clone(),
        gaze: this.gaze.clone(),
        emote: this.emote
      };
      return true;
    }

    // Check for significant changes
    if (!this.lastState.position.equals(this.position)) return true;
    if (!this.lastState.quaternion.equals(this.quaternion)) return true;
    if (this.lastState.mode !== this.mode) return true;
    if (!this.lastState.axis.equals(this.axis)) return true;
    if (!this.lastState.gaze.equals(this.gaze)) return true;
    if (this.lastState.emote !== this.emote) return true;

    return false;
  }

  getNetworkData(): any {
    this.lastSendAt = 0;

    const data: any = { id: this.id };

    if (!this.lastState!.position.equals(this.position)) {
      data.p = this.position.toArray();
      this.lastState!.position.copy(this.position);
    }

    if (!this.lastState!.quaternion.equals(this.quaternion)) {
      data.q = this.quaternion.toArray();
      this.lastState!.quaternion.copy(this.quaternion);
    }

    if (this.lastState!.mode !== this.mode) {
      data.m = this.mode;
      this.lastState!.mode = this.mode;
    }

    if (!this.lastState!.axis.equals(this.axis)) {
      data.a = this.axis.toArray();
      this.lastState!.axis.copy(this.axis);
    }

    if (!this.lastState!.gaze.equals(this.gaze)) {
      data.g = this.gaze.toArray();
      this.lastState!.gaze.copy(this.gaze);
    }

    if (this.lastState!.emote !== this.emote) {
      data.e = this.emote;
      this.lastState!.emote = this.emote;
    }

    return data;
  }

  // Cleanup
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    // Clear event listeners
    this.events.clear();

    // Emit destroy event
    this.emit('destroy', { playerId: this.id });
  }
}