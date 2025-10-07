import { jest } from '@jest/globals'
import { HyperfyClient, EntityBuilder, AppBuilder, ErrorHandler } from '../src/index.js'

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url
    this.readyState = MockWebSocket.CONNECTING
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null
    this.sentMessages = []

    // Simulate connection after delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) this.onopen({ type: 'open' })
    }, 10)
  }

  send(data) {
    this.sentMessages.push(data)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) this.onclose({ type: 'close' })
  }

  // Mock WebSocket constants
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
}

// Global WebSocket mock
global.WebSocket = MockWebSocket

describe('Hyperfy SDK Tests', () => {
  let client
  let testWorldUrl = 'ws://localhost:8080'

  beforeEach(() => {
    client = new HyperfyClient(testWorldUrl, {
      name: 'Test SDK Client',
      autoReconnect: false
    })
  })

  afterEach(() => {
    if (client) {
      client.disconnect()
    }
  })

  describe('Client Initialization', () => {
    test('should create client with default options', () => {
      const simpleClient = new HyperfyClient(testWorldUrl)
      expect(simpleClient.url).toBe(testWorldUrl)
      expect(simpleClient.options.name).toBe('Node.js SDK')
      expect(simpleClient.options.autoReconnect).toBe(true)
    })

    test('should create client with custom options', () => {
      const customClient = new HyperfyClient(testWorldUrl, {
        name: 'Custom Client',
        autoReconnect: false,
        authToken: 'test-token'
      })
      expect(customClient.options.name).toBe('Custom Client')
      expect(customClient.options.autoReconnect).toBe(false)
      expect(customClient.options.authToken).toBe('test-token')
    })

    test('should build WebSocket URL with parameters', () => {
      const clientWithParams = new HyperfyClient(testWorldUrl, {
        name: 'Test Client',
        authToken: 'token123',
        avatar: 'https://example.com/avatar.png'
      })
      const builtUrl = clientWithParams.buildWebSocketUrl()
      expect(builtUrl).toContain('name=')
      expect(builtUrl).toContain('authToken=token123')
      expect(builtUrl).toContain('avatar=')
    })
  })

  describe('Connection Management', () => {
    test('should connect successfully', async () => {
      await expect(client.connect()).resolves.toBe(true)
      expect(client.isConnected()).toBe(true)
    })

    test('should handle connection errors', async () => {
      const failingClient = new HyperfyClient('ws://invalid-url', {
        autoReconnect: false
      })
      // Mock connection failure
      global.WebSocket = class extends MockWebSocket {
        constructor(url) {
          super(url)
          setTimeout(() => {
            this.readyState = MockWebSocket.CLOSED
            if (this.onerror) this.onerror(new Error('Connection failed'))
          }, 10)
        }
      }

      await expect(failingClient.connect()).rejects.toThrow()
    })

    test('should disconnect cleanly', async () => {
      await client.connect()
      client.disconnect()
      expect(client.isConnected()).toBe(false)
    })

    test('should handle reconnection', async () => {
      const reconnectingClient = new HyperfyClient(testWorldUrl, {
        autoReconnect: true,
        maxReconnectAttempts: 2
      })

      await reconnectingClient.connect()
      expect(reconnectingClient.isConnected()).toBe(true)

      // Simulate connection loss
      reconnectingClient.wsManager.ws.close()
      expect(reconnectingClient.wsManager.reconnectAttempts).toBe(1)
    })
  })

  describe('Entity Management', () => {
    beforeEach(async () => {
      await client.connect()
      // Mock snapshot data
      client.wsManager.emit('snapshot', {
        id: 'test-player-id',
        serverTime: Date.now(),
        assetsUrl: 'http://localhost:8080/assets',
        apiUrl: 'http://localhost:8080/api',
        maxUploadSize: 50000000,
        settings: {},
        blueprints: [],
        entities: [],
        collections: null
      })
    })

    test('should handle entity addition', () => {
      const entityData = {
        id: 'test-entity-1',
        type: 'entity',
        position: [0, 0, 0],
        quaternion: [0, 0, 0, 1],
        scale: [1, 1, 1],
        state: {},
        name: 'Test Entity'
      }

      client.wsManager.emit('entityAdded', entityData)
      const entity = client.getEntity('test-entity-1')

      expect(entity).toBeTruthy()
      expect(entity.id).toBe('test-entity-1')
      expect(entity.type).toBe('entity')
      expect(entity.getName()).toBe('Test Entity')
    })

    test('should handle entity removal', () => {
      const entityData = {
        id: 'test-entity-2',
        type: 'entity',
        position: [0, 0, 0],
        quaternion: [0, 0, 0, 1],
        scale: [1, 1, 1],
        state: {},
        name: 'Test Entity 2'
      }

      client.wsManager.emit('entityAdded', entityData)
      expect(client.getEntity('test-entity-2')).toBeTruthy()

      client.wsManager.emit('entityRemoved', 'test-entity-2')
      expect(client.getEntity('test-entity-2')).toBeFalsy()
    })

    test('should handle entity modification', () => {
      const entityData = {
        id: 'test-entity-3',
        type: 'entity',
        position: [0, 0, 0],
        quaternion: [0, 0, 0, 1],
        scale: [1, 1, 1],
        state: {},
        name: 'Test Entity 3'
      }

      client.wsManager.emit('entityAdded', entityData)
      const entity = client.getEntity('test-entity-3')

      const updatedData = {
        id: 'test-entity-3',
        position: [5, 2, 3],
        name: 'Updated Entity'
      }

      client.wsManager.emit('entityModified', updatedData)
      expect(entity.getPosition()).toEqual([5, 2, 3])
      expect(entity.getName()).toBe('Updated Entity')
    })
  })

  describe('Player Management', () => {
    beforeEach(async () => {
      await client.connect()
    })

    test('should create player entity from snapshot', () => {
      const playerData = {
        id: 'test-player-id',
        type: 'player',
        position: [0, 1, 0],
        quaternion: [0, 0, 0, 1],
        scale: [1, 1, 1],
        state: {},
        name: 'TestPlayer',
        health: 100,
        rank: 1
      }

      client.wsManager.emit('snapshot', {
        id: 'test-player-id',
        serverTime: Date.now(),
        assetsUrl: 'http://localhost:8080/assets',
        apiUrl: 'http://localhost:8080/api',
        maxUploadSize: 50000000,
        settings: {},
        blueprints: [],
        entities: [playerData],
        collections: null
      })

      expect(client.player).toBeTruthy()
      expect(client.player.id).toBe('test-player-id')
      expect(client.player.getHealth()).toBe(100)
      expect(client.player.getRank()).toBe(1)
      expect(client.player.isBuilder()).toBe(true)
      expect(client.player.isAdmin()).toBe(false)
    })

    test('should handle player teleportation', () => {
      const playerData = {
        id: 'test-player-id',
        type: 'player',
        position: [0, 1, 0],
        quaternion: [0, 0, 0, 1],
        scale: [1, 1, 1],
        state: {},
        name: 'TestPlayer'
      }

      client.wsManager.emit('snapshot', {
        id: 'test-player-id',
        serverTime: Date.now(),
        assetsUrl: 'http://localhost:8080/assets',
        apiUrl: 'http://localhost:8080/api',
        maxUploadSize: 50000000,
        settings: {},
        blueprints: [],
        entities: [playerData],
        collections: null
      })

      const teleportData = {
        networkId: 'test-player-id',
        position: [10, 5, 10],
        quaternion: [0, 1, 0, 0]
      }

      client.wsManager.emit('playerTeleport', teleportData)
      expect(client.player.getPosition()).toEqual([10, 5, 10])
      expect(client.player.getQuaternion()).toEqual([0, 1, 0, 0])
    })
  })

  describe('App Management', () => {
    beforeEach(async () => {
      await client.connect()
    })

    test('should create app entity from blueprint', () => {
      const blueprint = {
        id: 'test-blueprint',
        name: 'Test App',
        author: 'TestAuthor',
        script: 'console.log("test")',
        props: { color: 'red' }
      }

      const appData = {
        id: 'test-app-1',
        type: 'app',
        blueprint: blueprint.id,
        position: [0, 0, 0],
        quaternion: [0, 0, 0, 1],
        scale: [1, 1, 1],
        state: {},
        name: 'Test App Instance',
        pinned: false
      }

      client.wsManager.emit('snapshot', {
        id: 'test-player-id',
        serverTime: Date.now(),
        assetsUrl: 'http://localhost:8080/assets',
        apiUrl: 'http://localhost:8080/api',
        maxUploadSize: 50000000,
        settings: {},
        blueprints: [blueprint],
        entities: [appData],
        collections: null
      })

      const app = client.getEntity('test-app-1')
      expect(app).toBeTruthy()
      expect(app.isApp()).toBe(true)
      expect(app.getBlueprintName()).toBe('Test App')
      expect(app.getBlueprintAuthor()).toBe('TestAuthor')
      expect(app.getBlueprintScript()).toBe('console.log("test")')
      expect(app.getBlueprintProperty('color')).toBe('red')
    })

    test('should handle app pinning', () => {
      const blueprint = { id: 'test-blueprint-2', name: 'Test App 2' }
      const appData = {
        id: 'test-app-2',
        type: 'app',
        blueprint: blueprint.id,
        position: [0, 0, 0],
        quaternion: [0, 0, 0, 1],
        scale: [1, 1, 1],
        state: {},
        name: 'Test App Instance 2',
        pinned: false
      }

      client.wsManager.emit('snapshot', {
        id: 'test-player-id',
        serverTime: Date.now(),
        assetsUrl: 'http://localhost:8080/assets',
        apiUrl: 'http://localhost:8080/api',
        maxUploadSize: 50000000,
        settings: {},
        blueprints: [blueprint],
        entities: [appData],
        collections: null
      })

      const app = client.getEntity('test-app-2')
      expect(app.isPinned()).toBe(false)

      // Mock successful pin
      client.send = jest.fn().mockResolvedValue(true)
      app.setPinned(true)

      expect(client.send).toHaveBeenCalledWith('entityModified', {
        id: 'test-app-2',
        pinned: true
      })
    })
  })

  describe('Chat System', () => {
    beforeEach(async () => {
      await client.connect()
    })

    test('should add chat messages', () => {
      const messageData = {
        id: 'msg-1',
        userId: 'user-1',
        name: 'TestUser',
        text: 'Hello, world!',
        timestamp: Date.now(),
        type: 'chat'
      }

      client.wsManager.emit('chatAdded', messageData)

      expect(client.chat.getMessages()).toHaveLength(1)
      expect(client.chat.getLastMessage().text).toBe('Hello, world!')
      expect(client.chat.getMessageCount()).toBe(1)
    })

    test('should send chat messages', async () => {
      client.send = jest.fn().mockResolvedValue(true)
      await expect(client.chat.sendMessage('Test message')).resolves.toBe(true)
      expect(client.send).toHaveBeenCalledWith('command', ['chat', 'Test message'])
    })

    test('should reject empty or oversized messages', async () => {
      await expect(client.chat.sendMessage('')).rejects.toThrow('non-empty string')
      await expect(client.chat.sendMessage('a'.repeat(501))).rejects.toThrow('500 characters')
    })

    test('should search messages', () => {
      const messages = [
        { id: '1', text: 'Hello world', userId: 'user1', name: 'User1', timestamp: Date.now(), type: 'chat' },
        { id: '2', text: 'World hello', userId: 'user2', name: 'User2', timestamp: Date.now(), type: 'chat' },
        { id: '3', text: 'Test message', userId: 'user1', name: 'User1', timestamp: Date.now(), type: 'chat' }
      ]

      messages.forEach(msg => client.chat.addMessage(msg))

      const searchResults = client.chat.searchMessages('hello')
      expect(searchResults).toHaveLength(2)

      const userMessages = client.chat.getMessagesByUser('user1')
      expect(userMessages).toHaveLength(2)
    })
  })

  describe('Entity Builder', () => {
    test('should create valid entity builder', () => {
      const builder = new EntityBuilder(client)
      expect(builder).toBeTruthy()
    })

    test('should build entity with position and rotation', () => {
      const builder = new EntityBuilder(client)
      builder.position(5, 2, 3).rotation(0, 1, 0, 0).name('Test Entity')

      const entityData = builder.preview()
      expect(entityData.position).toEqual([5, 2, 3])
      expect(entityData.quaternion).toEqual([0, 1, 0, 0])
      expect(entityData.name).toBe('Test Entity')
    })

    test('should validate entity data', () => {
      const builder = new EntityBuilder(client)
      builder.position([1, 2]) // Invalid position

      const validation = builder.validate()
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Position must be an array of 3 numbers')
    })

    test('should create app from builder', () => {
      const builder = new EntityBuilder(client)
      builder.asApp('test-blueprint').position(0, 1, 0).name('Test App')

      const entityData = builder.preview()
      expect(entityData.type).toBe('app')
      expect(entityData.blueprint).toBe('test-blueprint')
    })
  })

  describe('App Builder', () => {
    test('should create valid app builder', () => {
      const builder = new AppBuilder(client)
      expect(builder).toBeTruthy()
    })

    test('should build app with blueprint and properties', () => {
      const builder = new AppBuilder(client)
      builder
        .blueprint('test-blueprint')
        .name('Test App')
        .position(0, 1, 0)
        .pinned(true)
        .setBlueprintProp('color', 'blue')
        .author('TestAuthor')

      const preview = builder.preview()
      expect(preview.appData.blueprint).toBe('test-blueprint')
      expect(preview.appData.name).toBe('Test App')
      expect(preview.appData.pinned).toBe(true)
      expect(preview.blueprintData.props.color).toBe('blue')
      expect(preview.blueprintData.author).toBe('TestAuthor')
    })

    test('should create app grid', async () => {
      const builder = new AppBuilder(client)
      builder.blueprint('test-blueprint').name('Grid App')

      client.send = jest.fn().mockResolvedValue(true)
      client.getEntity = jest.fn().mockReturnValue({ id: 'test-entity' })

      const entities = await builder.buildGrid(2, 3, 2)
      expect(entities).toHaveLength(6)
      expect(client.send).toHaveBeenCalledTimes(6)
    })

    test('should validate app data', () => {
      const builder = new AppBuilder(client)
      builder.position(0, 1, 0) // Missing blueprint

      const validation = builder.validate()
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('App must have a blueprint specified')
    })
  })

  describe('Error Handling', () => {
    test('should handle and track errors', () => {
      const errorHandler = new ErrorHandler()
      const error = new Error('Test error')

      const errorData = errorHandler.handleError(error, { context: 'test' })

      expect(errorData.message).toBe('Test error')
      expect(errorData.context.context).toBe('test')
      expect(errorHandler.getErrors()).toHaveLength(1)
    })

    test('should handle warnings', () => {
      const errorHandler = new ErrorHandler()
      const warningData = errorHandler.handleWarning('Test warning', { source: 'test' })

      expect(warningData.message).toBe('Test warning')
      expect(warningData.context.source).toBe('test')
      expect(errorHandler.getWarnings()).toHaveLength(1)
    })

    test('should provide error statistics', () => {
      const errorHandler = new ErrorHandler()

      errorHandler.handleError(new Error('Error 1'))
      errorHandler.handleError(new Error('Error 2'))
      errorHandler.handleWarning('Warning 1')
      errorHandler.handleWarning('Warning 2')

      const errorStats = errorHandler.getErrorStats()
      const warningStats = errorHandler.getWarningStats()

      expect(errorStats.total).toBe(2)
      expect(warningStats.total).toBe(2)
    })

    test('should export error data', () => {
      const errorHandler = new ErrorHandler()
      errorHandler.handleError(new Error('Test error'))

      const exported = JSON.parse(errorHandler.export('json'))
      expect(exported.errors).toHaveLength(1)
      expect(exported.stats.errors.total).toBe(1)
    })
  })

  describe('WebSocket Manager', () => {
    test('should manage connection state', () => {
      const wsManager = client.wsManager
      expect(wsManager.getConnectionState()).toBe('DISCONNECTED')
    })

    test('should handle message queuing', async () => {
      const wsManager = client.wsManager

      // Try to send before connection
      const result = wsManager.send('test', { data: 'test' })
      expect(result).toBe(false)
      expect(wsManager.queue.length).toBe(1)

      // Connect and process queue
      await client.connect()
      // Queue should be processed automatically
    })

    test('should provide connection statistics', () => {
      const wsManager = client.wsManager
      const stats = wsManager.getStats()

      expect(stats).toHaveProperty('connected')
      expect(stats).toHaveProperty('state')
      expect(stats).toHaveProperty('queueLength')
      expect(stats).toHaveProperty('url')
    })
  })

  describe('Client Utilities', () => {
    test('should provide client information', async () => {
      await client.connect()

      // Mock ready state
      client.ready = true
      client.player = { id: 'test-player' }

      const info = client.getClientInfo()
      expect(info).toHaveProperty('connected')
      expect(info).toHaveProperty('ready')
      expect(info).toHaveProperty('url')
    })

    test('should provide comprehensive statistics', () => {
      const stats = client.getStats()
      expect(stats).toHaveProperty('websocket')
      expect(stats).toHaveProperty('errors')
      expect(stats).toHaveProperty('client')
    })

    test('should filter entities by type', () => {
      const entities = [
        { type: 'player', id: '1' },
        { type: 'app', id: '2' },
        { type: 'app', id: '3' },
        { type: 'entity', id: '4' }
      ]

      client.entities = new Map(entities.map(e => [e.id, e]))

      const apps = client.getApps()
      const players = client.getPlayers()

      expect(apps).toHaveLength(2)
      expect(players).toHaveLength(1)
    })
  })

  describe('Integration Tests', () => {
    test('should handle complete connection flow', async () => {
      const client = new HyperfyClient(testWorldUrl, {
        name: 'Integration Test Client'
      })

      await client.connect()

      // Simulate full snapshot
      client.wsManager.emit('snapshot', {
        id: 'test-player-id',
        serverTime: Date.now(),
        assetsUrl: 'http://localhost:8080/assets',
        apiUrl: 'http://localhost:8080/api',
        maxUploadSize: 50000000,
        settings: { maxPlayers: 10 },
        blueprints: [
          {
            id: 'test-blueprint',
            name: 'Test Blueprint',
            script: 'console.log("test")'
          }
        ],
        entities: [
          {
            id: 'test-player-id',
            type: 'player',
            position: [0, 1, 0],
            quaternion: [0, 0, 0, 1],
            scale: [1, 1, 1],
            state: {},
            name: 'TestPlayer'
          },
          {
            id: 'test-app',
            type: 'app',
            blueprint: 'test-blueprint',
            position: [5, 1, 5],
            quaternion: [0, 0, 0, 1],
            scale: [1, 1, 1],
            state: {},
            name: 'TestApp'
          }
        ],
        collections: null
      })

      expect(client.isReady()).toBe(true)
      expect(client.player).toBeTruthy()
      expect(client.getApps()).toHaveLength(1)
      expect(client.getBlueprints()).toHaveLength(1)

      client.disconnect()
    })

    test('should handle error recovery', async () => {
      const client = new HyperfyClient(testWorldUrl, {
        autoReconnect: true,
        maxReconnectAttempts: 2
      })

      await client.connect()

      // Simulate connection error
      const error = new Error('Connection lost')
      client.wsManager.emit('error', error)

      // Should attempt reconnection
      expect(client.wsManager.reconnectAttempts).toBe(1)

      client.disconnect()
    })
  })
})