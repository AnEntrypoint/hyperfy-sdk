import { EventEmitter } from 'eventemitter3';
import { WebSocketManager } from './websocket-manager';
import { writePacket, PacketType } from './packets';
import { NodeLogger } from '../utils/logger';
import {
  HyperfyConfig,
  ChatMessage,
  ErrorInfo,
  NetworkEvent,
  SnapshotData,
  EntityData,
  PlayerTeleportData,
  PlayerPushData,
  EntityEvent,
  ChatMessageData,
  SettingsModifiedData,
  BlueprintModifiedData,
  EntityModifiedData,
  LiveKitLevelData,
  MuteData,
  PlayerSessionAvatarData,
  ErrorReportData,
  GetErrorsData,
  ErrorsData,
  McpSubscribeErrorsData,
  McpErrorEventData,
  NetworkClientConfig
} from '../types';

export class NetworkClient extends EventEmitter {
  private ws: WebSocketManager;
  private logger: NodeLogger;
  private config: NetworkClientConfig;

  // State matching browser client
  public id: string | null = null;
  public serverTimeOffset: number = 0;
  public apiUrl: string | null = null;
  public maxUploadSize: number = 0;
  public assetsUrl: string | null = null;
  public isClient: boolean = true;

  // Internal queue for packet processing
  private queue: Array<[string, any]> = [];
  private isProcessing: boolean = false;

  constructor(config: NetworkClientConfig) {
    super();
    this.config = config;
    this.logger = new NodeLogger('NetworkClient');

    this.ws = new WebSocketManager({
      url: config.wsUrl,
      authToken: config.authToken,
      name: config.name,
      avatar: config.avatar,
      reconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      timeout: 10000,
      heartbeatInterval: 30000,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.ws.on('connected', () => {
      this.logger.info('WebSocket connected');
      this.emit('connected');
    });

    this.ws.on('packet', (method: string, data: any) => {
      this.enqueue(method, data);
    });

    this.ws.on('disconnected', (data: { code: number; reason: string }) => {
      this.logger.info(`WebSocket disconnected: ${data.code} - ${data.reason}`);
      this.handleDisconnection(data.code);
    });

    this.ws.on('error', (error: Error) => {
      this.logger.error('WebSocket error', error);
      this.emit('error', error);
    });

    // Process queue on interval (matching browser client's preFixedUpdate)
    setInterval(() => {
      this.flush();
    }, 16); // ~60fps
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    await this.ws.connect();
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.ws.disconnect();
  }

  /**
   * Send a packet to the server
   */
  send(name: PacketType, data: any): void {
    // Debug logging (matching browser client)
    const ignore = ['ping'];
    if (!ignore.includes(name) && data.id !== this.id) {
      this.logger.debug(`-> ${name}`, data);
    }
    this.ws.send(name, data);
  }

  /**
   * Get synchronized server time
   */
  getTime(): number {
    return (Date.now() + this.serverTimeOffset) / 1000; // seconds
  }

  /**
   * Upload a file to the server
   */
  async upload(file: Buffer | ArrayBuffer, filename: string, mimeType: string): Promise<void> {
    // First check if file already exists
    const hash = this.hashBuffer(file);
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const uploadFilename = `${hash}.${ext}`;

    const checkUrl = `${this.apiUrl}/upload-check?filename=${uploadFilename}`;
    const checkResponse = await fetch(checkUrl);
    const checkData = await checkResponse.json();

    if (checkData.exists) {
      this.logger.debug(`File already uploaded: ${uploadFilename}`);
      return;
    }

    // Upload the file
    const formData = new FormData();
    const blob = new Blob([file], { type: mimeType });
    formData.append('file', blob, filename);

    const uploadUrl = `${this.apiUrl}/upload`;
    await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    this.logger.info(`File uploaded: ${filename}`);
  }

  /**
   * Add a packet to the processing queue
   */
  private enqueue(method: string, data: any): void {
    this.queue.push([method, data]);
  }

  /**
   * Process all queued packets
   */
  private flush(): void {
    if (this.isProcessing) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      try {
        const [method, data] = this.queue.shift()!;
        this.processPacket(method, data);
      } catch (err) {
        this.logger.error('Error processing packet', err);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Process a single packet
   */
  private processPacket(method: string, data: any): void {
    const handler = (this as any)[method];
    if (typeof handler === 'function') {
      handler.call(this, data);
    } else {
      this.logger.warn(`No handler for packet method: ${method}`);
      this.emit('unknownPacket', { method, data });
    }
  }

  // Packet handlers matching browser client exactly

  private onSnapshot(data: SnapshotData): void {
    this.id = data.id;
    this.serverTimeOffset = data.serverTime - Date.now();
    this.apiUrl = data.apiUrl;
    this.maxUploadSize = data.maxUploadSize;
    this.assetsUrl = data.assetsUrl;

    this.logger.info(`Received snapshot for world: ${data.id}`);
    this.emit('snapshot', data);
  }

  private onSettingsModified(data: SettingsModifiedData): void {
    this.emit('settingsModified', data);
  }

  private onChatAdded(data: ChatMessageData): void {
    this.emit('chatAdded', data);
  }

  private onChatCleared(): void {
    this.emit('chatCleared');
  }

  private onBlueprintAdded(data: any): void {
    this.emit('blueprintAdded', data);
  }

  private onBlueprintModified(data: BlueprintModifiedData): void {
    this.emit('blueprintModified', data);
  }

  private onEntityAdded(data: EntityData): void {
    this.emit('entityAdded', data);
  }

  private onEntityModified(data: EntityModifiedData): void {
    const entity = { id: data.id }; // This would be managed by entity system
    if (!entity) {
      this.logger.error('onEntityModified: no entity found', data);
      return;
    }
    this.emit('entityModified', data);
  }

  private onEntityEvent(data: EntityEvent): void {
    this.emit('entityEvent', data);
  }

  private onEntityRemoved(id: string): void {
    this.emit('entityRemoved', id);
  }

  private onPlayerTeleport(data: PlayerTeleportData): void {
    this.emit('playerTeleport', data);
  }

  private onPlayerPush(data: PlayerPushData): void {
    this.emit('playerPush', data);
  }

  private onPlayerSessionAvatar(data: PlayerSessionAvatarData): void {
    this.emit('playerSessionAvatar', data);
  }

  private onLiveKitLevel(data: LiveKitLevelData): void {
    this.emit('liveKitLevel', data);
  }

  private onMute(data: MuteData): void {
    this.emit('mute', data);
  }

  private onPong(time: number): void {
    this.emit('pong', time);
  }

  private onKick(code: string): void {
    this.logger.warn(`Kicked from server: ${code}`);
    this.emit('kick', code);
  }

  private onErrors(data: ErrorsData): void {
    this.logger.info(`Received ${data.errors.length} errors from server`);
    this.emit('errors', data);
  }

  // Helper methods for error reporting
  requestErrors(options: GetErrorsData = {}): void {
    this.send('getErrors', options);
  }

  clearErrors(): void {
    this.send('clearErrors');
  }

  reportError(error: ErrorInfo, context?: any): void {
    this.send('errorReport', { error, context });
  }

  subscribeToMcpErrors(enabled: boolean): void {
    this.send('mcpSubscribeErrors', { enabled });
  }

  // Utility methods
  private hashBuffer(buffer: Buffer | ArrayBuffer): string {
    const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    // Simple hash implementation - in production use crypto
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private handleDisconnection(code: number): void {
    // Add disconnect message to chat (matching browser client)
    const disconnectMessage: ChatMessageData = {
      id: this.generateId(),
      from: null,
      fromId: null,
      body: 'You have been disconnected.',
      createdAt: new Date().toISOString(),
    };

    this.emit('chatAdded', disconnectMessage);
    this.emit('disconnect', code || true);
    this.logger.info(`Disconnected with code: ${code}`);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  /**
   * Get connection status
   */
  get isConnected(): boolean {
    return this.ws.isConnected();
  }

  /**
   * Get connection state
   */
  get connectionState(): string {
    return this.ws.getConnectionState();
  }

  /**
   * Destroy the network client
   */
  destroy(): void {
    this.ws.destroy();
    this.removeAllListeners();
    this.queue.length = 0;
  }
}