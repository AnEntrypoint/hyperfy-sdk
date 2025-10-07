import * as THREE from 'three';
import { Player } from './player';
import {
  PlayerMode,
  PlayerInput,
  MovementSettings,
  PhysicsProperties,
  CollisionInfo,
  RaycastHit,
  Vector3,
  XRState
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
const tempVector3 = new THREE.Vector3();
const tempVector4 = new THREE.Vector3();
const tempQuaternion1 = new THREE.Quaternion();
const tempQuaternion2 = new THREE.Quaternion();
const tempEuler1 = new THREE.Euler(0, 0, 0, 'YXZ');
const tempMatrix4 = new THREE.Matrix4();

// Constants
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const POINTER_LOOK_SPEED = 0.1;
const PAN_LOOK_SPEED = 0.4;
const ZOOM_SPEED = 2;
const MIN_ZOOM = 0;
const MAX_ZOOM = 8;
const STICK_OUTER_RADIUS = 50;
const STICK_INNER_RADIUS = 25;
const GAZE_TILT_ANGLE = 10 * DEG2RAD;
const MAX_SLOPE_ANGLE = 60 * DEG2RAD;

// Default movement settings
const DEFAULT_MOVEMENT_SETTINGS: MovementSettings = {
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
};

export class PlayerController {
  public player: Player;
  public settings: MovementSettings;
  public input: PlayerInput;
  public physics: PhysicsProperties;

  // Movement state
  private velocity: THREE.Vector3;
  private angularVelocity: THREE.Vector3;
  private pushForce: THREE.Vector3 | null;
  private pushForceInit: boolean;

  // Ground detection
  private grounded: boolean;
  private groundNormal: THREE.Vector3;
  private groundAngle: number;
  private groundSweepRadius: number;
  private platform: {
    actor: any;
    prevTransform: THREE.Matrix4;
  };

  // Jumping state
  private jumped: boolean;
  private jumping: boolean;
  private justLeftGround: boolean;
  private airJumped: boolean;
  private airJumping: boolean;
  private lastJumpAt: number;

  // Falling state
  private fallTimer: number;
  private falling: boolean;
  private fallDistance: number;
  private fallStartY: number;

  // Flying state
  private flyForce: number;
  private flyDrag: number;
  private flyDir: THREE.Vector3;

  // Camera control
  private zoomSpeed: number;
  private minZoom: number;
  private maxZoom: number;

  // XR/VR state
  private xrState: XRState;

  // Touch controls
  private stick?: {
    center: THREE.Vector3;
    active: boolean;
    touch: any;
  };

  private pan?: any;
  private didSnapTurn: boolean;

  // Event listeners
  private onMouseMove?: (event: MouseEvent) => void;
  private onKeyDown?: (event: KeyboardEvent) => void;
  private onKeyUp?: (event: KeyboardEvent) => void;
  private onWheel?: (event: WheelEvent) => void;

  constructor(player: Player, settings: Partial<MovementSettings> = {}) {
    this.player = player;
    this.settings = { ...DEFAULT_MOVEMENT_SETTINGS, ...settings };

    // Initialize physics properties
    this.physics = {
      mass: this.settings.mass,
      gravity: this.settings.gravity,
      friction: this.settings.friction,
      restitution: 0.1,
      linearDamping: 0.05,
      angularDamping: 0.05
    };

    // Initialize movement state
    this.velocity = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3();
    this.pushForce = null;
    this.pushForceInit = false;

    // Ground detection
    this.grounded = false;
    this.groundNormal = UP.clone();
    this.groundAngle = 0;
    this.groundSweepRadius = this.settings.capsuleRadius - 0.01;
    this.platform = {
      actor: null,
      prevTransform: new THREE.Matrix4()
    };

    // Jumping state
    this.jumped = false;
    this.jumping = false;
    this.justLeftGround = false;
    this.airJumped = false;
    this.airJumping = false;
    this.lastJumpAt = -999;

    // Falling state
    this.fallTimer = 0;
    this.falling = false;
    this.fallDistance = 0;
    this.fallStartY = 0;

    // Flying state
    this.flyForce = 100;
    this.flyDrag = 300;
    this.flyDir = new THREE.Vector3();

    // Camera control
    this.zoomSpeed = ZOOM_SPEED;
    this.minZoom = MIN_ZOOM;
    this.maxZoom = MAX_ZOOM;

    // XR state
    this.xrState = {
      active: false,
      mode: 'vr',
      controllers: {},
      head: {
        position: new THREE.Vector3(),
        quaternion: new THREE.Quaternion()
      }
    };

    // Touch state
    this.didSnapTurn = false;

    // Initialize input
    this.input = {
      moveDir: new THREE.Vector3(),
      jumpPressed: false,
      jumpDown: false,
      running: false,
      flying: false,
      lookDelta: new THREE.Vector3(),
      zoomDelta: 0
    };

    this.setupEventListeners();
  }

  // Main update methods
  update(delta: number): void {
    if (this.player.destroyed) return;

    this.updateCamera(delta);
    this.updateInput(delta);
    this.updateMode(delta);
    this.updateNetworkSync(delta);
  }

  fixedUpdate(delta: number): void {
    if (this.player.destroyed) return;

    const freeze = this.player.effect?.freeze;
    const anchor = this.player.effect?.anchorId;
    const snare = this.player.effect?.snare || 0;

    if (anchor) {
      // Player is anchored to something, skip movement
      this.updateAnchoredMovement(delta);
    } else if (!this.player.flying) {
      this.updateStandardMovement(delta, snare, freeze);
    } else {
      this.updateFlyingMovement(delta, freeze);
    }

    // Handle jumping
    this.updateJumping(delta);

    // Update player state
    this.updatePlayerState();
  }

  private updateCamera(delta: number): void {
    const { isXR, pointerLocked } = this.input;
    const freeze = this.player.effect?.freeze;

    if (freeze) return;

    // Update camera look direction
    if (this.xrState.active) {
      this.updateXRCamera(delta);
    } else if (pointerLocked) {
      this.updatePointerLockCamera(delta);
    } else if (this.pan) {
      this.updateTouchPanCamera(delta);
    }

    // Ensure we can't look too far up/down (except in XR)
    if (!this.xrState.active) {
      this.player.camera.rotation.x = Math.max(
        -89 * DEG2RAD,
        Math.min(89 * DEG2RAD, this.player.camera.rotation.x)
      );
    }

    // Handle zoom
    if (!this.xrState.active) {
      this.player.camera.zoom += -this.input.zoomDelta * this.zoomSpeed * delta;
      this.player.camera.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.player.camera.zoom));
    }

    // Handle first person transition
    this.updateFirstPersonTransition();
  }

  private updateXRCamera(delta: number): void {
    // In XR, clear camera rotation (handled internally)
    this.player.camera.rotation.x = 0;
    this.player.camera.rotation.z = 0;

    // Handle snap turning
    const rightStick = this.input.gamepad?.rightStick;
    if (rightStick) {
      if (rightStick.x === 0 && this.didSnapTurn) {
        this.didSnapTurn = false;
      } else if (rightStick.x > 0 && !this.didSnapTurn) {
        this.player.camera.rotation.y -= 45 * DEG2RAD;
        this.didSnapTurn = true;
      } else if (rightStick.x < 0 && !this.didSnapTurn) {
        this.player.camera.rotation.y += 45 * DEG2RAD;
        this.didSnapTurn = true;
      }
    }
  }

  private updatePointerLockCamera(delta: number): void {
    const lookDelta = this.input.lookDelta;
    this.player.camera.rotation.x += -lookDelta.y * POINTER_LOOK_SPEED * delta;
    this.player.camera.rotation.y += -lookDelta.x * POINTER_LOOK_SPEED * delta;
    this.player.camera.rotation.z = 0;
  }

  private updateTouchPanCamera(delta: number): void {
    const lookDelta = this.input.lookDelta;
    this.player.camera.rotation.x += -lookDelta.y * PAN_LOOK_SPEED * delta;
    this.player.camera.rotation.y += -lookDelta.x * PAN_LOOK_SPEED * delta;
    this.player.camera.rotation.z = 0;
  }

  private updateFirstPersonTransition(): void {
    // Force zoom in XR to trigger first person
    if (this.xrState.active && !this.player.camera.firstPerson) {
      this.player.camera.zoom = 0;
      this.player.camera.firstPerson = true;
      if (this.player.avatar) {
        this.player.avatar.visible = false;
      }
    } else if (!this.xrState.active && this.player.camera.firstPerson && this.player.camera.zoom > 0) {
      this.player.camera.zoom = 1;
      this.player.camera.firstPerson = false;
      if (this.player.avatar) {
        this.player.avatar.visible = true;
      }
    } else if (this.player.camera.zoom < 1 && !this.player.camera.firstPerson) {
      this.player.camera.zoom = 0;
      this.player.camera.firstPerson = true;
      if (this.player.avatar) {
        this.player.avatar.visible = false;
      }
    } else if (this.player.camera.zoom > 0 && this.player.camera.firstPerson) {
      this.player.camera.zoom = 1;
      this.player.camera.firstPerson = false;
      if (this.player.avatar) {
        this.player.avatar.visible = true;
      }
    }
  }

  private updateInput(delta: number): void {
    // Process movement input
    this.processMovementInput(delta);

    // Update player state
    this.player.moveDir.copy(this.input.moveDir);
    this.player.running = this.input.running;
    this.player.jumpDown = this.input.jumpDown;
    this.player.jumpPressed = this.input.jumpPressed;

    // Check if we're moving
    this.player.moving = this.input.moveDir.length() > 0;

    // Update flying direction
    this.flyDir.copy(this.input.moveDir);
    this.flyDir.applyQuaternion(this.player.camera.quaternion);

    // Store un-rotated move direction (axis)
    this.player.axis.copy(this.input.moveDir);

    // Normalize movement direction
    this.input.moveDir.normalize();

    // Rotate movement direction to face camera
    const yQuaternion = tempQuaternion1.setFromAxisAngle(UP, this.player.camera.rotation.y);
    this.input.moveDir.applyQuaternion(yQuaternion);
  }

  private processMovementInput(delta: number): void {
    this.input.moveDir.set(0, 0, 0);

    if (this.xrState.active) {
      // Use controller input in XR
      const leftStick = this.input.gamepad?.leftStick;
      if (leftStick) {
        this.input.moveDir.x = leftStick.x;
        this.input.moveDir.z = leftStick.z;
      }
    } else if (this.stick?.active) {
      // Use touch joystick
      const touchX = this.stick.touch.position.x;
      const touchY = this.stick.touch.position.y;
      const centerX = this.stick.center.x;
      const centerY = this.stick.center.y;
      const dx = centerX - touchX;
      const dy = centerY - touchY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const moveRadius = STICK_OUTER_RADIUS - STICK_INNER_RADIUS;

      if (distance > moveRadius) {
        this.stick.center.x = touchX + (moveRadius * dx) / distance;
        this.stick.center.y = touchY + (moveRadius * dy) / distance;
      }

      this.input.moveDir.x = (touchX - this.stick.center.x) / moveRadius;
      this.input.moveDir.z = (touchY - this.stick.center.y) / moveRadius;

      // Determine running state for touch
      this.input.running = this.player.moving && this.input.moveDir.length() > 0.9;
    } else {
      // Use keyboard input
      const keyboard = this.input.keyboard;
      if (keyboard) {
        if (keyboard['KeyW'] || keyboard['ArrowUp']) this.input.moveDir.z -= 1;
        if (keyboard['KeyS'] || keyboard['ArrowDown']) this.input.moveDir.z += 1;
        if (keyboard['KeyA'] || keyboard['ArrowLeft']) this.input.moveDir.x -= 1;
        if (keyboard['KeyD'] || keyboard['ArrowRight']) this.input.moveDir.x += 1;

        // Running with shift
        this.input.running = this.player.moving && (keyboard['ShiftLeft'] || keyboard['ShiftRight']);
      }
    }
  }

  private updateMode(delta: number): void {
    // Get locomotion mode
    let mode: PlayerMode;

    if (this.player.effect?.emote) {
      // Emote takes precedence
      mode = PlayerMode.IDLE;
    } else if (this.player.flying) {
      mode = PlayerMode.FLY;
    } else if (this.airJumping) {
      mode = PlayerMode.FLIP;
    } else if (this.jumping) {
      mode = PlayerMode.JUMP;
    } else if (this.falling) {
      mode = this.fallDistance > 1.6 ? PlayerMode.FALL : PlayerMode.JUMP;
    } else if (this.player.moving) {
      mode = this.input.running ? PlayerMode.RUN : PlayerMode.WALK;
    } else if (this.player.speaking) {
      mode = PlayerMode.TALK;
    } else {
      mode = PlayerMode.IDLE;
    }

    if (this.player.mode !== mode) {
      this.player.mode = mode;
      this.player.data.mode = mode;
    }

    // Set gaze direction
    this.updateGazeDirection();

    // Set player rotation based on movement or camera
    this.updatePlayerRotation(delta);
  }

  private updateGazeDirection(): void {
    if (this.xrState.active) {
      this.player.gaze.copy(FORWARD).applyQuaternion(this.xrState.head.quaternion);
    } else {
      this.player.gaze.copy(FORWARD).applyQuaternion(this.player.camera.quaternion);
      if (!this.player.camera.firstPerson) {
        // Tilt slightly up in third person as people look from above
        tempVector1.copy(RIGHT).applyQuaternion(this.player.camera.quaternion);
        tempVector1.applyAxisAngle(tempVector1, GAZE_TILT_ANGLE);
        this.player.gaze.applyAxisAngle(tempVector1, GAZE_TILT_ANGLE);
      }
    }
  }

  private updatePlayerRotation(delta: number): void {
    let shouldRotate = false;
    let targetRotation = 0;

    if (this.player.effect?.turn) {
      shouldRotate = true;
      targetRotation = this.player.camera.rotation.y;
    } else if (this.player.moving || this.player.camera.firstPerson) {
      shouldRotate = true;
      if (this.xrState.active) {
        const xrRotation = tempEuler1.copy(this.xrState.head.rotation);
        targetRotation = xrRotation.y + this.player.camera.rotation.y;
      } else {
        targetRotation = this.player.camera.rotation.y;
      }
    }

    if (shouldRotate) {
      tempEuler1.set(0, targetRotation, 0);
      const targetQuaternion = tempQuaternion1.setFromEuler(tempEuler1);
      const alpha = 1 - Math.pow(0.00000001, delta);
      this.player.quaternion.slerp(targetQuaternion, alpha);
    }
  }

  private updateStandardMovement(delta: number, snare: number, freeze: boolean): void {
    if (freeze) {
      // Cancel all movement when frozen
      this.velocity.set(0, 0, 0);
      this.input.moveDir.set(0, 0, 0);
      return;
    }

    // Handle moving platforms
    this.updateMovingPlatforms(delta);

    // Ground detection
    this.updateGroundDetection(delta);

    // Apply gravity
    this.applyGravity(delta);

    // Apply ground friction and drag
    this.applyDrag(delta);

    // Handle push forces
    this.applyPushForces(delta);

    // Apply movement forces
    if (this.player.moving) {
      this.applyMovementForce(delta, snare);
    }

    // Update player velocity
    this.player.velocity.copy(this.velocity);
  }

  private updateMovingPlatforms(delta: number): void {
    if (this.grounded) {
      // Find any potentially moving platform
      const origin = tempVector1.copy(this.player.position);
      origin.y += 0.2;
      const hit = this.performRaycast(origin, DOWN, 2, ['environment', 'prop']);
      let actor = hit?.entity || null;

      // If we found a new platform, set it up for tracking
      if (this.platform.actor !== actor) {
        this.platform.actor = actor;
        if (actor) {
          // Store current platform transform
          this.platform.prevTransform.compose(
            new THREE.Vector3(0, 0, 0), // Would get from actual platform
            new THREE.Quaternion(),
            new THREE.Vector3(1, 1, 1)
          );
        }
      }

      // Move with platform
      if (this.platform.actor) {
        // This would be implemented with actual platform tracking
        // For now, we'll simulate basic platform movement
      }
    } else {
      this.platform.actor = null;
    }
  }

  private updateGroundDetection(delta: number): void {
    const origin = tempVector1.copy(this.player.position);
    origin.y += this.groundSweepRadius + 0.12;
    const direction = DOWN;
    const maxDistance = 0.12 + 0.1;
    const hit = this.performSpherecast(origin, this.groundSweepRadius, direction, maxDistance);

    // Update grounded info
    if (hit) {
      this.justLeftGround = false;
      this.grounded = true;
      this.player.grounded = true;
      this.groundNormal.copy(hit.normal);
      this.groundAngle = UP.angleTo(this.groundNormal) * RAD2DEG;
    } else {
      this.justLeftGround = !!this.grounded;
      this.grounded = false;
      this.player.grounded = false;
      this.groundNormal.copy(UP);
      this.groundAngle = 0;
    }

    // Handle steep slopes
    if (this.grounded && this.groundAngle > this.settings.maxSlopeAngle) {
      this.justLeftGround = false;
      this.grounded = false;
      this.player.grounded = false;
      this.groundNormal.copy(UP);
      this.groundAngle = 0;
    }

    // Update player ground normal
    this.player.groundNormal.copy(this.groundNormal);
    this.player.groundAngle = this.groundAngle;

    // Update jumping state
    this.updateJumpingState(delta);
  }

  private updateJumpingState(delta: number): void {
    // If we jumped and have now left the ground, progress to jumping
    if (this.jumped && !this.grounded) {
      this.jumped = false;
      this.jumping = true;
      this.player.jumping = true;
    }

    // Track falling
    if (!this.grounded && this.velocity.y < 0) {
      this.fallTimer += delta;
    } else {
      this.fallTimer = 0;
    }

    // Start falling after a threshold
    if (this.fallTimer > 0.1 && !this.falling) {
      this.jumping = false;
      this.player.jumping = false;
      this.airJumping = false;
      this.player.airJumping = false;
      this.falling = true;
      this.player.falling = true;
      this.fallStartY = this.player.position.y;
    }

    // Track fall distance
    if (this.falling) {
      this.fallDistance = this.fallStartY - this.player.position.y;
      this.player.fallDistance = this.fallDistance;
    }

    // Clear states when grounded
    if (this.falling && this.grounded) {
      this.falling = false;
      this.player.falling = false;
      this.player.emit('land', {
        fallDistance: this.fallDistance,
        velocity: this.velocity.clone()
      });
    }

    if (this.jumping && this.grounded) {
      this.jumping = false;
      this.player.jumping = false;
    }

    if (this.airJumped && this.grounded) {
      this.airJumped = false;
      this.player.airJumped = false;
      this.airJumping = false;
      this.player.airJumping = false;
    }
  }

  private applyGravity(delta: number): void {
    if (this.grounded) {
      // Don't apply gravity when grounded on static objects
      // Would apply downward force to dynamic platforms here
    } else {
      const gravityForce = tempVector1.set(0, -this.physics.gravity * this.physics.mass, 0);
      this.velocity.add(gravityForce.multiplyScalar(delta));
    }
  }

  private applyDrag(delta: number): void {
    // Apply drag, oriented to ground normal
    const dragCoeff = 10 * delta;
    const perpComponent = tempVector1.copy(this.groundNormal).multiplyScalar(this.velocity.dot(this.groundNormal));
    const parallelComponent = tempVector2.copy(this.velocity).sub(perpComponent);
    parallelComponent.multiplyScalar(1 - dragCoeff);
    this.velocity.copy(parallelComponent.add(perpComponent));

    // Cancel out velocity in ground normal direction when grounded
    if (this.grounded && !this.jumping) {
      const projectedLength = this.velocity.dot(this.groundNormal);
      const projectedVector = tempVector1.copy(this.groundNormal).multiplyScalar(projectedLength);
      this.velocity.sub(projectedVector);
    }

    // Apply downward velocity when walking off edges
    if (this.justLeftGround && !this.jumping) {
      this.velocity.y = -5;
    }
  }

  private applyPushForces(delta: number): void {
    if (this.pushForce) {
      if (!this.pushForceInit) {
        this.pushForceInit = true;
        // If we're pushing up, act like a jump
        if (this.pushForce.y > 0) {
          this.jumped = true;
          this.jumping = false;
          this.falling = false;
          this.airJumped = false;
          this.airJumping = false;
        }
      }

      this.velocity.add(this.pushForce);
      const drag = 20;
      const decayFactor = 1 - drag * delta;

      if (decayFactor < 0) {
        this.pushForce = null;
      } else {
        this.pushForce.multiplyScalar(Math.max(decayFactor, 0));
        if (this.pushForce.length() < 0.01) {
          this.pushForce = null;
        }
      }
    }
  }

  private applyMovementForce(delta: number, snare: number): void {
    let moveSpeed = (this.input.running ? this.settings.runSpeed : this.settings.walkSpeed) * this.physics.mass;
    moveSpeed *= 1 - snare;

    // Project movement onto ground normal
    const slopeRotation = tempQuaternion1.setFromUnitVectors(UP, this.groundNormal);
    const moveForce = tempVector1.copy(this.input.moveDir).multiplyScalar(moveSpeed * 10);
    moveForce.applyQuaternion(slopeRotation);

    this.velocity.add(moveForce.multiplyScalar(delta));
  }

  private updateFlyingMovement(delta: number, freeze: boolean): void {
    if (freeze) {
      this.velocity.set(0, 0, 0);
      return;
    }

    // Apply force in the direction we want to go
    if (this.player.moving || this.input.jumpDown || this.input.keyboard?.['KeyC']) {
      const flySpeed = this.flyForce * (this.input.running ? 2 : 1);
      const force = tempVector1.copy(this.flyDir).multiplyScalar(flySpeed);

      // Handle vertical movement
      if (this.input.jumpDown) {
        force.y = flySpeed;
      } else if (this.input.keyboard?.['KeyC']) {
        force.y = -flySpeed;
      }

      this.velocity.add(force.multiplyScalar(delta));
    }

    // Add drag to prevent excessive speeds
    const dragForce = tempVector1.copy(this.velocity).multiplyScalar(-this.flyDrag * delta);
    this.velocity.add(dragForce);

    // Zero out angular velocity
    this.angularVelocity.set(0, 0, 0);
  }

  private updateAnchoredMovement(delta: number): void {
    // Player is anchored, clear movement
    this.velocity.set(0, 0, 0);
    this.input.moveDir.set(0, 0, 0);
    this.player.moving = false;
  }

  private updateJumping(delta: number): void {
    // Ground jump
    const shouldJump =
      this.grounded &&
      !this.jumping &&
      this.input.jumpDown &&
      !this.player.effect?.snare &&
      !this.player.effect?.freeze;

    // Air jump (currently disabled)
    const shouldAirJump = false; // && !this.grounded && !this.airJumped && this.input.jumpPressed

    if (shouldJump || shouldAirJump) {
      const jumpVelocity = Math.sqrt(2 * this.physics.gravity * this.settings.jumpHeight);
      const adjustedVelocity = jumpVelocity * (1 / Math.sqrt(this.physics.mass));

      this.velocity.y = adjustedVelocity;

      if (shouldJump) {
        this.jumped = true;
        this.player.jumped = true;
        this.player.emit('jump', {
          height: this.settings.jumpHeight,
          velocity: this.velocity.clone()
        });
      }

      if (shouldAirJump) {
        this.falling = false;
        this.fallTimer = 0;
        this.jumping = true;
        this.player.jumping = true;
        this.airJumped = true;
        this.airJumping = true;
        this.player.airJumping = true;
      }
    }

    // Consume jump press
    this.input.jumpPressed = false;
  }

  private updatePlayerState(): void {
    // Update player velocity
    this.player.velocity.copy(this.velocity);

    // Update position based on velocity
    if (this.velocity.length() > 0) {
      const movement = tempVector1.copy(this.velocity).multiplyScalar(1 / 60); // Assuming 60 FPS
      this.player.position.add(movement);
      this.player.updateCameraPosition();
    }
  }

  private updateNetworkSync(delta: number): void {
    if (this.player.needsNetworkUpdate(delta)) {
      const networkData = this.player.getNetworkData();
      if (Object.keys(networkData).length > 1) { // More than just id
        this.player.emit('networkUpdate', networkData);
      }
    }
  }

  // Physics helpers
  private performRaycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number, layers: string[]): RaycastHit | null {
    // This would interface with the actual physics system
    // For now, return null
    return null;
  }

  private performSpherecast(origin: THREE.Vector3, radius: number, direction: THREE.Vector3, maxDistance: number): RaycastHit | null {
    // This would interface with the actual physics system
    // For now, return null
    return null;
  }

  // Public control methods
  push(force: Vector3 | THREE.Vector3): void {
    const pushVector = Array.isArray(force) ? tempVector1.fromArray(force) : force.clone();

    // Add to any existing push force
    if (this.pushForce) {
      this.pushForce.add(pushVector);
    } else {
      this.pushForce = pushVector.clone();
      this.pushForceInit = false;
    }

    this.player.push(pushVector);
  }

  teleport(options: { position: Vector3; rotation?: number }): void {
    this.player.teleport(options);
    this.velocity.set(0, 0, 0);
    this.pushForce = null;
  }

  toggleFlying(force?: boolean): void {
    this.player.toggleFlying(force);
    this.input.flying = this.player.flying;

    if (this.player.flying) {
      // Zero out vertical velocity when entering fly mode
      this.velocity.y = 0;
    }
  }

  // Input handling
  setKeyState(key: string, pressed: boolean): void {
    if (!this.input.keyboard) {
      this.input.keyboard = {};
    }
    this.input.keyboard[key] = pressed;
  }

  setMouseState(button: string, pressed: boolean): void {
    if (!this.input.mouse) {
      this.input.mouse = {
        left: false,
        right: false,
        middle: false,
        position: new THREE.Vector3(),
        delta: new THREE.Vector3(),
        locked: false
      };
    }
    if (button === 'left') this.input.mouse.left = pressed;
    if (button === 'right') this.input.mouse.right = pressed;
    if (button === 'middle') this.input.mouse.middle = pressed;
  }

  setMousePosition(position: Vector3, delta: Vector3): void {
    if (!this.input.mouse) {
      this.input.mouse = {
        left: false,
        right: false,
        middle: false,
        position: new THREE.Vector3(),
        delta: new THREE.Vector3(),
        locked: false
      };
    }
    if (Array.isArray(position)) {
      this.input.mouse.position.fromArray(position);
    } else {
      this.input.mouse.position.copy(position);
    }
    if (Array.isArray(delta)) {
      this.input.mouse.delta.fromArray(delta);
    } else {
      this.input.mouse.delta.copy(delta);
    }
  }

  setPointerLock(locked: boolean): void {
    if (this.input.mouse) {
      this.input.mouse.locked = locked;
    }
  }

  setGamepadState(state: any): void {
    this.input.gamepad = state;
  }

  setXRState(state: Partial<XRState>): void {
    Object.assign(this.xrState, state);
  }

  // Touch controls
  setupTouchControls(centerX: number, centerY: number): void {
    this.stick = {
      center: new THREE.Vector3(centerX, centerY, 0),
      active: false,
      touch: null
    };
  }

  updateTouchControls(touchX: number, touchY: number, isEnd: boolean = false): void {
    if (!this.stick) return;

    if (isEnd) {
      this.stick.active = false;
      return;
    }

    const dx = centerX - touchX;
    const dy = centerY - touchY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    this.stick.active = distance > 3;
    if (this.stick.active) {
      this.stick.touch = { position: new THREE.Vector3(touchX, touchY, 0) };
    }
  }

  // Event listeners
  private setupEventListeners(): void {
    // These would be set up in the actual implementation
    // For now, they're just stubs
  }

  // Cleanup
  destroy(): void {
    // Remove event listeners
    this.onMouseMove = undefined;
    this.onKeyDown = undefined;
    this.onKeyUp = undefined;
    this.onWheel = undefined;

    // Clear state
    this.stick = undefined;
    this.pan = undefined;
    this.pushForce = null;
  }
}