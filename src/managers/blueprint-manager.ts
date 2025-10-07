import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import {
  Blueprint,
  BlueprintVersion,
  BlueprintMetadata,
  BlueprintPermissions,
  BlueprintCollaborator,
  BlueprintComment,
  BlueprintDependency,
  BlueprintTemplate,
  BlueprintAnalytics,
  Vector3,
  Quaternion,
  AppEntity,
  Entity,
  AssetFile,
  FileUploadOptions,
  VersionDiff,
  BlueprintShareOptions,
  MarketplaceListing,
  BlueprintValidationError,
  BlueprintSearchOptions,
  BlueprintImportOptions,
  BlueprintExportOptions
} from '../types/index.js'

export interface BlueprintConfig {
  enableVersioning: boolean
  maxVersions: number
  enableCollaboration: boolean
  enableComments: boolean
  enableAnalytics: boolean
  autoSave: boolean
  autoSaveInterval: number
  validationRules: BlueprintValidationRule[]
  storageProvider: 'local' | 'cloud' | 'hybrid'
  compressionEnabled: boolean
  cacheEnabled: boolean
}

export interface BlueprintValidationRule {
  name: string
  description: string
  validator: (blueprint: Blueprint) => BlueprintValidationError[]
  severity: 'error' | 'warning' | 'info'
  enabled: boolean
}

export class BlueprintManager extends EventEmitter {
  public readonly id: string
  public config: BlueprintConfig

  private blueprints: Map<string, Blueprint> = new Map()
  private versions: Map<string, BlueprintVersion[]> = new Map()
  private collaborators: Map<string, BlueprintCollaborator[]> = new Map()
  private comments: Map<string, BlueprintComment[]> = new Map()
  private analytics: Map<string, BlueprintAnalytics> = new Map()
  private dependencies: Map<string, BlueprintDependency[]> = new Map()
  private templates: Map<string, BlueprintTemplate> = new Map()
  private searchIndex: Map<string, string[]> = new Map()

  private loadCallback?: (id: string) => Promise<Blueprint | null>
  private saveCallback?: (blueprint: Blueprint) => Promise<void>
  private deleteCallback?: (id: string) => Promise<void>
  private assetLoadCallback?: (path: string) => Promise<AssetFile | null>
  private assetSaveCallback?: (asset: AssetFile, path: string) => Promise<string>
  private validateCallback?: (blueprint: Blueprint) => Promise<BlueprintValidationError[]>

  constructor(config: Partial<BlueprintConfig> = {}) {
    super()

    this.id = uuidv4()
    this.config = {
      enableVersioning: true,
      maxVersions: 50,
      enableCollaboration: true,
      enableComments: true,
      enableAnalytics: true,
      autoSave: true,
      autoSaveInterval: 30000,
      validationRules: this.getDefaultValidationRules(),
      storageProvider: 'local',
      compressionEnabled: true,
      cacheEnabled: true,
      ...config
    }

    this.initializeDefaultTemplates()
    this.startAutoSave()
  }

  async createBlueprint(
    name: string,
    metadata: Partial<BlueprintMetadata> = {},
    initialData?: any
  ): Promise<Blueprint> {
    const blueprint: Blueprint = {
      id: uuidv4(),
      name,
      description: metadata.description || '',
      author: metadata.author || 'anonymous',
      version: '1.0.0',
      created: new Date(),
      updated: new Date(),
      tags: metadata.tags || [],
      category: metadata.category || 'general',
      public: metadata.public || false,
      permissions: {
        canView: true,
        canEdit: true,
        canShare: true,
        canDelete: true,
        canComment: true,
        canFork: true,
        ...metadata.permissions
      },
      metadata: {
        thumbnail: metadata.thumbnail,
        screenshots: metadata.screenshots || [],
        documentation: metadata.documentation,
        changelog: [],
        dependencies: metadata.dependencies || [],
        compatibility: metadata.compatibility || {
          engine: '*',
          minVersion: '1.0.0',
          maxVersion: '*'
        },
        performance: metadata.performance || {
          complexity: 'medium',
          memoryUsage: 'medium',
          renderCost: 'medium'
        }
      },
      data: initialData || {
        entities: [],
        components: [],
        scripts: [],
        assets: [],
        settings: {}
      },
      assets: [],
      versions: [],
      analytics: {
        downloads: 0,
        likes: 0,
        views: 0,
        forks: 0,
        comments: 0,
        rating: 0,
        ratingCount: 0,
        usage: []
      },
      collaborators: [],
      comments: [],
      locked: false,
      archived: false,
      featured: false
    }

    if (this.config.enableVersioning) {
      await this.createVersion(blueprint, 'Initial version')
    }

    this.blueprints.set(blueprint.id, blueprint)
    this.updateSearchIndex(blueprint)

    if (this.saveCallback) {
      await this.saveCallback(blueprint)
    }

    this.emit('blueprintCreated', blueprint)
    return blueprint
  }

  async loadBlueprint(id: string): Promise<Blueprint | null> {
    let blueprint = this.blueprints.get(id)

    if (!blueprint && this.loadCallback) {
      blueprint = await this.loadCallback(id)
      if (blueprint) {
        this.blueprints.set(id, blueprint)
        this.updateSearchIndex(blueprint)
      }
    }

    if (blueprint) {
      this.emit('blueprintLoaded', blueprint)
    }

    return blueprint || null
  }

  async saveBlueprint(blueprint: Blueprint, createVersion = false): Promise<void> {
    blueprint.updated = new Date()

    if (createVersion && this.config.enableVersioning) {
      await this.createVersion(blueprint, 'Auto-save')
    }

    const errors = await this.validateBlueprint(blueprint)
    if (errors.some(e => e.severity === 'error')) {
      throw new Error(`Blueprint validation failed: ${errors.map(e => e.message).join(', ')}`)
    }

    this.blueprints.set(blueprint.id, blueprint)
    this.updateSearchIndex(blueprint)

    if (this.saveCallback) {
      await this.saveCallback(blueprint)
    }

    this.emit('blueprintSaved', blueprint)
  }

  async deleteBlueprint(id: string): Promise<void> {
    const blueprint = this.blueprints.get(id)
    if (!blueprint) {
      throw new Error('Blueprint not found')
    }

    this.blueprints.delete(id)
    this.versions.delete(id)
    this.collaborators.delete(id)
    this.comments.delete(id)
    this.analytics.delete(id)
    this.dependencies.delete(id)
    this.searchIndex.delete(id)

    if (this.deleteCallback) {
      await this.deleteCallback(id)
    }

    this.emit('blueprintDeleted', blueprint)
  }

  async duplicateBlueprint(id: string, newName?: string): Promise<Blueprint> {
    const original = await this.loadBlueprint(id)
    if (!original) {
      throw new Error('Blueprint not found')
    }

    const duplicate: Blueprint = {
      ...JSON.parse(JSON.stringify(original)),
      id: uuidv4(),
      name: newName || `${original.name} (Copy)`,
      created: new Date(),
      updated: new Date(),
      author: 'anonymous',
      analytics: {
        downloads: 0,
        likes: 0,
        views: 0,
        forks: 0,
        comments: 0,
        rating: 0,
        ratingCount: 0,
        usage: []
      },
      collaborators: [],
      comments: []
    }

    this.blueprints.set(duplicate.id, duplicate)
    this.updateSearchIndex(duplicate)

    if (this.saveCallback) {
      await this.saveCallback(duplicate)
    }

    this.emit('blueprintDuplicated', { original, duplicate })
    return duplicate
  }

  async createVersion(
    blueprint: Blueprint,
    description: string,
    changes?: VersionDiff
  ): Promise<BlueprintVersion> {
    const version: BlueprintVersion = {
      id: uuidv4(),
      blueprintId: blueprint.id,
      version: this.incrementVersion(blueprint.version),
      description,
      created: new Date(),
      author: 'anonymous',
      changes: changes || this.generateVersionDiff(blueprint),
      data: JSON.parse(JSON.stringify(blueprint.data)),
      metadata: JSON.parse(JSON.stringify(blueprint.metadata)),
      size: this.calculateBlueprintSize(blueprint),
      checksum: this.calculateChecksum(blueprint),
      tags: blueprint.tags,
      public: blueprint.public
    }

    blueprint.version = version.version
    blueprint.versions.push(version.id)

    const versions = this.versions.get(blueprint.id) || []
    versions.push(version)

    if (versions.length > this.config.maxVersions) {
      const removedVersions = versions.splice(0, versions.length - this.config.maxVersions)
      this.emit('versionsPruned', { blueprintId: blueprint.id, removedVersions })
    }

    this.versions.set(blueprint.id, versions)

    if (this.saveCallback) {
      await this.saveCallback(blueprint)
    }

    this.emit('versionCreated', version)
    return version
  }

  async getVersion(blueprintId: string, versionId: string): Promise<BlueprintVersion | null> {
    const versions = this.versions.get(blueprintId)
    if (!versions) return null

    return versions.find(v => v.id === versionId) || null
  }

  async restoreVersion(blueprintId: string, versionId: string): Promise<Blueprint> {
    const blueprint = await this.loadBlueprint(blueprintId)
    if (!blueprint) {
      throw new Error('Blueprint not found')
    }

    const version = await this.getVersion(blueprintId, versionId)
    if (!version) {
      throw new Error('Version not found')
    }

    const previousData = JSON.parse(JSON.stringify(blueprint.data))
    const previousMetadata = JSON.parse(JSON.stringify(blueprint.metadata))

    blueprint.data = JSON.parse(JSON.stringify(version.data))
    blueprint.metadata = JSON.parse(JSON.stringify(version.metadata))
    blueprint.updated = new Date()

    await this.createVersion(blueprint, `Restored from version ${version.version}`, {
      before: { data: previousData, metadata: previousMetadata },
      after: { data: blueprint.data, metadata: blueprint.metadata }
    })

    if (this.saveCallback) {
      await this.saveCallback(blueprint)
    }

    this.emit('versionRestored', { blueprint, version })
    return blueprint
  }

  async searchBlueprints(options: BlueprintSearchOptions): Promise<Blueprint[]> {
    let results: Blueprint[] = Array.from(this.blueprints.values())

    if (options.query) {
      const query = options.query.toLowerCase()
      results = results.filter(bp =>
        bp.name.toLowerCase().includes(query) ||
        bp.description.toLowerCase().includes(query) ||
        bp.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    if (options.tags && options.tags.length > 0) {
      results = results.filter(bp =>
        options.tags!.some(tag => bp.tags.includes(tag))
      )
    }

    if (options.author) {
      results = results.filter(bp => bp.author === options.author)
    }

    if (options.category) {
      results = results.filter(bp => bp.category === options.category)
    }

    if (options.dateRange) {
      results = results.filter(bp =>
        bp.created >= options.dateRange!.start &&
        bp.created <= options.dateRange!.end
      )
    }

    if (options.sortBy) {
      results.sort((a, b) => {
        const aValue = this.getSortValue(a, options.sortBy!)
        const bValue = this.getSortValue(b, options.sortBy!)

        if (options.sortOrder === 'desc') {
          return bValue > aValue ? 1 : -1
        }
        return aValue > bValue ? 1 : -1
      })
    }

    if (options.offset) {
      results = results.slice(options.offset)
    }

    if (options.limit) {
      results = results.slice(0, options.limit)
    }

    return results
  }

  async validateBlueprint(blueprint: Blueprint): Promise<BlueprintValidationError[]> {
    const errors: BlueprintValidationError[] = []

    for (const rule of this.config.validationRules) {
      if (rule.enabled) {
        try {
          const ruleErrors = rule.validator(blueprint)
          errors.push(...ruleErrors)
        } catch (error) {
          errors.push({
            code: 'VALIDATION_ERROR',
            message: `Validation rule '${rule.name}' failed: ${error}`,
            severity: 'error',
            path: '',
            value: rule.name
          })
        }
      }
    }

    if (this.validateCallback) {
      try {
        const callbackErrors = await this.validateCallback(blueprint)
        errors.push(...callbackErrors)
      } catch (error) {
        errors.push({
          code: 'VALIDATION_CALLBACK_ERROR',
          message: `Custom validation failed: ${error}`,
          severity: 'error',
          path: '',
          value: error
        })
      }
    }

    return errors
  }

  async addCollaborator(
    blueprintId: string,
    userId: string,
    role: 'viewer' | 'editor' | 'admin',
    permissions: Partial<BlueprintPermissions> = {}
  ): Promise<BlueprintCollaborator> {
    const blueprint = await this.loadBlueprint(blueprintId)
    if (!blueprint) {
      throw new Error('Blueprint not found')
    }

    const collaborator: BlueprintCollaborator = {
      userId,
      role,
      permissions: {
        canView: true,
        canEdit: role !== 'viewer',
        canShare: role === 'admin',
        canDelete: role === 'admin',
        canComment: true,
        canFork: true,
        ...permissions
      },
      added: new Date(),
      lastActive: new Date(),
      contributions: {
        versions: 0,
        comments: 0,
        edits: 0
      }
    }

    const collaborators = this.collaborators.get(blueprintId) || []
    collaborators.push(collaborator)
    this.collaborators.set(blueprintId, collaborators)

    blueprint.collaborators.push(collaborator)
    await this.saveBlueprint(blueprint)

    this.emit('collaboratorAdded', { blueprint, collaborator })
    return collaborator
  }

  async removeCollaborator(blueprintId: string, userId: string): Promise<void> {
    const blueprint = await this.loadBlueprint(blueprintId)
    if (!blueprint) {
      throw new Error('Blueprint not found')
    }

    const collaborators = this.collaborators.get(blueprintId) || []
    const index = collaborators.findIndex(c => c.userId === userId)

    if (index >= 0) {
      collaborators.splice(index, 1)
      this.collaborators.set(blueprintId, collaborators)

      blueprint.collaborators = collaborators
      await this.saveBlueprint(blueprint)

      this.emit('collaboratorRemoved', { blueprint, userId })
    }
  }

  async addComment(
    blueprintId: string,
    userId: string,
    content: string,
    parentCommentId?: string
  ): Promise<BlueprintComment> {
    const blueprint = await this.loadBlueprint(blueprintId)
    if (!blueprint) {
      throw new Error('Blueprint not found')
    }

    const comment: BlueprintComment = {
      id: uuidv4(),
      userId,
      content,
      created: new Date(),
      updated: new Date(),
      parentCommentId,
      reactions: {},
      resolved: false
    }

    const comments = this.comments.get(blueprintId) || []
    comments.push(comment)
    this.comments.set(blueprintId, comments)

    blueprint.comments.push(comment)
    blueprint.analytics.comments++
    await this.saveBlueprint(blueprint)

    this.emit('commentAdded', { blueprint, comment })
    return comment
  }

  async exportBlueprint(
    blueprintId: string,
    options: BlueprintExportOptions
  ): Promise<Buffer | string> {
    const blueprint = await this.loadBlueprint(blueprintId)
    if (!blueprint) {
      throw new Error('Blueprint not found')
    }

    const exportData = {
      blueprint: options.includeMetadata !== false ? blueprint : {
        id: blueprint.id,
        name: blueprint.name,
        version: blueprint.version,
        data: blueprint.data
      },
      versions: options.includeVersions ? await this.getVersions(blueprintId) : undefined,
      assets: options.includeAssets ? blueprint.assets : undefined,
      exported: new Date(),
      format: options.format
    }

    switch (options.format) {
      case 'json':
        let jsonString = JSON.stringify(exportData, null, options.minify ? 0 : 2)

        if (options.compress) {
          jsonString = await this.compressData(jsonString)
        }

        if (options.encryption?.enabled) {
          jsonString = await this.encryptData(jsonString, options.encryption.key)
        }

        return jsonString

      case 'binary':
        return this.serializeToBinary(exportData, options)

      case 'gltf':
        return this.convertToGLTF(blueprint, options)

      case 'obj':
        return this.convertToOBJ(blueprint, options)

      default:
        throw new Error(`Unsupported export format: ${options.format}`)
    }
  }

  async importBlueprint(
    data: Buffer | string,
    options: BlueprintImportOptions = {}
  ): Promise<Blueprint> {
    let blueprintData: any

    if (typeof data === 'string') {
      try {
        blueprintData = JSON.parse(data)
      } catch (error) {
        throw new Error('Invalid JSON data')
      }
    } else {
      blueprintData = this.deserializeFromBinary(data)
    }

    const blueprint = blueprintData.blueprint || blueprintData

    if (!options.preserveIds) {
      blueprint.id = uuidv4()
      if (blueprint.data.entities) {
        blueprint.data.entities.forEach((entity: any) => {
          entity.id = uuidv4()
        })
      }
    }

    if (options.validateOnly) {
      const errors = await this.validateBlueprint(blueprint)
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`)
      }
      return blueprint
    }

    if (!options.overwriteExisting && this.blueprints.has(blueprint.id)) {
      throw new Error('Blueprint already exists')
    }

    if (options.optimizeAssets) {
      blueprint.assets = await this.optimizeAssets(blueprint.assets || [])
    }

    if (options.importDependencies && blueprint.metadata.dependencies) {
      await this.importDependencies(blueprint.metadata.dependencies)
    }

    this.blueprints.set(blueprint.id, blueprint)
    this.updateSearchIndex(blueprint)

    if (this.saveCallback) {
      await this.saveCallback(blueprint)
    }

    this.emit('blueprintImported', blueprint)
    return blueprint
  }

  setCallbacks(callbacks: {
    load?: (id: string) => Promise<Blueprint | null>
    save?: (blueprint: Blueprint) => Promise<void>
    delete?: (id: string) => Promise<void>
    assetLoad?: (path: string) => Promise<AssetFile | null>
    assetSave?: (asset: AssetFile, path: string) => Promise<string>
    validate?: (blueprint: Blueprint) => Promise<BlueprintValidationError[]>
  }): void {
    this.loadCallback = callbacks.load
    this.saveCallback = callbacks.save
    this.deleteCallback = callbacks.delete
    this.assetLoadCallback = callbacks.assetLoad
    this.assetSaveCallback = callbacks.assetSave
    this.validateCallback = callbacks.validate
  }

  getBlueprint(id: string): Blueprint | null {
    return this.blueprints.get(id) || null
  }

  getBlueprints(): Blueprint[] {
    return Array.from(this.blueprints.values())
  }

  getVersions(blueprintId: string): BlueprintVersion[] {
    return this.versions.get(blueprintId) || []
  }

  getCollaborators(blueprintId: string): BlueprintCollaborator[] {
    return this.collaborators.get(blueprintId) || []
  }

  getComments(blueprintId: string): BlueprintComment[] {
    return this.comments.get(blueprintId) || []
  }

  getAnalytics(blueprintId: string): BlueprintAnalytics | undefined {
    return this.analytics.get(blueprintId)
  }

  getTemplate(id: string): BlueprintTemplate | undefined {
    return this.templates.get(id)
  }

  getTemplates(): BlueprintTemplate[] {
    return Array.from(this.templates.values())
  }

  updateAnalytics(blueprintId: string, event: string, data?: any): void {
    const analytics = this.analytics.get(blueprintId) || {
      downloads: 0,
      likes: 0,
      views: 0,
      forks: 0,
      comments: 0,
      rating: 0,
      ratingCount: 0,
      usage: []
    }

    switch (event) {
      case 'download':
        analytics.downloads++
        break
      case 'view':
        analytics.views++
        break
      case 'like':
        analytics.likes++
        break
      case 'fork':
        analytics.forks++
        break
      case 'comment':
        analytics.comments++
        break
      case 'rating':
        if (data?.rating) {
          analytics.ratingCount++
          analytics.rating = ((analytics.rating * (analytics.ratingCount - 1)) + data.rating) / analytics.ratingCount
        }
        break
      case 'usage':
        analytics.usage.push({
          timestamp: new Date(),
          sessionId: data?.sessionId,
          userId: data?.userId,
          duration: data?.duration,
          interactions: data?.interactions || 0
        })
        break
    }

    this.analytics.set(blueprintId, analytics)
    this.emit('analyticsUpdated', { blueprintId, analytics, event, data })
  }

  private incrementVersion(currentVersion: string): string {
    const parts = currentVersion.split('.').map(Number)
    parts[2]++
    return parts.join('.')
  }

  private generateVersionDiff(blueprint: Blueprint): VersionDiff {
    return {
      before: {},
      after: {
        data: blueprint.data,
        metadata: blueprint.metadata
      },
      summary: 'Auto-generated version'
    }
  }

  private calculateBlueprintSize(blueprint: Blueprint): number {
    return JSON.stringify(blueprint).length
  }

  private calculateChecksum(blueprint: Blueprint): string {
    const data = JSON.stringify(blueprint.data) + JSON.stringify(blueprint.metadata)
    return require('crypto').createHash('md5').update(data).digest('hex')
  }

  private updateSearchIndex(blueprint: Blueprint): void {
    const terms = [
      blueprint.name,
      blueprint.description,
      blueprint.author,
      blueprint.category,
      ...blueprint.tags
    ].join(' ').toLowerCase()

    this.searchIndex.set(blueprint.id, terms.split(' '))
  }

  private getSortValue(blueprint: Blueprint, sortBy: string): any {
    switch (sortBy) {
      case 'name':
        return blueprint.name.toLowerCase()
      case 'created':
        return blueprint.created.getTime()
      case 'updated':
        return blueprint.updated.getTime()
      case 'downloads':
        return blueprint.analytics.downloads
      case 'rating':
        return blueprint.analytics.rating
      default:
        return blueprint.name.toLowerCase()
    }
  }

  private getDefaultValidationRules(): BlueprintValidationRule[] {
    return [
      {
        name: 'required-fields',
        description: 'Check required fields are present',
        validator: (blueprint) => {
          const errors: BlueprintValidationError[] = []
          if (!blueprint.name) {
            errors.push({
              code: 'MISSING_NAME',
              message: 'Blueprint name is required',
              severity: 'error',
              path: 'name',
              value: blueprint.name
            })
          }
          return errors
        },
        severity: 'error',
        enabled: true
      },
      {
        name: 'entity-validation',
        description: 'Validate entity structure',
        validator: (blueprint) => {
          const errors: BlueprintValidationError[] = []
          if (blueprint.data.entities) {
            blueprint.data.entities.forEach((entity: any, index: number) => {
              if (!entity.id) {
                errors.push({
                  code: 'MISSING_ENTITY_ID',
                  message: `Entity at index ${index} missing ID`,
                  severity: 'error',
                  path: `data.entities[${index}]`,
                  value: entity
                })
              }
            })
          }
          return errors
        },
        severity: 'error',
        enabled: true
      }
    ]
  }

  private initializeDefaultTemplates(): void {
    const templates: BlueprintTemplate[] = [
      {
        id: 'empty-room',
        name: 'Empty Room',
        description: 'A basic empty room template',
        category: 'basic',
        thumbnail: '',
        tags: ['basic', 'empty', 'room'],
        data: {
          entities: [
            {
              id: uuidv4(),
              type: 'box',
              size: [10, 0.1, 10],
              position: [0, 0, 0],
              rotation: [0, 0, 0, 1],
              scale: [1, 1, 1],
              color: '#808080',
              physics: 'static'
            }
          ],
          components: [],
          scripts: [],
          assets: [],
          settings: {}
        },
        created: new Date(),
        author: 'system',
        downloads: 0,
        rating: 0
      },
      {
        id: 'basic-gallery',
        name: 'Basic Gallery',
        description: 'A simple art gallery template',
        category: 'gallery',
        thumbnail: '',
        tags: ['gallery', 'art', 'exhibition'],
        data: {
          entities: [
            {
              id: uuidv4(),
              type: 'box',
              size: [20, 0.1, 20],
              position: [0, 0, 0],
              rotation: [0, 0, 0, 1],
              scale: [1, 1, 1],
              color: '#f0f0f0',
              physics: 'static'
            },
            {
              id: uuidv4(),
              type: 'box',
              size: [0.2, 4, 20],
              position: [-10, 2, 0],
              rotation: [0, 0, 0, 1],
              scale: [1, 1, 1],
              color: '#ffffff',
              physics: 'static'
            },
            {
              id: uuidv4(),
              type: 'box',
              size: [0.2, 4, 20],
              position: [10, 2, 0],
              rotation: [0, 0, 0, 1],
              scale: [1, 1, 1],
              color: '#ffffff',
              physics: 'static'
            },
            {
              id: uuidv4(),
              type: 'box',
              size: [20, 4, 0.2],
              position: [0, 2, -10],
              rotation: [0, 0, 0, 1],
              scale: [1, 1, 1],
              color: '#ffffff',
              physics: 'static'
            },
            {
              id: uuidv4(),
              type: 'box',
              size: [20, 4, 0.2],
              position: [0, 2, 10],
              rotation: [0, 0, 0, 1],
              scale: [1, 1, 1],
              color: '#ffffff',
              physics: 'static'
            }
          ],
          components: [],
          scripts: [],
          assets: [],
          settings: {
            lighting: {
              ambient: '#ffffff',
              intensity: 0.8
            }
          }
        },
        created: new Date(),
        author: 'system',
        downloads: 0,
        rating: 0
      }
    ]

    templates.forEach(template => {
      this.templates.set(template.id, template)
    })
  }

  private startAutoSave(): void {
    if (!this.config.autoSave) return

    setInterval(() => {
      this.emit('autoSave')
    }, this.config.autoSaveInterval)
  }

  private async compressData(data: string): Promise<string> {
    const zlib = require('zlib')
    return zlib.deflateSync(data).toString('base64')
  }

  private async encryptData(data: string, key?: string): Promise<string> {
    const crypto = require('crypto')
    const algorithm = 'aes-256-gcm'
    const secretKey = key || 'default-key-change-in-production'
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipher(algorithm, secretKey)

    let encrypted = cipher.update(data, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    return iv.toString('hex') + ':' + encrypted
  }

  private serializeToBinary(data: any, options: BlueprintExportOptions): Buffer {
    const binaryData = JSON.stringify(data)
    return Buffer.from(binaryData, 'utf8')
  }

  private deserializeFromBinary(data: Buffer): any {
    const jsonString = data.toString('utf8')
    return JSON.parse(jsonString)
  }

  private async convertToGLTF(blueprint: Blueprint, options: BlueprintExportOptions): Promise<string> {
    return JSON.stringify({
      asset: { version: '2.0', generator: 'Hyperfy Blueprint Manager' },
      scene: 0,
      scenes: [{ nodes: [] }],
      nodes: [],
      meshes: [],
      materials: [],
      textures: [],
      extensions: {
        HYPERFY: {
          blueprint: blueprint.data
        }
      }
    }, null, options.minify ? 0 : 2)
  }

  private async convertToOBJ(blueprint: Blueprint, options: BlueprintExportOptions): Promise<string> {
    let obj = '# Hyperfy Blueprint Export\n'
    obj += '# Generated: ' + new Date().toISOString() + '\n\n'

    if (blueprint.data.entities) {
      blueprint.data.entities.forEach((entity: any, index: number) => {
        if (entity.type === 'box') {
          const size = entity.size || [1, 1, 1]
          const pos = entity.position || [0, 0, 0]

          obj += `o Box_${index}\n`
          obj += `v ${pos[0] - size[0]/2} ${pos[1] - size[1]/2} ${pos[2] - size[2]/2}\n`
          obj += `v ${pos[0] + size[0]/2} ${pos[1] - size[1]/2} ${pos[2] - size[2]/2}\n`
          obj += `v ${pos[0] + size[0]/2} ${pos[1] + size[1]/2} ${pos[2] - size[2]/2}\n`
          obj += `v ${pos[0] - size[0]/2} ${pos[1] + size[1]/2} ${pos[2] - size[2]/2}\n`
          obj += `v ${pos[0] - size[0]/2} ${pos[1] - size[1]/2} ${pos[2] + size[2]/2}\n`
          obj += `v ${pos[0] + size[0]/2} ${pos[1] - size[1]/2} ${pos[2] + size[2]/2}\n`
          obj += `v ${pos[0] + size[0]/2} ${pos[1] + size[1]/2} ${pos[2] + size[2]/2}\n`
          obj += `v ${pos[0] - size[0]/2} ${pos[1] + size[1]/2} ${pos[2] + size[2]/2}\n`
        }
      })
    }

    return obj
  }

  private async optimizeAssets(assets: AssetFile[]): Promise<AssetFile[]> {
    return assets
  }

  private async importDependencies(dependencies: BlueprintDependency[]): Promise<void> {
    for (const dependency of dependencies) {
      try {
        await this.loadBlueprint(dependency.id)
      } catch (error) {
        console.warn(`Failed to import dependency ${dependency.id}:`, error)
      }
    }
  }
}