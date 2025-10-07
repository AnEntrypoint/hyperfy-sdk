import { EventEmitter } from 'eventemitter3';
import { NodeLogger } from '../utils/logger';
import { HyperfyError, NetworkError, WebSocketError } from '../utils/errors';
import { WebSocketManager } from '../network/websocket-manager';
import { HttpClient } from '../network/http-client';
import { EntityManager } from '../entities/entity-manager';
import { AppManager } from '../managers/app-manager';
import { BuilderManager } from '../managers/builder-manager';
import { ChatManager } from '../managers/chat-manager';
import { FileManager } from '../managers/file-manager';
import {
  HyperfyConfig,
  App,
  Entity,
  User,
  ChatMessage,
  FileUpload,
  NetworkEvent,
  WebSocketMessage,
} from '../types';

export interface SDKState {
  connected: boolean;
  authenticated: boolean;
  currentApp?: App;
  currentUser?: User;
  lastActivity: Date;
}

export class HyperfySDK extends EventEmitter {
  private config: Required<HyperfyConfig>;
  private logger: NodeLogger;
  private httpClient: HttpClient;
  private wsManager?: WebSocketManager;
  private entityManager: EntityManager;
  private appManager: AppManager;
  private builderManager: BuilderManager;
  private chatManager: ChatManager;
  private fileManager: FileManager;
  private state: SDKState;

  constructor(config: HyperfyConfig = {}) {
    super();

    this.config = {
      apiUrl: 'https://api.hyperfy.com',
      wsUrl: 'wss://ws.hyperfy.com',
      apiKey: '',
      timeout: 10000,
      retries: 3,
      logLevel: 'info',
      ...config,
    };

    this.logger = new NodeLogger('HyperfySDK', this.config.logLevel);
    this.logger.setLogLevel(this.config.logLevel);

    this.httpClient = new HttpClient({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      retries: this.config.retries,
      apiKey: this.config.apiKey,
    });

    this.entityManager = new EntityManager({
      maxEntities: 10000,
      validateOnAdd: true,
      trackHistory: true,
      historySize: 1000,
    });

    this.appManager = new AppManager({
      httpClient: this.httpClient,
      baseURL: '/apps',
    });

    this.builderManager = new BuilderManager({
      httpClient: this.httpClient,
      baseURL: '/builder',
      autoSave: true,
      autoSaveInterval: 30000,
    });

    this.chatManager = new ChatManager({
      httpClient: this.httpClient,
      baseURL: '/chat',
      maxMessageLength: 1000,
      enableHistory: true,
      historySize: 1000,
    });

    this.fileManager = new FileManager({
      httpClient: this.httpClient,
      baseURL: '/files',
      maxFileSize: 100 * 1024 * 1024, // 100MB
      uploadTimeout: 300000, // 5 minutes
    });

    this.state = {
      connected: false,
      authenticated: false,
      lastActivity: new Date(),
    };

    this.setupEventForwarding();
    this.logger.info('HyperfySDK initialized');
  }

  async connect(appId?: string): Promise<void> {
    try {
      this.logger.info('Connecting to Hyperfy...');

      if (this.config.apiKey) {
        await this.authenticate();
      }

      if (appId) {
        await this.loadApp(appId);
      }

      await this.connectWebSocket();
      this.updateState({ connected: true, lastActivity: new Date() });

      this.logger.info('Connected to Hyperfy successfully');
      this.emit('connected', this.state);

    } catch (error) {
      this.logger.error('Failed to connect to Hyperfy', error);
      throw new HyperfyError('Connection failed', error);
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.logger.info('Disconnecting from Hyperfy...');

      if (this.wsManager) {
        this.wsManager.disconnect();
        this.wsManager = undefined;
      }

      this.updateState({
        connected: false,
        authenticated: false,
        currentApp: undefined,
        currentUser: undefined,
        lastActivity: new Date(),
      });

      this.logger.info('Disconnected from Hyperfy');
      this.emit('disconnected');

    } catch (error) {
      this.logger.error('Error during disconnect', error);
      throw new HyperfyError('Disconnect failed', error);
    }
  }

  async authenticate(apiKey?: string): Promise<User> {
    try {
      const key = apiKey || this.config.apiKey;
      if (!key) {
        throw new HyperfyError('API key is required for authentication');
      }

      this.httpClient.setApiKey(key);
      this.config.apiKey = key;

      const response = await this.httpClient.get<User>('/auth/me');
      const user = response.data;

      this.updateState({ authenticated: true, currentUser: user, lastActivity: new Date() });

      this.logger.info(`Authenticated as user: ${user.username}`);
      this.emit('authenticated', user);

      return user;

    } catch (error) {
      this.logger.error('Authentication failed', error);
      throw new HyperfyError('Authentication failed', error);
    }
  }

  async loadApp(appId: string): Promise<App> {
    try {
      const app = await this.appManager.getApp(appId);
      this.updateState({ currentApp: app, lastActivity: new Date() });

      this.logger.info(`Loaded app: ${app.name} (${app.id})`);
      this.emit('appLoaded', app);

      return app;

    } catch (error) {
      this.logger.error(`Failed to load app: ${appId}`, error);
      throw new HyperfyError(`Failed to load app: ${appId}`, error);
    }
  }

  send(event: string, data: any): void {
    if (!this.wsManager?.isConnected()) {
      throw new WebSocketError('WebSocket is not connected');
    }

    this.wsManager.send(event, data);
    this.updateState({ lastActivity: new Date() });
  }

  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  once(event: string, listener: (...args: any[]) => void): this {
    return super.once(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): this {
    return super.off(event, listener);
  }

  getState(): SDKState {
    return { ...this.state };
  }

  isConnected(): boolean {
    return this.state.connected && this.wsManager?.isConnected() || false;
  }

  isAuthenticated(): boolean {
    return this.state.authenticated;
  }

  getCurrentApp(): App | undefined {
    return this.state.currentApp;
  }

  getCurrentUser(): User | undefined {
    return this.state.currentUser;
  }

  getConfig(): Required<HyperfyConfig> {
    return { ...this.config };
  }

  updateConfig(updates: Partial<HyperfyConfig>): void {
    Object.assign(this.config, updates);

    if (updates.apiUrl) {
      this.httpClient.setBaseURL(updates.apiUrl);
    }

    if (updates.apiKey) {
      this.httpClient.setApiKey(updates.apiKey);
    }

    if (updates.logLevel) {
      this.logger.setLogLevel(updates.logLevel);
    }

    this.logger.info('Configuration updated');
    this.emit('configUpdated', updates);
  }

  getEntityManager(): EntityManager {
    return this.entityManager;
  }

  getAppManager(): AppManager {
    return this.appManager;
  }

  getBuilderManager(): BuilderManager {
    return this.builderManager;
  }

  getChatManager(): ChatManager {
    return this.chatManager;
  }

  getFileManager(): FileManager {
    return this.fileManager;
  }

  async getStats(): Promise<{
    uptime: number;
    entities: number;
    messages: number;
    connections: number;
    memory: NodeJS.MemoryUsage;
  }> {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      uptime,
      entities: this.entityManager.getEntityCount(),
      messages: this.chatManager.getMessageHistory().length,
      connections: this.isConnected() ? 1 : 0,
      memory: memoryUsage,
    };
  }

  private async connectWebSocket(): Promise<void> {
    if (this.wsManager) {
      this.wsManager.destroy();
    }

    const wsUrl = this.config.wsUrl;
    this.wsManager = new WebSocketManager({
      url: wsUrl,
      reconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      timeout: this.config.timeout,
    });

    this.wsManager.on('connected', () => {
      this.logger.debug('WebSocket connected');
      this.emit('websocketConnected');
    });

    this.wsManager.on('disconnected', (data) => {
      this.logger.debug('WebSocket disconnected', data);
      this.emit('websocketDisconnected', data);
    });

    this.wsManager.on('message', (message: WebSocketMessage) => {
      this.handleWebSocketMessage(message);
    });

    this.wsManager.on('error', (error) => {
      this.logger.error('WebSocket error', error);
      this.emit('websocketError', error);
    });

    await this.wsManager.connect();
  }

  private handleWebSocketMessage(message: WebSocketMessage): void {
    this.updateState({ lastActivity: new Date() });

    switch (message.event) {
      case 'entity:added':
      case 'entity:updated':
      case 'entity:removed':
        this.handleEntityMessage(message);
        break;

      case 'chat:message':
        this.handleChatMessage(message);
        break;

      case 'user:joined':
      case 'user:left':
        this.handleUserMessage(message);
        break;

      case 'app:updated':
        this.handleAppMessage(message);
        break;

      default:
        this.emit('message', message);
        break;
    }
  }

  private handleEntityMessage(message: WebSocketMessage): void {
    this.emit('entity:' + message.event.split(':')[1], message.data);
  }

  private handleChatMessage(message: WebSocketMessage): void {
    const chatMessage = message.data as ChatMessage;
    this.emit('chatMessage', chatMessage);
  }

  private handleUserMessage(message: WebSocketMessage): void {
    this.emit(message.event, message.data);
  }

  private handleAppMessage(message: WebSocketMessage): void {
    const app = message.data as App;
    if (app.id === this.state.currentApp?.id) {
      this.updateState({ currentApp: app, lastActivity: new Date() });
    }
    this.emit('appUpdated', app);
  }

  private setupEventForwarding(): void {
    this.entityManager.on('entityAdded', (entity) => this.emit('entityAdded', entity));
    this.entityManager.on('entityUpdated', (entity) => this.emit('entityUpdated', entity));
    this.entityManager.on('entityRemoved', (entity) => this.emit('entityRemoved', entity));

    this.appManager.on('appCreated', (app) => this.emit('appCreated', app));
    this.appManager.on('appUpdated', (app) => this.emit('appUpdated', app));
    this.appManager.on('appDeleted', (appId) => this.emit('appDeleted', appId));

    this.chatManager.on('messageSent', (message) => this.emit('chatMessageSent', message));
    this.chatManager.on('messageDeleted', (messageId) => this.emit('chatMessageDeleted', messageId));

    this.fileManager.on('uploadCompleted', (result) => this.emit('fileUploaded', result));
    this.fileManager.on('fileDeleted', (fileId) => this.emit('fileDeleted', fileId));
  }

  private updateState(updates: Partial<SDKState>): void {
    Object.assign(this.state, updates);
    this.emit('stateChanged', this.state);
  }

  destroy(): void {
    this.logger.info('Destroying HyperfySDK...');

    if (this.wsManager) {
      this.wsManager.destroy();
      this.wsManager = undefined;
    }

    this.entityManager.removeAllListeners();
    this.appManager.removeAllListeners();
    this.builderManager.removeAllListeners();
    this.chatManager.removeAllListeners();
    this.fileManager.removeAllListeners();

    this.removeAllListeners();
    this.logger.info('HyperfySDK destroyed');
  }
}