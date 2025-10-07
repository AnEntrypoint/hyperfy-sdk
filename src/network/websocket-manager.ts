import WebSocket from 'ws';
import { EventEmitter } from 'eventemitter3';
import { NodeLogger } from '../utils/logger';
import { WebSocketError, TimeoutError } from '../utils/errors';
import { writePacket, readPacket, PacketType } from './packets';
import { NetworkEvent } from '../types';

export interface WebSocketManagerConfig {
  url: string;
  authToken?: string;
  name?: string;
  avatar?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  timeout?: number;
  heartbeatInterval?: number;
}

export class WebSocketManager extends EventEmitter {
  private ws?: WebSocket;
  private config: Required<WebSocketManagerConfig>;
  private logger: NodeLogger;
  private reconnectAttempts = 0;
  private isManualClose = false;
  private heartbeatTimer?: NodeJS.Timeout;
  private messageQueue: Array<{ type: PacketType; data: any }> = [];
  private isConnecting = false;
  private alive = true; // For ping/pong heartbeat
  private closed = false;
  private disconnected = false;

  constructor(config: WebSocketManagerConfig) {
    super();
    this.config = {
      authToken: '',
      name: '',
      avatar: '',
      reconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      timeout: 10000,
      heartbeatInterval: 30000,
      ...config,
    };
    this.logger = new NodeLogger('WebSocketManager');
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.isConnected()) {
      return;
    }

    this.isConnecting = true;
    this.isManualClose = false;

    try {
      await this.createConnection();
      this.startHeartbeat();
      this.flushMessageQueue();
      this.logger.info('WebSocket connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect WebSocket', error);
      this.handleConnectionError(error);
    } finally {
      this.isConnecting = false;
    }
  }

  private createConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Build URL with query parameters matching browser client
      let url = this.config.url;
      const params = new URLSearchParams();

      if (this.config.authToken) {
        params.set('authToken', this.config.authToken);
      }
      if (this.config.name) {
        params.set('name', encodeURIComponent(this.config.name));
      }
      if (this.config.avatar) {
        params.set('avatar', encodeURIComponent(this.config.avatar));
      }

      const queryString = params.toString();
      if (queryString) {
        url += '?' + queryString;
      }

      this.ws = new WebSocket(url);
      this.ws.binaryType = 'arraybuffer'; // Match browser client

      const timeout = setTimeout(() => {
        this.ws?.close();
        reject(new TimeoutError('WebSocket connection timeout'));
      }, this.config.timeout);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;
        this.alive = true;
        this.closed = false;
        this.disconnected = false;
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const [method, packetData] = readPacket(data);
          if (method) {
            this.emit('packet', method, packetData);
            this.emit(method, packetData);
          }
        } catch (error) {
          this.logger.error('Failed to parse packet', error);
          this.emit('error', new WebSocketError('Failed to parse packet', error));
        }
      });

      this.ws.on('pong', () => {
        this.alive = true;
        this.emit('pong');
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        clearTimeout(timeout);
        this.closed = true;
        this.logger.debug(`WebSocket closed: ${code} - ${reason?.toString()}`);
        this.emit('disconnected', { code, reason: reason?.toString() });
        this.handleDisconnection();
      });

      this.ws.on('error', (error: Error) => {
        clearTimeout(timeout);
        this.logger.error('WebSocket error', error);
        this.emit('error', new WebSocketError('WebSocket error', error));
        reject(error);
      });
    });
  }

  send(type: PacketType, data: any): void {
    if (this.isConnected()) {
      this.sendPacket(type, data);
    } else {
      this.messageQueue.push({ type, data });
      this.logger.debug('Packet queued (WebSocket not connected)', { type });
    }
  }

  private sendPacket(type: PacketType, data: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new WebSocketError('WebSocket is not connected');
    }

    try {
      const packet = writePacket(type, data);
      this.ws.send(packet);
      this.logger.debug('Packet sent', { type });
    } catch (error) {
      this.logger.error('Failed to send packet', error);
      throw new WebSocketError('Failed to send packet', error);
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const packet = this.messageQueue.shift();
      if (packet) {
        try {
          this.sendPacket(packet.type, packet.data);
        } catch (error) {
          this.logger.error('Failed to send queued packet', error);
        }
      }
    }
  }

  ping(): void {
    if (this.isConnected()) {
      this.alive = false;
      this.ws?.ping();
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send('ping', { timestamp: Date.now() });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private handleDisconnection(): void {
    this.stopHeartbeat();

    if (!this.isManualClose && this.config.reconnect) {
      this.attemptReconnect();
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      this.emit('reconnectFailed');
      return;
    }

    this.reconnectAttempts++;
    this.logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();
        this.logger.info('WebSocket reconnected successfully');
      } catch (error) {
        this.logger.error('Reconnection failed', error);
        this.attemptReconnect();
      }
    }, this.config.reconnectInterval);
  }

  private handleConnectionError(error: any): void {
    if (this.config.reconnect) {
      this.attemptReconnect();
    } else {
      this.emit('error', error);
    }
  }

  disconnect(): void {
    this.isManualClose = true;
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.terminate();
      this.ws = undefined;
    }

    this.messageQueue.length = 0;
    this.disconnected = true;
    this.emit('disconnected', { code: 1000, reason: 'Manual disconnect' });
  }

  // Getters for connection state matching browser client
  get isAlive(): boolean {
    return this.alive;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  get isDisconnected(): boolean {
    return this.disconnected;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  isConnectingStatus(): boolean {
    return this.isConnecting;
  }

  getConnectionState(): string {
    if (!this.ws) return 'DISCONNECTED';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'CONNECTED';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  getQueuedMessageCount(): number {
    return this.messageQueue.length;
  }

  private generateMessageId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  destroy(): void {
    this.disconnect();
    this.removeAllListeners();
  }
}