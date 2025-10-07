import { HyperfySDK } from '../../src/sdk/hyperfy-sdk';
import { NodeLogger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/network/websocket-manager');
jest.mock('../../src/network/http-client');
jest.mock('../../src/entities/entity-manager');
jest.mock('../../src/managers/app-manager');
jest.mock('../../src/managers/builder-manager');
jest.mock('../../src/managers/chat-manager');
jest.mock('../../src/managers/file-manager');

describe('HyperfySDK', () => {
  let sdk: HyperfySDK;

  beforeEach(() => {
    sdk = new HyperfySDK({
      apiUrl: 'https://test.hyperfy.com',
      wsUrl: 'wss://test.hyperfy.com',
      apiKey: 'test-api-key',
      logLevel: 'debug',
    });
  });

  afterEach(() => {
    sdk.destroy();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultSDK = new HyperfySDK();
      const config = defaultSDK.getConfig();

      expect(config.apiUrl).toBe('https://api.hyperfy.com');
      expect(config.wsUrl).toBe('wss://ws.hyperfy.com');
      expect(config.apiKey).toBe('');
      expect(config.timeout).toBe(10000);
      expect(config.retries).toBe(3);
      expect(config.logLevel).toBe('info');
    });

    it('should initialize with custom configuration', () => {
      const customSDK = new HyperfySDK({
        apiUrl: 'https://custom.hyperfy.com',
        wsUrl: 'wss://custom.hyperfy.com',
        apiKey: 'custom-key',
        timeout: 15000,
        retries: 5,
        logLevel: 'debug',
      });

      const config = customSDK.getConfig();
      expect(config.apiUrl).toBe('https://custom.hyperfy.com');
      expect(config.wsUrl).toBe('wss://custom.hyperfy.com');
      expect(config.apiKey).toBe('custom-key');
      expect(config.timeout).toBe(15000);
      expect(config.retries).toBe(5);
      expect(config.logLevel).toBe('debug');
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const state = sdk.getState();

      expect(state).toHaveProperty('connected', false);
      expect(state).toHaveProperty('authenticated', false);
      expect(state).toHaveProperty('lastActivity');
      expect(state).toHaveProperty('currentApp', undefined);
      expect(state).toHaveProperty('currentUser', undefined);
    });
  });

  describe('isConnected', () => {
    it('should return connection status', () => {
      expect(sdk.isConnected()).toBe(false);
    });
  });

  describe('isAuthenticated', () => {
    it('should return authentication status', () => {
      expect(sdk.isAuthenticated()).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const updates = {
        apiUrl: 'https://updated.hyperfy.com',
        logLevel: 'warn' as const,
      };

      sdk.updateConfig(updates);
      const config = sdk.getConfig();

      expect(config.apiUrl).toBe('https://updated.hyperfy.com');
      expect(config.logLevel).toBe('warn');
    });

    it('should emit configUpdated event', () => {
      const listener = jest.fn();
      sdk.on('configUpdated', listener);

      const updates = { logLevel: 'error' as const };
      sdk.updateConfig(updates);

      expect(listener).toHaveBeenCalledWith(updates);
    });
  });

  describe('getManager methods', () => {
    it('should return entity manager', () => {
      expect(sdk.getEntityManager()).toBeDefined();
    });

    it('should return app manager', () => {
      expect(sdk.getAppManager()).toBeDefined();
    });

    it('should return builder manager', () => {
      expect(sdk.getBuilderManager()).toBeDefined();
    });

    it('should return chat manager', () => {
      expect(sdk.getChatManager()).toBeDefined();
    });

    it('should return file manager', () => {
      expect(sdk.getFileManager()).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return SDK statistics', async () => {
      const stats = await sdk.getStats();

      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('entities');
      expect(stats).toHaveProperty('messages');
      expect(stats).toHaveProperty('connections');
      expect(stats).toHaveProperty('memory');
      expect(typeof stats.uptime).toBe('number');
      expect(typeof stats.entities).toBe('number');
      expect(typeof stats.messages).toBe('number');
      expect(typeof stats.connections).toBe('number');
      expect(stats.memory).toHaveProperty('rss');
      expect(stats.memory).toHaveProperty('heapTotal');
      expect(stats.memory).toHaveProperty('heapUsed');
      expect(stats.memory).toHaveProperty('external');
    });
  });

  describe('event forwarding', () => {
    it('should forward entity manager events', () => {
      const listener = jest.fn();
      sdk.on('entityAdded', listener);

      const entity = {
        id: 'test-entity',
        type: 'test',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      };

      sdk.getEntityManager().emit('entityAdded', entity);
      expect(listener).toHaveBeenCalledWith(entity);
    });

    it('should forward app manager events', () => {
      const listener = jest.fn();
      sdk.on('appCreated', listener);

      const app = {
        id: 'test-app',
        name: 'Test App',
        url: 'https://test.com',
        settings: {},
        entities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      sdk.getAppManager().emit('appCreated', app);
      expect(listener).toHaveBeenCalledWith(app);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      const wsManagerSpy = jest.spyOn(sdk as any, 'wsManager', 'get');
      const removeListenersSpy = jest.spyOn(sdk, 'removeAllListeners');

      sdk.destroy();

      expect(removeListenersSpy).toHaveBeenCalled();
      expect(sdk.getState().connected).toBe(false);
    });
  });
});