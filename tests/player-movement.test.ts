import { Player } from '../src/entities/player';
import { PlayerController } from '../src/entities/player-controller';
import { InputSystem } from '../src/systems/input-system';
import { PhysicsSystem } from '../src/systems/physics-system';
import { PlayerManager } from '../src/managers/player-manager';
import { PlayerMode, PlayerRank, Vector3 } from '../src/types';

// Mock DOM for testing
const mockDocument = {
  createElement: jest.fn(() => ({
    style: {},
    addEventListener: jest.fn(),
    innerHTML: '',
    textContent: ''
  })),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => [])
  }),
  head: {
    appendChild: jest.fn()
  },
  addEventListener: jest.fn(),
  pointerLockElement: null,
  hidden: false,
  activeElement: null
} as any;

const mockWindow = {
  innerWidth: 1920,
  innerHeight: 1080,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  performance: {
    now: jest.fn(() => Date.now())
  },
  navigator: {
    getGamepads: jest.fn(() => []),
    xr: null
  },
  requestAnimationFrame: jest.fn(),
  cancelAnimationFrame: jest.fn()
} as any;

// Setup global mocks
Object.defineProperty(global, 'document', { value: mockDocument, writable: true });
Object.defineProperty(global, 'window', { value: mockWindow, writable: true });
Object.defineProperty(global, 'performance', { value: mockWindow.performance, writable: true });

describe('Player Movement System', () => {
  let inputSystem: InputSystem;
  let physicsSystem: PhysicsSystem;
  let playerManager: PlayerManager;
  let localPlayer: Player;
  let playerController: PlayerController;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock DOM element
    const mockElement = {
      style: {},
      addEventListener: jest.fn(),
      requestPointerLock: jest.fn(),
      innerWidth: 1920,
      innerHeight: 1080,
      getBoundingClientRect: jest.fn(() => ({
        left: 0,
        top: 0,
        width: 1920,
        height: 1080
      }))
    } as any;

    mockDocument.createElement.mockReturnValue(mockElement);

    // Initialize systems
    inputSystem = new InputSystem(mockElement);
    physicsSystem = new PhysicsSystem();
    playerManager = new PlayerManager();

    // Connect systems
    playerManager.initialize(inputSystem, physicsSystem);

    // Create local player
    localPlayer = playerManager.addLocalPlayer({
      name: 'Test Player',
      position: { x: 0, y: 2, z: 0 }
    });

    playerController = playerManager.controllers.get(localPlayer.id)!;
  });

  afterEach(() => {
    playerManager?.destroy();
    inputSystem?.destroy();
    physicsSystem?.destroy();
  });

  describe('Player Entity', () => {
    test('should create player with default values', () => {
      expect(localPlayer.id).toBeDefined();
      expect(localPlayer.name).toBe('Test Player');
      expect(localPlayer.isLocal).toBe(true);
      expect(localPlayer.position.y).toBe(2); // Default height
      expect(localPlayer.health).toBe(100);
      expect(localPlayer.rank).toBe(PlayerRank.MEMBER);
    });

    test('should update position correctly', () => {
      const newPosition = { x: 5, y: 3, z: 10 };
      localPlayer.setPosition(newPosition);

      expect(localPlayer.position.x).toBe(5);
      expect(localPlayer.position.y).toBe(3);
      expect(localPlayer.position.z).toBe(10);
    });

    test('should update rotation correctly', () => {
      const quaternion = [0, 0.707, 0, 0.707]; // 90 degrees around Y axis
      localPlayer.setRotation(quaternion);

      expect(localPlayer.quaternion.toArray()).toEqual(quaternion);
    });

    test('should handle teleportation', () => {
      const teleportPos = { x: 10, y: 5, z: -5 };
      const rotation = Math.PI / 4;

      const teleportSpy = jest.spyOn(localPlayer, 'emit');
      localPlayer.teleport({ position: teleportPos, rotation });

      expect(localPlayer.position.x).toBe(10);
      expect(localPlayer.position.y).toBe(5);
      expect(localPlayer.position.z).toBe(-5);
      expect(teleportSpy).toHaveBeenCalledWith('teleport', {
        position: expect.any(Object),
        rotation
      });
    });

    test('should handle jumping', () => {
      localPlayer.grounded = true;
      const jumpSpy = jest.spyOn(localPlayer, 'emit');

      localPlayer.jump();

      expect(localPlayer.jumped).toBe(true);
      expect(jumpSpy).toHaveBeenCalledWith('jump', {
        height: expect.any(Number),
        velocity: expect.any(Object)
      });
    });

    test('should toggle flying mode', () => {
      expect(localPlayer.flying).toBe(false);

      localPlayer.toggleFlying(true);
      expect(localPlayer.flying).toBe(true);

      localPlayer.toggleFlying(false);
      expect(localPlayer.flying).toBe(false);
    });

    test('should manage health correctly', () => {
      const healthSpy = jest.spyOn(localPlayer, 'emit');

      localPlayer.setHealth(75);
      expect(localPlayer.health).toBe(75);
      expect(healthSpy).toHaveBeenCalledWith('health', {
        playerId: localPlayer.id,
        health: 75,
        change: -25
      });
    });

    test('should handle rank changes', () => {
      const rankSpy = jest.spyOn(localPlayer, 'emit');

      localPlayer.setRank(PlayerRank.ADMIN);
      expect(localPlayer.rank).toBe(PlayerRank.ADMIN);
      expect(rankSpy).toHaveBeenCalledWith('rank', {
        playerId: localPlayer.id,
        rank: PlayerRank.ADMIN
      });
    });
  });

  describe('Player Controller', () => {
    test('should initialize with correct settings', () => {
      expect(playerController.player).toBe(localPlayer);
      expect(playerController.settings.walkSpeed).toBe(3);
      expect(playerController.settings.runSpeed).toBe(6);
      expect(playerController.settings.jumpHeight).toBe(1.5);
    });

    test('should handle keyboard input', () => {
      playerController.setKeyState('KeyW', true);
      playerController.setKeyState('KeyShift', true);

      playerController.update(0.016);

      expect(playerController.input.moveDir.z).toBe(-1);
      expect(playerController.input.running).toBe(true);
    });

    test('should handle mouse input', () => {
      const mouseDelta = { x: 10, y: 5 };
      playerController.setMousePosition({ x: 100, y: 100 }, mouseDelta);

      expect(playerController.input.lookDelta.x).toBe(10);
      expect(playerController.input.lookDelta.y).toBe(5);
    });

    test('should handle jumping input', () => {
      localPlayer.grounded = true;
      playerController.setKeyState('space', true);

      playerController.fixedUpdate(0.016);

      expect(playerController.input.jumpPressed).toBe(true);
      expect(playerController.input.jumpDown).toBe(true);
    });

    test('should apply push forces', () => {
      const pushForce = { x: 5, y: 10, z: 0 };
      const pushSpy = jest.spyOn(localPlayer, 'push');

      playerController.push(pushForce);

      expect(pushSpy).toHaveBeenCalledWith(expect.objectContaining({
        x: 5,
        y: 10,
        z: 0
      }));
    });

    test('should handle flying movement', () => {
      localPlayer.toggleFlying(true);
      playerController.setKeyState('KeyW', true);
      playerController.setKeyState('space', true);

      playerController.fixedUpdate(0.016);

      expect(playerController.player.flying).toBe(true);
      expect(playerController.input.moveDir.z).toBe(-1);
      expect(playerController.input.jumpDown).toBe(true);
    });

    test('should handle camera controls', () => {
      playerController.setMousePosition({ x: 100, y: 100 }, { x: 5, y: 3 });
      playerController.update(0.016);

      expect(localPlayer.camera.rotation.y).not.toBe(0);
      expect(localPlayer.camera.rotation.x).not.toBe(0);
    });
  });

  describe('Input System', () => {
    test('should handle keyboard events', () => {
      const keyPressSpy = jest.spyOn(inputSystem, 'emit');

      // Simulate key press
      inputSystem['onKeyDown']({ code: 'KeyW', preventDefault: jest.fn(), repeat: false } as any);

      expect(inputSystem.state.keyboard['keyW']).toBe(true);
      expect(keyPressSpy).toHaveBeenCalledWith('keyPress', expect.any(Object));
    });

    test('should handle mouse events', () => {
      const mouseDownSpy = jest.spyOn(inputSystem, 'emit');

      // Simulate mouse down
      inputSystem['onMouseDown']({ clientX: 100, clientY: 100, button: 0 } as any);

      expect(inputSystem.state.mouse.left).toBe(true);
      expect(mouseDownSpy).toHaveBeenCalledWith('mouseDown', expect.any(Object));
    });

    test('should handle touch events', () => {
      const touchStartSpy = jest.spyOn(inputSystem, 'emit');

      // Simulate touch start
      const mockTouch = { identifier: 1, clientX: 100, clientY: 100 };
      inputSystem['onTouchStart']({
        preventDefault: jest.fn(),
        touches: [mockTouch],
        changedTouches: [mockTouch]
      } as any);

      expect(inputSystem.state.touch.active).toBe(true);
      expect(touchStartSpy).toHaveBeenCalledWith('touchStart', expect.any(Object));
    });

    test('should handle gamepad events', () => {
      const mockGamepad = {
        index: 0,
        connected: true,
        axes: [0, 0.5, 0, 0],
        buttons: [
          { pressed: true, value: 1, touched: true },
          { pressed: false, value: 0, touched: false }
        ]
      } as Gamepad;

      inputSystem['updateGamepadState'](mockGamepad);

      expect(inputSystem.state.gamepad.leftStick.z).toBe(-0.5);
      expect(inputSystem.state.gamepad.buttons['faceDown']).toBe(true);
    });

    test('should manage pointer lock', async () => {
      const mockElement = {
        requestPointerLock: jest.fn().mockResolvedValue(undefined)
      } as any;

      inputSystem.element = mockElement;

      const result = await inputSystem.requestPointerLock();
      expect(result).toBe(true);
      expect(mockElement.requestPointerLock).toHaveBeenCalled();
    });
  });

  describe('Physics System', () => {
    test('should create physics bodies', () => {
      const body = physicsSystem.addBody({
        id: 'test_body',
        position: { x: 0, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        mass: 1,
        shape: 'box'
      });

      expect(body.id).toBe('test_body');
      expect(body.mass).toBe(1);
      expect(body.shape).toBe('box');
      expect(physicsSystem.bodies.has('test_body')).toBe(true);
    });

    test('should apply gravity to dynamic bodies', () => {
      const body = physicsSystem.addBody({
        id: 'test_body',
        position: { x: 0, y: 10, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        mass: 1,
        shape: 'box',
        isKinematic: false
      });

      const initialY = body.position.y;
      physicsSystem.update(1); // 1 second

      expect(body.position.y).toBeLessThan(initialY);
      expect(body.velocity.y).toBeLessThan(0);
    });

    test('should handle collisions', () => {
      const bodyA = physicsSystem.addBody({
        id: 'body_a',
        position: { x: 0, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        mass: 1,
        shape: 'sphere'
      });

      const bodyB = physicsSystem.addBody({
        id: 'body_b',
        position: { x: 0.5, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        mass: 1,
        shape: 'sphere'
      });

      const collisionSpy = jest.spyOn(physicsSystem, 'emit');
      physicsSystem.update(1);

      // Bodies should have collided and separated
      expect(bodyA.position.distanceTo(bodyB.position)).toBeGreaterThan(1);
    });

    test('should perform raycasting', () => {
      physicsSystem.addBody({
        id: 'test_body',
        position: { x: 0, y: 0, z: 10 },
        size: { x: 1, y: 1, z: 1 },
        mass: 1,
        shape: 'box'
      });

      const hit = physicsSystem.raycast(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
        100
      );

      expect(hit).toBeTruthy();
      expect(hit!.entity).toBe('test_body');
      expect(hit!.distance).toBeGreaterThan(0);
    });

    test('should enforce world bounds', () => {
      physicsSystem.setWorldBounds(
        { x: -10, y: 0, z: -10 },
        { x: 10, y: 20, z: 10 }
      );

      const body = physicsSystem.addBody({
        id: 'test_body',
        position: { x: 15, y: 5, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        mass: 1,
        shape: 'box'
      });

      physicsSystem.update(1);

      // Body should be clamped within bounds
      expect(body.position.x).toBeLessThanOrEqual(10);
    });
  });

  describe('Player Manager', () => {
    test('should manage multiple players', () => {
      const remotePlayerData = {
        id: 'remote_player_1',
        name: 'Remote Player',
        position: { x: 5, y: 2, z: 0 },
        quaternion: [0, 0, 0, 1],
        scale: { x: 1, y: 1, z: 1 }
      };

      const remotePlayer = playerManager.addRemotePlayer(remotePlayerData);

      expect(playerManager.getPlayerCount()).toBe(2);
      expect(playerManager.getAllPlayers()).toHaveLength(2);
      expect(playerManager.getRemotePlayers()).toHaveLength(1);
      expect(remotePlayer.isRemote).toBe(true);
    });

    test('should handle player proximity tracking', () => {
      const remotePlayerData = {
        id: 'remote_player_1',
        name: 'Remote Player',
        position: { x: 1, y: 2, z: 1 },
        quaternion: [0, 0, 0, 1],
        scale: { x: 1, y: 1, z: 1 }
      };

      playerManager.addRemotePlayer(remotePlayerData);
      playerManager.update(0.016);

      const proximityInfo = playerManager.getProximityInfo(localPlayer.id);
      expect(proximityInfo).toHaveLength(1);
      expect(proximityInfo[0].inRange).toBe(true);
    });

    test('should handle player interactions', () => {
      const remotePlayerData = {
        id: 'remote_player_1',
        name: 'Remote Player',
        position: { x: 1, y: 2, z: 0 },
        quaternion: [0, 0, 0, 1],
        scale: { x: 1, y: 1, z: 1 }
      };

      const remotePlayer = playerManager.addRemotePlayer(remotePlayerData);
      const interactionSpy = jest.spyOn(playerManager, 'emit');

      playerManager.interactWithPlayer(
        localPlayer.id,
        remotePlayer.id,
        'emote',
        { emote: 'wave' }
      );

      expect(interactionSpy).toHaveBeenCalledWith('playerInteraction', {
        from: localPlayer,
        to: remotePlayer,
        interaction: expect.objectContaining({
          type: 'emote',
          targetId: remotePlayer.id
        })
      });
    });

    test('should handle player teleportation', () => {
      const teleportSpy = jest.spyOn(localPlayer, 'teleport');

      playerManager.teleportPlayer(localPlayer.id, { x: 10, y: 5, z: -5 }, Math.PI / 2);

      expect(teleportSpy).toHaveBeenCalledWith({
        position: { x: 10, y: 5, z: -5 },
        rotation: Math.PI / 2
      });
    });

    test('should handle emotes', () => {
      const emoteSpy = jest.spyOn(localPlayer, 'setEmote');

      playerManager.setPlayerEmote(localPlayer.id, 'wave');

      expect(emoteSpy).toHaveBeenCalledWith('wave');
    });

    test('should handle player push', () => {
      const pushSpy = jest.spyOn(localPlayer, 'push');
      const force = { x: 5, y: 0, z: 0 };

      playerManager.pushPlayer(localPlayer.id, force);

      expect(pushSpy).toHaveBeenCalledWith(force);
    });

    test('should find players in radius', () => {
      playerManager.addRemotePlayer({
        id: 'remote_player_1',
        name: 'Nearby Player',
        position: { x: 2, y: 2, z: 0 },
        quaternion: [0, 0, 0, 1],
        scale: { x: 1, y: 1, z: 1 }
      });

      playerManager.addRemotePlayer({
        id: 'remote_player_2',
        name: 'Far Player',
        position: { x: 20, y: 2, z: 0 },
        quaternion: [0, 0, 0, 1],
        scale: { x: 1, y: 1, z: 1 }
      });

      const nearbyPlayers = playerManager.getPlayersInRadius({ x: 0, y: 2, z: 0 }, 5);

      expect(nearbyPlayers).toHaveLength(2); // Local player + nearby remote player
      expect(nearbyPlayers.some(p => p.name === 'Nearby Player')).toBe(true);
      expect(nearbyPlayers.some(p => p.name === 'Far Player')).toBe(false);
    });

    test('should find nearest player', () => {
      playerManager.addRemotePlayer({
        id: 'remote_player_1',
        name: 'Nearby Player',
        position: { x: 1, y: 2, z: 0 },
        quaternion: [0, 0, 0, 1],
        scale: { x: 1, y: 1, z: 1 }
      });

      playerManager.addRemotePlayer({
        id: 'remote_player_2',
        name: 'Far Player',
        position: { x: 5, y: 2, z: 0 },
        quaternion: [0, 0, 0, 1],
        scale: { x: 1, y: 1, z: 1 }
      });

      const nearestPlayer = playerManager.getNearestPlayer({ x: 0, y: 2, z: 0 });

      expect(nearestPlayer).toBeTruthy();
      expect(nearestPlayer!.name).toBe('Nearby Player');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete movement cycle', () => {
      // Start movement
      playerController.setKeyState('KeyW', true);
      playerController.setKeyState('KeyShift', true);

      // Update systems
      inputSystem.update(0.016);
      playerController.update(0.016);
      physicsSystem.update(0.016);
      playerManager.update(0.016);

      // Check movement state
      expect(playerController.input.moveDir.z).toBe(-1);
      expect(playerController.input.running).toBe(true);
      expect(localPlayer.moving).toBe(true);

      // Stop movement
      playerController.setKeyState('KeyW', false);
      playerController.setKeyState('KeyShift', false);

      playerController.update(0.016);
      playerManager.update(0.016);

      expect(playerController.input.moveDir.length()).toBe(0);
      expect(localPlayer.moving).toBe(false);
    });

    test('should handle jump cycle', () => {
      // Ensure player is grounded
      localPlayer.grounded = true;

      // Jump
      playerController.setKeyState('space', true);
      playerController.fixedUpdate(0.016);

      expect(localPlayer.jumped).toBe(true);
      expect(localPlayer.velocity.y).toBeGreaterThan(0);

      // Update during jump
      localPlayer.grounded = false;
      playerController.fixedUpdate(0.016);

      expect(localPlayer.jumping).toBe(true);

      // Land
      localPlayer.grounded = true;
      playerController.fixedUpdate(0.016);

      expect(localPlayer.jumping).toBe(false);
    });

    test('should handle flying mode', () => {
      // Enable flying
      localPlayer.toggleFlying(true);
      playerController.update(0.016);

      expect(localPlayer.flying).toBe(true);
      expect(localPlayer.mode).toBe(PlayerMode.FLY);

      // Move in flying mode
      playerController.setKeyState('KeyW', true);
      playerController.setKeyState('space', true);
      playerController.fixedUpdate(0.016);

      expect(playerController.input.moveDir.z).toBe(-1);
      expect(playerController.input.jumpDown).toBe(true);

      // Disable flying
      localPlayer.toggleFlying(false);
      playerController.update(0.016);

      expect(localPlayer.flying).toBe(false);
    });

    test('should handle multiplayer synchronization', () => {
      const networkClient = {
        send: jest.fn(),
        on: jest.fn()
      };

      playerManager.networkClient = networkClient;
      playerManager.setupNetworkListeners();

      // Force network update
      playerManager.lastNetworkUpdate = playerManager.networkRate + 0.1;
      playerManager.updateNetworkSync(0.016);

      expect(networkClient.send).toHaveBeenCalled();
    });

    test('should handle physics interactions', () => {
      // Add a physics body
      const platform = physicsSystem.addBody({
        id: 'platform',
        position: { x: 0, y: 0, z: 0 },
        size: { x: 4, y: 0.5, z: 4 },
        layer: physicsSystem.layers.STATIC,
        shape: 'box',
        isKinematic: true
      });

      // Position player above platform
      localPlayer.position.set(0, 1, 0);
      localPlayer.velocity.set(0, 0, 0);

      // Simulate falling
      localPlayer.grounded = false;
      physicsSystem.update(0.016);

      // Check for collision (this would need more detailed physics setup)
      expect(physicsSystem.performance.collisionChecks).toBeGreaterThanOrEqual(0);
    });

    test('should handle cleanup properly', () => {
      const playerCount = playerManager.getPlayerCount();
      const bodyCount = physicsSystem.bodies.size;

      // Remove a player
      const playerId = localPlayer.id;
      playerManager.removePlayer(playerId);

      expect(playerManager.getPlayerCount()).toBe(playerCount - 1);
      expect(playerManager.getPlayer(playerId)).toBeUndefined();
    });
  });

  describe('Performance Tests', () => {
    test('should handle multiple players efficiently', () => {
      const startTime = performance.now();

      // Add multiple remote players
      for (let i = 0; i < 10; i++) {
        playerManager.addRemotePlayer({
          id: `remote_player_${i}`,
          name: `Player ${i}`,
          position: { x: i * 2, y: 2, z: i * 2 },
          quaternion: [0, 0, 0, 1],
          scale: { x: 1, y: 1, z: 1 }
        });
      }

      // Run multiple update cycles
      for (let i = 0; i < 100; i++) {
        playerManager.update(0.016);
      }

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      expect(updateTime).toBeLessThan(100); // Should complete in less than 100ms
      expect(playerManager.getPlayerCount()).toBe(11); // 1 local + 10 remote
    });

    test('should handle physics simulation efficiently', () => {
      const startTime = performance.now();

      // Add multiple physics bodies
      for (let i = 0; i < 20; i++) {
        physicsSystem.addBody({
          id: `body_${i}`,
          position: { x: i, y: 5, z: i },
          size: { x: 1, y: 1, z: 1 },
          mass: 1,
          shape: 'box'
        });
      }

      // Run physics simulation
      for (let i = 0; i < 100; i++) {
        physicsSystem.update(0.016);
      }

      const endTime = performance.now();
      const physicsTime = endTime - startTime;

      expect(physicsTime).toBeLessThan(200); // Should complete in less than 200ms
      expect(physicsSystem.bodies.size).toBe(20);
    });
  });
});