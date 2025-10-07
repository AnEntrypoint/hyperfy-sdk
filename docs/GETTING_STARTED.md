# Getting Started with Hyperfy SDK

This guide will help you get up and running with the Hyperfy SDK for Node.js.

## Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn
- A Hyperfy account (sign up at [hyperfy.com](https://hyperfy.com))
- API key from your Hyperfy dashboard

## Installation

```bash
npm install @hyperfy/sdk
# or
yarn add @hyperfy/sdk
```

## Quick Start

### 1. Basic Setup

```typescript
import { HyperfySDK } from '@hyperfy/sdk';

// Initialize the SDK
const sdk = new HyperfySDK({
  apiUrl: 'https://api.hyperfy.com',
  wsUrl: 'wss://ws.hyperfy.com',
  apiKey: process.env.HYPERSDK_API_KEY,
  logLevel: 'info',
});

// Connect to Hyperfy
await sdk.connect();

// Authenticate
const user = await sdk.authenticate();
console.log(`Authenticated as: ${user.username}`);
```

### 2. Create Your First App

```typescript
// Create a new app
const app = await sdk.createApp({
  name: 'My First Hyperfy App',
  description: 'A simple 3D experience',
  url: 'https://my-app.hyperfy.com',
  settings: {
    maxUsers: 10,
    public: true,
    allowVoice: true,
    allowChat: true,
  },
});

console.log(`App created with ID: ${app.id}`);
```

### 3. Add 3D Entities

```typescript
// Load your app
await sdk.loadApp(app.id);

// Get entity manager
const entityManager = sdk.getEntityManager();

// Add a cube
const cubeId = entityManager.addEntity({
  type: 'cube',
  position: { x: 0, y: 1, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  properties: {
    color: '#ff0000',
    material: 'standard',
  },
});

// Add a sphere
const sphereId = entityManager.addEntity({
  type: 'sphere',
  position: { x: 2, y: 1, z: 0 },
  properties: {
    color: '#0000ff',
    material: 'standard',
  },
});
```

### 4. Handle Events

```typescript
// Listen for entity events
entityManager.on('entityAdded', (entity) => {
  console.log(`Entity added: ${entity.type}`);
});

// Listen for chat messages
const chatManager = sdk.getChatManager();
chatManager.on('message', (message) => {
  console.log(`New message: ${message.content}`);
});

// Listen for connection events
sdk.on('connected', () => {
  console.log('Connected to Hyperfy');
});

sdk.on('disconnected', () => {
  console.log('Disconnected from Hyperfy');
});
```

## Environment Setup

### Using Environment Variables

Create a `.env` file in your project:

```env
HYPERSDK_API_KEY=your-api-key-here
HYPERSDK_API_URL=https://api.hyperfy.com
HYPERSDK_WS_URL=wss://ws.hyperfy.com
```

Then load it in your application:

```typescript
import dotenv from 'dotenv';
dotenv.config();

const sdk = new HyperfySDK({
  apiKey: process.env.HYPERSDK_API_KEY,
  apiUrl: process.env.HYPERSDK_API_URL,
  wsUrl: process.env.HYPERSDK_WS_URL,
});
```

## Common Use Cases

### File Upload

```typescript
const fileManager = sdk.getFileManager();

// Upload an image
const result = await fileManager.uploadFile('./path/to/image.jpg', {
  appId: app.id,
  public: true,
  metadata: {
    category: 'texture',
    tags: ['material', 'texture'],
  },
});

console.log(`File uploaded: ${result.url}`);
```

### Chat System

```typescript
const chatManager = sdk.getChatManager();

// Send a message
await chatManager.sendMessage(app.id, 'Hello everyone!', user.id);

// Get message history
const { messages } = await chatManager.getMessages(app.id, {
  limit: 50,
});

// Create a chat room
const room = await chatManager.createRoom({
  name: 'General',
  description: 'General discussion',
  owner: user.id,
});
```

### App Management

```typescript
const appManager = sdk.getAppManager();

// List your apps
const { apps } = await appManager.listApps({
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc',
});

// Update an app
await appManager.updateApp(app.id, {
  name: 'Updated App Name',
  settings: {
    maxUsers: 50,
  },
});
```

## Best Practices

### 1. Error Handling

```typescript
import { HyperfyError, NetworkError } from '@hyperfy/sdk';

try {
  await sdk.connect();
} catch (error) {
  if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
    // Implement retry logic
  } else if (error instanceof HyperfyError) {
    console.error('SDK error:', error.code, error.message);
    // Handle specific SDK errors
  }
}
```

### 2. Connection Management

```typescript
// Handle reconnection
sdk.on('disconnected', () => {
  console.log('Disconnected, attempting to reconnect...');
  setTimeout(async () => {
    try {
      await sdk.connect();
    } catch (error) {
      console.error('Reconnection failed:', error);
    }
  }, 5000);
});
```

### 3. Resource Cleanup

```typescript
// Clean up when shutting down
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await sdk.disconnect();
  process.exit(0);
});
```

## Next Steps

- Explore the [API Reference](./API_REFERENCE.md)
- Check out [examples](../examples/)
- Learn about [testing](./TESTING.md)
- Join our [Discord community](https://discord.gg/hyperfy)

## Troubleshooting

### Common Issues

1. **Authentication failures**: Check your API key and permissions
2. **Connection issues**: Verify your network and firewall settings
3. **Entity errors**: Ensure entities have valid properties and positions

### Getting Help

- [Documentation](https://docs.hyperfy.com)
- [GitHub Issues](https://github.com/hyperfy/hyperfy-sdk/issues)
- [Discord Community](https://discord.gg/hyperfy)
- [Email Support](mailto:support@hyperfy.com)