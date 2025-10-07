// Global test setup for Jest
import { jest } from '@jest/globals'

// Mock WebSocket globally
class MockWebSocket {
  constructor(url) {
    this.url = url
    this.readyState = MockWebSocket.CONNECTING
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null
    this.sentMessages = []

    // Simulate connection after short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) {
        this.onopen({ type: 'open' })
      }
    }, 10)
  }

  send(data) {
    this.sentMessages.push(data)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose({ type: 'close', code: 1000, reason: 'Normal closure' })
    }
  }

  // Mock WebSocket constants
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
}

// Set global WebSocket mock
global.WebSocket = MockWebSocket

// Mock fetch API for file uploads
global.fetch = jest.fn()

// Mock FormData
global.FormData = class {
  constructor() {
    this.data = new Map()
  }

  append(key, value, filename) {
    this.data.set(key, { value, filename })
  }

  get(key) {
    return this.data.get(key)
  }

  entries() {
    return this.data.entries()
  }
}

// Mock Blob
global.Blob = class {
  constructor(data, options = {}) {
    this.data = data
    this.type = options.type || ''
    this.size = data.length || 0
  }
}

// Mock XMLHttpRequest
global.XMLHttpRequest = class {
  constructor() {
    this.readyState = 0
    this.status = 0
    this.statusText = ''
    this.response = null
    this.responseText = ''
    this.responseXML = null
    this.timeout = 0
    this.upload = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }
    this.eventHandlers = {}
  }

  open(method, url, async = true) {
    this.method = method
    this.url = url
    this.async = async
    this.readyState = 1
  }

  setRequestHeader(name, value) {
    // Mock implementation
  }

  send(data) {
    this.readyState = 2
    this.readyState = 3

    // Simulate successful response
    setTimeout(() => {
      this.readyState = 4
      this.status = 200
      this.statusText = 'OK'
      this.response = JSON.stringify({ success: true, url: 'https://example.com/uploaded' })
      this.responseText = JSON.stringify({ success: true, url: 'https://example.com/uploaded' })

      if (this.eventHandlers.load) {
        this.eventHandlers.load({ target: this })
      }
    }, 50)
  }

  abort() {
    this.readyState = 0
  }

  addEventListener(event, handler) {
    this.eventHandlers[event] = handler
  }

  removeEventListener(event, handler) {
    delete this.eventHandlers[event]
  }

  static UNSENT = 0
  static OPENED = 1
  static HEADERS_RECEIVED = 2
  static LOADING = 3
  static DONE = 4
}

// Mock crypto module for UUID generation
if (!global.crypto) {
  global.crypto = {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2),
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    }
  }
}

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}

// Mock process for browser-like environment
if (typeof process === 'undefined') {
  global.process = {
    env: {},
    cwd: () => '/',
    nextTick: (cb) => setTimeout(cb, 0)
  }
}

// Setup global test utilities
global.createMockPacket = (type, data) => ({
  type,
  data,
  timestamp: Date.now()
})

global.createMockEntity = (overrides = {}) => ({
  id: 'test-entity-' + Math.random().toString(36).substr(2),
  type: 'entity',
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1],
  state: {},
  name: 'Test Entity',
  ...overrides
})

global.createMockApp = (overrides = {}) => ({
  id: 'test-app-' + Math.random().toString(36).substr(2),
  type: 'app',
  blueprint: 'test-blueprint',
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1],
  state: {},
  name: 'Test App',
  pinned: false,
  ...overrides
})

global.createMockPlayer = (overrides = {}) => ({
  id: 'test-player-' + Math.random().toString(36).substr(2),
  type: 'player',
  position: [0, 1, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1],
  state: {},
  name: 'TestPlayer',
  health: 100,
  rank: 0,
  ...overrides
})

global.createMockBlueprint = (overrides = {}) => ({
  id: 'test-blueprint-' + Math.random().toString(36).substr(2),
  name: 'Test Blueprint',
  author: 'TestAuthor',
  desc: 'Test blueprint description',
  script: 'console.log("test")',
  props: {},
  locked: false,
  frozen: false,
  unique: false,
  scene: false,
  disabled: false,
  version: 1,
  lastModified: Date.now(),
  ...overrides
})