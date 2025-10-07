import { EventEmitter } from 'eventemitter3';
import { NodeLogger } from '../utils/logger';
import { ScriptError, ValidationError, SecurityError } from '../utils/errors';
import {
  ScriptContext,
  ScriptExecutionOptions,
  ScriptModule,
  ScriptEvent,
  ScriptPerformance,
  SecurityPolicy,
  SandboxEnvironment,
  ResourceLimits
} from '../types';

export interface ScriptEngineConfig {
  enableSandbox?: boolean;
  enableModules?: boolean;
  enableNetwork?: boolean;
  enableFileSystem?: boolean;
  maxExecutionTime?: number;
  maxMemoryUsage?: number;
  maxModules?: number;
  allowedDomains?: string[];
  allowedModules?: string[];
  securityPolicy?: SecurityPolicy;
  resourceLimits?: ResourceLimits;
  enablePerformanceMonitoring?: boolean;
  enableDebugMode?: boolean;
}

export interface ScriptModule {
  name: string;
  exports: any;
  path?: string;
  version?: string;
  dependencies?: string[];
}

export interface ScriptBundle {
  id: string;
  name: string;
  version: string;
  main: string;
  modules: Record<string, ScriptModule>;
  dependencies: Record<string, string>;
  metadata: Record<string, any>;
}

export interface HotReloadConfig {
  enabled: boolean;
  watchPaths: string[];
  ignorePaths: string[];
  debounceMs: number;
}

export class ScriptEngine extends EventEmitter {
  private config: Required<ScriptEngineConfig>;
  private logger: NodeLogger;
  private scripts: Map<string, any> = new Map();
  private modules: Map<string, ScriptModule> = new Map();
  private bundles: Map<string, ScriptBundle> = new Map();
  private sandboxes: Map<string, SandboxEnvironment> = new Map();
  private performance: Map<string, ScriptPerformance> = new Map();
  private hotReloadConfig: HotReloadConfig;

  constructor(config: ScriptEngineConfig = {}) {
    super();
    this.config = {
      enableSandbox: true,
      enableModules: true,
      enableNetwork: false,
      enableFileSystem: false,
      maxExecutionTime: 5000, // 5 seconds
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB
      maxModules: 100,
      allowedDomains: [],
      allowedModules: ['events', 'util', 'path', 'crypto'],
      securityPolicy: this.createDefaultSecurityPolicy(),
      resourceLimits: {
        maxMemory: 50 * 1024 * 1024,
        maxCpuTime: 5000,
        maxNetworkRequests: 10,
        maxFileSize: 10 * 1024 * 1024,
      },
      enablePerformanceMonitoring: true,
      enableDebugMode: false,
      ...config,
    };

    this.logger = new NodeLogger('ScriptEngine');
    this.hotReloadConfig = {
      enabled: false,
      watchPaths: ['./scripts'],
      ignorePaths: ['node_modules', '.git'],
      debounceMs: 100,
    };

    this.initializeBuiltinModules();
  }

  // Script Compilation and Execution
  async compileScript(scriptCode: string, options: {
    id?: string;
    filename?: string;
    sourceMap?: boolean;
    optimize?: boolean;
  } = {}): Promise<any> {
    const scriptId = options.id || this.generateScriptId();

    try {
      this.logger.debug(`Compiling script: ${scriptId}`);

      // Basic validation
      this.validateScriptCode(scriptCode);

      // Create script function
      const compiledFunction = this.createScriptFunction(scriptCode, options);

      // Store compiled script
      this.scripts.set(scriptId, {
        id: scriptId,
        function: compiledFunction,
        source: scriptCode,
        compiledAt: new Date(),
        filename: options.filename,
      });

      this.logger.debug(`Script compiled successfully: ${scriptId}`);
      this.emit('scriptCompiled', { scriptId, options });

      return { scriptId, function: compiledFunction };

    } catch (error) {
      this.logger.error(`Failed to compile script: ${scriptId}`, error);
      throw new ScriptError('Script compilation failed', error);
    }
  }

  async executeScript(
    scriptId: string,
    context: ScriptContext,
    options: ScriptExecutionOptions = {}
  ): Promise<any> {
    const script = this.scripts.get(scriptId);
    if (!script) {
      throw new ValidationError(`Script not found: ${scriptId}`);
    }

    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    try {
      this.logger.debug(`Executing script: ${scriptId} (execution: ${executionId})`);

      // Create execution environment
      const executionContext = await this.createExecutionContext(context, options);

      // Set up execution timeout
      const timeoutId = options.timeout ?
        setTimeout(() => {
          throw new ScriptError('Script execution timeout');
        }, options.timeout) :
        setTimeout(() => {
          throw new ScriptError('Script execution timeout');
        }, this.config.maxExecutionTime);

      // Monitor memory usage if enabled
      let memoryMonitor: any = null;
      if (this.config.enablePerformanceMonitoring) {
        memoryMonitor = this.startMemoryMonitoring(scriptId);
      }

      // Execute script
      const result = await script.function.call(
        executionContext.global,
        executionContext.world,
        executionContext.app,
        executionContext.props,
        executionContext.require,
        executionContext.console
      );

      // Clear timeout
      clearTimeout(timeoutId);

      // Stop memory monitoring
      if (memoryMonitor) {
        memoryMonitor.stop();
      }

      // Record performance metrics
      const executionTime = Date.now() - startTime;
      if (this.config.enablePerformanceMonitoring) {
        this.recordPerformance(scriptId, {
          executionTime,
          memoryUsage: memoryMonitor?.peakMemory || 0,
          success: true,
        });
      }

      this.logger.debug(`Script executed successfully: ${scriptId} (${executionTime}ms)`);
      this.emit('scriptExecuted', { scriptId, executionId, result, executionTime });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Record error performance
      if (this.config.enablePerformanceMonitoring) {
        this.recordPerformance(scriptId, {
          executionTime,
          memoryUsage: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      this.logger.error(`Script execution failed: ${scriptId}`, error);
      this.emit('scriptError', { scriptId, executionId, error, executionTime });

      throw new ScriptError('Script execution failed', error);
    }
  }

  async executeScriptCode(
    scriptCode: string,
    context: ScriptContext,
    options: ScriptExecutionOptions & { id?: string } = {}
  ): Promise<any> {
    const { id: scriptId, ...executionOptions } = options;

    // Compile and execute in one step
    const { function: compiledFunction } = await this.compileScript(scriptCode, {
      id: scriptId,
      filename: options.filename,
    });

    // Create temporary script entry for execution
    const tempScriptId = scriptId || this.generateScriptId();
    this.scripts.set(tempScriptId, {
      id: tempScriptId,
      function: compiledFunction,
      source: scriptCode,
      compiledAt: new Date(),
      filename: options.filename,
    });

    try {
      return await this.executeScript(tempScriptId, context, executionOptions);
    } finally {
      // Clean up temporary script if it wasn't given an ID
      if (!scriptId) {
        this.scripts.delete(tempScriptId);
      }
    }
  }

  // Module System
  async loadModule(moduleName: string, path?: string): Promise<ScriptModule> {
    if (this.modules.has(moduleName)) {
      return this.modules.get(moduleName)!;
    }

    try {
      this.logger.debug(`Loading module: ${moduleName}`);

      // Check if module is allowed
      if (!this.config.allowedModules.includes(moduleName)) {
        throw new SecurityError(`Module not allowed: ${moduleName}`);
      }

      // Load module (this would typically load from file system or registry)
      const moduleExports = await this.loadModuleImplementation(moduleName, path);

      const module: ScriptModule = {
        name: moduleName,
        exports: moduleExports,
        path,
        version: '1.0.0',
        dependencies: [],
      };

      this.modules.set(moduleName, module);
      this.logger.debug(`Module loaded: ${moduleName}`);
      this.emit('moduleLoaded', module);

      return module;

    } catch (error) {
      this.logger.error(`Failed to load module: ${moduleName}`, error);
      throw new ScriptError(`Failed to load module: ${moduleName}`, error);
    }
  }

  registerModule(module: ScriptModule): void {
    if (this.modules.size >= this.config.maxModules) {
      throw new ValidationError('Maximum number of modules reached');
    }

    this.modules.set(module.name, module);
    this.logger.debug(`Module registered: ${module.name}`);
    this.emit('moduleRegistered', module);
  }

  unregisterModule(moduleName: string): boolean {
    const removed = this.modules.delete(moduleName);
    if (removed) {
      this.logger.debug(`Module unregistered: ${moduleName}`);
      this.emit('moduleUnregistered', moduleName);
    }
    return removed;
  }

  getModule(moduleName: string): ScriptModule | null {
    return this.modules.get(moduleName) || null;
  }

  getModules(): ScriptModule[] {
    return Array.from(this.modules.values());
  }

  // Bundle System
  async createBundle(bundleData: Omit<ScriptBundle, 'id'>): Promise<ScriptBundle> {
    const bundle: ScriptBundle = {
      id: this.generateBundleId(),
      ...bundleData,
    };

    try {
      // Validate bundle
      this.validateBundle(bundle);

      // Store bundle
      this.bundles.set(bundle.id, bundle);

      this.logger.info(`Bundle created: ${bundle.id}`);
      this.emit('bundleCreated', bundle);

      return bundle;

    } catch (error) {
      this.logger.error(`Failed to create bundle: ${bundle.id}`, error);
      throw new ScriptError('Failed to create bundle', error);
    }
  }

  async loadBundle(bundleId: string): Promise<ScriptBundle> {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) {
      throw new ValidationError(`Bundle not found: ${bundleId}`);
    }

    try {
      // Load all modules in bundle
      for (const [moduleName, module] of Object.entries(bundle.modules)) {
        await this.loadModule(module.name, module.path);
      }

      this.logger.info(`Bundle loaded: ${bundleId}`);
      this.emit('bundleLoaded', bundle);

      return bundle;

    } catch (error) {
      this.logger.error(`Failed to load bundle: ${bundleId}`, error);
      throw new ScriptError('Failed to load bundle', error);
    }
  }

  // Hot Reloading
  enableHotReload(config: Partial<HotReloadConfig> = {}): void {
    this.hotReloadConfig = { ...this.hotReloadConfig, ...config };
    this.hotReloadConfig.enabled = true;

    this.logger.info('Hot reload enabled');
    this.emit('hotReloadEnabled', this.hotReloadConfig);

    // Set up file watchers (implementation would depend on environment)
    this.setupFileWatchers();
  }

  disableHotReload(): void {
    this.hotReloadConfig.enabled = false;
    this.cleanupFileWatchers();

    this.logger.info('Hot reload disabled');
    this.emit('hotReloadDisabled');
  }

  async reloadScript(scriptId: string): Promise<void> {
    const script = this.scripts.get(scriptId);
    if (!script) {
      throw new ValidationError(`Script not found: ${scriptId}`);
    }

    try {
      // Clear existing sandbox if any
      const sandbox = this.sandboxes.get(scriptId);
      if (sandbox) {
        await this.destroySandbox(scriptId);
      }

      // Clear performance data
      this.performance.delete(scriptId);

      // Re-compile script
      await this.compileScript(script.source, { id: scriptId, filename: script.filename });

      this.logger.info(`Script reloaded: ${scriptId}`);
      this.emit('scriptReloaded', scriptId);

    } catch (error) {
      this.logger.error(`Failed to reload script: ${scriptId}`, error);
      throw new ScriptError('Failed to reload script', error);
    }
  }

  // Security and Sandboxing
  async createSandbox(scriptId: string, context: ScriptContext): Promise<SandboxEnvironment> {
    if (!this.config.enableSandbox) {
      throw new ValidationError('Sandboxing is not enabled');
    }

    try {
      this.logger.debug(`Creating sandbox for script: ${scriptId}`);

      const sandbox: SandboxEnvironment = {
        id: this.generateSandboxId(),
        scriptId,
        global: this.createSandboxGlobal(context),
        allowedApis: this.getAllowedApis(),
        resourceLimits: this.config.resourceLimits,
        startTime: Date.now(),
        memoryUsage: 0,
        cpuTime: 0,
        networkRequests: 0,
      };

      this.sandboxes.set(scriptId, sandbox);
      this.emit('sandboxCreated', sandbox);

      return sandbox;

    } catch (error) {
      this.logger.error(`Failed to create sandbox: ${scriptId}`, error);
      throw new SecurityError('Failed to create sandbox', error);
    }
  }

  async destroySandbox(scriptId: string): Promise<void> {
    const sandbox = this.sandboxes.get(scriptId);
    if (!sandbox) {
      return;
    }

    try {
      // Clean up sandbox resources
      if (sandbox.global && typeof sandbox.global.cleanup === 'function') {
        sandbox.global.cleanup();
      }

      this.sandboxes.delete(scriptId);
      this.logger.debug(`Sandbox destroyed: ${scriptId}`);
      this.emit('sandboxDestroyed', sandbox);

    } catch (error) {
      this.logger.error(`Failed to destroy sandbox: ${scriptId}`, error);
    }
  }

  getSandbox(scriptId: string): SandboxEnvironment | null {
    return this.sandboxes.get(scriptId) || null;
  }

  // Performance Monitoring
  getPerformance(scriptId: string): ScriptPerformance | null {
    return this.performance.get(scriptId) || null;
  }

  getAllPerformance(): Map<string, ScriptPerformance> {
    return new Map(this.performance);
  }

  clearPerformance(scriptId?: string): void {
    if (scriptId) {
      this.performance.delete(scriptId);
    } else {
      this.performance.clear();
    }
    this.emit('performanceCleared', scriptId);
  }

  // Diagnostics and Debugging
  async validateScript(scriptCode: string, options: {
    syntax?: boolean;
    security?: boolean;
    performance?: boolean;
  } = {}): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    metrics?: any;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Syntax validation
      if (options.syntax !== false) {
        try {
          new Function(scriptCode);
        } catch (error) {
          errors.push(`Syntax error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Security validation
      if (options.security !== false) {
        const securityIssues = this.analyzeSecurity(scriptCode);
        errors.push(...securityIssues);
      }

      // Performance analysis
      let metrics;
      if (options.performance) {
        metrics = this.analyzePerformance(scriptCode);
        if (metrics.complexity > 100) {
          warnings.push('High complexity detected');
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        metrics,
      };

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
      return { valid: false, errors, warnings };
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up ScriptEngine');

    // Destroy all sandboxes
    for (const [scriptId] of this.sandboxes) {
      await this.destroySandbox(scriptId);
    }

    // Clear all caches
    this.scripts.clear();
    this.modules.clear();
    this.bundles.clear();
    this.performance.clear();

    // Clean up file watchers
    this.cleanupFileWatchers();

    this.removeAllListeners();
    this.logger.info('ScriptEngine cleaned up');
  }

  // Private Methods
  private validateScriptCode(scriptCode: string): void {
    if (!scriptCode || scriptCode.trim().length === 0) {
      throw new ValidationError('Script code is required');
    }

    // Basic syntax check
    try {
      new Function(scriptCode);
    } catch (error) {
      throw new ScriptError('Invalid script syntax', error);
    }

    // Security checks
    const securityIssues = this.analyzeSecurity(scriptCode);
    if (securityIssues.length > 0) {
      throw new SecurityError(`Security issues detected: ${securityIssues.join(', ')}`);
    }
  }

  private createScriptFunction(scriptCode: string, options: any): Function {
    // Create a secure script function with limited scope
    const wrappedCode = `
      "use strict";
      return (function(world, app, props, require, console) {
        ${scriptCode}
      });
    `;

    return new Function(wrappedCode)();
  }

  private async createExecutionContext(
    context: ScriptContext,
    options: ScriptExecutionOptions
  ): Promise<any> {
    // Create secure execution context
    const secureRequire = this.createSecureRequire();
    const secureConsole = this.createSecureConsole();

    // Apply sandbox if enabled
    if (this.config.enableSandbox && options.sandbox !== false) {
      const sandbox = await this.createSandbox('temp', context);
      return {
        global: sandbox.global,
        world: this.createSecureWorld(context.world),
        app: this.createSecureApp(context.app),
        props: context.props || {},
        require: secureRequire,
        console: secureConsole,
      };
    }

    return {
      global: {},
      world: this.createSecureWorld(context.world),
      app: this.createSecureApp(context.app),
      props: context.props || {},
      require: secureRequire,
      console: secureConsole,
    };
  }

  private createSecureRequire(): any {
    return (moduleName: string) => {
      const module = this.modules.get(moduleName);
      if (!module) {
        throw new ValidationError(`Module not found: ${moduleName}`);
      }
      return module.exports;
    };
  }

  private createSecureConsole(): any {
    return {
      log: (...args: any[]) => {
        this.logger.info('[Script]', ...args);
        this.emit('consoleLog', { level: 'info', args });
      },
      warn: (...args: any[]) => {
        this.logger.warn('[Script]', ...args);
        this.emit('consoleLog', { level: 'warn', args });
      },
      error: (...args: any[]) => {
        this.logger.error('[Script]', ...args);
        this.emit('consoleLog', { level: 'error', args });
      },
      debug: (...args: any[]) => {
        if (this.config.enableDebugMode) {
          this.logger.debug('[Script]', ...args);
          this.emit('consoleLog', { level: 'debug', args });
        }
      },
    };
  }

  private createSecureWorld(world: any): any {
    // Create a secure proxy for world object
    return {
      id: world.id || 'unknown',
      time: Date.now(),
      emit: (event: string, data: any) => {
        this.emit('worldEvent', { event, data });
      },
      on: (event: string, callback: Function) => {
        this.on(event, callback);
      },
      off: (event: string, callback: Function) => {
        this.off(event, callback);
      },
    };
  }

  private createSecureApp(app: any): any {
    // Create a secure proxy for app object
    return {
      id: app.id || 'unknown',
      position: app.position || [0, 0, 0],
      rotation: app.rotation || [0, 0, 0, 1],
      scale: app.scale || [1, 1, 1],
      state: app.state || {},
      setState: (state: Record<string, any>) => {
        this.emit('appStateChanged', { appId: app.id, state });
      },
      getState: () => app.state || {},
      send: (event: string, data: any) => {
        this.emit('appMessage', { appId: app.id, event, data });
      },
    };
  }

  private createSandboxGlobal(context: ScriptContext): any {
    return {
      // Limited global objects
      Math,
      Date,
      JSON,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      encodeURIComponent,
      decodeURIComponent,
      // Script-specific APIs
      setTimeout: (fn: Function, delay: number) => {
        if (delay < 10) delay = 10; // Minimum delay
        return setTimeout(fn, delay);
      },
      clearTimeout: (id: number) => clearTimeout(id),
      // Prevent access to dangerous globals
      process: undefined,
      global: undefined,
      require: undefined,
      exports: undefined,
      module: undefined,
      __dirname: undefined,
      __filename: undefined,
    };
  }

  private getAllowedApis(): string[] {
    const apis = ['console', 'setTimeout', 'clearTimeout'];
    if (this.config.enableNetwork) apis.push('fetch', 'XMLHttpRequest');
    if (this.config.enableFileSystem) apis.push('fs', 'path');
    return apis;
  }

  private analyzeSecurity(scriptCode: string): string[] {
    const issues: string[] = [];
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(\s*["'].*["']/,
      /setInterval\s*\(/,
      /process\./,
      /require\s*\(\s*["']fs["']/,
      /require\s*\(\s*["']child_process["']/,
      /global\./,
      /window\./,
      /document\./,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(scriptCode)) {
        issues.push(`Dangerous pattern detected: ${pattern.source}`);
      }
    }

    return issues;
  }

  private analyzePerformance(scriptCode: string): any {
    // Simple performance analysis
    const lines = scriptCode.split('\n').length;
    const functions = (scriptCode.match(/function\s+\w+/g) || []).length;
    const loops = (scriptCode.match(/for\s*\(|while\s*\(/g) || []).length;

    return {
      lines,
      functions,
      loops,
      complexity: lines + functions * 2 + loops * 3,
    };
  }

  private recordPerformance(scriptId: string, metrics: Partial<ScriptPerformance>): void {
    const existing = this.performance.get(scriptId) || {
      scriptId,
      executionCount: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      minExecutionTime: Infinity,
      maxExecutionTime: 0,
      totalMemoryUsage: 0,
      averageMemoryUsage: 0,
      errorCount: 0,
      lastExecution: new Date(),
    };

    existing.executionCount++;
    existing.lastExecution = new Date();

    if (metrics.executionTime !== undefined) {
      existing.totalExecutionTime += metrics.executionTime;
      existing.averageExecutionTime = existing.totalExecutionTime / existing.executionCount;
      existing.minExecutionTime = Math.min(existing.minExecutionTime, metrics.executionTime);
      existing.maxExecutionTime = Math.max(existing.maxExecutionTime, metrics.executionTime);
    }

    if (metrics.memoryUsage !== undefined) {
      existing.totalMemoryUsage += metrics.memoryUsage;
      existing.averageMemoryUsage = existing.totalMemoryUsage / existing.executionCount;
    }

    if (!metrics.success) {
      existing.errorCount++;
    }

    this.performance.set(scriptId, existing);
  }

  private startMemoryMonitoring(scriptId: string): any {
    if (typeof process === 'undefined' || !process.memoryUsage) {
      return null;
    }

    let peakMemory = 0;
    const interval = setInterval(() => {
      const usage = process.memoryUsage();
      peakMemory = Math.max(peakMemory, usage.heapUsed);
    }, 100);

    return {
      stop: () => clearInterval(interval),
      peakMemory,
    };
  }

  private validateBundle(bundle: ScriptBundle): void {
    if (!bundle.name || !bundle.version || !bundle.main) {
      throw new ValidationError('Bundle must have name, version, and main module');
    }

    if (Object.keys(bundle.modules).length === 0) {
      throw new ValidationError('Bundle must contain at least one module');
    }

    if (!bundle.modules[bundle.main]) {
      throw new ValidationError('Main module not found in bundle');
    }
  }

  private async loadModuleImplementation(moduleName: string, path?: string): Promise<any> {
    // Built-in modules
    const builtinModules: Record<string, any> = {
      events: { EventEmitter },
      util: { format: (str: string, ...args: any[]) => str.replace(/%s/g, () => String(args.shift())) },
      crypto: {
        randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        })
      },
      path: {
        join: (...paths: string[]) => paths.join('/'),
        dirname: (path: string) => path.split('/').slice(0, -1).join('/'),
        basename: (path: string) => path.split('/').pop() || '',
      },
    };

    if (builtinModules[moduleName]) {
      return builtinModules[moduleName];
    }

    // For custom modules, this would load from file system or registry
    throw new ValidationError(`Module implementation not found: ${moduleName}`);
  }

  private createDefaultSecurityPolicy(): SecurityPolicy {
    return {
      allowEval: false,
      allowFunctionConstructor: false,
      allowTimers: true,
      allowNetworkRequests: this.config.enableNetwork,
      allowFileSystemAccess: this.config.enableFileSystem,
      allowedDomains: this.config.allowedDomains,
      allowedModules: this.config.allowedModules,
      maxExecutionTime: this.config.maxExecutionTime,
      maxMemoryUsage: this.config.maxMemoryUsage,
    };
  }

  private initializeBuiltinModules(): void {
    // Register built-in modules
    this.registerModule({
      name: 'events',
      exports: { EventEmitter },
    });

    this.registerModule({
      name: 'util',
      exports: {
        format: (str: string, ...args: any[]) => str.replace(/%s/g, () => String(args.shift()))
      },
    });

    this.registerModule({
      name: 'crypto',
      exports: {
        randomUUID: () => this.generateScriptId(),
      },
    });

    this.registerModule({
      name: 'path',
      exports: {
        join: (...paths: string[]) => paths.join('/'),
        dirname: (path: string) => path.split('/').slice(0, -1).join('/'),
        basename: (path: string) => path.split('/').pop() || '',
      },
    });
  }

  private setupFileWatchers(): void {
    // Implementation would depend on environment (Node.js fs.watch, browser File System Access API, etc.)
    this.logger.debug('File watchers set up for hot reload');
  }

  private cleanupFileWatchers(): void {
    this.logger.debug('File watchers cleaned up');
  }

  private generateScriptId(): string {
    return `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBundleId(): string {
    return `bundle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSandboxId(): string {
    return `sandbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}