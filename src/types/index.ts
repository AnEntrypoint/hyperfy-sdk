export interface HyperfyConfig {
  apiUrl?: string;
  wsUrl?: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface Entity {
  id: string;
  type: string;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  properties?: Record<string, any>;
  parent?: string;
  children?: string[];
}

export type Vector3 = [number, number, number];
export type Vector2 = [number, number];
export type Quaternion = [number, number, number, number];

export interface App {
  id: string;
  name: string;
  description?: string;
  url: string;
  settings: AppSettings;
  entities: Entity[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AppSettings {
  maxUsers: number;
  public: boolean;
  allowVoice: boolean;
  allowChat: boolean;
  physics: boolean;
  [key: string]: any;
}

export interface User {
  id: string;
  username: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'moderator' | 'user';
  joinedAt: Date;
  lastSeen: Date;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'system' | 'command';
}

export interface FileUpload {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: Date;
}

export interface NetworkEvent {
  type: string;
  data: any;
  timestamp: Date;
  userId?: string;
}

export interface WebSocketMessage {
  event: string;
  data: any;
  id?: string;
  timestamp?: number;
}

// Network-specific types for Hyperfy protocol
export interface SnapshotData {
  id: string;
  serverTime: number;
  apiUrl: string;
  assetsUrl: string;
  maxUploadSize: number;
  authToken: string;
  hasAdminCode: boolean;
  settings: Record<string, any>;
  collections: Record<string, any>;
  chat: ChatMessage[];
  blueprints: Blueprint[];
  entities: Entity[];
  livekit?: LiveKitData;
}

export interface EntityData {
  id: string;
  type: string;
  owner?: string;
  position?: Vector3;
  rotation?: Vector3;
  scale?: Vector3;
  avatar?: string;
  sessionAvatar?: string;
  [key: string]: any;
}

export interface PlayerTeleportData {
  position: Vector3;
  rotation?: Vector3;
}

export interface PlayerPushData {
  force: Vector3;
}

export interface EntityEvent {
  id: string;
  version: number;
  name: string;
  data: any;
}

export interface ChatMessageData {
  id: string;
  from: string | null;
  fromId: string | null;
  body: string;
  createdAt: string;
  [key: string]: any;
}

export interface SettingsModifiedData {
  key: string;
  value: any;
}

export interface BlueprintModifiedData {
  id: string;
  changes: Record<string, any>;
}

export interface EntityModifiedData {
  id: string;
  [key: string]: any;
}

export interface LiveKitLevelData {
  playerId: string;
  level: number;
}

export interface MuteData {
  playerId: string;
  muted: boolean;
}

export interface PlayerSessionAvatarData {
  avatar: string;
}

export interface ErrorReportData {
  error: ErrorInfo;
  context?: Record<string, any>;
}

export interface GetErrorsData {
  limit?: number;
  offset?: number;
  severity?: string;
  userId?: string;
}

export interface ErrorsData {
  errors: ErrorInfo[];
  total: number;
  hasMore: boolean;
}

export interface McpSubscribeErrorsData {
  enabled: boolean;
}

export interface McpErrorEventData {
  error: ErrorInfo;
  timestamp: number;
}

export interface LiveKitData {
  enabled: boolean;
  serverUrl?: string;
  token?: string;
  [key: string]: any;
}

export interface Blueprint {
  id: string;
  name: string;
  description?: string;
  model?: string;
  script?: string;
  props?: Record<string, any>;
  preload?: boolean;
  disabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Packet types for the Hyperfy protocol
export type PacketType =
  | 'snapshot'
  | 'command'
  | 'chatAdded'
  | 'chatCleared'
  | 'blueprintAdded'
  | 'blueprintModified'
  | 'entityAdded'
  | 'entityModified'
  | 'entityEvent'
  | 'entityRemoved'
  | 'playerTeleport'
  | 'playerPush'
  | 'playerSessionAvatar'
  | 'liveKitLevel'
  | 'mute'
  | 'settingsModified'
  | 'spawnModified'
  | 'modifyRank'
  | 'kick'
  | 'ping'
  | 'pong'
  | 'errorReport'
  | 'getErrors'
  | 'clearErrors'
  | 'errors'
  | 'mcpSubscribeErrors'
  | 'mcpErrorEvent';

// Network client configuration
export interface NetworkClientConfig extends HyperfyConfig {
  wsUrl: string;
  name?: string;
  avatar?: string;
  authToken?: string;
}

export interface BuilderAction {
  type: 'create' | 'update' | 'delete' | 'move' | 'rotate' | 'scale';
  entity: string;
  data: any;
  userId?: string;
  timestamp: Date;
}

export interface ErrorInfo {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  stack?: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: Error | ErrorInfo): void;
}

export interface EventEmitter {
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
  once(event: string, listener: (...args: any[]) => void): void;
}

// Player types
export interface PlayerData {
  id: string;
  name: string;
  position: Vector3;
  quaternion: number[];
  scale?: Vector3;
  health?: number;
  avatar?: string;
  sessionAvatar?: string;
  rank?: number;
  mode?: number;
  axis?: Vector3;
  gaze?: Vector3;
  emote?: string;
  effect?: PlayerEffect;
}

export interface PlayerEffect {
  freeze?: boolean;
  snare?: number;
  anchorId?: string;
  emote?: string;
  duration?: number;
  cancellable?: boolean;
  turn?: boolean;
}

export interface PlayerAvatar {
  url: string;
  height: number;
  headToHeight: number;
  visible: boolean;
}

export interface PlayerState {
  id: string;
  position: Vector3;
  quaternion: Vector3;
  velocity: Vector3;
  mode: PlayerMode;
  axis: Vector3;
  gaze: Vector3;
  emote?: string;
  health: number;
  grounded: boolean;
  flying: boolean;
  running: boolean;
  speaking: boolean;
  firstPerson: boolean;
  rank: number;
}

export interface PlayerInput {
  moveDir: Vector3;
  jumpPressed: boolean;
  jumpDown: boolean;
  running: boolean;
  flying: boolean;
  lookDelta: Vector3;
  zoomDelta: number;
}

export interface PlayerStats {
  distanceTraveled: number;
  timeMoving: number;
  jumpCount: number;
  fallDistance: number;
  health: number;
}

export interface PlayerCamera {
  position: Vector3;
  quaternion: Vector3;
  rotation: Vector3;
  zoom: number;
  height: number;
  firstPerson: boolean;
}

// Player movement modes
export enum PlayerMode {
  IDLE = 0,
  WALK = 1,
  RUN = 2,
  JUMP = 3,
  FALL = 4,
  FLY = 5,
  TALK = 6,
  FLIP = 7
}

// Player ranks
export enum PlayerRank {
  VISITOR = 0,
  MEMBER = 1,
  MODERATOR = 2,
  BUILDER = 3,
  ADMIN = 4,
  OWNER = 5
}

// Input types
export interface InputBinding {
  id: string;
  type: 'keyboard' | 'mouse' | 'gamepad' | 'touch';
  code?: string;
  button?: string;
  axis?: string;
  priority: number;
  active: boolean;
}

export interface InputState {
  keyboard: Record<string, boolean>;
  mouse: {
    left: boolean;
    right: boolean;
    middle: boolean;
    position: Vector3;
    delta: Vector3;
    locked: boolean;
  };
  gamepad: {
    leftStick: Vector3;
    rightStick: Vector3;
    leftTrigger: boolean;
    rightTrigger: boolean;
    buttons: Record<string, boolean>;
  };
  touch: {
    active: boolean;
    position: Vector3;
    delta: Vector3;
  };
}

// Physics types
export interface PhysicsProperties {
  mass: number;
  gravity: number;
  friction: number;
  restitution: number;
  linearDamping: number;
  angularDamping: number;
}

export interface CollisionInfo {
  position: Vector3;
  normal: Vector3;
  distance: number;
  entity?: string;
  penetration: number;
}

export interface RaycastHit {
  position: Vector3;
  normal: Vector3;
  distance: number;
  entity: string;
  point: Vector3;
}

// Movement settings
export interface MovementSettings {
  walkSpeed: number;
  runSpeed: number;
  jumpHeight: number;
  flySpeed: number;
  gravity: number;
  mass: number;
  friction: number;
  airControl: number;
  groundCheckDistance: number;
  maxSlopeAngle: number;
  capsuleRadius: number;
  capsuleHeight: number;
}

// Animation and emotes
export interface EmoteData {
  id: string;
  name: string;
  duration: number;
  animation: string;
  loop: boolean;
  priority: number;
}

export interface AnimationState {
  mode: PlayerMode;
  axis: Vector3;
  gaze: Vector3;
  transitionTime: number;
  weight: number;
}

// Social features
export interface PlayerInteraction {
  type: 'follow' | 'trade' | 'emote' | 'chat' | 'teleport';
  targetId?: string;
  data?: any;
  timestamp: Date;
}

export interface ProximityInfo {
  playerId: string;
  distance: number;
  inRange: boolean;
  interactionType: string[];
}

// Network player sync
export interface PlayerSyncData {
  id: string;
  position: Vector3;
  quaternion: number[];
  mode: number;
  axis: Vector3;
  gaze: Vector3;
  emote?: string;
  teleport?: boolean;
  timestamp: number;
}

export interface PlayerPrediction {
  id: string;
  position: Vector3;
  velocity: Vector3;
  timestamp: number;
  sequence: number;
  acknowledged: boolean;
}

// VR/AR support
export interface XRController {
  hand: 'left' | 'right';
  position: Vector3;
  quaternion: Vector3;
  buttons: Record<string, boolean>;
  stick: Vector3;
  trigger: boolean;
}

export interface XRState {
  active: boolean;
  mode: 'vr' | 'ar';
  controllers: {
    left?: XRController;
    right?: XRController;
  };
  head: {
    position: Vector3;
    quaternion: Vector3;
  };
}

// Events
export interface PlayerEvents {
  move: { position: Vector3; velocity: Vector3 };
  rotate: { rotation: Vector3; quaternion: Vector3 };
  jump: { height: number; velocity: Vector3 };
  land: { fallDistance: number; velocity: Vector3 };
  health: { playerId: string; health: number; change: number };
  rank: { playerId: string; rank: number };
  chat: { playerId: string; message: string; timestamp: Date };
  emote: { playerId: string; emote: string; duration: number };
  teleport: { position: Vector3; rotation?: Vector3 };
  push: { force: Vector3; source?: string };
  interact: { target: string; type: string; data: any };
  collision: { entity: string; position: Vector3; normal: Vector3 };
  state: { mode: PlayerMode; grounded: boolean; flying: boolean };
  proximity: { playerId: string; distance: number; entered: boolean };
}

// Player management
export interface PlayerManagerConfig {
  maxPlayers: number;
  spawnPoints: Vector3[];
  defaultAvatar: string;
  movementSettings: MovementSettings;
  allowedEmotes: string[];
  voiceChatEnabled: boolean;
  textChatEnabled: boolean;
}

// Error handling
export interface PlayerError {
  code: string;
  message: string;
  playerId?: string;
  context?: Record<string, any>;
  timestamp: Date;
}

export type PlayerEventType = keyof PlayerEvents;

// ========== APP SYSTEM TYPES ==========

// App Entity Types
export enum AppMode {
  ACTIVE = 'active',
  MOVING = 'moving',
  LOADING = 'loading',
  CRASHED = 'crashed',
  PAUSED = 'paused',
  DESTROYED = 'destroyed'
}

export enum AppState {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  PAUSED = 'paused',
  CRASHED = 'crashed',
  DESTROYED = 'destroyed'
}

export interface AppInstance {
  id: string;
  appId: string;
  status: 'initializing' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  createdAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
  config: {
    autoStart: boolean;
    hotReload: boolean;
    debugMode: boolean;
    performanceMonitoring: boolean;
    networkSync: boolean;
    maxMemory?: number;
    timeout?: number;
  };
  error?: string;
}

export interface Component {
  id: string;
  type: string;
  properties: Record<string, any>;
  active: boolean;
  activate?(app: any): Promise<void>;
  deactivate?(): Promise<void>;
  update?(delta: number): void;
}

export interface HotReloader {
  enabled: boolean;
  watchedFiles: string[];
  lastReload: Date;
}

export interface PerformanceMonitor {
  frameCount: number;
  lastFrameTime: number;
  averageFrameTime: number;
  memoryUsage: number;
  entityCount: number;
}

export interface NetworkMessage {
  type: string;
  data: any;
  appId: string;
  timestamp: Date;
  userId?: string;
  broadcast?: boolean;
}

export interface ScriptContext {
  world: {
    id: string;
    time: number;
    deltaTime: number;
    emit: (event: string, data: any) => void;
    on: (event: string, callback: Function) => void;
    off: (event: string, callback: Function) => void;
  };
  app: {
    id: string;
    position: Vector3;
    rotation: Quaternion;
    scale: Vector3;
    state: Record<string, any>;
    setState: (state: Record<string, any>) => void;
    getState: () => Record<string, any>;
    send: (event: string, data: any) => void;
    on: (event: string, callback: Function) => void;
    off: (event: string, callback: Function) => void;
  };
  require: any;
  console: any;
}

export interface AssetFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  hash?: string;
  uploadedAt: Date;
  metadata?: Record<string, any>;
}

// Blueprint System Types
export interface BlueprintVersion {
  number: number;
  createdAt: Date;
  message: string;
  author: string;
  changes: Record<string, any>;
  assets: string[];
  checksum: string;
  parentVersion?: number;
  metadata?: Record<string, any>;
}

export interface BlueprintAsset {
  id: string;
  name: string;
  type: 'model' | 'texture' | 'audio' | 'script';
  url: string;
  size: number;
  hash: string;
  addedAt: Date;
  metadata?: Record<string, any>;
}

export interface BlueprintMetadata {
  downloads: number;
  rating: number;
  ratingCount: number;
  views: number;
  shares: number;
  fileSize: number;
  lastAccessed: Date;
  featured: boolean;
  verified: boolean;
}

export interface BlueprintCollaborator {
  userId: string;
  role: CollaboratorRole;
  addedAt: Date;
  invitedBy?: string;
  permissions: string[];
  updatedAt?: Date;
}

export enum CollaboratorRole {
  OWNER = 'owner',
  EDITOR = 'editor',
  VIEWER = 'viewer',
  COMMENTER = 'commenter'
}

export interface BlueprintComment {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
  parentId?: string;
  versionNumber?: number;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  replies?: BlueprintComment[];
}

export interface BlueprintTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  blueprintId: string;
  blueprintVersion: number;
  createdAt: Date;
  category: string;
  tags: string[];
  thumbnail?: string;
  downloads: number;
  rating: number;
  ratingCount: number;
}

export interface BlueprintSearchOptions {
  query?: string;
  category?: string;
  tags?: string[];
  author?: string;
  license?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'downloads' | 'rating';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface BlueprintCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
}

export interface BlueprintTag {
  id: string;
  name: string;
  count: number;
  color?: string;
}

// Builder System Types
export enum BuildMode {
  SELECT = 'select',
  GRAB = 'grab',
  MOVE = 'move',
  ROTATE = 'rotate',
  SCALE = 'scale',
  PAINT = 'paint',
  TERRAIN = 'terrain'
}

export enum BuildTool {
  GRAB = 'grab',
  MOVE = 'move',
  ROTATE = 'rotate',
  SCALE = 'scale',
  PAINT = 'paint',
  SELECT = 'select',
  TERRAIN = 'terrain',
  MATERIAL = 'material'
}

export interface BuildAction {
  type: 'create' | 'delete' | 'move' | 'rotate' | 'scale' | 'update';
  entityId: string;
  data: any;
  userId: string;
  timestamp: Date;
  buildVersion?: number;
}

export interface BuildHistory {
  id: string;
  timestamp: Date;
  changes: BuildAction[];
  snapshot: Entity[];
  userId?: string;
  description?: string;
  buildVersion: number;
}

export interface BuildSession {
  id: string;
  appId: string;
  startTime: Date;
  endTime?: Date;
  userId: string;
  actions: BuildAction[];
  entities: Entity[];
  options: Record<string, any>;
}

export interface BuilderPermissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPublish: boolean;
  canManageCollaborators: boolean;
}

export interface SnapSettings {
  enabled: boolean;
  distance: number;
  angle: number;
  scale: number;
}

export interface GridSettings {
  visible: boolean;
  size: number;
  divisions: number;
  color: [number, number, number, number];
  orientation: 'x' | 'y' | 'z';
}

export interface SelectionGroup {
  id: string;
  name: string;
  entities: string[];
  pivot: Vector3;
}

export interface BuilderHotkey {
  key: string;
  modifiers?: string[];
  tool?: BuildTool;
  action?: string;
  description: string;
}

export interface MaterialPreset {
  id: string;
  name: string;
  properties: Material;
  thumbnail?: string;
  category?: string;
}

export interface BuilderSelection {
  entities: string[];
  boundingBox?: {
    min: Vector3;
    max: Vector3;
    center: Vector3;
    size: Vector3;
  };
  group?: SelectionGroup;
}

export interface BuilderViewport {
  camera: {
    position: Vector3;
    rotation: Quaternion;
    fov: number;
    near: number;
    far: number;
  };
  grid: GridSettings;
  gizmos: boolean;
  wireframe: boolean;
  bounds: boolean;
}

export interface RaycastResult {
  point: Vector3;
  normal: Vector3;
  distance: number;
  entity?: string;
  face?: number;
  uv?: Vector2;
}

export interface Transform3D {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
}

export interface BoundingBox {
  min: Vector3;
  max: Vector3;
  center: Vector3;
  size: Vector3;
}

// Script Engine Types
export interface ScriptExecutionOptions {
  timeout?: number;
  sandbox?: boolean;
  allowNetwork?: boolean;
  allowFileAccess?: boolean;
  maxMemory?: number;
  debugMode?: boolean;
}

export interface ScriptModule {
  name: string;
  exports: any;
  path?: string;
  version?: string;
  dependencies?: string[];
}

export interface ScriptEvent {
  name: string;
  data: any;
  timestamp: Date;
  source: string;
}

export interface ScriptPerformance {
  scriptId: string;
  executionCount: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  totalMemoryUsage: number;
  averageMemoryUsage: number;
  errorCount: number;
  lastExecution: Date;
}

export interface SecurityPolicy {
  allowEval: boolean;
  allowFunctionConstructor: boolean;
  allowTimers: boolean;
  allowNetworkRequests: boolean;
  allowFileSystemAccess: boolean;
  allowedDomains: string[];
  allowedModules: string[];
  maxExecutionTime: number;
  maxMemoryUsage: number;
}

export interface SandboxEnvironment {
  id: string;
  scriptId: string;
  global: any;
  allowedApis: string[];
  resourceLimits: ResourceLimits;
  startTime: number;
  memoryUsage: number;
  cpuTime: number;
  networkRequests: number;
}

export interface ResourceLimits {
  maxMemory: number;
  maxCpuTime: number;
  maxNetworkRequests: number;
  maxFileSize: number;
}

// Material Types
export interface Material {
  id: string;
  type: 'standard' | 'glass' | 'metal' | 'emissive' | 'unlit' | 'custom';
  color: Vector3;
  metalness: number;
  roughness: number;
  opacity: number;
  transparent: boolean;
  emissive: Vector3;
  emissiveIntensity: number;
  texture?: string;
  normalMap?: string;
  roughnessMap?: string;
  metalnessMap?: string;
  aoMap?: string;
  properties?: Record<string, any>;
}

// Animation Types
export interface Animation {
  id: string;
  name: string;
  duration: number;
  loop: boolean;
  autoplay: boolean;
  keyframes: any[];
  properties?: Record<string, any>;
}

// Asset Types
export type AssetType = 'model' | 'texture' | 'audio' | 'script' | 'video';

// Transform Operation Types
export interface TransformOperation {
  type: 'translate' | 'rotate' | 'scale' | 'lookAt';
  values: Vector3 | Quaternion;
  duration?: number;
  easing?: string;
}

// Deployment Types
export interface DeploymentConfig {
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

// Extended Entity Interface
export interface Entity {
  id: string;
  type: string;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  visible: boolean;
  locked: boolean;
  parent?: string;
  children?: string[];
  components?: Component[];
  material?: Material;
  physics?: PhysicsProperties;
  animation?: Animation;
  properties?: Record<string, any>;
  tags?: string[];
  metadata?: Record<string, any>;
}

// Extended Blueprint Interface
export interface Blueprint {
  id: string;
  name: string;
  description?: string;
  author: string;
  model?: string;
  script?: string;
  props?: Record<string, any>;
  thumbnail?: string;
  tags?: string[];
  public?: boolean;
  locked?: boolean;
  frozen?: boolean;
  unique?: boolean;
  scene?: boolean;
  disabled?: boolean;
  category?: string;
  license?: string;
  dependencies?: string[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
  metadata?: BlueprintMetadata;
}

// Extended App Interface
export interface App {
  id: string;
  name: string;
  description?: string;
  url: string;
  blueprintId?: string;
  position?: Vector3;
  quaternion?: Quaternion;
  scale?: Vector3;
  settings: AppSettings;
  tags?: string[];
  category?: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  lastAccessed?: Date;
}

// Extended AppSettings
export interface AppSettings {
  maxUsers?: number;
  public?: boolean;
  allowVoice?: boolean;
  allowChat?: boolean;
  physics?: boolean;
  enableNetworking?: boolean;
  enableCollaboration?: boolean;
  enableHotReload?: boolean;
  debugMode?: boolean;
  performanceMonitoring?: boolean;
  autoSave?: boolean;
  version?: string;
  [key: string]: any;
}

// ========== APP DEVELOPMENT TYPES ==========

export interface AppDevelopmentConfig {
  hotReload: boolean
  debugMode: boolean
  performanceMonitoring: boolean
  errorMonitoring: boolean
  autoSave: boolean
  autoSaveInterval: number
  collaboration: boolean
  permissions: AppPermissions
  testing: TestingConfig
  deployment: DeploymentConfig
}

export interface AppPermissions {
  canEdit: boolean
  canBuild: boolean
  canPublish: boolean
  canCollaborate: boolean
  canManageUsers: boolean
  canManageAssets: boolean
  canAccessAnalytics: boolean
}

export interface TestingConfig {
  enabled: boolean
  framework: 'jest' | 'mocha' | 'vitest' | 'custom'
  autoRun: boolean
  coverage: boolean
  coverageThreshold: number
  mockNetwork: boolean
  testPatterns: string[]
}

export interface AssetProcessingOptions {
  optimize: boolean
  compress: boolean
  generateMipmaps: boolean
  resizeTextures?: { width: number; height: number }
  compressionFormat?: 'draco' | 'meshopt' | 'gzip'
  quality: 'low' | 'medium' | 'high' | 'ultra'
}

export interface FileUploadProgress {
  loaded: number
  total: number
  percentage: number
  speed: number
  timeRemaining: number
}

export interface AppDevelopmentSession {
  id: string
  appId: string
  userId: string
  startTime: Date
  endTime?: Date
  isActive: boolean
  collaborators: string[]
  permissions: Map<string, AppPermissions>
  changes: DevelopmentChange[]
  assets: AssetFile[]
  errors: DevelopmentError[]
}

export interface DevelopmentChange {
  id: string
  type: 'create' | 'update' | 'delete' | 'move' | 'rename'
  timestamp: Date
  userId: string
  data: any
  description?: string
}

export interface DevelopmentError {
  id: string
  type: 'script' | 'build' | 'network' | 'asset' | 'validation'
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  details?: any
  stack?: string
  timestamp: Date
  userId?: string
  resolved: boolean
  resolvedBy?: string
  resolvedAt?: Date
}

export interface AppTemplate {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  blueprint: Blueprint
  assets: AssetFile[]
  thumbnail?: string
  author: string
  downloads: number
  rating: number
  ratingCount: number
  featured: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ComponentLibrary {
  id: string
  name: string
  description: string
  version: string
  author: string
  components: ComponentDefinition[]
  dependencies: string[]
  license: string
  repository?: string
  documentation?: string
  createdAt: Date
  updatedAt: Date
}

export interface ComponentDefinition {
  id: string
  name: string
  description: string
  type: 'primitive' | 'model' | 'script' | 'system' | 'ui' | 'effect'
  category: string
  tags: string[]
  props: ComponentProperty[]
  defaultValues: Record<string, any>
  events: ComponentEvent[]
  slots?: ComponentSlot[]
  dependencies?: string[]
  preview?: string
  documentation?: string
}

export interface ComponentProperty {
  name: string
  type: 'string' | 'number' | 'boolean' | 'vector3' | 'color' | 'asset' | 'enum' | 'array' | 'object'
  description?: string
  default?: any
  required: boolean
  min?: number
  max?: number
  step?: number
  options?: string[]
  validation?: (value: any) => boolean | string
}

export interface ComponentEvent {
  name: string
  description?: string
  parameters: ComponentParameter[]
}

export interface ComponentParameter {
  name: string
  type: string
  description?: string
  optional?: boolean
}

export interface ComponentSlot {
  name: string
  description?: string
  allowedTypes?: string[]
  multiple: boolean
  default?: any
}

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  main: string
  dependencies: Record<string, string>
  permissions: string[]
  hooks: string[]
  config?: Record<string, any>
  repository?: string
  documentation?: string
  license: string
  keywords: string[]
}

export interface AnalyticsData {
  appId: string
  userId?: string
  sessionId?: string
  event: string
  timestamp: Date
  data: Record<string, any>
  metadata?: Record<string, any>
}

export interface AnalyticsMetrics {
  appId: string
  period: 'hour' | 'day' | 'week' | 'month'
  totalUsers: number
  activeUsers: number
  totalSessions: number
  averageSessionDuration: number
  totalEvents: number
  errors: number
  performance: {
    averageFrameTime: number
    memoryUsage: number
    networkLatency: number
  }
  popularFeatures: Array<{
    feature: string
    usage: number
  }>
}

export interface ABTestConfig {
  id: string
  name: string
  description: string
  appId: string
  variants: ABTestVariant[]
  trafficSplit: number[]
  metrics: string[]
  startDate: Date
  endDate?: Date
  status: 'draft' | 'running' | 'completed' | 'paused'
}

export interface ABTestVariant {
  id: string
  name: string
  description: string
  config: Record<string, any>
  trafficPercentage: number
}

export interface ABTestResult {
  testId: string
  variantId: string
  metrics: Record<string, {
    value: number
    improvement?: number
    significance?: number
  }>
  sampleSize: number
  confidence: number
  winner?: boolean
}

export interface MonetizationConfig {
  enabled: boolean
  currency: string
  products: MonetizationProduct[]
  subscriptions: MonetizationSubscription[]
  analytics: boolean
}

export interface MonetizationProduct {
  id: string
  name: string
  description: string
  price: number
  currency: string
  type: 'consumable' | 'durable' | 'subscription'
  metadata?: Record<string, any>
}

export interface MonetizationSubscription {
  id: string
  name: string
  description: string
  price: number
  currency: string
  billingPeriod: 'day' | 'week' | 'month' | 'year'
  features: string[]
  metadata?: Record<string, any>
}