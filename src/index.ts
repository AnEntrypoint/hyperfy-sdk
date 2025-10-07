export { HyperfySDK } from './sdk/hyperfy-sdk';
export { WebSocketManager } from './network/websocket-manager';
export { HttpClient } from './network/http-client';
export { EntityManager } from './entities/entity-manager';
export { AppManager } from './managers/app-manager';
export { BuilderManager } from './managers/builder-manager';
export { ChatManager } from './managers/chat-manager';
export { FileManager } from './managers/file-manager';

export { NodeLogger } from './utils/logger';
export {
  HyperfyError,
  NetworkError,
  WebSocketError,
  EntityError,
  AppError,
  ValidationError,
  AuthenticationError,
  FileNotFoundError,
  TimeoutError,
} from './utils/errors';

export {
  createVector3,
  addVectors,
  subtractVectors,
  multiplyVector,
  distanceBetween,
  normalizeVector,
  generateId,
  validateEntity,
  deepClone,
  debounce,
  throttle,
  sanitizeString,
  isValidUrl,
  formatFileSize,
} from './utils/helpers';

export type {
  HyperfyConfig,
  Entity,
  Vector3,
  App,
  AppSettings,
  User,
  ChatMessage,
  FileUpload,
  NetworkEvent,
  WebSocketMessage,
  BuilderAction,
  ErrorInfo,
  LogLevel,
  Logger,
  EventEmitter,
} from './types';

export type { SDKState } from './sdk/hyperfy-sdk';
export type { EntityManagerConfig, EntityHistory } from './entities/entity-manager';
export type { AppManagerConfig, CreateAppData, UpdateAppData, AppListOptions } from './managers/app-manager';
export type { BuilderManagerConfig, BuildHistory, BuildSession } from './managers/builder-manager';
export type { ChatManagerConfig, SendMessageOptions, ChatHistoryOptions, ChatRoom } from './managers/chat-manager';
export type { FileManagerConfig, UploadOptions, UploadResult, FileInfo } from './managers/file-manager';
export type { WebSocketManagerConfig } from './network/websocket-manager';
export type { HttpClientConfig, RequestOptions, HttpResponse } from './network/http-client';