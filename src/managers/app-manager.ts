import { EventEmitter } from 'eventemitter3';
import { NodeLogger } from '../utils/logger';
import { HttpClient } from '../network/http-client';
import { AppError, ValidationError, ScriptError } from '../utils/errors';
import {
  App,
  AppSettings,
  Entity,
  Blueprint,
  AppEntity,
  AppConfig,
  Vector3,
  Quaternion,
  AppMode,
  AppState,
  AssetFile,
  BuildAction,
  Component,
  PerformanceMonitor,
  NetworkMessage,
  AppInstance
} from '../types';
import { AppEntity } from '../entities/app';
import { BlueprintEntity } from '../entities/blueprint';
import { isValidUrl, generateId } from '../utils/helpers';

export interface AppManagerConfig {
  httpClient: HttpClient;
  baseURL?: string;
  enableHotReload?: boolean;
  enableComponents?: boolean;
  enablePerformanceMonitoring?: boolean;
  maxConcurrentApps?: number;
  defaultAppSettings?: Partial<AppSettings>;
  networkSyncInterval?: number;
}

export interface CreateAppData {
  name: string;
  description?: string;
  url?: string;
  blueprintId?: string;
  position?: Vector3;
  quaternion?: Quaternion;
  scale?: Vector3;
  settings?: Partial<AppSettings>;
  userId?: string;
  tags?: string[];
  category?: string;
}

export interface UpdateAppData {
  name?: string;
  description?: string;
  url?: string;
  blueprintId?: string;
  position?: Vector3;
  quaternion?: Quaternion;
  scale?: Vector3;
  settings?: Partial<AppSettings>;
  tags?: string[];
  category?: string;
}

export interface AppListOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastAccessed' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  filter?: {
    public?: boolean;
    owner?: string;
    category?: string;
    tags?: string[];
    status?: AppState;
  };
  search?: string;
}

export interface AppInstanceOptions {
  autoStart?: boolean;
  hotReload?: boolean;
  debugMode?: boolean;
  performanceMonitoring?: boolean;
  networkSync?: boolean;
  maxMemory?: number;
  timeout?: number;
}

export interface AppDeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  region?: string;
  domain?: string;
  ssl?: boolean;
  scaling?: {
    minInstances?: number;
    maxInstances?: number;
    autoScale?: boolean;
  };
  monitoring?: {
    enableMetrics?: boolean;
    enableLogging?: boolean;
    enableTracing?: boolean;
  };
}

export class AppManager extends EventEmitter {
  private httpClient: HttpClient;
  private baseURL: string;
  private config: Required<AppManagerConfig>;
  private logger: NodeLogger;
  private apps: Map<string, AppEntity> = new Map();
  private appInstances: Map<string, AppInstance> = new Map();
  private blueprints: Map<string, BlueprintEntity> = new Map();
  private networkMessages: NetworkMessage[] = [];
  private componentRegistry: Map<string, typeof Component> = new Map();

  constructor(config: AppManagerConfig) {
    super();
    this.httpClient = config.httpClient;
    this.baseURL = config.baseURL || '/apps';
    this.config = {
      enableHotReload: true,
      enableComponents: true,
      enablePerformanceMonitoring: true,
      maxConcurrentApps: 100,
      defaultAppSettings: {},
      networkSyncInterval: 100,
      ...config,
    };
    this.logger = new NodeLogger('AppManager');

    this.setupNetworkSync();
  }

  // App Creation and Management
  async createApp(data: CreateAppData): Promise<App> {
    this.validateCreateAppData(data);

    try {
      const appConfig: AppConfig = {
        id: generateId(),
        blueprintId: data.blueprintId || generateId(),
        position: data.position || [0, 0, 0],
        quaternion: data.quaternion || [0, 0, 0, 1],
        scale: data.scale || [1, 1, 1],
        userId: data.userId,
        settings: {
          ...this.config.defaultAppSettings,
          ...data.settings,
        },
      };

      const appEntity = new AppEntity(appConfig, {
        hotReload: this.config.enableHotReload,
        enableComponents: this.config.enableComponents,
        performanceMonitoring: this.config.enablePerformanceMonitoring,
      });

      this.apps.set(appEntity.id, appEntity);

      // Set up event handlers
      this.setupAppEventHandlers(appEntity);

      // Create app record in API
      const appData = {
        id: appEntity.id,
        name: data.name,
        description: data.description,
        url: data.url,
        blueprintId: data.blueprintId,
        position: appConfig.position,
        quaternion: appConfig.quaternion,
        scale: appConfig.scale,
        settings: appConfig.settings,
        tags: data.tags,
        category: data.category,
        userId: data.userId,
      };

      const response = await this.httpClient.post<App>(this.baseURL, appData);
      const app = response.data;

      this.logger.info(`App created: ${app.id} - ${app.name}`);
      this.emit('appCreated', { app, entity: appEntity });
      return app;

    } catch (error) {
      this.logger.error('Failed to create app', error);
      throw new AppError('Failed to create app', error);
    }
  }

  async createAppFromBlueprint(blueprintId: string, data: Partial<CreateAppData>): Promise<App> {
    const blueprint = await this.getBlueprint(blueprintId);
    if (!blueprint) {
      throw new ValidationError(`Blueprint not found: ${blueprintId}`);
    }

    const createData: CreateAppData = {
      name: data.name || blueprint.name,
      description: data.description || blueprint.description,
      blueprintId,
      position: data.position || [0, 0, 0],
      quaternion: data.quaternion || [0, 0, 0, 1],
      scale: data.scale || [1, 1, 1],
      settings: data.settings,
      userId: data.userId,
      tags: data.tags || blueprint.tags,
      category: data.category || blueprint.category,
    };

    return this.createApp(createData);
  }

  async getApp(appId: string): Promise<App | null> {
    if (!appId) {
      throw new ValidationError('App ID is required');
    }

    try {
      const response = await this.httpClient.get<App>(`${this.baseURL}/${appId}`);
      return response.data;

    } catch (error) {
      this.logger.error(`Failed to get app: ${appId}`, error);
      return null;
    }
  }

  async getAppEntity(appId: string): Promise<AppEntity | null> {
    return this.apps.get(appId) || null;
  }

  async updateApp(appId: string, data: UpdateAppData): Promise<App> {
    if (!appId) {
      throw new ValidationError('App ID is required');
    }

    this.validateUpdateAppData(data);

    try {
      const response = await this.httpClient.put<App>(`${this.baseURL}/${appId}`, data);
      const app = response.data;

      // Update entity if it exists
      const appEntity = this.apps.get(appId);
      if (appEntity) {
        if (data.position) appEntity.setPosition(data.position);
        if (data.quaternion) appEntity.setRotation(data.quaternion);
        if (data.scale) appEntity.setScale(data.scale);
      }

      this.logger.info(`App updated: ${app.id} - ${app.name}`);
      this.emit('appUpdated', { app, entity: appEntity });
      return app;

    } catch (error) {
      this.logger.error(`Failed to update app: ${appId}`, error);
      throw new AppError(`Failed to update app: ${appId}`, error);
    }
  }

  async deleteApp(appId: string): Promise<boolean> {
    if (!appId) {
      throw new ValidationError('App ID is required');
    }

    try {
      // Destroy entity if it exists
      const appEntity = this.apps.get(appId);
      if (appEntity) {
        await appEntity.destroy();
        this.apps.delete(appId);
      }

      // Remove from API
      await this.httpClient.delete(`${this.baseURL}/${appId}`);

      this.logger.info(`App deleted: ${appId}`);
      this.emit('appDeleted', appId);
      return true;

    } catch (error) {
      this.logger.error(`Failed to delete app: ${appId}`, error);
      throw new AppError(`Failed to delete app: ${appId}`, error);
    }
  }

  async listApps(options: AppListOptions = {}): Promise<{ apps: App[], total: number, hasMore: boolean }> {
    const queryParams = new URLSearchParams();

    if (options.limit) queryParams.append('limit', options.limit.toString());
    if (options.offset) queryParams.append('offset', options.offset.toString());
    if (options.sortBy) queryParams.append('sortBy', options.sortBy);
    if (options.sortOrder) queryParams.append('sortOrder', options.sortOrder);
    if (options.search) queryParams.append('search', options.search);

    if (options.filter) {
      if (options.filter.public !== undefined) {
        queryParams.append('public', options.filter.public.toString());
      }
      if (options.filter.owner) {
        queryParams.append('owner', options.filter.owner);
      }
      if (options.filter.category) {
        queryParams.append('category', options.filter.category);
      }
      if (options.filter.tags) {
        queryParams.append('tags', options.filter.tags.join(','));
      }
      if (options.filter.status) {
        queryParams.append('status', options.filter.status);
      }
    }

    const url = queryParams.toString() ? `${this.baseURL}?${queryParams.toString()}` : this.baseURL;

    try {
      const response = await this.httpClient.get<{ apps: App[], total: number, hasMore: boolean }>(url);
      return response.data;

    } catch (error) {
      this.logger.error('Failed to list apps', error);
      throw new AppError('Failed to list apps', error);
    }
  }

  // App Instance Management
  async createAppInstance(appId: string, options: AppInstanceOptions = {}): Promise<AppInstance> {
    const app = await this.getApp(appId);
    if (!app) {
      throw new ValidationError(`App not found: ${appId}`);
    }

    const instanceId = generateId();
    const instance: AppInstance = {
      id: instanceId,
      appId,
      status: 'initializing',
      createdAt: new Date(),
      config: {
        autoStart: options.autoStart ?? true,
        hotReload: options.hotReload ?? this.config.enableHotReload,
        debugMode: options.debugMode ?? false,
        performanceMonitoring: options.performanceMonitoring ?? this.config.enablePerformanceMonitoring,
        networkSync: options.networkSync ?? true,
        maxMemory: options.maxMemory,
        timeout: options.timeout,
      },
    };

    this.appInstances.set(instanceId, instance);

    try {
      if (instance.config.autoStart) {
        await this.startAppInstance(instanceId);
      }

      this.logger.info(`App instance created: ${instanceId}`);
      this.emit('instanceCreated', instance);
      return instance;

    } catch (error) {
      this.appInstances.delete(instanceId);
      throw error;
    }
  }

  async startAppInstance(instanceId: string): Promise<void> {
    const instance = this.appInstances.get(instanceId);
    if (!instance) {
      throw new ValidationError(`Instance not found: ${instanceId}`);
    }

    if (instance.status === 'running') {
      return;
    }

    try {
      instance.status = 'starting';
      instance.startedAt = new Date();

      const appEntity = this.apps.get(instance.appId);
      if (appEntity) {
        await appEntity.initialize();
      }

      instance.status = 'running';
      this.logger.info(`App instance started: ${instanceId}`);
      this.emit('instanceStarted', instance);

    } catch (error) {
      instance.status = 'error';
      instance.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  async stopAppInstance(instanceId: string): Promise<void> {
    const instance = this.appInstances.get(instanceId);
    if (!instance) {
      throw new ValidationError(`Instance not found: ${instanceId}`);
    }

    if (instance.status !== 'running') {
      return;
    }

    try {
      instance.status = 'stopping';

      const appEntity = this.apps.get(instance.appId);
      if (appEntity) {
        await appEntity.destroy();
      }

      instance.status = 'stopped';
      instance.stoppedAt = new Date();

      this.logger.info(`App instance stopped: ${instanceId}`);
      this.emit('instanceStopped', instance);

    } catch (error) {
      instance.status = 'error';
      instance.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  async restartAppInstance(instanceId: string): Promise<void> {
    await this.stopAppInstance(instanceId);
    await this.startAppInstance(instanceId);
  }

  getAppInstance(instanceId: string): AppInstance | null {
    return this.appInstances.get(instanceId) || null;
  }

  getAppInstances(appId?: string): AppInstance[] {
    const instances = Array.from(this.appInstances.values());
    return appId ? instances.filter(i => i.appId === appId) : instances;
  }

  async deleteAppInstance(instanceId: string): Promise<boolean> {
    const instance = this.appInstances.get(instanceId);
    if (!instance) {
      return false;
    }

    try {
      if (instance.status === 'running') {
        await this.stopAppInstance(instanceId);
      }

      this.appInstances.delete(instanceId);
      this.logger.info(`App instance deleted: ${instanceId}`);
      this.emit('instanceDeleted', instanceId);
      return true;

    } catch (error) {
      this.logger.error(`Failed to delete app instance: ${instanceId}`, error);
      throw new AppError(`Failed to delete app instance: ${instanceId}`, error);
    }
  }

  // App Operations
  async duplicateApp(appId: string, newName?: string): Promise<App> {
    const originalApp = await this.getApp(appId);
    if (!originalApp) {
      throw new ValidationError(`App not found: ${appId}`);
    }

    const duplicateData: CreateAppData = {
      name: newName || `${originalApp.name} (Copy)`,
      description: originalApp.description,
      url: originalApp.url,
      blueprintId: originalApp.blueprintId,
      settings: originalApp.settings,
      tags: originalApp.tags,
      category: originalApp.category,
    };

    const newApp = await this.createApp(duplicateData);
    this.logger.info(`App duplicated: ${appId} -> ${newApp.id}`);
    this.emit('appDuplicated', { originalId: appId, newApp });

    return newApp;
  }

  async publishApp(appId: string): Promise<App> {
    return this.updateApp(appId, { settings: { public: true } });
  }

  async unpublishApp(appId: string): Promise<App> {
    return this.updateApp(appId, { settings: { public: false } });
  }

  async deployApp(appId: string, config: AppDeploymentConfig): Promise<{ url: string; version: string }> {
    try {
      const response = await this.httpClient.post(`${this.baseURL}/${appId}/deploy`, config);
      this.logger.info(`App deployed: ${appId}`);
      this.emit('appDeployed', { appId, deployment: response.data });
      return response.data;

    } catch (error) {
      this.logger.error(`Failed to deploy app: ${appId}`, error);
      throw new AppError(`Failed to deploy app: ${appId}`, error);
    }
  }

  // Search and Filtering
  async searchApps(query: string, options: AppListOptions = {}): Promise<{ apps: App[], total: number, hasMore: boolean }> {
    if (!query || query.trim().length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }

    return this.listApps({ ...options, search: query.trim() });
  }

  async getAppsByOwner(ownerId: string, options: Omit<AppListOptions, 'filter'> = {}): Promise<App[]> {
    return this.listApps({ ...options, filter: { owner: ownerId } }).then(result => result.apps);
  }

  async getPublicApps(options: Omit<AppListOptions, 'filter'> = {}): Promise<App[]> {
    return this.listApps({ ...options, filter: { public: true } }).then(result => result.apps);
  }

  async getAppsByCategory(category: string, options: Omit<AppListOptions, 'filter'> = {}): Promise<App[]> {
    return this.listApps({ ...options, filter: { category } }).then(result => result.apps);
  }

  async getAppsByTags(tags: string[], options: Omit<AppListOptions, 'filter'> = {}): Promise<App[]> {
    return this.listApps({ ...options, filter: { tags } }).then(result => result.apps);
  }

  // Analytics and Statistics
  async getAppStats(appId: string): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalSessions: number;
    averageSessionDuration: number;
    createdAt: Date;
    lastActivity: Date;
    views: number;
    downloads: number;
    rating: number;
    ratingCount: number;
  }> {
    if (!appId) {
      throw new ValidationError('App ID is required');
    }

    try {
      const response = await this.httpClient.get(`${this.baseURL}/${appId}/stats`);
      return response.data;

    } catch (error) {
      this.logger.error(`Failed to get app stats: ${appId}`, error);
      throw new AppError(`Failed to get app stats: ${appId}`, error);
    }
  }

  async getAppPerformance(appId: string): Promise<PerformanceMonitor | null> {
    const appEntity = this.apps.get(appId);
    if (!appEntity) {
      return null;
    }

    // Return performance metrics from the app entity
    return null; // Would be implemented in AppEntity
  }

  // Component Management
  registerComponent(name: string, componentClass: typeof Component): void {
    this.componentRegistry.set(name, componentClass);
    this.logger.info(`Component registered: ${name}`);
    this.emit('componentRegistered', { name, componentClass });
  }

  unregisterComponent(name: string): boolean {
    const removed = this.componentRegistry.delete(name);
    if (removed) {
      this.logger.info(`Component unregistered: ${name}`);
      this.emit('componentUnregistered', name);
    }
    return removed;
  }

  getComponent(name: string): typeof Component | null {
    return this.componentRegistry.get(name) || null;
  }

  getRegisteredComponents(): string[] {
    return Array.from(this.componentRegistry.keys());
  }

  // Blueprint Management
  async createBlueprint(config: any): Promise<BlueprintEntity> {
    const blueprint = new BlueprintEntity(config);
    this.blueprints.set(blueprint.id, blueprint);
    return blueprint;
  }

  async getBlueprint(blueprintId: string): Promise<BlueprintEntity | null> {
    return this.blueprints.get(blueprintId) || null;
  }

  async loadBlueprint(blueprintId: string): Promise<Blueprint | null> {
    try {
      const response = await this.httpClient.get<Blueprint>(`${this.baseURL}/blueprints/${blueprintId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to load blueprint: ${blueprintId}`, error);
      return null;
    }
  }

  // Asset Management
  async uploadAsset(file: File | Buffer, type: 'model' | 'texture' | 'audio' | 'script'): Promise<AssetFile> {
    try {
      const formData = new FormData();
      if (file instanceof File) {
        formData.append('file', file);
      } else {
        formData.append('file', new Blob([file]), 'asset');
      }
      formData.append('type', type);

      const response = await this.httpClient.post<AssetFile>(`${this.baseURL}/assets/upload`, formData);
      this.logger.info(`Asset uploaded: ${response.data.url}`);
      return response.data;

    } catch (error) {
      this.logger.error('Failed to upload asset', error);
      throw new AppError('Failed to upload asset', error);
    }
  }

  async deleteAsset(assetId: string): Promise<boolean> {
    try {
      await this.httpClient.delete(`${this.baseURL}/assets/${assetId}`);
      this.logger.info(`Asset deleted: ${assetId}`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to delete asset: ${assetId}`, error);
      return false;
    }
  }

  // Network Message Handling
  sendNetworkMessage(message: Omit<NetworkMessage, 'timestamp' | 'appId'>): void {
    const networkMessage: NetworkMessage = {
      ...message,
      timestamp: new Date(),
    };

    this.networkMessages.push(networkMessage);
    this.processNetworkMessages();
  }

  // Batch Operations
  async batchCreateApps(apps: CreateAppData[]): Promise<App[]> {
    const results: App[] = [];
    const errors: Error[] = [];

    for (const appData of apps) {
      try {
        const app = await this.createApp(appData);
        results.push(app);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    if (errors.length > 0 && results.length === 0) {
      throw new AppError('All app creations failed', errors[0]);
    }

    this.emit('batchCreateCompleted', { results, errors });
    return results;
  }

  async batchDeleteApps(appIds: string[]): Promise<{ successful: string[], failed: string[] }> {
    const successful: string[] = [];
    const failed: string[] = [];

    for (const appId of appIds) {
      try {
        await this.deleteApp(appId);
        successful.push(appId);
      } catch (error) {
        failed.push(appId);
        this.logger.error(`Failed to delete app: ${appId}`, error);
      }
    }

    this.emit('batchDeleteCompleted', { successful, failed });
    return { successful, failed };
  }

  // Cleanup and Maintenance
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up AppManager');

    // Stop all app instances
    for (const [instanceId, instance] of this.appInstances) {
      if (instance.status === 'running') {
        try {
          await this.stopAppInstance(instanceId);
        } catch (error) {
          this.logger.error(`Failed to stop instance: ${instanceId}`, error);
        }
      }
    }

    // Destroy all app entities
    for (const [appId, appEntity] of this.apps) {
      try {
        await appEntity.destroy();
      } catch (error) {
        this.logger.error(`Failed to destroy app entity: ${appId}`, error);
      }
    }

    // Clear all collections
    this.apps.clear();
    this.appInstances.clear();
    this.blueprints.clear();
    this.networkMessages = [];
    this.componentRegistry.clear();

    this.removeAllListeners();
    this.logger.info('AppManager cleaned up');
  }

  // Private Methods
  private setupAppEventHandlers(appEntity: AppEntity): void {
    appEntity.on('error', (error) => {
      this.logger.error(`App error: ${appEntity.id}`, error);
      this.emit('appError', { appId: appEntity.id, error });
    });

    appEntity.on('initialized', () => {
      this.logger.info(`App initialized: ${appEntity.id}`);
      this.emit('appInitialized', appEntity);
    });

    appEntity.on('destroyed', () => {
      this.logger.info(`App destroyed: ${appEntity.id}`);
      this.apps.delete(appEntity.id);
      this.emit('appDestroyed', appEntity);
    });

    appEntity.on('networkMessages', (messages: NetworkMessage[]) => {
      this.networkMessages.push(...messages);
    });
  }

  private setupNetworkSync(): void {
    setInterval(() => {
      this.processNetworkMessages();
    }, this.config.networkSyncInterval);
  }

  private processNetworkMessages(): void {
    if (this.networkMessages.length === 0) {
      return;
    }

    const messages = [...this.networkMessages];
    this.networkMessages = [];

    // Group messages by app
    const messagesByApp = new Map<string, NetworkMessage[]>();
    for (const message of messages) {
      if (!messagesByApp.has(message.appId)) {
        messagesByApp.set(message.appId, []);
      }
      messagesByApp.get(message.appId)!.push(message);
    }

    // Send messages to respective app entities
    for (const [appId, appMessages] of messagesByApp) {
      const appEntity = this.apps.get(appId);
      if (appEntity) {
        for (const message of appMessages) {
          appEntity.emit('networkMessage', message);
        }
      }
    }

    this.emit('networkMessagesProcessed', messages);
  }

  private validateCreateAppData(data: CreateAppData): void {
    if (!data.name || data.name.trim().length < 1) {
      throw new ValidationError('App name is required');
    }

    if (data.name.length > 100) {
      throw new ValidationError('App name must be 100 characters or less');
    }

    if (data.description && data.description.length > 500) {
      throw new ValidationError('App description must be 500 characters or less');
    }

    if (data.url && !isValidUrl(data.url)) {
      throw new ValidationError('Valid app URL is required');
    }

    if (this.apps.size >= this.config.maxConcurrentApps) {
      throw new ValidationError('Maximum concurrent apps limit reached');
    }
  }

  private validateUpdateAppData(data: UpdateAppData): void {
    if (data.name && (data.name.trim().length < 1 || data.name.length > 100)) {
      throw new ValidationError('App name must be between 1 and 100 characters');
    }

    if (data.description && data.description.length > 500) {
      throw new ValidationError('App description must be 500 characters or less');
    }

    if (data.url && !isValidUrl(data.url)) {
      throw new ValidationError('Valid app URL is required');
    }
  }
}