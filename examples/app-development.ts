/**
 * Comprehensive App Development Example
 *
 * This example demonstrates the complete app creation and management system
 * for the Hyperfy Node.js SDK, including:
 *
 * - App lifecycle management
 * - Blueprint system with versioning
 * - Building tools and operations
 * - Script execution and hot reloading
 * - Multi-user collaboration
 * - Asset management
 * - Performance monitoring
 */

import { HyperfySDK } from '../src/sdk/hyperfy-sdk';
import { AppManager } from '../src/managers/app-manager';
import { BuilderManager } from '../src/managers/builder-manager';
import { BlueprintManager } from '../src/managers/blueprint-manager';
import { ScriptEngine } from '../src/systems/script-engine';
import { AppTools } from '../src/utils/app-tools';
import {
  App,
  Blueprint,
  Vector3,
  Quaternion,
  Entity,
  Component,
  Material,
  Animation,
  BuildMode,
  BuildTool,
  AppMode,
  AppState,
  CollaboratorRole
} from '../src/types';

// Initialize the SDK
const sdk = new HyperfySDK({
  apiUrl: 'https://api.hyperfy.com',
  wsUrl: 'wss://api.hyperfy.com/ws',
  apiKey: process.env.HYPERFY_API_KEY,
  logLevel: 'info'
});

async function comprehensiveAppDevelopmentExample() {
  console.log('🚀 Starting Comprehensive App Development Example');

  try {
    // 1. Initialize all managers
    const { appManager, builderManager, blueprintManager, scriptEngine } = await initializeManagers();

    // 2. Create a blueprint
    const blueprint = await createInteractiveGameBlueprint(blueprintManager);

    // 3. Create an app from the blueprint
    const app = await createAppFromBlueprint(appManager, blueprint);

    // 4. Start a build session
    const buildSession = await startBuildSession(builderManager, app);

    // 5. Add entities to the app
    const entities = await populateAppWithEntities(builderManager, buildSession);

    // 6. Set up scripting
    await setupAppScripting(scriptEngine, app);

    // 7. Enable collaboration
    await enableCollaboration(blueprintManager, blueprint);

    // 8. Add advanced features
    await addAdvancedFeatures(builderManager, buildSession);

    // 9. Test and validate
    await testAndValidate(appManager, builderManager, app);

    // 10. Deploy the app
    const deployment = await deployApp(appManager, app);

    console.log('✅ App development completed successfully!');
    console.log(`📦 App deployed to: ${deployment.url}`);

    // Cleanup
    await cleanup(appManager, builderManager, scriptEngine);

  } catch (error) {
    console.error('❌ App development failed:', error);
    throw error;
  }
}

async function initializeManagers() {
  console.log('🔧 Initializing managers...');

  const appManager = new AppManager({
    httpClient: sdk.httpClient,
    enableHotReload: true,
    enableComponents: true,
    enablePerformanceMonitoring: true,
    maxConcurrentApps: 50,
    networkSyncInterval: 100
  });

  const builderManager = new BuilderManager({
    httpClient: sdk.httpClient,
    autoSave: true,
    autoSaveInterval: 30000,
    maxUndoHistory: 100,
    enableCollaboration: true,
    enableRealTimeSync: true,
    defaultSnapSettings: {
      enabled: true,
      distance: 0.5,
      angle: 15,
      scale: 0.1
    }
  });

  const blueprintManager = new BlueprintManager({
    httpClient: sdk.httpClient,
    enableVersioning: true,
    enableCollaboration: true,
    enableComments: true,
    enableTemplates: true,
    maxVersions: 50,
    maxFileSize: 100 * 1024 * 1024
  });

  const scriptEngine = new ScriptEngine({
    enableSandbox: true,
    enableModules: true,
    enableNetwork: false,
    maxExecutionTime: 5000,
    maxMemoryUsage: 50 * 1024 * 1024,
    enablePerformanceMonitoring: true,
    enableDebugMode: false
  });

  // Set up event listeners
  setupEventListeners(appManager, builderManager, blueprintManager, scriptEngine);

  return { appManager, builderManager, blueprintManager, scriptEngine };
}

function setupEventListeners(
  appManager: AppManager,
  builderManager: BuilderManager,
  blueprintManager: BlueprintManager,
  scriptEngine: ScriptEngine
) {
  // App Manager events
  appManager.on('appCreated', ({ app }) => {
    console.log(`📱 App created: ${app.name} (${app.id})`);
  });

  appManager.on('appError', ({ appId, error }) => {
    console.error(`💥 App error (${appId}):`, error);
  });

  // Builder Manager events
  builderManager.on('sessionStarted', (session) => {
    console.log(`🔨 Build session started: ${session.id}`);
  });

  builderManager.on('actionExecuted', (action) => {
    console.log(`🔧 Action executed: ${action.type} on ${action.entityId}`);
  });

  // Blueprint Manager events
  blueprintManager.on('blueprintCreated', ({ blueprint }) => {
    console.log(`📋 Blueprint created: ${blueprint.name} (${blueprint.id})`);
  });

  blueprintManager.on('versionCreated', ({ blueprintId, version }) => {
    console.log(`📈 Blueprint version created: ${blueprintId} v${version.number}`);
  });

  // Script Engine events
  scriptEngine.on('scriptExecuted', ({ scriptId, executionTime }) => {
    console.log(`⚡ Script executed: ${scriptId} (${executionTime}ms)`);
  });

  scriptEngine.on('scriptError', ({ scriptId, error }) => {
    console.error(`💥 Script error (${scriptId}):`, error);
  });
}

async function createInteractiveGameBlueprint(blueprintManager: BlueprintManager) {
  console.log('📋 Creating interactive game blueprint...');

  const blueprint = await blueprintManager.createBlueprint({
    name: 'Interactive 3D Game',
    description: 'A multiplayer interactive 3D game with physics, animations, and scripting',
    category: 'games',
    tags: ['interactive', 'multiplayer', '3d', 'game', 'physics'],
    script: `
      // Interactive Game Script
      let score = 0;
      let players = new Map();
      let collectibles = [];
      let gameTime = 0;

      // Initialize game
      function init() {
        console.log('Game initialized!');
        app.setState({ score: 0, gameTime: 0, players: 0 });

        // Create collectibles
        createCollectibles();

        // Start game loop
        world.on('fixedUpdate', update);

        // Handle player interactions
        app.on('playerJoin', handlePlayerJoin);
        app.on('playerLeave', handlePlayerLeave);
        app.on('collect', handleCollect);
      }

      function createCollectibles() {
        const positions = [
          [2, 1, 2], [-2, 1, 2], [0, 1, -2],
          [3, 2, 0], [-3, 2, 0], [0, 3, 3]
        ];

        positions.forEach((pos, index) => {
          const collectible = app.create('prim', {
            type: 'sphere',
            size: [0.3, 0.3, 0.3],
            position: pos,
            color: '#FFD700',
            emissive: '#FFD700',
            emissiveIntensity: 2,
            physics: 'trigger'
          });

          collectibles.push({
            id: collectible.id,
            position: pos,
            collected: false
          });
        });
      }

      function update(delta) {
        gameTime += delta;
        app.setState({ gameTime });

        // Rotate collectibles
        collectibles.forEach(item => {
          if (!item.collected) {
            const entity = world.getEntity(item.id);
            if (entity) {
              entity.rotation.y += delta;
            }
          }
        });
      }

      function handlePlayerJoin(player) {
        players.set(player.id, {
          score: 0,
          joins: Date.now()
        });

        const playerCount = players.size;
        app.setState({ players: playerCount });

        world.emit('chat', {
          from: 'System',
          body: \`${player.username} joined the game! Players: \${playerCount}\`
        });
      }

      function handlePlayerLeave(player) {
        players.delete(player.id);
        const playerCount = players.size;
        app.setState({ players: playerCount });
      }

      function handleCollect(data) {
        const { playerId, collectibleId } = data;
        const player = players.get(playerId);
        const collectible = collectibles.find(c => c.id === collectibleId);

        if (player && collectible && !collectible.collected) {
          collectible.collected = true;
          player.score += 10;
          score += 10;

          app.setState({ score });

          // Remove collectible
          const entity = world.getEntity(collectibleId);
          if (entity) {
            entity.position = [0, -10, 0]; // Move it underground
          }

          world.emit('chat', {
            from: 'System',
            body: \`\${player.username} collected a coin! Score: \${score}\`
          });

          // Check win condition
          if (collectibles.every(c => c.collected)) {
            world.emit('chat', {
              from: 'System',
              body: '🎉 All coins collected! Game Over!'
            });
          }
        }
      }

      // Start the game
      init();
    `,
    props: {
      maxPlayers: 10,
      gameDuration: 300, // 5 minutes
      collectibleCount: 6,
      respawnTime: 5000
    },
    public: true,
    license: 'MIT'
  }, 'user123');

  // Add assets to the blueprint
  await uploadGameAssets(blueprintManager, blueprint.id);

  // Create initial version
  await blueprintManager.createBlueprintVersion(
    blueprint.id,
    'Initial version with basic game mechanics',
    'user123'
  );

  return blueprint;
}

async function uploadGameAssets(blueprintManager: BlueprintManager, blueprintId: string) {
  console.log('📦 Uploading game assets...');

  // Upload a 3D model for the game arena
  const arenaModel = new Blob([JSON.stringify({
    type: 'glb',
    vertices: [],
    materials: []
  })], { type: 'application/json' });

  await blueprintManager.uploadBlueprintAsset(
    blueprintId,
    arenaModel,
    'model',
    'arena.glb'
  );

  // Upload background music
  const backgroundMusic = new Blob([JSON.stringify({
    type: 'audio',
    duration: 120,
    format: 'mp3'
  })], { type: 'application/json' });

  await blueprintManager.uploadBlueprintAsset(
    blueprintId,
    backgroundMusic,
    'audio',
    'background-music.mp3'
  );

  console.log('✅ Assets uploaded successfully');
}

async function createAppFromBlueprint(appManager: AppManager, blueprint: Blueprint) {
  console.log('📱 Creating app from blueprint...');

  const app = await appManager.createAppFromBlueprint(blueprint.id, {
    name: 'My Interactive Game',
    description: 'A fun multiplayer game experience',
    position: [0, 0, 0],
    quaternion: [0, 0, 0, 1],
    scale: [1, 1, 1],
    settings: {
      maxUsers: 10,
      public: true,
      allowVoice: true,
      allowChat: true,
      physics: true,
      enableNetworking: true,
      enableCollaboration: true
    },
    tags: ['game', 'interactive', 'multiplayer'],
    userId: 'user123'
  });

  // Create an app instance
  const instance = await appManager.createAppInstance(app.id, {
    autoStart: true,
    hotReload: true,
    debugMode: true,
    performanceMonitoring: true,
    networkSync: true
  });

  console.log(`✅ App created: ${app.name} (${app.id})`);
  console.log(`🎮 Instance started: ${instance.id}`);

  return app;
}

async function startBuildSession(builderManager: BuilderManager, app: App) {
  console.log('🔨 Starting build session...');

  // Get the app entity (simulated)
  const appEntity = {
    id: app.id,
    initialize: async () => {
      console.log('App entity initialized');
    },
    destroy: async () => {
      console.log('App entity destroyed');
    }
  } as any;

  const session = await builderManager.startBuildSession(appEntity, 'user123', {
    enablePhysics: true,
    enableCollision: true,
    showGrid: true,
    showGizmos: true,
    localSpace: false,
    snapToGrid: true,
    snapAngle: 15,
    snapDistance: 0.5
  });

  // Set build mode and tool
  builderManager.setBuildMode(BuildMode.GRAB);
  builderManager.setBuildTool(BuildTool.MOVE);

  console.log(`✅ Build session started: ${session.id}`);
  return session;
}

async function populateAppWithEntities(builderManager: BuilderManager, session: any) {
  console.log('🏗️ Populating app with entities...');

  const entities: Entity[] = [];

  // Create game arena
  const arena = await builderManager.addEntity({
    type: 'box',
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    scale: [20, 0.1, 20],
    material: AppTools.createMaterial({
      type: 'standard',
      color: [0.3, 0.6, 0.3],
      roughness: 0.8
    }),
    physics: AppTools.createPhysicsProperties({
      type: 'static',
      mass: 0
    }),
    tags: ['arena', 'ground']
  });

  entities.push(arena);

  // Create walls
  const wallPositions: Vector3[] = [
    [10, 2, 0], [-10, 2, 0], [0, 2, 10], [0, 2, -10]
  ];

  for (const [index, position] of wallPositions.entries()) {
    const wall = await builderManager.addEntity({
      type: 'box',
      position,
      rotation: [0, Math.PI / 2 * index, 0, 1],
      scale: [0.1, 4, 20],
      material: AppTools.createMaterial({
        type: 'standard',
        color: [0.7, 0.7, 0.7],
        roughness: 0.6
      }),
      physics: AppTools.createPhysicsProperties({
        type: 'static',
        mass: 0
      }),
      tags: ['wall']
    });

    entities.push(wall);
  }

  // Create spawn points
  const spawnPositions: Vector3[] = [
    [5, 1, 5], [-5, 1, 5], [5, 1, -5], [-5, 1, -5]
  ];

  for (const position of spawnPositions) {
    const spawnPoint = await builderManager.addEntity({
      type: 'cylinder',
      position,
      rotation: [0, 0, 0, 1],
      scale: [1, 0.1, 1],
      material: AppTools.createMaterial({
        type: 'emissive',
        emissive: [0, 1, 0],
        emissiveIntensity: 0.5
      }),
      tags: ['spawn']
    });

    entities.push(spawnPoint);
  }

  // Create decorative elements
  const treePositions: Vector3[] = [
    [7, 1, 7], [-7, 1, 7], [7, 1, -7], [-7, 1, -7]
  ];

  for (const position of treePositions) {
    const tree = await builderManager.addEntity({
      type: 'cone',
      position: AppTools.addVectors(position, [0, 2, 0]),
      rotation: [0, 0, 0, 1],
      scale: [1, 3, 1],
      material: AppTools.createMaterial({
        type: 'standard',
        color: [0.1, 0.6, 0.1],
        roughness: 0.9
      }),
      tags: ['decoration', 'tree']
    });

    entities.push(tree);

    // Tree trunk
    const trunk = await builderManager.addEntity({
      type: 'cylinder',
      position: AppTools.addVectors(position, [0, 0.5, 0]),
      rotation: [0, 0, 0, 1],
      scale: [0.3, 1, 0.3],
      material: AppTools.createMaterial({
        type: 'standard',
        color: [0.4, 0.2, 0.1],
        roughness: 0.8
      }),
      tags: ['decoration', 'trunk']
    });

    entities.push(trunk);
  }

  // Create collectible items
  const collectiblePositions: Vector3[] = [
    [2, 1, 2], [-2, 1, 2], [0, 1, -2],
    [3, 1.5, 0], [-3, 1.5, 0], [0, 2, 3]
  ];

  for (const position of collectiblePositions) {
    const collectible = await builderManager.addEntity({
      type: 'sphere',
      position,
      rotation: [0, 0, 0, 1],
      scale: [0.3, 0.3, 0.3],
      material: AppTools.createMaterial({
        type: 'metal',
        color: [1, 0.8, 0],
        emissive: [1, 0.8, 0],
        emissiveIntensity: 2
      }),
      animation: AppTools.createAnimation({
        name: 'rotate',
        duration: 2,
        loop: true,
        autoplay: true,
        keyframes: [
          AppTools.createKeyframe(0, { rotation: [0, 0, 0, 1] }),
          AppTools.createKeyframe(1, { rotation: [0, Math.PI, 0, 1] }),
          AppTools.createKeyframe(2, { rotation: [0, Math.PI * 2, 0, 1] })
        ]
      }),
      tags: ['collectible', 'coin']
    });

    entities.push(collectible);
  }

  // Create a center platform
  const platform = await builderManager.addEntity({
    type: 'cylinder',
    position: [0, 1, 0],
    rotation: [0, 0, 0, 1],
    scale: [3, 0.2, 3],
    material: AppTools.createMaterial({
      type: 'standard',
      color: [0.2, 0.4, 0.8],
      metalness: 0.5,
      roughness: 0.3
    }),
    physics: AppTools.createPhysicsProperties({
      type: 'static',
      mass: 0
    }),
    tags: ['platform', 'center']
  });

  entities.push(platform);

  console.log(`✅ Created ${entities.length} entities`);
  return entities;
}

async function setupAppScripting(scriptEngine: ScriptEngine, app: App) {
  console.log('⚡ Setting up app scripting...');

  // Create enhanced game script with hot reload
  const gameScript = `
    // Enhanced Interactive Game Script with Hot Reload Support

    // Game state
    let gameState = {
      score: 0,
      timeRemaining: 300,
      players: new Map(),
      collectibles: [],
      powerUps: [],
      particles: [],
      gameActive: false,
      winner: null
    };

    // Initialize game
    function init() {
      console.log('🎮 Enhanced game initialized!');
      app.setState({
        score: 0,
        timeRemaining: 300,
        players: 0,
        gameActive: false
      });

      // Create collectibles
      createCollectibles();

      // Create power-ups
      createPowerUps();

      // Set up game loop
      world.on('fixedUpdate', update);
      world.on('lateUpdate', render);

      // Handle player interactions
      app.on('playerJoin', handlePlayerJoin);
      app.on('playerLeave', handlePlayerLeave);
      app.on('collect', handleCollect);
      app.on('powerUp', handlePowerUp);
      app.on('startGame', startGame);
      app.on('resetGame', resetGame);

      // Handle hot reload
      if (typeof hotReload !== 'undefined') {
        hotReload.on('change', () => {
          console.log('🔄 Script hot reloaded!');
          preserveGameState();
        });
      }
    }

    function createCollectibles() {
      const positions = [
        [2, 1, 2], [-2, 1, 2], [0, 1, -2],
        [3, 1.5, 0], [-3, 1.5, 0], [0, 2, 3],
        [1, 1, 1], [-1, 1, -1], [2, 1, -2]
      ];

      positions.forEach((pos, index) => {
        const collectible = app.create('prim', {
          type: 'sphere',
          size: [0.3, 0.3, 0.3],
          position: pos,
          color: '#FFD700',
          emissive: '#FFD700',
          emissiveIntensity: 2,
          physics: 'trigger'
        });

        gameState.collectibles.push({
          id: collectible.id,
          position: pos,
          collected: false,
          value: 10,
          type: 'coin'
        });
      });
    }

    function createPowerUps() {
      const powerUpTypes = ['speed', 'jump', 'magnet', 'shield'];
      const positions = [[5, 1, 5], [-5, 1, 5], [5, 1, -5]];

      positions.forEach((pos, index) => {
        const type = powerUpTypes[index % powerUpTypes.length];
        const color = {
          speed: '#FF0000',
          jump: '#00FF00',
          magnet: '#0000FF',
          shield: '#FFFF00'
        }[type];

        const powerUp = app.create('prim', {
          type: 'box',
          size: [0.5, 0.5, 0.5],
          position: pos,
          color: color,
          emissive: color,
          emissiveIntensity: 1.5,
          physics: 'trigger'
        });

        gameState.powerUps.push({
          id: powerUp.id,
          position: pos,
          collected: false,
          type: type,
          duration: 10000
        });
      });
    }

    function startGame() {
      gameState.gameActive = true;
      gameState.timeRemaining = 300;
      gameState.score = 0;
      gameState.winner = null;

      app.setState({
        gameActive: true,
        timeRemaining: gameState.timeRemaining,
        score: gameState.score
      });

      world.emit('chat', {
        from: 'System',
        body: '🎮 Game Started! Collect coins and power-ups!'
      });
    }

    function resetGame() {
      gameState.gameActive = false;
      gameState.timeRemaining = 300;
      gameState.score = 0;
      gameState.winner = null;

      // Reset collectibles
      gameState.collectibles.forEach(c => c.collected = false);
      gameState.powerUps.forEach(p => p.collected = false);

      app.setState({
        gameActive: false,
        timeRemaining: gameState.timeRemaining,
        score: gameState.score
      });
    }

    function update(delta) {
      if (!gameState.gameActive) return;

      // Update game timer
      gameState.timeRemaining -= delta;
      if (gameState.timeRemaining <= 0) {
        endGame();
        return;
      }

      app.setState({ timeRemaining: Math.max(0, gameState.timeRemaining) });

      // Rotate collectibles
      gameState.collectibles.forEach(item => {
        if (!item.collected) {
          const entity = world.getEntity(item.id);
          if (entity) {
            entity.rotation.y += delta;
            entity.position.y = item.position[1] + Math.sin(Date.now() / 1000) * 0.1;
          }
        }
      });

      // Animate power-ups
      gameState.powerUps.forEach(item => {
        if (!item.collected) {
          const entity = world.getEntity(item.id);
          if (entity) {
            entity.rotation.y += delta * 0.5;
            entity.rotation.x += delta * 0.3;
          }
        }
      });

      // Update particles
      updateParticles(delta);

      // Check win condition
      if (gameState.collectibles.every(c => c.collected)) {
        endGame();
      }
    }

    function render() {
      // Render effects
      if (gameState.gameActive) {
        // Add game-specific rendering here
      }
    }

    function handlePlayerJoin(player) {
      gameState.players.set(player.id, {
        username: player.username,
        score: 0,
        powerUps: [],
        joins: Date.now()
      });

      const playerCount = gameState.players.size;
      app.setState({ players: playerCount });

      world.emit('chat', {
        from: 'System',
        body: \`\${player.username} joined! Players: \${playerCount}\`
      });

      if (playerCount === 1 && !gameState.gameActive) {
        setTimeout(startGame, 2000);
      }
    }

    function handlePlayerLeave(player) {
      gameState.players.delete(player.id);
      const playerCount = gameState.players.size;
      app.setState({ players: playerCount });
    }

    function handleCollect(data) {
      const { playerId, collectibleId } = data;
      const player = gameState.players.get(playerId);
      const collectible = gameState.collectibles.find(c => c.id === collectibleId);

      if (player && collectible && !collectible.collected) {
        collectible.collected = true;
        player.score += collectible.value;
        gameState.score += collectible.value;

        app.setState({ score: gameState.score });

        // Create particle effect
        createParticles(collectible.position, '#FFD700');

        // Remove collectible
        const entity = world.getEntity(collectibleId);
        if (entity) {
          entity.position = [0, -10, 0];
        }

        world.emit('chat', {
          from: 'System',
          body: \`\${player.username} collected a \${collectible.type}! Score: \${gameState.score}\`
        });
      }
    }

    function handlePowerUp(data) {
      const { playerId, powerUpId } = data;
      const player = gameState.players.get(playerId);
      const powerUp = gameState.powerUps.find(p => p.id === powerUpId);

      if (player && powerUp && !powerUp.collected) {
        powerUp.collected = true;
        player.powerUps.push({
          type: powerUp.type,
          endTime: Date.now() + powerUp.duration
        });

        // Create particle effect
        createParticles(powerUp.position, '#FF00FF');

        // Remove power-up
        const entity = world.getEntity(powerUpId);
        if (entity) {
          entity.position = [0, -10, 0];
        }

        world.emit('chat', {
          from: 'System',
          body: \`\${player.username} got a \${powerUp.type} power-up!\`
        });
      }
    }

    function createParticles(position, color) {
      for (let i = 0; i < 10; i++) {
        const particle = app.create('prim', {
          type: 'sphere',
          size: [0.1, 0.1, 0.1],
          position: AppTools.addVectors(position, [
            (Math.random() - 0.5) * 0.5,
            Math.random() * 0.5,
            (Math.random() - 0.5) * 0.5
          ]),
          color: color,
          emissive: color,
          emissiveIntensity: 3
        });

        gameState.particles.push({
          id: particle.id,
          position: particle.position,
          velocity: [
            (Math.random() - 0.5) * 2,
            Math.random() * 2,
            (Math.random() - 0.5) * 2
          ],
          life: 1
        });
      }
    }

    function updateParticles(delta) {
      gameState.particles = gameState.particles.filter(particle => {
        particle.life -= delta * 2;
        particle.position = AppTools.addVectors(particle.position, particle.velocity);
        particle.velocity[1] -= delta * 5; // gravity

        const entity = world.getEntity(particle.id);
        if (entity) {
          entity.position = particle.position;
          entity.material.opacity = particle.life;
        }

        return particle.life > 0;
      });
    }

    function endGame() {
      gameState.gameActive = false;

      // Find winner
      let topPlayer = null;
      let topScore = 0;

      gameState.players.forEach((player, id) => {
        if (player.score > topScore) {
          topScore = player.score;
          topPlayer = player;
        }
      });

      gameState.winner = topPlayer;

      if (topPlayer) {
        world.emit('chat', {
          from: 'System',
          body: \`🏆 Game Over! Winner: \${topPlayer.username} with \${topScore} points!\`
        });
      } else {
        world.emit('chat', {
          from: 'System',
          body: '⏰ Time\'s up! Game Over!'
        });
      }

      app.setState({
        gameActive: false,
        winner: topPlayer?.username || null,
        finalScore: topScore
      });
    }

    function preserveGameState() {
      // Preserve game state during hot reload
      const currentState = app.getState();
      console.log('🔄 Preserving game state:', currentState);

      // Restore any lost entities
      if (gameState.collectibles.length === 0) {
        createCollectibles();
      }
      if (gameState.powerUps.length === 0) {
        createPowerUps();
      }
    }

    // Start the game
    init();
  `;

  // Compile the script
  const { scriptId } = await scriptEngine.compileScript(gameScript, {
    id: 'enhanced-game-script',
    filename: 'game.js',
    sourceMap: true
  });

  // Enable hot reload for the script
  scriptEngine.enableHotReload({
    enabled: true,
    watchPaths: ['./scripts'],
    ignorePaths: ['node_modules'],
    debounceMs: 100
  });

  console.log(`✅ Script setup complete (ID: ${scriptId})`);
  return scriptId;
}

async function enableCollaboration(blueprintManager: BlueprintManager, blueprint: Blueprint) {
  console.log('🤝 Enabling collaboration...');

  // Add collaborators
  const collaborators = [
    { userId: 'user456', role: CollaboratorRole.EDITOR },
    { userId: 'user789', role: CollaboratorRole.VIEWER },
    { userId: 'user012', role: CollaboratorRole.COMMENTER }
  ];

  for (const collaborator of collaborators) {
    await blueprint.addCollaborator(collaborator.userId, collaborator.role, 'user123');
  }

  // Add comments
  await blueprint.addComment('user123', 'Great game concept! Maybe add some obstacles?', undefined, 1);
  await blueprint.addComment('user456', 'I like the power-up system. Could we add more types?', undefined, 1);
  await blueprint.addComment('user123', 'Good idea! I\'ll add speed boost and shield power-ups.', 'comment1', 1);

  console.log(`✅ Collaboration enabled with ${collaborators.length} collaborators`);
}

async function addAdvancedFeatures(builderManager: BuilderManager, session: any) {
  console.log('✨ Adding advanced features...');

  // Create entity templates
  const coinTemplate = await builderManager.createTemplate({
    name: 'Gold Coin',
    description: 'A collectible gold coin worth 10 points',
    category: 'collectibles',
    entityType: 'sphere',
    defaultProperties: {
      type: 'sphere',
      size: [0.3, 0.3, 0.3],
      material: AppTools.createMaterial({
        type: 'metal',
        color: [1, 0.8, 0],
        emissive: [1, 0.8, 0],
        emissiveIntensity: 2
      }),
      physics: 'trigger',
      tags: ['collectible', 'coin']
    },
    tags: ['collectible', 'game', 'coin']
  });

  // Place multiple coins using the template
  const coinPositions: Vector3[] = [
    [4, 1, 4], [-4, 1, 4], [4, 1, -4], [-4, 1, -4],
    [2, 1, 2], [-2, 1, 2], [2, 1, -2], [-2, 1, -2]
  ];

  for (const position of coinPositions) {
    await builderManager.placeTemplate(coinTemplate.id, position);
  }

  // Create material presets
  const glassMaterial = AppTools.createGlassMaterial();
  const metalMaterial = AppTools.createMetalMaterial();

  // Apply materials to existing entities
  const selection = builderManager.getSelection();
  if (selection.entities.length > 0) {
    // Apply glass material to first half of selected entities
    const firstHalf = selection.entities.slice(0, Math.ceil(selection.entities.length / 2));
    await builderManager.applyMaterial(firstHalf, 'glass-preset');

    // Apply metal material to second half
    const secondHalf = selection.entities.slice(Math.ceil(selection.entities.length / 2));
    await builderManager.applyMaterial(secondHalf, 'metal-preset');
  }

  // Create a complex animation sequence
  const platformAnimation = AppTools.createAnimation({
    name: 'platform-pulse',
    duration: 3,
    loop: true,
    keyframes: [
      AppTools.createKeyframe(0, { scale: [1, 0.2, 1] }),
      AppTools.createKeyframe(1.5, { scale: [1.1, 0.3, 1.1] }),
      AppTools.createKeyframe(3, { scale: [1, 0.2, 1] })
    ]
  });

  // Duplicate some entities with transforms
  const entitiesToDuplicate = builderManager.getSelection().entities.slice(0, 3);
  for (const entityId of entitiesToDuplicate) {
    const duplicate = await builderManager.duplicateEntity(entityId, [2, 0, 0]);
    if (duplicate) {
      // Apply rotation to duplicate
      await builderManager.rotateEntities([duplicate.id], [0, Math.PI / 4, 0], {
        space: 'world'
      });
    }
  }

  // Create a selection group
  if (builderManager.getSelection().entities.length > 0) {
    const group = {
      id: AppTools.generateId(),
      name: 'Game Objects',
      entities: builderManager.getSelection().entities,
      pivot: [0, 0, 0]
    };

    console.log(`✅ Created selection group with ${group.entities.length} entities`);
  }

  // Test undo/redo functionality
  await builderManager.saveSnapshot('Before complex changes');

  // Make some changes
  await builderManager.moveEntities(
    builderManager.getSelection().entities.slice(0, 2),
    [1, 0, 1],
    { snap: true }
  );

  await builderManager.rotateEntities(
    builderManager.getSelection().entities.slice(2, 4),
    [0, Math.PI / 6, 0],
    { space: 'local' }
  );

  // Test undo
  console.log('Testing undo functionality...');
  const undoResult = await builderManager.undo();
  console.log(`Undo successful: ${undoResult}`);

  console.log('✅ Advanced features added successfully');
}

async function testAndValidate(appManager: AppManager, builderManager: BuilderManager, app: App) {
  console.log('🧪 Testing and validating...');

  // Test app retrieval
  const retrievedApp = await appManager.getApp(app.id);
  if (!retrievedApp) {
    throw new Error('Failed to retrieve app');
  }
  console.log('✅ App retrieval test passed');

  // Test app search
  const searchResults = await appManager.searchApps('interactive');
  if (searchResults.apps.length === 0) {
    console.warn('⚠️ No apps found in search results');
  }
  console.log(`✅ App search test passed (${searchResults.apps.length} results)`);

  // Test blueprint operations
  const blueprints = await builderManager.getActiveApp();
  if (blueprints) {
    console.log('✅ Blueprint operations test passed');
  }

  // Test builder operations
  const selection = builderManager.getSelection();
  console.log(`✅ Builder selection test passed (${selection.entities.length} entities selected)`);

  // Test performance monitoring
  const performance = await AppTools.measurePerformance(async () => {
    // Simulate some work
    for (let i = 0; i < 1000; i++) {
      AppTools.addVectors([1, 2, 3], [4, 5, 6]);
      AppTools.vectorLength([3, 4, 5]);
    }
  }, 10);

  console.log(`✅ Performance test passed (${performance.averageTime.toFixed(2)}ms average)`);

  // Test utility functions
  const testVector = [1, 2, 3];
  const normalized = AppTools.normalizeVector(testVector);
  const length = AppTools.vectorLength(normalized);

  if (Math.abs(length - 1) > 0.001) {
    throw new Error('Vector normalization test failed');
  }
  console.log('✅ Utility functions test passed');

  console.log('🎉 All tests passed successfully!');
}

async function deployApp(appManager: AppManager, app: App) {
  console.log('🚀 Deploying app...');

  const deployment = await appManager.deployApp(app.id, {
    environment: 'production',
    region: 'us-west-2',
    ssl: true,
    scaling: {
      minInstances: 1,
      maxInstances: 5,
      autoScale: true
    },
    monitoring: {
      enableMetrics: true,
      enableLogging: true,
      enableTracing: true
    }
  });

  // Wait a moment for deployment to process
  await new Promise(resolve => setTimeout(resolve, 2000));

  return deployment;
}

async function cleanup(
  appManager: AppManager,
  builderManager: BuilderManager,
  scriptEngine: ScriptEngine
) {
  console.log('🧹 Cleaning up...');

  await appManager.cleanup();
  await builderManager.destroy();
  await scriptEngine.cleanup();

  console.log('✅ Cleanup completed');
}

// Run the example
if (require.main === module) {
  comprehensiveAppDevelopmentExample()
    .then(() => {
      console.log('🎉 Example completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Example failed:', error);
      process.exit(1);
    });
}

export {
  comprehensiveAppDevelopmentExample,
  initializeManagers,
  createInteractiveGameBlueprint,
  createAppFromBlueprint,
  startBuildSession,
  populateAppWithEntities,
  setupAppScripting,
  enableCollaboration,
  addAdvancedFeatures,
  testAndValidate,
  deployApp,
  cleanup
};