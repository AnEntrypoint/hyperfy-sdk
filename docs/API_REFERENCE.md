# API Reference

This document provides a comprehensive reference for all Hyperfy SDK classes, methods, and types.

## Table of Contents

- [HyperfySDK](#hyperfysdk)
- [AppManager](#appmanager)
- [EntityManager](#entitymanager)
- [ChatManager](#chatmanager)
- [FileManager](#filemanager)
- [BuilderManager](#buildermanager)
- [Types](#types)
- [Events](#events)
- [Errors](#errors)

## HyperfySDK

The main SDK class that orchestrates all managers and provides the primary interface.

### Constructor

```typescript
new HyperfySDK(config: SDKConfig)
```

**Parameters:**
- `config` - SDK configuration object

**SDKConfig:**
```typescript
interface SDKConfig {
  apiUrl?: string;        // API base URL (default: 'https://api.hyperfy.com')
  wsUrl?: string;         // WebSocket URL (default: 'wss://ws.hyperfy.com')
  apiKey?: string;        // API key for authentication
  timeout?: number;       // Request timeout in ms (default: 10000)
  retries?: number;       // Number of retries (default: 3)
  logLevel?: LogLevel;    // Logging level (default: 'info')
}
```

**Example:**
```typescript
const sdk = new HyperfySDK({
  apiUrl: 'https://api.hyperfy.com',
  wsUrl: 'wss://ws.hyperfy.com',
  apiKey: 'your-api-key',
  logLevel: 'info',
});
```

### Methods

#### connect()

```typescript
connect(appId?: string): Promise<void>
```

Connect to Hyperfy. Optionally connect to a specific app.

**Parameters:**
- `appId` - Optional app ID to connect to

**Returns:** Promise that resolves when connected

#### disconnect()

```typescript
disconnect(): Promise<void>
```

Disconnect from Hyperfy.

**Returns:** Promise that resolves when disconnected

#### authenticate()

```typescript
authenticate(): Promise<User>
```

Authenticate with the Hyperfy API.

**Returns:** Promise resolving to user information

#### loadApp()

```typescript
loadApp(appId: string): Promise<App>
```

Load a specific app.

**Parameters:**
- `appId` - App ID to load

**Returns:** Promise resolving to app object

#### getManager()

```typescript
getEntityManager(): EntityManager
getAppManager(): AppManager
getChatManager(): ChatManager
getFileManager(): FileManager
getBuilderManager(): BuilderManager
```

Get manager instances for different features.

## AppManager

Manages Hyperfy applications.

### Methods

#### createApp()

```typescript
createApp(data: CreateAppData): Promise<App>
```

Create a new app.

**CreateAppData:**
```typescript
interface CreateAppData {
  name: string;
  description?: string;
  url?: string;
  settings?: AppSettings;
}
```

#### getApp()

```typescript
getApp(appId: string): Promise<App>
```

Get app details.

#### updateApp()

```typescript
updateApp(appId: string, data: UpdateAppData): Promise<App>
```

Update an existing app.

#### deleteApp()

```typescript
deleteApp(appId: string): Promise<void>
```

Delete an app.

#### listApps()

```typescript
listApps(options?: ListAppsOptions): Promise<ListResponse<App>>
```

List apps with pagination and filtering.

**ListAppsOptions:**
```typescript
interface ListAppsOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: {
    public?: boolean;
    owner?: string;
  };
}
```

#### searchApps()

```typescript
searchApps(query: string, options?: SearchOptions): Promise<SearchResponse<App>>
```

Search for apps.

## EntityManager

Manages 3D entities in apps.

### Methods

#### addEntity()

```typescript
addEntity(data: EntityData): string
```

Add a new entity to the scene.

**EntityData:**
```typescript
interface EntityData {
  type: EntityType;
  position: Vector3;
  rotation?: Vector3;
  scale?: Vector3;
  properties?: EntityProperties;
  parent?: string;
}
```

#### updateEntity()

```typescript
updateEntity(entityId: string, data: Partial<EntityData>): void
```

Update an existing entity.

#### removeEntity()

```typescript
removeEntity(entityId: string): void
```

Remove an entity from the scene.

#### moveEntity()

```typescript
moveEntity(entityId: string, position: Vector3): void
```

Move an entity to a new position.

#### rotateEntity()

```typescript
rotateEntity(entityId: string, rotation: Vector3): void
```

Rotate an entity.

#### scaleEntity()

```typescript
scaleEntity(entityId: string, scale: Vector3): void
```

Scale an entity.

#### getEntity()

```typescript
getEntity(entityId: string): Entity | null
```

Get an entity by ID.

#### getAllEntities()

```typescript
getAllEntities(): Entity[]
```

Get all entities in the scene.

#### getEntitiesByType()

```typescript
getEntitiesByType(type: EntityType): Entity[]
```

Get entities by type.

#### findEntitiesInRadius()

```typescript
findEntitiesInRadius(center: Vector3, radius: number): Entity[]
```

Find entities within a radius.

## ChatManager

Manages chat functionality.

### Methods

#### sendMessage()

```typescript
sendMessage(appId: string, content: string, userId: string, options?: MessageOptions): Promise<Message>
```

Send a chat message.

#### getMessages()

```typescript
getMessages(appId: string, options?: GetMessagesOptions): Promise<ListResponse<Message>>
```

Get message history.

#### editMessage()

```typescript
editMessage(messageId: string, content: string, userId: string): Promise<Message>
```

Edit a message.

#### deleteMessage()

```typescript
deleteMessage(messageId: string, userId: string): Promise<void>
```

Delete a message.

#### createRoom()

```typescript
createRoom(data: CreateRoomData): Promise<ChatRoom>
```

Create a chat room.

#### joinRoom()

```typescript
joinRoom(roomId: string, userId: string): Promise<void>
```

Join a chat room.

#### leaveRoom()

```typescript
leaveRoom(roomId: string, userId: string): Promise<void>
```

Leave a chat room.

## FileManager

Manages file uploads and downloads.

### Methods

#### uploadFile()

```typescript
uploadFile(path: string, options?: UploadOptions): Promise<UploadResult>
```

Upload a file from disk.

#### uploadBuffer()

```typescript
uploadBuffer(buffer: Buffer, filename: string, options?: UploadOptions): Promise<UploadResult>
```

Upload a file from a buffer.

#### uploadStream()

```typescript
uploadStream(stream: Readable, filename: string, size: number, options?: UploadOptions): Promise<UploadResult>
```

Upload a file from a stream.

#### getFile()

```typescript
getFile(fileId: string): Promise<FileInfo>
```

Get file information.

#### downloadFile()

```typescript
downloadFile(fileId: string, path: string): Promise<string>
```

Download a file to disk.

#### downloadFileToBuffer()

```typescript
downloadFileToBuffer(fileId: string): Promise<Buffer>
```

Download a file to a buffer.

#### listFiles()

```typescript
listFiles(options?: ListFilesOptions): Promise<ListResponse<FileInfo>>
```

List files with filtering.

#### updateFileMetadata()

```typescript
updateFileMetadata(fileId: string, metadata: Partial<FileMetadata>): Promise<void>
```

Update file metadata.

#### deleteFile()

```typescript
deleteFile(fileId: string): Promise<void>
```

Delete a file.

## BuilderManager

Manages build sessions and builder tools.

### Methods

#### startBuildSession()

```typescript
startBuildSession(appId: string, userId: string): Promise<BuildSession>
```

Start a new build session.

#### endBuildSession()

```typescript
endBuildSession(sessionId: string): Promise<void>
```

End a build session.

#### addEntity()

```typescript
addEntity(data: EntityData): Promise<Entity>
```

Add an entity via builder.

#### moveEntity()

```typescript
moveEntity(entityId: string, position: Vector3): Promise<void>
```

Move an entity via builder.

#### saveSnapshot()

```typescript
saveSnapshot(name?: string): Promise<Snapshot>
```

Save a snapshot.

#### undoLastAction()

```typescript
undoLastAction(): Promise<void>
```

Undo the last action.

#### redoLastAction()

```typescript
redoLastAction(): Promise<void>
```

Redo the last undone action.

#### publishBuild()

```typescript
publishBuild(options?: PublishOptions): Promise<void>
```

Publish the current build.

## Types

### Core Types

```typescript
interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  createdAt: Date;
}

interface App {
  id: string;
  name: string;
  description?: string;
  url?: string;
  settings: AppSettings;
  owner: User;
  createdAt: Date;
  updatedAt: Date;
}

interface AppSettings {
  maxUsers: number;
  public: boolean;
  allowVoice: boolean;
  allowChat: boolean;
  [key: string]: any;
}

interface Entity {
  id: string;
  type: EntityType;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  properties: EntityProperties;
  parent?: string;
  children: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Message {
  id: string;
  content: string;
  type: MessageType;
  author: User;
  appId: string;
  roomId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  maxMembers: number;
  members: User[];
  owner: User;
  createdAt: Date;
}

interface FileInfo {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  appId?: string;
  public: boolean;
  metadata: FileMetadata;
  uploadedBy: User;
  createdAt: Date;
}
```

### Enums

```typescript
enum EntityType {
  CUBE = 'cube',
  SPHERE = 'sphere',
  PLANE = 'plane',
  CYLINDER = 'cylinder',
  CONE = 'cone',
  TORUS = 'torus',
  MODEL = 'model',
  LIGHT = 'light',
  CAMERA = 'camera',
}

enum MessageType {
  TEXT = 'text',
  COMMAND = 'command',
  SYSTEM = 'system',
  EMOTE = 'emote',
}

enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}
```

## Events

The SDK emits various events throughout its lifecycle:

### Connection Events

- `connected` - Connected to Hyperfy
- `disconnected` - Disconnected from Hyperfy
- `websocketConnected` - WebSocket connected
- `websocketDisconnected` - WebSocket disconnected

### Authentication Events

- `authenticated` - User authenticated
- `authenticationFailed` - Authentication failed

### App Events

- `appLoaded` - App loaded
- `appUpdated` - App updated
- `appCreated` - App created
- `appDeleted` - App deleted

### Entity Events

- `entityAdded` - Entity added
- `entityUpdated` - Entity updated
- `entityRemoved` - Entity removed
- `entityMoved` - Entity moved

### Chat Events

- `chatMessage` - New chat message
- `chatMessageSent` - Message sent
- `chatMessageEdited` - Message edited
- `chatMessageDeleted` - Message deleted
- `roomCreated` - Chat room created
- `roomJoined` - User joined room
- `roomLeft` - User left room

### File Events

- `fileUploaded` - File uploaded
- `fileDownloaded` - File downloaded
- `fileDeleted` - File deleted
- `fileMetadataUpdated` - File metadata updated

### Error Events

- `error` - General error occurred
- `networkError` - Network error occurred
- `validationError` - Validation error occurred

## Errors

The SDK provides specific error types:

### HyperfyError

Base error class for all SDK errors.

```typescript
class HyperfyError extends Error {
  code: string;
  details?: any;
}
```

### NetworkError

Network-related errors.

```typescript
class NetworkError extends HyperfyError {
  statusCode?: number;
  response?: any;
}
```

### ValidationError

Validation errors.

```typescript
class ValidationError extends HyperfyError {
  field?: string;
  value?: any;
}
```

### AuthenticationError

Authentication-related errors.

```typescript
class AuthenticationError extends HyperfyError {}
```

### ConnectionError

Connection-related errors.

```typescript
class ConnectionError extends HyperfyError {}
```

## Utilities

The SDK includes various utility functions:

```typescript
import {
  createVector3,
  addVectors,
  subtractVectors,
  multiplyVectors,
  distanceBetween,
  normalizeVector,
  generateId,
  validateEntity,
  debounce,
  throttle,
  formatFileSize,
  isValidEmail,
  isValidUrl,
} from '@hyperfy/sdk';
```

### Vector Operations

```typescript
// Create a 3D vector
const vector = createVector3(1, 2, 3);

// Vector math
const sum = addVectors(v1, v2);
const diff = subtractVectors(v1, v2);
const product = multiplyVectors(v1, v2);
const distance = distanceBetween(v1, v2);
const normalized = normalizeVector(vector);
```

### Utility Functions

```typescript
// Generate unique ID
const id = generateId();

// Validate entity data
const isValid = validateEntity(entityData);

// Debounce function calls
const debouncedFn = debounce(myFunction, 300);

// Throttle function calls
const throttledFn = throttle(myFunction, 100);

// Format file size
const size = formatFileSize(1048576); // "1 MB"

// Validate data
const validEmail = isValidEmail('user@example.com');
const validUrl = isValidUrl('https://example.com');
```