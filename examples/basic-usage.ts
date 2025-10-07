import { HyperfySDK } from '../src';

async function basicUsageExample() {
  console.log('🚀 Starting Hyperfy SDK Basic Usage Example');

  // Initialize the SDK
  const sdk = new HyperfySDK({
    apiUrl: 'https://api.hyperfy.com',
    wsUrl: 'wss://ws.hyperfy.com',
    apiKey: 'your-api-key-here', // Replace with your actual API key
    logLevel: 'info',
  });

  try {
    // Connect to Hyperfy
    console.log('📡 Connecting to Hyperfy...');
    await sdk.connect();
    console.log('✅ Connected successfully!');

    // Authenticate
    console.log('🔐 Authenticating...');
    const user = await sdk.authenticate();
    console.log(`✅ Authenticated as: ${user.username}`);

    // Load an app
    console.log('📱 Loading app...');
    const app = await sdk.loadApp('your-app-id-here'); // Replace with actual app ID
    console.log(`✅ Loaded app: ${app.name}`);

    // Set up event listeners
    sdk.on('entityAdded', (entity) => {
      console.log(`🎯 Entity added: ${entity.id} (${entity.type})`);
    });

    sdk.on('entityUpdated', (entity) => {
      console.log(`🔄 Entity updated: ${entity.id}`);
    });

    sdk.on('entityRemoved', (entity) => {
      console.log(`🗑️ Entity removed: ${entity.id}`);
    });

    sdk.on('chatMessage', (message) => {
      console.log(`💬 ${message.username}: ${message.content}`);
    });

    sdk.on('fileUploaded', (result) => {
      console.log(`📁 File uploaded: ${result.file.name}`);
    });

    // Get entity manager and add some entities
    const entityManager = sdk.getEntityManager();

    const cubeId = entityManager.addEntity({
      type: 'cube',
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      properties: {
        color: 'red',
        material: 'standard',
      },
    });

    console.log(`🎲 Added cube entity: ${cubeId}`);

    const sphereId = entityManager.addEntity({
      type: 'sphere',
      position: { x: 2, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 0.5, y: 0.5, z: 0.5 },
      properties: {
        color: 'blue',
        material: 'standard',
      },
    });

    console.log(`🔵 Added sphere entity: ${sphereId}`);

    // Get app manager for app operations
    const appManager = sdk.getAppManager();

    // List all apps
    console.log('📋 Listing apps...');
    const apps = await appManager.listApps({ limit: 10 });
    console.log(`Found ${apps.total} apps`);

    // Get chat manager and send a message
    const chatManager = sdk.getChatManager();

    if (app.id) {
      const message = await chatManager.sendMessage(
        app.id,
        'Hello from the Node.js SDK! 🚀',
        user.id
      );
      console.log(`💬 Sent message: ${message.id}`);
    }

    // Get file manager and upload a file
    const fileManager = sdk.getFileManager();

    // Example: Upload a text buffer
    const textContent = 'Hello from Hyperfy SDK!';
    const buffer = Buffer.from(textContent, 'utf8');

    const uploadResult = await fileManager.uploadBuffer(
      buffer,
      'hello.txt',
      {
        appId: app.id,
        public: true,
      }
    );

    console.log(`📁 Uploaded file: ${uploadResult.file.name} (${uploadResult.file.url})`);

    // Use builder manager for build operations
    const builderManager = sdk.getBuilderManager();

    if (app.id) {
      // Start a build session
      const session = await builderManager.startBuildSession(app.id, user.id);
      console.log(`🔨 Started build session: ${session.id}`);

      // Add entity through builder
      const buildEntity = await builderManager.addEntity({
        type: 'cylinder',
        position: { x: -2, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.8, y: 1.5, z: 0.8 },
        properties: {
          color: 'green',
          material: 'standard',
        },
      }, user.id);

      console.log(`🔨 Added entity via builder: ${buildEntity.id}`);

      // Save a build snapshot
      const snapshot = await builderManager.saveSnapshot('Initial build');
      console.log(`📸 Saved build snapshot: ${snapshot.id}`);

      // End the build session
      await builderManager.endBuildSession(session.id);
      console.log(`🔨 Ended build session: ${session.id}`);
    }

    // Get SDK stats
    const stats = await sdk.getStats();
    console.log('📊 SDK Stats:');
    console.log(`  Uptime: ${Math.round(stats.uptime)}s`);
    console.log(`  Entities: ${stats.entities}`);
    console.log(`  Messages: ${stats.messages}`);
    console.log(`  Connections: ${stats.connections}`);
    console.log(`  Memory Usage: ${Math.round(stats.memory.heapUsed / 1024 / 1024)}MB`);

    // Wait a bit to receive any WebSocket messages
    console.log('⏳ Waiting for WebSocket messages...');
    await new Promise(resolve => setTimeout(resolve, 2000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // Clean up
    console.log('🧹 Disconnecting...');
    await sdk.disconnect();
    sdk.destroy();
    console.log('✅ Example completed!');
  }
}

// Run the example
if (require.main === module) {
  basicUsageExample().catch(console.error);
}

export { basicUsageExample };