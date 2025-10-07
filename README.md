# hyperfy-sdk

[![npm version](https://badge.fury.io/js/hyperfy-sdk.svg)](https://badge.fury.io/js/hyperfy-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/AnEntrypoint/hyperfy-sdk/workflows/CI/badge.svg)](https://github.com/AnEntrypoint/hyperfy-sdk/actions)

Official Hyperfy SDK for Node.js - Build immersive 3D worlds and virtual reality experiences on the Hyperfy platform.

## 🚀 Quick Start

### Installation

```bash
npm install hyperfy-sdk
```

### Basic Usage

```javascript
import { HyperfyClient } from 'hyperfy-sdk';

// Connect to a Hyperfy world
const client = new HyperfyClient({
  wsUrl: 'ws://localhost:3000',
  authToken: 'your-auth-token',
  name: 'YourName',
  avatar: 'https://example.com/avatar.png'
});

client.on('connected', () => {
  console.log('Connected to Hyperfy world!');
  
  // Listen for events
  client.on('entityAdded', (entity) => {
    console.log('New entity:', entity);
  });
  
  client.on('chatAdded', (message) => {
    console.log('New message:', message);
  });
});

// Start connection
client.connect();
```

## 📚 Features

- **🌐 Real-time Communication** - WebSocket-based real-time connectivity
- **🎮 Entity Management** - Create, modify, and delete 3D entities
- **💬 Chat System** - Send and receive chat messages
- **👥 Player Management** - Handle player joins, leaves, and interactions
- **📁 File Upload** - Upload assets and files to your worlds
- **🔧 Event-Driven** - Comprehensive event system for world changes
- **🛡️ Type Safety** - Full TypeScript support with comprehensive definitions
- **🔌 Plugin System** - Extensible architecture for custom functionality

## 🏗️ Architecture

The Hyperfy SDK provides a clean, event-driven interface for interacting with Hyperfy worlds:

### Core Components

- **NetworkClient** - Handles WebSocket communication and protocol management
- **EntityManager** - Manages 3D entities in the world
- **PlayerManager** - Handles player state and interactions
- **ChatManager** - Manages chat messages and history
- **FileManager** - Handles file uploads and downloads

### Event System

All major actions emit events that you can listen to:

```javascript
// Entity events
client.on('entityAdded', (entity) => {});
client.on('entityModified', (entity) => {});
client.on('entityRemoved', (entityId) => {});

// Player events  
client.on('playerJoined', (player) => {});
client.on('playerLeft', (playerId) => {});
client.on('playerTeleport', (data) => {});

// Chat events
client.on('chatAdded', (message) => {});

// World events
client.on('snapshot', (worldData) => {});
client.on('settingsModified', (settings) => {});
```

## 📖 API Reference

### HyperfyClient

#### Constructor

```typescript
new HyperfyClient(options: HyperfyClientOptions)
```

**Options:**
- `wsUrl` (string): WebSocket server URL
- `authToken` (string): Authentication token
- `name` (string): Display name
- `avatar` (string): Avatar URL (optional)

#### Methods

##### connect()
Connect to the Hyperfy world.

```javascript
client.connect();
```

##### disconnect()
Disconnect from the world.

```javascript
client.disconnect();
```

##### sendPacket(type, data)
Send a packet to the server.

```javascript
client.sendPacket('command', { action: 'spawn', type: 'box' });
```

##### createEntity(options)
Create a new entity in the world.

```javascript
const entity = client.createEntity({
  type: 'box',
  position: [0, 1, 0],
  scale: [1, 1, 1],
  color: '#ff0000'
});
```

##### updateEntity(id, changes)
Update an existing entity.

```javascript
client.updateEntity('entity-id', {
  position: [5, 2, 0],
  color: '#00ff00'
});
```

##### removeEntity(id)
Remove an entity from the world.

```javascript
client.removeEntity('entity-id');
```

##### sendChat(message)
Send a chat message.

```javascript
client.sendChat('Hello, world!');
```

##### teleport(position)
Teleport your player to a position.

```javascript
client.teleport([10, 0, 5]);
```

#### Properties

- `connected` (boolean): Connection status
- `id` (string | null): World ID when connected
- `entities` (Map): All entities in the world
- `players` (Map): All players in the world
- `chat` (Array): Chat message history

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## 🔧 Development

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## 📝 Examples

### Basic Entity Manipulation

```javascript
import { HyperfyClient } from 'hyperfy-sdk';

const client = new HyperfyClient({
  wsUrl: 'ws://localhost:3000',
  authToken: process.env.HYPERTY_TOKEN,
  name: 'BotUser'
});

client.on('connected', () => {
  // Create a spinning cube
  const cube = client.createEntity({
    type: 'box',
    position: [0, 2, 0],
    scale: [1, 1, 1],
    color: '#4287f5'
  });
  
  // Animate it
  let rotation = 0;
  setInterval(() => {
    rotation += 0.05;
    client.updateEntity(cube.id, {
      rotation: [0, rotation, 0]
    });
  }, 50);
});
```

### Chat Bot

```javascript
client.on('chatAdded', (message) => {
  if (message.body.startsWith('!ping')) {
    client.sendChat('Pong! 🏓');
  }
  
  if (message.body.startsWith('!time')) {
    client.sendChat(`Current time: ${new Date().toLocaleString()}`);
  }
});
```

### File Upload

```javascript
import fs from 'fs';

// Upload an image
const imageBuffer = fs.readFileSync('./my-image.png');
client.uploadFile(imageBuffer, 'my-image.png', 'image/png')
  .then(url => {
    console.log('File uploaded:', url);
    
    // Use the uploaded image as an entity texture
    client.createEntity({
      type: 'box',
      position: [0, 1, 0],
      texture: url
    });
  })
  .catch(error => {
    console.error('Upload failed:', error);
  });
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/amazing-feature`
5. Make your changes
6. Run tests: `npm test`
7. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 [Documentation](https://github.com/AnEntrypoint/hyperfy-sdk/wiki)
- 🐛 [Issue Tracker](https://github.com/AnEntrypoint/hyperfy-sdk/issues)
- 💬 [Discussions](https://github.com/AnEntrypoint/hyperfy-sdk/discussions)

## 🔗 Links

- [Hyperfy Platform](https://hyperfy.com)
- [API Documentation](https://github.com/AnEntrypoint/hyperfy-sdk/wiki/API-Reference)
- [Examples](https://github.com/AnEntrypoint/hyperfy-sdk/tree/main/examples)

---

Made with ❤️ for the Hyperfy community
