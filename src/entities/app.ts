import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import {
  App as IApp,
  AppData,
  Blueprint,
  AppMode,
  AppState,
  Component,
  ScriptContext,
  AssetFile,
  NetworkMessage,
  PerformanceMonitor,
  HotReloader,
  AppDevelopmentConfig,
  DevelopmentError,
  DevelopmentChange,
  FileUploadProgress,
  SecurityPolicy,
  SandboxEnvironment,
  Vector3,
  Quaternion
} from '../types/index.js'

export interface AppConfig {
  id: string
  blueprintId: string
  position: Vector3
  quaternion: Quaternion
  scale: Vector3
  pinned?: boolean
  state?: Record<string, any>
  userId?: string
  settings?: {
    maxEntities?: number
    enablePhysics?: boolean
    enableNetworking?: boolean
    debugMode?: boolean
  }
}

export interface AppBuildOptions {
  hotReload?: boolean
  enableComponents?: boolean
  performanceMonitoring?: boolean
  debugMode?: boolean
  skipAssets?: boolean
}

export interface ScriptExecutionOptions {
  timeout?: number
  sandbox?: boolean
  allowNetwork?: boolean
  allowFileAccess?: boolean
  maxMemory?: number
}

export class AppEntity extends EventEmitter implements IApp {
  public readonly id: string
  public name: string
  public description?: string
  public url: string
  public blueprintId?: string
  public position: Vector3
  public quaternion: Quaternion
  public scale: Vector3
  public settings: any
  public tags?: string[]
  public category?: string
  public userId?: string
  public createdAt: Date
  public updatedAt: Date
  public publishedAt?: Date
  public lastAccessed?: Date

  private blueprint: Blueprint | null = null
  private mode: AppMode = AppMode.LOADING
  private appState: AppState = AppState.INITIALIZING
  private isDestroyed: boolean = false
  private isBuilding: boolean = false

  private scriptContext: ScriptContext | null = null
  private scriptTimeoutId?: NodeJS.Timeout
  private scriptExecutionCount: number = 0
  private maxScriptExecutions: number = 1000

  private components: Map<string, Component> = new Map()
  private componentUpdateQueue: Array<() => void> = []

  private loadedAssets: Map<string, any> = new Map()
  private assetLoadPromises: Map<string, Promise<any>> = new Map()

  private networkQueue: NetworkMessage[] = []
  private lastNetworkSync: number = 0
  private networkSyncInterval: number = 100

  private performanceMonitor: PerformanceMonitor | null = null
  private frameCount: number = 0
  private lastFrameTime: number = 0

  private hotReloader: HotReloader | null = null
  private fileWatchers: Map<string, any> = new Map()

  private buildHistory: any[] = []
  private buildVersion: number = 0
  private undoStack: any[] = []
  private redoStack: any[] = []

  private developmentConfig?: AppDevelopmentConfig
  private errors: DevelopmentError[] = []
  private changes: DevelopmentChange[] = []
  private sandbox?: SandboxEnvironment
  private abortController?: AbortController

  constructor(
    private config: AppConfig,
    private options: AppBuildOptions = {},
    private world?: any
  ) {
    super()

    this.id = config.id || uuidv4()
    this.name = config.id
    this.url = ''
    this.blueprintId = config.blueprintId
    this.position = config.position
    this.quaternion = config.quaternion
    this.scale = config.scale
    this.settings = config.settings || {}
    this.createdAt = new Date()
    this.updatedAt = new Date()

    this.setupPerformanceMonitoring()
    this.setupHotReloader()
  }

  async initialize(): Promise<void> {
    try {
      this.emit('initializing', { appId: this.id })
      this.appState = AppState.INITIALIZING

      await this.loadBlueprint()

      if (!this.options.skipAssets) {
        await this.loadAssets()
      }

      if (this.options.enableComponents) {
        await this.setupComponents()
      }

      await this.build()

      this.startUpdateLoop()

      this.appState = AppState.ACTIVE
      this.mode = AppMode.ACTIVE

      this.emit('initialized', this)

    } catch (error) {
      this.appState = AppState.CRASHED
      this.emit('error', error)
      throw error
    }
  }

  async build(crashed: boolean = false): Promise<void> {
    if (this.isBuilding) {
      return
    }

    this.isBuilding = true
    this.buildVersion++

    try {
      await this.unbuild()

      this.mode = crashed ? AppMode.CRASHED : AppMode.ACTIVE

      await this.createRootEntity(crashed)

      if (this.blueprint?.script && !crashed) {
        await this.executeScript()
      }

      if (this.options.enableNetworking && this.world) {
        await this.setupNetworking()
      }

      this.processNetworkQueue()

      this.emit('built', { version: this.buildVersion, crashed })

    } catch (error) {
      this.appState = AppState.CRASHED
      this.emit('buildError', error)
      throw error
    } finally {
      this.isBuilding = false
    }
  }

  async unbuild(): Promise<void> {
    this.stopScript()

    for (const component of this.components.values()) {
      try {
        await component.deactivate?.()
      } catch (error) {
        this.emit('componentError', error)
      }
    }

    this.clearEventListeners()

    if (this.world) {
      this.clearWorldNodes()
    }

    this.cancelNetworkSync()
    this.emit('unbuilt')
  }

  async destroy(): Promise<void> {
    if (this.isDestroyed) {
      return
    }

    this.isDestroyed = true
    this.appState = AppState.DESTROYED

    await this.unbuild()
    this.cleanupHotReloader()
    this.cleanupPerformanceMonitoring()

    this.components.clear()
    this.loadedAssets.clear()
    this.assetLoadPromises.clear()
    this.networkQueue = []
    this.buildHistory = []
    this.undoStack = []
    this.redoStack = []

    this.removeAllListeners()

    this.emit('destroyed', this)
  }

  async executeScript(options: ScriptExecutionOptions = {}): Promise<void> {
    if (!this.blueprint?.script) {
      return
    }

    const scriptOptions: ScriptExecutionOptions = {
      timeout: 10000,
      sandbox: true,
      allowNetwork: false,
      allowFileAccess: false,
      maxMemory: 50 * 1024 * 1024,
      ...options,
    }

    try {
      this.scriptContext = this.createScriptContext(scriptOptions)

      if (scriptOptions.timeout) {
        this.scriptTimeoutId = setTimeout(() => {
          this.stopScript()
          throw new Error('Script execution timeout')
        }, scriptOptions.timeout)
      }

      const scriptFunction = new Function(
        'world', 'app', 'props', 'require', 'console',
        this.blueprint.script
      )

      await scriptFunction(
        this.scriptContext.world,
        this.scriptContext.app,
        this.blueprint.props || {},
        this.createRequire(),
        this.createScriptConsole()
      )

      this.scriptExecutionCount++

      if (this.scriptTimeoutId) {
        clearTimeout(this.scriptTimeoutId)
        this.scriptTimeoutId = undefined
      }

      this.emit('scriptExecuted', { executionCount: this.scriptExecutionCount })

    } catch (error) {
      this.stopScript()
      this.appState = AppState.CRASHED
      this.emit('scriptError', error)
      throw error
    }
  }

  stopScript(): void {
    if (this.scriptTimeoutId) {
      clearTimeout(this.scriptTimeoutId)
      this.scriptTimeoutId = undefined
    }

    this.scriptContext = null
    this.emit('scriptStopped')
  }

  restartScript(): Promise<void> {
    this.stopScript()
    return this.executeScript()
  }

  addComponent(component: Component): void {
    if (this.components.has(component.id)) {
      throw new Error(`Component already exists: ${component.id}`)
    }

    this.components.set(component.id, component)

    if (this.appState === AppState.ACTIVE) {
      this.componentUpdateQueue.push(async () => {
        try {
          await component.activate?.(this)
        } catch (error) {
          this.emit('componentError', error)
        }
      })
    }

    this.emit('componentAdded', component)
  }

  removeComponent(componentId: string): boolean {
    const component = this.components.get(componentId)
    if (!component) {
      return false
    }

    this.componentUpdateQueue.push(async () => {
      try {
        await component.deactivate?.()
      } catch (error) {
        this.emit('componentError', error)
      }
    })

    this.components.delete(componentId)
    this.emit('componentRemoved', componentId)
    return true
  }

  getComponent<T extends Component>(componentId: string): T | null {
    return (this.components.get(componentId) as T) || null
  }

  getComponentsByType<T extends Component>(type: string): T[] {
    return Array.from(this.components.values()).filter(
      component => component.type === type
    ) as T[]
  }

  async loadAsset(url: string, type: 'model' | 'texture' | 'audio' | 'script' = 'model'): Promise<any> {
    if (this.loadedAssets.has(url)) {
      return this.loadedAssets.get(url)
    }

    if (this.assetLoadPromises.has(url)) {
      return this.assetLoadPromises.get(url)
    }

    const loadPromise = this.doLoadAsset(url, type)
    this.assetLoadPromises.set(url, loadPromise)

    try {
      const asset = await loadPromise
      this.loadedAssets.set(url, asset)
      this.emit('assetLoaded', { url, type, asset })
      return asset
    } finally {
      this.assetLoadPromises.delete(url)
    }
  }

  unloadAsset(url: string): boolean {
    const asset = this.loadedAssets.get(url)
    if (!asset) {
      return false
    }

    if (typeof asset.dispose === 'function') {
      asset.dispose()
    }

    this.loadedAssets.delete(url)
    this.emit('assetUnloaded', { url })
    return true
  }

  async performAction(action: any): Promise<void> {
    this.buildHistory.push({
      ...action,
      timestamp: new Date(),
      buildVersion: this.buildVersion,
    })

    this.undoStack.push(action)
    this.redoStack = []

    try {
      await this.executeBuildAction(action)
      this.emit('actionPerformed', action)
    } catch (error) {
      this.emit('actionError', { action, error })
      throw error
    }
  }

  async undo(): Promise<boolean> {
    const lastAction = this.undoStack.pop()
    if (!lastAction) {
      return false
    }

    const inverseAction = this.createInverseAction(lastAction)
    if (inverseAction) {
      await this.executeBuildAction(inverseAction)
      this.redoStack.push(lastAction)
      this.emit('actionUndone', lastAction)
      return true
    }

    return false
  }

  async redo(): Promise<boolean> {
    const actionToRedo = this.redoStack.pop()
    if (!actionToRedo) {
      return false
    }

    await this.executeBuildAction(actionToRedo)
    this.undoStack.push(actionToRedo)
    this.emit('actionRedone', actionToRedo)
    return true
  }

  updateState(updates: Record<string, any>): void {
    const previousState = { ...this.config.state }
    this.config.state = { ...this.config.state, ...updates }
    this.updatedAt = new Date()

    this.emit('stateUpdated', { previousState, currentState: this.config.state })
  }

  getState(): Record<string, any> {
    return { ...this.config.state }
  }

  sendNetworkMessage(message: Omit<NetworkMessage, 'timestamp' | 'appId'>): void {
    const networkMessage: NetworkMessage = {
      ...message,
      timestamp: new Date(),
      appId: this.id,
    }

    this.networkQueue.push(networkMessage)
    this.processNetworkQueue()
  }

  setPosition(position: Vector3): void {
    this.config.position = position
    this.position = position
    this.updatedAt = new Date()
    this.emit('transformChanged', { type: 'position', value: position })
  }

  setRotation(quaternion: Quaternion): void {
    this.config.quaternion = quaternion
    this.quaternion = quaternion
    this.updatedAt = new Date()
    this.emit('transformChanged', { type: 'rotation', value: quaternion })
  }

  setScale(scale: Vector3): void {
    this.config.scale = scale
    this.scale = scale
    this.updatedAt = new Date()
    this.emit('transformChanged', { type: 'scale', value: scale })
  }

  getBlueprint(): Blueprint | null {
    return this.blueprint
  }

  getMode(): AppMode {
    return this.mode
  }

  getAppState(): AppState {
    return this.appState
  }

  isBuilt(): boolean {
    return this.appState === AppState.ACTIVE || this.appState === AppState.PAUSED
  }

  isPaused(): boolean {
    return this.appState === AppState.PAUSED
  }

  isCrashed(): boolean {
    return this.appState === AppState.CRASHED
  }

  getBuildVersion(): number {
    return this.buildVersion
  }

  getBuildHistory(): any[] {
    return [...this.buildHistory]
  }

  getLoadedAssets(): string[] {
    return Array.from(this.loadedAssets.keys())
  }

  getComponents(): Component[] {
    return Array.from(this.components.values())
  }

  getPerformanceMetrics(): PerformanceMonitor | null {
    return this.performanceMonitor ? { ...this.performanceMonitor } : null
  }

  getErrors(): DevelopmentError[] {
    return [...this.errors]
  }

  getChanges(): DevelopmentChange[] {
    return [...this.changes]
  }

  async uploadAsset(file: File | Buffer, options?: any): Promise<AssetFile> {
    return new Promise((resolve, reject) => {
      const asset: AssetFile = {
        id: uuidv4(),
        name: (file as File).name || 'asset',
        type: (file as File).type || 'application/octet-stream',
        size: (file as File).size || (file as Buffer).length,
        url: `asset://${uuidv4()}`,
        uploadedAt: new Date()
      }

      this.loadedAssets.set(asset.id, asset)

      this.emit('assetUploadStarted', { asset })

      setTimeout(() => {
        this.emit('assetUploadCompleted', { asset })
        resolve(asset)
      }, 100)
    })
  }

  enableHotReload(): void {
    if (this.hotReloader) {
      this.hotReloader.enabled = true
      this.emit('hotReloadEnabled')
    }
  }

  disableHotReload(): void {
    if (this.hotReloader) {
      this.hotReloader.enabled = false
      this.emit('hotReloadDisabled')
    }
  }

  isHotReloadEnabled(): boolean {
    return this.hotReloader?.enabled || false
  }

  private async loadBlueprint(): Promise<void> {
    if (!this.config.blueprintId) {
      throw new Error('Blueprint ID is required')
    }

    this.blueprint = {
      id: this.config.blueprintId,
      version: 1,
      name: 'Default Blueprint',
      model: null,
      script: null,
      props: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.emit('blueprintLoaded', this.blueprint)
  }

  private async loadAssets(): Promise<void> {
    if (!this.blueprint?.model) {
      return
    }

    await this.loadAsset(this.blueprint.model, 'model')
  }

  private async setupComponents(): Promise<void> {
    for (const component of this.components.values()) {
      try {
        await component.activate?.(this)
      } catch (error) {
        this.emit('componentError', error)
      }
    }
  }

  private async createRootEntity(crashed: boolean): Promise<void> {
    if (crashed) {
      const crashModel = await this.loadAsset('asset://crash-block.glb', 'model')
      this.emit('rootEntityCreated', { entity: crashModel, crashed })
    } else if (this.blueprint?.model) {
      const model = await this.loadAsset(this.blueprint.model, 'model')
      this.emit('rootEntityCreated', { entity: model, crashed: false })
    }
  }

  private createScriptContext(options: ScriptExecutionOptions): ScriptContext {
    return {
      world: {
        id: this.id,
        time: Date.now(),
        deltaTime: 0,
        emit: (event: string, data: any) => this.emit(event, data),
        on: (event: string, callback: Function) => this.on(event, callback),
        off: (event: string, callback: Function) => this.off(event, callback),
      },
      app: {
        id: this.id,
        position: this.config.position,
        rotation: this.config.quaternion,
        scale: this.config.scale,
        state: this.config.state || {},
        setState: (state: Record<string, any>) => this.updateState(state),
        getState: () => this.getState(),
        send: (event: string, data: any) => this.sendNetworkMessage({ type: event, data }),
        on: (event: string, callback: Function) => this.on(event, callback),
        off: (event: string, callback: Function) => this.off(event, callback),
      },
      require: this.createRequire(),
      console: this.createScriptConsole(),
    }
  }

  private createRequire() {
    return (module: string) => {
      this.emit('moduleLoad', { module })
      throw new Error(`Module not found: ${module}`)
    }
  }

  private createScriptConsole() {
    return {
      log: (...args: any[]) => this.emit('log', { level: 'info', message: args.join(' ') }),
      warn: (...args: any[]) => this.emit('log', { level: 'warn', message: args.join(' ') }),
      error: (...args: any[]) => this.emit('log', { level: 'error', message: args.join(' ') }),
      debug: (...args: any[]) => this.emit('log', { level: 'debug', message: args.join(' ') }),
    }
  }

  private async setupNetworking(): Promise<void> {
    setInterval(() => {
      if (this.appState === AppState.ACTIVE) {
        this.syncNetworkState()
      }
    }, this.networkSyncInterval)
  }

  private processNetworkQueue(): void {
    if (this.networkQueue.length === 0) {
      return
    }

    const now = Date.now()
    if (now - this.lastNetworkSync < this.networkSyncInterval) {
      return
    }

    const messages = [...this.networkQueue]
    this.networkQueue = []
    this.lastNetworkSync = now

    this.emit('networkMessages', messages)
  }

  private syncNetworkState(): void {
    this.emit('networkSync', {
      position: this.config.position,
      rotation: this.config.quaternion,
      scale: this.config.scale,
      state: this.config.state,
      mode: this.mode,
    })
  }

  private cancelNetworkSync(): void {
    this.networkQueue = []
  }

  private clearEventListeners(): void {
    const frameworkEvents = ['initialized', 'built', 'destroyed', 'error', 'scriptError']
    const listeners = this.eventNames()

    for (const event of listeners) {
      if (!frameworkEvents.includes(event as string)) {
        this.removeAllListeners(event)
      }
    }
  }

  private clearWorldNodes(): void {
    if (this.world && typeof this.world.clearAppNodes === 'function') {
      this.world.clearAppNodes(this.id)
    }
  }

  private async doLoadAsset(url: string, type: string): Promise<any> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ url, type, loaded: true })
      }, 100)
    })
  }

  private async executeBuildAction(action: any): Promise<void> {
    switch (action.type) {
      case 'create':
        this.emit('entityCreated', action.data)
        break
      case 'delete':
        this.emit('entityDeleted', action.data)
        break
      case 'move':
        this.emit('entityMoved', action.data)
        break
      case 'rotate':
        this.emit('entityRotated', action.data)
        break
      case 'scale':
        this.emit('entityScaled', action.data)
        break
      default:
        throw new Error(`Unknown action type: ${action.type}`)
    }
  }

  private createInverseAction(action: any): any | null {
    switch (action.type) {
      case 'create':
        return {
          type: 'delete',
          entityId: action.entityId,
          data: { ...action.data },
          timestamp: new Date(),
          buildVersion: this.buildVersion,
        }
      case 'delete':
        return {
          type: 'create',
          entityId: action.entityId,
          data: { ...action.data },
          timestamp: new Date(),
          buildVersion: this.buildVersion,
        }
      case 'move':
        return {
          type: 'move',
          entityId: action.entityId,
          data: {
            position: action.data.previousPosition,
            previousPosition: action.data.position,
          },
          timestamp: new Date(),
          buildVersion: this.buildVersion,
        }
      default:
        return null
    }
  }

  private setupPerformanceMonitoring(): void {
    if (!this.options.performanceMonitoring) {
      return
    }

    this.performanceMonitor = {
      frameCount: 0,
      lastFrameTime: 0,
      averageFrameTime: 0,
      memoryUsage: 0,
      entityCount: 0,
    }

    this.startPerformanceMonitoring()
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      if (this.performanceMonitor && this.appState === AppState.ACTIVE) {
        this.updatePerformanceMetrics()
      }
    }, 1000)
  }

  private updatePerformanceMetrics(): void {
    if (!this.performanceMonitor) return

    const now = Date.now()
    const deltaTime = now - this.performanceMonitor.lastFrameTime

    this.performanceMonitor.frameCount++
    this.performanceMonitor.lastFrameTime = now
    this.performanceMonitor.averageFrameTime =
      (this.performanceMonitor.averageFrameTime + deltaTime) / 2

    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage()
      this.performanceMonitor.memoryUsage = memUsage.heapUsed
    }

    this.performanceMonitor.entityCount = this.components.size

    this.emit('performanceUpdate', this.performanceMonitor)
  }

  private cleanupPerformanceMonitoring(): void {
    this.performanceMonitor = null
  }

  private setupHotReloader(): void {
    if (!this.options.hotReload) {
      return
    }

    this.hotReloader = {
      enabled: true,
      watchedFiles: [],
      lastReload: new Date(),
    }
  }

  private cleanupHotReloader(): void {
    if (this.hotReloader) {
      for (const [path, watcher] of this.fileWatchers) {
        try {
          watcher.close?.()
        } catch (error) {
          this.emit('error', error)
        }
      }
      this.fileWatchers.clear()
      this.hotReloader = null
    }
  }

  private startUpdateLoop(): void {
    const update = () => {
      if (this.isDestroyed || this.appState !== AppState.ACTIVE) {
        return
      }

      const now = Date.now()
      const deltaTime = now - this.lastFrameTime
      this.lastFrameTime = now

      this.processComponentUpdates()

      if (this.performanceMonitor) {
        this.performanceMonitor.frameCount = this.frameCount++
      }

      setImmediate(update)
    }

    this.lastFrameTime = Date.now()
    setImmediate(update)
  }

  private processComponentUpdates(): void {
    while (this.componentUpdateQueue.length > 0) {
      const update = this.componentUpdateQueue.shift()
      if (update) {
        try {
          update()
        } catch (error) {
          this.emit('error', error)
        }
      }
    }
  }
}