import { NetworkClient, NetworkClientConfig } from '../src/network/network-client';
import { PacketType, SnapshotData, EntityData, ChatMessageData } from '../src/types';

async function demonstrateNetworkUsage() {
  // Configure the network client
  const config: NetworkClientConfig = {
    wsUrl: 'wss://your-hyperfy-server.com/ws', // Replace with actual server URL
    name: 'TestUser',
    avatar: 'https://example.com/avatar.png',
    authToken: 'your-auth-token-here', // Optional if not authenticated
    logLevel: 'info',
  };

  // Create network client
  const client = new NetworkClient(config);

  // Set up event listeners
  client.on('connected', () => {
    console.log('✅ Connected to Hyperfy server');
  });

  client.on('disconnected', ({ code, reason }) => {
    console.log(`❌ Disconnected: ${code} - ${reason}`);
  });

  client.on('snapshot', (data: SnapshotData) => {
    console.log('📸 Received world snapshot:', {
      worldId: data.id,
      entityCount: data.entities.length,
      chatMessages: data.chat.length,
    });

    // Access synchronized properties
    console.log('🌐 Server time offset:', client.serverTimeOffset);
    console.log('🔗 API URL:', client.apiUrl);
    console.log('📁 Assets URL:', client.assetsUrl);
    console.log('📤 Max upload size:', client.maxUploadSize);
  });

  client.on('entityAdded', (entity: EntityData) => {
    console.log('➕ Entity added:', {
      id: entity.id,
      type: entity.type,
      position: entity.position,
    });
  });

  client.on('entityModified', (data: any) => {
    console.log('✏️ Entity modified:', {
      id: data.id,
      changes: Object.keys(data).filter(key => key !== 'id'),
    });
  });

  client.on('entityRemoved', (entityId: string) => {
    console.log('➖ Entity removed:', entityId);
  });

  client.on('chatAdded', (message: ChatMessageData) => {
    console.log('💬 New chat message:', {
      from: message.from,
      body: message.body,
    });
  });

  client.on('playerTeleport', (data: any) => {
    console.log('🚀 Player teleported:', data.position);
  });

  client.on('playerPush', (data: any) => {
    console.log('💨 Player pushed by force:', data.force);
  });

  client.on('settingsModified', (data: any) => {
    console.log('⚙️ Setting changed:', data.key, '=', data.value);
  });

  client.on('kick', (code: string) => {
    console.log('👢 Kicked from server:', code);
  });

  client.on('errors', (data: any) => {
    console.log('🚨 Server errors received:', data.errors.length);
    data.errors.forEach((error: any) => {
      console.log(`  - ${error.code}: ${error.message}`);
    });
  });

  client.on('error', (error: Error) => {
    console.error('❌ Network error:', error.message);
  });

  try {
    // Connect to the server
    console.log('🔄 Connecting to server...');
    await client.connect();

    // Example: Send a chat message (this would be handled by the chat system)
    if (client.isConnected) {
      // Note: This is just for demonstration - actual chat would be handled by the chat manager
      console.log('📡 Ready to send packets to server');

      // Example: Request errors from server
      client.requestErrors({ limit: 50, severity: 'error' });

      // Example: Subscribe to error monitoring
      client.subscribeToMcpErrors(true);

      // Example: Report an error
      client.reportError({
        code: 'EXAMPLE_ERROR',
        message: 'This is a test error report',
        timestamp: new Date(),
        details: { userId: 'test-user', context: 'example' },
      });
    }

    // Keep the connection alive for demonstration
    console.log('⏳ Keeping connection alive for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Disconnect
    client.disconnect();
    console.log('👋 Disconnected');

  } catch (error) {
    console.error('❌ Failed to connect:', error);
    client.destroy();
  }
}

// Example: File upload functionality
async function demonstrateFileUpload(client: NetworkClient) {
  try {
    // Example file data (in a real app, this would come from file system or upload)
    const fileData = Buffer.from('Example file content for upload');
    const filename = 'example.txt';
    const mimeType = 'text/plain';

    console.log('📤 Uploading file:', filename);
    await client.upload(fileData, filename, mimeType);
    console.log('✅ File uploaded successfully');
  } catch (error) {
    console.error('❌ File upload failed:', error);
  }
}

// Example: Time synchronization
function demonstrateTimeSync(client: NetworkClient) {
  const clientTime = Date.now();
  const serverTime = client.getTime(); // Synchronized server time

  console.log('⏰ Time synchronization:');
  console.log('  Client time:', new Date(clientTime).toISOString());
  console.log('  Server time:', new Date(serverTime * 1000).toISOString());
  console.log('  Time offset:', client.serverTimeOffset, 'ms');
}

// Example: Network utilities
function demonstrateNetworkUtilities(client: NetworkClient) {
  console.log('🔧 Network utilities:');
  console.log('  Connected:', client.isConnected);
  console.log('  Connection state:', client.getConnectionState());
  console.log('  Client ID:', client.id);
  console.log('  Is client:', client.isClient);
}

// Run the demonstration
if (require.main === module) {
  demonstrateNetworkUsage()
    .then(() => {
      console.log('✅ Network usage demonstration completed');
    })
    .catch((error) => {
      console.error('❌ Demonstration failed:', error);
      process.exit(1);
    });
}

export {
  demonstrateNetworkUsage,
  demonstrateFileUpload,
  demonstrateTimeSync,
  demonstrateNetworkUtilities,
};