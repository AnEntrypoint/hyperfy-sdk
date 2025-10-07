import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { writePacket, readPacket, PacketType, getPacketTypes } from '../src/network/packets';
import { WebSocketManager } from '../src/network/websocket-manager';
import { NetworkClient } from '../src/network/network-client';
import { getPacketInfo, isValidPacketType } from '../src/network/packets';

describe('Network Protocol Implementation', () => {
  describe('Packet Protocol', () => {
    it('should serialize and deserialize packets correctly', () => {
      const testData = {
        id: 'test-id',
        message: 'Hello World',
        timestamp: Date.now(),
      };

      const packet = writePacket('snapshot', testData);
      expect(packet).toBeInstanceOf(Buffer);

      const [method, data] = readPacket(packet);
      expect(method).toBe('onSnapshot');
      expect(data).toEqual(testData);
    });

    it('should handle all packet types', () => {
      const packetTypes = getPacketTypes();
      expect(packetTypes).toHaveLength(34); // All packet types from browser client

      // Test a few critical packet types
      const criticalPackets = ['snapshot', 'entityAdded', 'entityModified', 'entityRemoved', 'ping', 'pong'];

      criticalPackets.forEach(packetType => {
        expect(isValidPacketType(packetType)).toBe(true);

        const info = getPacketInfo(packetType);
        expect(info).toBeDefined();
        expect(info?.name).toBe(packetType);
        expect(info?.method).toBe(`on${packetType.charAt(0).toUpperCase() + packetType.slice(1)}`);
      });
    });

    it('should handle invalid packet names gracefully', () => {
      expect(() => writePacket('invalidPacket' as PacketType, {})).toThrow('writePacket failed: invalidPacket (name not found)');
    });

    it('should handle malformed packets gracefully', () => {
      // Create a buffer that will definitely fail msgpackr unpacking
      const malformedPacket = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
      const [method, data] = readPacket(malformedPacket);
      expect(method).toBe('');
      expect(data).toBeNull();
    });
  });

  describe('WebSocket Manager', () => {
    let wsManager: WebSocketManager;

    beforeEach(() => {
      wsManager = new WebSocketManager({
        url: 'ws://localhost:8080',
        reconnect: false, // Disable auto-reconnect for testing
      });
    });

    afterEach(() => {
      wsManager.destroy();
    });

    it('should create with correct configuration', () => {
      expect(wsManager.isConnected()).toBe(false);
      expect(wsManager.getConnectionState()).toBe('DISCONNECTED');
    });

    it('should handle connection state correctly', () => {
      // Test manual disconnect
      wsManager.disconnect();
      expect(wsManager.getConnectionState()).toBe('DISCONNECTED');
      expect(wsManager.isDisconnected).toBe(true);
    });

    it('should queue messages when not connected', () => {
      wsManager.send('ping', { timestamp: Date.now() });
      expect(wsManager.getQueuedMessageCount()).toBe(1);
    });

    it('should handle ping/pong state', () => {
      expect(wsManager.isAlive).toBe(true);
      // Note: actual ping/pong testing would require WebSocket server
    });
  });

  describe('Network Client', () => {
    let networkClient: NetworkClient;

    beforeEach(() => {
      networkClient = new NetworkClient({
        wsUrl: 'ws://localhost:8080',
        authToken: 'test-token',
        name: 'TestUser',
        avatar: 'test-avatar-url',
      });
    });

    afterEach(() => {
      networkClient.destroy();
    });

    it('should create with correct configuration', () => {
      expect(networkClient.isConnected).toBe(false);
      expect(networkClient.isClient).toBe(true);
      expect(networkClient.id).toBeNull();
    });

    it('should handle time synchronization', () => {
      const clientTime = Date.now();
      const serverTime = clientTime + 1000; // Server is 1 second ahead

      // Simulate snapshot data
      const snapshotData = {
        id: 'world-id',
        serverTime: serverTime,
        apiUrl: 'http://localhost:3000/api',
        assetsUrl: 'http://localhost:3000/assets',
        maxUploadSize: 10485760, // 10MB
        authToken: 'server-token',
        hasAdminCode: false,
        settings: {},
        collections: {},
        chat: [],
        blueprints: [],
        entities: [],
      };

      // Simulate receiving snapshot
      (networkClient as any).onSnapshot(snapshotData);

      expect(networkClient.id).toBe('world-id');
      expect(networkClient.serverTimeOffset).toBe(1000);
      expect(networkClient.apiUrl).toBe('http://localhost:3000/api');
      expect(networkClient.maxUploadSize).toBe(10485760);
    });

    it('should provide synchronized server time', () => {
      // Set server time offset
      networkClient.serverTimeOffset = 1000; // Server is 1 second ahead

      const serverTime = networkClient.getTime();
      const expectedTime = (Date.now() + 1000) / 1000;

      // Allow small differences due to execution time
      expect(Math.abs(serverTime - expectedTime)).toBeLessThan(0.1);
    });

    it('should handle all packet types through event emission', () => {
      const events: Array<{ type: string; data: any }> = [];

      // Listen for all packet events
      networkClient.on('snapshot', (data) => events.push({ type: 'snapshot', data }));
      networkClient.on('entityAdded', (data) => events.push({ type: 'entityAdded', data }));
      networkClient.on('entityModified', (data) => events.push({ type: 'entityModified', data }));
      networkClient.on('entityRemoved', (data) => events.push({ type: 'entityRemoved', data }));
      networkClient.on('playerTeleport', (data) => events.push({ type: 'playerTeleport', data }));
      networkClient.on('playerPush', (data) => events.push({ type: 'playerPush', data }));
      networkClient.on('chatAdded', (data) => events.push({ type: 'chatAdded', data }));
      networkClient.on('settingsModified', (data) => events.push({ type: 'settingsModified', data }));

      // Simulate packet processing
      (networkClient as any).enqueue('onSnapshot', { id: 'test-snapshot' });
      (networkClient as any).enqueue('onEntityAdded', { id: 'test-entity', type: 'player' });
      (networkClient as any).enqueue('onEntityModified', { id: 'test-entity', position: [0, 1, 0] });
      (networkClient as any).enqueue('onEntityRemoved', 'test-entity');
      (networkClient as any).enqueue('onPlayerTeleport', { position: [1, 2, 3] });
      (networkClient as any).enqueue('onPlayerPush', { force: [0, 1, 0] });
      (networkClient as any).enqueue('onChatAdded', { id: 'chat-1', body: 'Hello' });
      (networkClient as any).enqueue('onSettingsModified', { key: 'gravity', value: -9.81 });

      // Flush queue
      (networkClient as any).flush();

      expect(events).toHaveLength(8);
      expect(events[0].type).toBe('snapshot');
      expect(events[1].type).toBe('entityAdded');
      expect(events[2].type).toBe('entityModified');
      expect(events[3].type).toBe('entityRemoved');
      expect(events[4].type).toBe('playerTeleport');
      expect(events[5].type).toBe('playerPush');
      expect(events[6].type).toBe('chatAdded');
      expect(events[7].type).toBe('settingsModified');
    });

    it('should handle error reporting methods', () => {
      const errorData = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        timestamp: new Date(),
      };

      // These should not throw when not connected
      expect(() => networkClient.reportError(errorData)).not.toThrow();
      expect(() => networkClient.requestErrors({ limit: 10 })).not.toThrow();
      expect(() => networkClient.clearErrors()).not.toThrow();
      expect(() => networkClient.subscribeToMcpErrors(true)).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should maintain protocol compatibility with browser client', () => {
      // Test packet structure matches browser client
      const testData = {
        entities: [
          { id: 'entity1', type: 'box', position: [0, 1, 0] },
          { id: 'entity2', type: 'sphere', position: [1, 2, 3] },
        ],
        chat: [
          { id: 'chat1', body: 'Hello World', from: 'user1' },
        ],
      };

      const packet = writePacket('snapshot', testData);
      const [method, data] = readPacket(packet);

      expect(method).toBe('onSnapshot');
      expect(data.entities).toHaveLength(2);
      expect(data.entities[0].type).toBe('box');
      expect(data.chat).toHaveLength(1);
      expect(data.chat[0].body).toBe('Hello World');
    });

    it('should handle complex data structures', () => {
      const complexData = {
        id: 'complex-test',
        nested: {
          level1: {
            level2: {
              value: 'deeply nested',
              array: [1, 2, 3, { nested: true }],
            },
          },
        },
        largeArray: Array.from({ length: 1000 }, (_, i) => ({ id: i, data: `item-${i}` })),
      };

      const packet = writePacket('command', complexData);
      const [method, data] = readPacket(packet);

      expect(method).toBe('onCommand');
      expect(data.id).toBe('complex-test');
      expect(data.nested.level1.level2.value).toBe('deeply nested');
      expect(data.largeArray).toHaveLength(1000);
      expect(data.largeArray[999].id).toBe(999);
    });
  });
});