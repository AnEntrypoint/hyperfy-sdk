import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import {
  AppEntity,
  Blueprint,
  BuilderManager,
  BlueprintManager,
  Vector3,
  Quaternion,
  Entity,
  AssetFile,
  FileUploadOptions,
  AppDevelopmentConfig,
  DevelopmentError,
  AppTemplate,
  ComponentLibrary,
  AnalyticsData,
  RealTimeCollaboration,
  ScriptEditor,
  Debugger,
  TestingFramework,
  DeploymentSystem,
  PerformanceMonitoring,
  HotReloader,
  SecurityPolicy,
  ScriptValidation,
  CollaborationEvent,
  ScriptChange,
  DebugSession,
  TestResult,
  DeploymentConfig,
  PerformanceMetrics,
  SecurityViolation,
  ValidationError
} from '../types/index.js'

export interface DevelopmentManagerConfig {
  enableRealTimeCollaboration: boolean
  enableHotReloading: boolean
  enableScriptValidation: boolean
  enableSecurityPolicies: boolean
  enablePerformanceMonitoring: boolean
  enableDebugger: boolean
  enableTestingFramework: boolean
  enableDeployment: boolean
  maxConcurrentUsers: number
  collaborationSyncInterval: number
  hotReloadDebounceMs: number
  scriptValidationRules: ScriptValidation[]
  securityPolicies: SecurityPolicy[]
  performanceThresholds: PerformanceMetrics
}

export interface DevelopmentSession {
  id: string
  appId: string
  userId: string
  startTime: Date
  endTime?: Date
  isActive: boolean
  collaborators: string[]
  changes: ScriptChange[]
  errors: DevelopmentError[]
  performance: PerformanceMetrics
}

export interface CodeEditorConfig {
  language: 'javascript' | 'typescript'
  theme: 'dark' | 'light'
  fontSize: number
  tabSize: number
  wordWrap: boolean
  minimap: boolean
  autoComplete: boolean
  syntaxHighlighting: boolean
  errorChecking: boolean
  intellisense: boolean
}

export interface CollaborationConfig {
  enableVoiceChat: boolean
  enableTextChat: boolean
  enableScreenSharing: boolean
  enableCursorTracking: boolean
  enableSelectionSharing: boolean
  enableCodeSharing: boolean
  syncChanges: boolean
  conflictResolution: 'merge' | 'override' | 'prompt'
}

export class AppDevelopmentManager extends EventEmitter {
  public readonly id: string
  public config: DevelopmentManagerConfig

  private activeSessions: Map<string, DevelopmentSession> = new Map()
  private scriptEditors: Map<string, ScriptEditor> = new Map()
  private debugSessions: Map<string, DebugSession> = new Map()
  private testResults: Map<string, TestResult[]> = new Map()
  private deploymentConfigs: Map<string, DeploymentConfig> = new Map()
  private performanceData: Map<string, PerformanceMetrics[]> = new Map()
  private securityViolations: Map<string, SecurityViolation[]> = new Map()
  private collaborationEvents: Map<string, CollaborationEvent[]> = new Map()

  private appEntity?: AppEntity
  private builderManager?: BuilderManager
  private blueprintManager?: BlueprintManager
  private hotReloader?: HotReloader
  private debugger?: Debugger
  private testingFramework?: TestingFramework
  private deploymentSystem?: DeploymentSystem
  private performanceMonitor?: PerformanceMonitoring

  private validateScriptCallback?: (script: string, type: string) => Promise<ValidationError[]>
  private executeScriptCallback?: (script: string, context: any) => Promise<any>
  private deployCallback?: (config: DeploymentConfig) => Promise<string>
  private shareCollaborationCallback?: (event: CollaborationEvent) => Promise<void>

  constructor(config: Partial<DevelopmentManagerConfig> = {}) {
    super()

    this.id = uuidv4()
    this.config = {
      enableRealTimeCollaboration: true,
      enableHotReloading: true,
      enableScriptValidation: true,
      enableSecurityPolicies: true,
      enablePerformanceMonitoring: true,
      enableDebugger: true,
      enableTestingFramework: true,
      enableDeployment: true,
      maxConcurrentUsers: 10,
      collaborationSyncInterval: 100,
      hotReloadDebounceMs: 500,
      scriptValidationRules: this.getDefaultScriptValidationRules(),
      securityPolicies: this.getDefaultSecurityPolicies(),
      performanceThresholds: {
        memoryUsage: 512 * 1024 * 1024, // 512MB
        executionTime: 5000, // 5 seconds
        errorRate: 0.05, // 5%
        frameRate: 30,
        networkLatency: 200 // 200ms
      },
      ...config
    }

    this.initializeManagers()
  }

  setAppEntity(appEntity: AppEntity): void {
    this.appEntity = appEntity
    this.emit('appEntitySet', { appEntity })
  }

  setBuilderManager(builderManager: BuilderManager): void {
    this.builderManager = builderManager
    this.emit('builderManagerSet', { builderManager })
  }

  setBlueprintManager(blueprintManager: BlueprintManager): void {
    this.blueprintManager = blueprintManager
    this.emit('blueprintManagerSet', { blueprintManager })
  }

  async startDevelopmentSession(
    appId: string,
    userId: string,
    config: Partial<CollaborationConfig> = {}
  ): Promise<DevelopmentSession> {
    const sessionId = uuidv4()

    const session: DevelopmentSession = {
      id: sessionId,
      appId,
      userId,
      startTime: new Date(),
      isActive: true,
      collaborators: [userId],
      changes: [],
      errors: [],
      performance: {
        memoryUsage: 0,
        executionTime: 0,
        errorRate: 0,
        frameRate: 60,
        networkLatency: 0
      }
    }

    this.activeSessions.set(sessionId, session)

    if (this.config.enableRealTimeCollaboration) {
      await this.setupCollaboration(sessionId, config)
    }

    if (this.config.enableHotReloading) {
      await this.setupHotReloading(sessionId)
    }

    if (this.config.enablePerformanceMonitoring) {
      await this.setupPerformanceMonitoring(sessionId)
    }

    this.emit('developmentSessionStarted', { session })
    return session
  }

  async endDevelopmentSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      throw new Error('Development session not found')
    }

    session.endTime = new Date()
    session.isActive = false

    await this.cleanupCollaboration(sessionId)
    await this.cleanupHotReloading(sessionId)
    await this.cleanupPerformanceMonitoring(sessionId)

    this.activeSessions.delete(sessionId)
    this.emit('developmentSessionEnded', { session })
  }

  async createScriptEditor(
    sessionId: string,
    scriptId: string,
    config: Partial<CodeEditorConfig> = {}
  ): Promise<ScriptEditor> {
    const editorConfig: CodeEditorConfig = {
      language: 'javascript',
      theme: 'dark',
      fontSize: 14,
      tabSize: 2,
      wordWrap: true,
      minimap: true,
      autoComplete: true,
      syntaxHighlighting: true,
      errorChecking: true,
      intellisense: true,
      ...config
    }

    const editor: ScriptEditor = {
      id: scriptId,
      sessionId,
      config: editorConfig,
      content: '',
      cursor: { line: 0, column: 0 },
      selection: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
      diagnostics: [],
      isDirty: false,
      lastSaved: new Date(),
      version: 1
    }

    this.scriptEditors.set(scriptId, editor)
    this.emit('scriptEditorCreated', { editor })

    return editor
  }

  async updateScript(
    scriptId: string,
    content: string,
    cursor?: { line: number; column: number },
    userId?: string
  ): Promise<void> {
    const editor = this.scriptEditors.get(scriptId)
    if (!editor) {
      throw new Error('Script editor not found')
    }

    const change: ScriptChange = {
      id: uuidv4(),
      scriptId,
      userId: userId || 'unknown',
      timestamp: new Date(),
      type: 'update',
      content,
      cursor: cursor || editor.cursor,
      version: editor.version + 1
    }

    editor.content = content
    editor.version = change.version
    editor.isDirty = true
    editor.lastSaved = new Date()

    if (cursor) {
      editor.cursor = cursor
    }

    const session = Array.from(this.activeSessions.values()).find(s => s.id === editor.sessionId)
    if (session) {
      session.changes.push(change)
    }

    if (this.config.enableScriptValidation) {
      await this.validateScript(scriptId, content)
    }

    if (this.config.enableHotReloading) {
      await this.triggerHotReload(scriptId, content)
    }

    await this.broadcastScriptChange(change)
    this.emit('scriptUpdated', { editor, change })
  }

  async validateScript(scriptId: string, content: string): Promise<ValidationError[]> {
    const editor = this.scriptEditors.get(scriptId)
    if (!editor) {
      throw new Error('Script editor not found')
    }

    const errors: ValidationError[] = []

    // Built-in validation rules
    for (const rule of this.config.scriptValidationRules) {
      if (rule.enabled) {
        try {
          const ruleErrors = rule.validator(content)
          errors.push(...ruleErrors)
        } catch (error) {
          errors.push({
            code: 'VALIDATION_ERROR',
            message: `Validation rule '${rule.name}' failed: ${error}`,
            severity: 'error',
            line: 0,
            column: 0,
            endLine: 0,
            endColumn: 0
          })
        }
      }
    }

    // Custom validation callback
    if (this.validateScriptCallback) {
      try {
        const callbackErrors = await this.validateScriptCallback(content, editor.config.language)
        errors.push(...callbackErrors)
      } catch (error) {
        errors.push({
          code: 'VALIDATION_CALLBACK_ERROR',
          message: `Custom validation failed: ${error}`,
          severity: 'error',
          line: 0,
          column: 0,
          endLine: 0,
          endColumn: 0
        })
      }
    }

    editor.diagnostics = errors
    this.emit('scriptValidated', { scriptId, errors })

    return errors
  }

  async executeScript(scriptId: string, context: any = {}): Promise<any> {
    const editor = this.scriptEditors.get(scriptId)
    if (!editor) {
      throw new Error('Script editor not found')
    }

    const startTime = Date.now()

    try {
      let result: any

      if (this.executeScriptCallback) {
        result = await this.executeScriptCallback(editor.content, context)
      } else {
        // Default sandboxed execution
        result = await this.sandboxedExecution(editor.content, context)
      }

      const executionTime = Date.now() - startTime

      if (this.config.enablePerformanceMonitoring) {
        await this.recordPerformanceMetric(scriptId, 'executionTime', executionTime)
      }

      this.emit('scriptExecuted', { scriptId, result, executionTime })
      return result

    } catch (error) {
      const executionTime = Date.now() - startTime
      const devError: DevelopmentError = {
        id: uuidv4(),
        scriptId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date(),
        severity: 'error',
        userId: 'system'
      }

      const session = Array.from(this.activeSessions.values()).find(s =>
        s.changes.some(c => c.scriptId === scriptId)
      )

      if (session) {
        session.errors.push(devError)
      }

      this.emit('scriptExecutionError', { scriptId, error: devError, executionTime })
      throw error
    }
  }

  async startDebugSession(scriptId: string, userId: string): Promise<DebugSession> {
    const debugSession: DebugSession = {
      id: uuidv4(),
      scriptId,
      userId,
      startTime: new Date(),
      isActive: true,
      breakpoints: [],
      callStack: [],
      variables: new Map(),
      watches: []
    }

    this.debugSessions.set(debugSession.id, debugSession)
    this.emit('debugSessionStarted', { debugSession })

    return debugSession
  }

  async addBreakpoint(
    debugSessionId: string,
    scriptId: string,
    line: number,
    column?: number
  ): Promise<void> {
    const debugSession = this.debugSessions.get(debugSessionId)
    if (!debugSession) {
      throw new Error('Debug session not found')
    }

    const breakpoint = {
      id: uuidv4(),
      scriptId,
      line,
      column: column || 0,
      enabled: true,
      condition: undefined,
      hitCount: 0
    }

    debugSession.breakpoints.push(breakpoint)
    this.emit('breakpointAdded', { debugSession, breakpoint })
  }

  async removeBreakpoint(debugSessionId: string, breakpointId: string): Promise<void> {
    const debugSession = this.debugSessions.get(debugSessionId)
    if (!debugSession) {
      throw new Error('Debug session not found')
    }

    debugSession.breakpoints = debugSession.breakpoints.filter(bp => bp.id !== breakpointId)
    this.emit('breakpointRemoved', { debugSession, breakpointId })
  }

  async runTests(sessionId: string): Promise<TestResult[]> {
    if (!this.config.enableTestingFramework) {
      throw new Error('Testing framework is not enabled')
    }

    const testResults: TestResult[] = []
    const startTime = Date.now()

    try {
      // Get all scripts in the session
      const sessionScripts = Array.from(this.scriptEditors.values())
        .filter(editor => editor.sessionId === sessionId)

      for (const editor of sessionScripts) {
        const scriptTestResults = await this.runScriptTests(editor)
        testResults.push(...scriptTestResults)
      }

      const totalExecutionTime = Date.now() - startTime
      this.testResults.set(sessionId, testResults)

      this.emit('testsCompleted', { sessionId, results: testResults, executionTime: totalExecutionTime })
      return testResults

    } catch (error) {
      this.emit('testExecutionError', { sessionId, error })
      throw error
    }
  }

  async deployApp(
    sessionId: string,
    config: Partial<DeploymentConfig> = {}
  ): Promise<string> {
    if (!this.config.enableDeployment) {
      throw new Error('Deployment is not enabled')
    }

    const session = this.activeSessions.get(sessionId)
    if (!session) {
      throw new Error('Development session not found')
    }

    const deploymentConfig: DeploymentConfig = {
      appId: session.appId,
      environment: 'production',
      version: '1.0.0',
      buildOptions: {
        minify: true,
        optimize: true,
        bundle: true
      },
      targetPlatforms: ['web'],
      deploySettings: {
        autoScaling: true,
        cdn: true,
        ssl: true
      },
      ...config
    }

    try {
      let deploymentUrl: string

      if (this.deployCallback) {
        deploymentUrl = await this.deployCallback(deploymentConfig)
      } else {
        deploymentUrl = await this.defaultDeployment(deploymentConfig)
      }

      this.deploymentConfigs.set(sessionId, deploymentConfig)
      this.emit('appDeployed', { sessionId, deploymentUrl, config: deploymentConfig })

      return deploymentUrl

    } catch (error) {
      this.emit('deploymentError', { sessionId, error })
      throw error
    }
  }

  getDevelopmentSession(sessionId: string): DevelopmentSession | undefined {
    return this.activeSessions.get(sessionId)
  }

  getActiveSessions(): DevelopmentSession[] {
    return Array.from(this.activeSessions.values()).filter(s => s.isActive)
  }

  getScriptEditor(scriptId: string): ScriptEditor | undefined {
    return this.scriptEditors.get(scriptId)
  }

  getDebugSession(debugSessionId: string): DebugSession | undefined {
    return this.debugSessions.get(debugSessionId)
  }

  getTestResults(sessionId: string): TestResult[] {
    return this.testResults.get(sessionId) || []
  }

  getPerformanceMetrics(sessionId: string): PerformanceMetrics[] {
    return this.performanceData.get(sessionId) || []
  }

  getSecurityViolations(sessionId: string): SecurityViolation[] {
    return this.securityViolations.get(sessionId) || []
  }

  getCollaborationEvents(sessionId: string): CollaborationEvent[] {
    return this.collaborationEvents.get(sessionId) || []
  }

  setCallbacks(callbacks: {
    validateScript?: (script: string, type: string) => Promise<ValidationError[]>
    executeScript?: (script: string, context: any) => Promise<any>
    deploy?: (config: DeploymentConfig) => Promise<string>
    shareCollaboration?: (event: CollaborationEvent) => Promise<void>
  }): void {
    this.validateScriptCallback = callbacks.validateScript
    this.executeScriptCallback = callbacks.executeScript
    this.deployCallback = callbacks.deploy
    this.shareCollaborationCallback = callbacks.shareCollaboration
  }

  private async setupCollaboration(sessionId: string, config: Partial<CollaborationConfig>): Promise<void> {
    this.emit('collaborationSetup', { sessionId, config })
  }

  private async setupHotReloading(sessionId: string): Promise<void> {
    this.hotReloader = {
      enabled: true,
      debounceMs: this.config.hotReloadDebounceMs,
      lastReload: new Date(),
      pendingReloads: new Set()
    }

    this.emit('hotReloadingSetup', { sessionId })
  }

  private async setupPerformanceMonitoring(sessionId: string): Promise<void> {
    this.performanceData.set(sessionId, [])
    this.emit('performanceMonitoringSetup', { sessionId })
  }

  private async cleanupCollaboration(sessionId: string): Promise<void> {
    this.emit('collaborationCleanup', { sessionId })
  }

  private async cleanupHotReloading(sessionId: string): Promise<void> {
    this.hotReloader = undefined
    this.emit('hotReloadingCleanup', { sessionId })
  }

  private async cleanupPerformanceMonitoring(sessionId: string): Promise<void> {
    this.performanceData.delete(sessionId)
    this.emit('performanceMonitoringCleanup', { sessionId })
  }

  private async triggerHotReload(scriptId: string, content: string): Promise<void> {
    if (!this.hotReloader) return

    this.hotReloader.pendingReloads.add(scriptId)

    setTimeout(async () => {
      if (this.hotReloader && this.hotReloader.pendingReloads.has(scriptId)) {
        this.hotReloader.pendingReloads.delete(scriptId)
        this.hotReloader.lastReload = new Date()

        try {
          await this.executeScript(scriptId)
          this.emit('hotReloadTriggered', { scriptId, content })
        } catch (error) {
          this.emit('hotReloadError', { scriptId, error })
        }
      }
    }, this.hotReloader.debounceMs)
  }

  private async broadcastScriptChange(change: ScriptChange): Promise<void> {
    if (this.shareCollaborationCallback) {
      const event: CollaborationEvent = {
        id: uuidv4(),
        type: 'scriptChange',
        userId: change.userId,
        timestamp: change.timestamp,
        data: change
      }

      try {
        await this.shareCollaborationCallback(event)
      } catch (error) {
        this.emit('collaborationError', { event, error })
      }
    }
  }

  private async recordPerformanceMetric(
    scriptId: string,
    metric: string,
    value: number
  ): Promise<void> {
    const editor = this.scriptEditors.get(scriptId)
    if (!editor) return

    const session = Array.from(this.activeSessions.values()).find(s => s.id === editor.sessionId)
    if (!session) return

    const metrics = this.performanceData.get(session.id) || []
    metrics.push({
      scriptId,
      metric,
      value,
      timestamp: new Date()
    } as any)

    this.performanceData.set(session.id, metrics)
  }

  private async sandboxedExecution(script: string, context: any): Promise<any> {
    // Basic sandboxed execution - in production, use a proper sandbox like vm2
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
    const fn = new AsyncFunction('context', script)
    return await fn(context)
  }

  private async runScriptTests(editor: ScriptEditor): Promise<TestResult[]> {
    const results: TestResult[] = []

    try {
      // Basic test execution - should be expanded with proper testing framework
      const testStartTime = Date.now()

      // Simple validation test
      const validationErrors = await this.validateScript(editor.id, editor.content)

      results.push({
        id: uuidv4(),
        scriptId: editor.id,
        name: 'Validation Test',
        status: validationErrors.length === 0 ? 'passed' : 'failed',
        message: validationErrors.length === 0 ? 'Script passed validation' : `${validationErrors.length} validation errors`,
        executionTime: Date.now() - testStartTime,
        assertions: 1,
        failures: validationErrors.length
      })

    } catch (error) {
      results.push({
        id: uuidv4(),
        scriptId: editor.id,
        name: 'Execution Test',
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
        executionTime: 0,
        assertions: 0,
        failures: 1
      })
    }

    return results
  }

  private async defaultDeployment(config: DeploymentConfig): Promise<string> {
    // Default deployment logic - should be replaced with actual deployment implementation
    return `https://${config.appId}.hyperfy.app`
  }

  private initializeManagers(): void {
    // Initialize any required managers here
  }

  private getDefaultScriptValidationRules(): ScriptValidation[] {
    return [
      {
        name: 'syntax-check',
        description: 'Check JavaScript syntax',
        validator: (content: string) => {
          const errors: ValidationError[] = []
          try {
            new Function(content)
          } catch (error) {
            errors.push({
              code: 'SYNTAX_ERROR',
              message: error instanceof Error ? error.message : 'Syntax error',
              severity: 'error',
              line: 0,
              column: 0,
              endLine: 0,
              endColumn: 0
            })
          }
          return errors
        },
        enabled: true
      },
      {
        name: 'security-check',
        description: 'Check for security issues',
        validator: (content: string) => {
          const errors: ValidationError[] = []
          const securityPatterns = [
            /eval\s*\(/,
            /Function\s*\(/,
            /setTimeout\s*\(/,
            /setInterval\s*\(/,
            /document\./,
            /window\./,
            /require\s*\(/,
            /import\s+.*\s+from/
          ]

          securityPatterns.forEach((pattern, index) => {
            if (pattern.test(content)) {
              errors.push({
                code: 'SECURITY_VIOLATION',
                message: `Potential security issue detected: ${pattern.source}`,
                severity: 'warning',
                line: 0,
                column: 0,
                endLine: 0,
                endColumn: 0
              })
            }
          })

          return errors
        },
        enabled: true
      }
    ]
  }

  private getDefaultSecurityPolicies(): SecurityPolicy[] {
    return [
      {
        name: 'no-eval',
        description: 'Disallow eval() usage',
        pattern: /eval\s*\(/,
        action: 'block',
        severity: 'high'
      },
      {
        name: 'no-dom-access',
        description: 'Disallow direct DOM access',
        pattern: /document\./,
        action: 'warn',
        severity: 'medium'
      },
      {
        name: 'no-network-requests',
        description: 'Disallow unauthorized network requests',
        pattern: /fetch\s*\(|XMLHttpRequest/,
        action: 'block',
        severity: 'high'
      }
    ]
  }
}