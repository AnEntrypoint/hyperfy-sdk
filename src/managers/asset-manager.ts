import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs-extra'
import path from 'path'
import crypto from 'crypto'
import {
  Asset,
  AssetFile,
  AssetMetadata,
  AssetProcessingJob,
  AssetValidationResult,
  AssetOptimizationSettings,
  AssetAnalytics,
  AssetCacheEntry,
  AssetSecurityScan,
  SupportedAssetFormat,
  AssetType,
  AssetCompressionLevel,
  Vector3,
  Quaternion
} from '../types/index.js'

export interface AssetManagerConfig {
  storagePath: string
  maxFileSize: number
  allowedFormats: SupportedAssetFormat[]
  optimizationSettings: AssetOptimizationSettings
  securitySettings: {
    enableVirusScan: boolean
    enableContentValidation: boolean
    allowedDomains: string[]
    blockedDomains: string[]
  }
  cacheSettings: {
    enabled: boolean
    maxSize: number
    ttl: number
    storagePath: string
  }
  cdnSettings: {
    enabled: boolean
    baseUrl: string
    accessKey?: string
    secretKey?: string
    region?: string
  }
  analyticsSettings: {
    enabled: boolean
    trackDownloads: boolean
    trackUsage: boolean
    trackPerformance: boolean
  }
}

export interface AssetUploadOptions {
  optimize?: boolean
  validate?: boolean
  scanForSecurity?: boolean
  generateThumbnails?: boolean
  metadata?: Partial<AssetMetadata>
  tags?: string[]
  collection?: string
}

export interface AssetProcessOptions {
  format?: string
  quality?: number
  compression?: AssetCompressionLevel
  resolution?: { width: number; height: number }
  maxTextureSize?: number
  generateLODs?: boolean
  optimizeForWeb?: boolean
}

export interface AssetSearchOptions {
  type?: AssetType
  format?: string
  tags?: string[]
  collection?: string
  uploadedBy?: string
  dateRange?: { start: Date; end: Date }
  textSearch?: string
  sortBy?: 'name' | 'date' | 'size' | 'downloads'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export class AssetManager extends EventEmitter {
  public readonly id: string
  public config: AssetManagerConfig

  private assets: Map<string, Asset> = new Map()
  private processingJobs: Map<string, AssetProcessingJob> = new Map()
  private cache: Map<string, AssetCacheEntry> = new Map()
  private analytics: Map<string, AssetAnalytics> = new Map()
  private securityScans: Map<string, AssetSecurityScan> = new Map()

  constructor(config: AssetManagerConfig) {
    super()
    this.id = uuidv4()
    this.config = config

    this.initializeStorage()
    this.initializeCache()
  }

  async uploadAsset(
    file: Buffer | Uint8Array,
    filename: string,
    options: AssetUploadOptions = {}
  ): Promise<Asset> {
    const assetId = uuidv4()
    const fileHash = this.calculateFileHash(file)
    const fileSize = file.length
    const fileExtension = path.extname(filename).toLowerCase()
    const assetType = this.determineAssetType(fileExtension)

    // Validate file
    if (fileSize > this.config.maxFileSize) {
      throw new Error(`File size ${fileSize} exceeds maximum allowed size ${this.config.maxFileSize}`)
    }

    if (!this.isFormatSupported(fileExtension)) {
      throw new Error(`File format ${fileExtension} is not supported`)
    }

    // Check for duplicates
    const existingAsset = this.findAssetByHash(fileHash)
    if (existingAsset) {
      this.emit('assetDuplicate', { existingAsset, filename })
      return existingAsset
    }

    // Create asset record
    const asset: Asset = {
      id: assetId,
      name: path.basename(filename, fileExtension),
      filename,
      type: assetType,
      format: fileExtension.slice(1) as SupportedAssetFormat,
      size: fileSize,
      hash: fileHash,
      url: await this.generateAssetUrl(assetId, fileExtension),
      metadata: {
        uploadedAt: new Date(),
        uploadedBy: options.metadata?.uploadedBy || 'system',
        version: '1.0.0',
        ...options.metadata
      },
      tags: options.tags || [],
      collection: options.collection,
      processing: {
        status: 'uploading',
        progress: 0,
        startedAt: new Date()
      }
    }

    this.assets.set(assetId, asset)

    try {
      // Save file
      await this.saveAssetFile(assetId, file, fileExtension)

      // Process asset
      await this.processAsset(asset, options)

      // Initialize analytics
      if (this.config.analyticsSettings.enabled) {
        this.analytics.set(assetId, {
          assetId,
          downloads: 0,
          views: 0,
          usage: [],
          performance: {
            loadTime: 0,
            renderTime: 0,
            errorCount: 0
          },
          lastAccessed: new Date()
        })
      }

      this.emit('assetUploaded', asset)
      return asset

    } catch (error) {
      this.assets.delete(assetId)
      await this.cleanupAssetFiles(assetId)
      this.emit('assetUploadError', { asset, error })
      throw error
    }
  }

  async processAsset(
    asset: Asset,
    options: AssetUploadOptions = {}
  ): Promise<void> {
    const jobId = uuidv4()
    const job: AssetProcessingJob = {
      id: jobId,
      assetId: asset.id,
      type: 'validation',
      status: 'pending',
      startedAt: new Date(),
      options: {
        format: asset.format,
        quality: 80,
        compression: 'medium',
        optimizeForWeb: true
      }
    }

    this.processingJobs.set(jobId, job)
    this.emit('processingStarted', job)

    try {
      // Validation
      if (options.validate !== false) {
        job.type = 'validation'
        job.status = 'running'
        const validation = await this.validateAsset(asset)

        if (!validation.isValid) {
          throw new Error(`Asset validation failed: ${validation.errors.join(', ')}`)
        }
      }

      // Security scanning
      if (options.scanForSecurity && this.config.securitySettings.enableVirusScan) {
        job.type = 'security'
        job.status = 'running'
        const security = await this.scanAssetForSecurity(asset)

        if (security.threats.length > 0) {
          throw new Error(`Security threats detected: ${security.threats.map(t => t.type).join(', ')}`)
        }
      }

      // Optimization
      if (options.optimize !== false) {
        job.type = 'optimization'
        job.status = 'running'
        await this.optimizeAsset(asset, job.options)
      }

      // Thumbnail generation
      if (options.generateThumbnails) {
        job.type = 'thumbnail'
        job.status = 'running'
        await this.generateThumbnails(asset)
      }

      // Complete processing
      asset.processing = {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        duration: Date.now() - job.startedAt.getTime()
      }

      job.status = 'completed'
      job.completedAt = new Date()

      this.emit('processingCompleted', job)
      this.emit('assetProcessed', asset)

    } catch (error) {
      asset.processing = {
        status: 'failed',
        progress: 0,
        failedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }

      job.status = 'failed'
      job.error = error instanceof Error ? error.message : 'Unknown error'
      job.failedAt = new Date()

      this.emit('processingFailed', job)
      throw error

    } finally {
      this.processingJobs.delete(jobId)
    }
  }

  async getAsset(assetId: string): Promise<Asset | null> {
    const asset = this.assets.get(assetId)

    if (asset && this.config.analyticsSettings.enabled) {
      const analytics = this.analytics.get(assetId)
      if (analytics) {
        analytics.views++
        analytics.lastAccessed = new Date()
      }
    }

    return asset || null
  }

  async downloadAsset(assetId: string, options: { format?: string; quality?: number } = {}): Promise<Buffer> {
    const asset = this.assets.get(assetId)
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`)
    }

    let filePath = this.getAssetFilePath(assetId, asset.format)

    // Handle format conversion if requested
    if (options.format && options.format !== asset.format) {
      filePath = await this.convertAssetFormat(asset, options.format, options.quality)
    }

    const buffer = await fs.readFile(filePath)

    // Update analytics
    if (this.config.analyticsSettings.enabled) {
      const analytics = this.analytics.get(assetId)
      if (analytics) {
        analytics.downloads++
        analytics.lastAccessed = new Date()
      }
    }

    this.emit('assetDownloaded', { asset, options })
    return buffer
  }

  async updateAsset(
    assetId: string,
    updates: Partial<Asset>
  ): Promise<Asset> {
    const asset = this.assets.get(assetId)
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`)
    }

    const updatedAsset = { ...asset, ...updates }
    this.assets.set(assetId, updatedAsset)

    this.emit('assetUpdated', { asset: updatedAsset, previousAsset: asset })
    return updatedAsset
  }

  async deleteAsset(assetId: string): Promise<void> {
    const asset = this.assets.get(assetId)
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`)
    }

    // Remove from storage
    await this.cleanupAssetFiles(assetId)

    // Remove from collections
    this.assets.delete(assetId)
    this.analytics.delete(assetId)
    this.securityScans.delete(assetId)

    // Remove from cache
    this.cache.delete(assetId)
    this.cache.delete(`${assetId}_thumb`)

    this.emit('assetDeleted', asset)
  }

  async searchAssets(options: AssetSearchOptions = {}): Promise<Asset[]> {
    let results = Array.from(this.assets.values())

    // Filter by type
    if (options.type) {
      results = results.filter(asset => asset.type === options.type)
    }

    // Filter by format
    if (options.format) {
      results = results.filter(asset => asset.format === options.format)
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter(asset =>
        options.tags!.some(tag => asset.tags.includes(tag))
      )
    }

    // Filter by collection
    if (options.collection) {
      results = results.filter(asset => asset.collection === options.collection)
    }

    // Filter by uploader
    if (options.uploadedBy) {
      results = results.filter(asset =>
        asset.metadata.uploadedBy === options.uploadedBy
      )
    }

    // Filter by date range
    if (options.dateRange) {
      results = results.filter(asset => {
        const uploadDate = asset.metadata.uploadedAt
        return uploadDate >= options.dateRange!.start && uploadDate <= options.dateRange!.end
      })
    }

    // Text search
    if (options.textSearch) {
      const searchLower = options.textSearch.toLowerCase()
      results = results.filter(asset =>
        asset.name.toLowerCase().includes(searchLower) ||
        asset.description?.toLowerCase().includes(searchLower) ||
        asset.tags.some(tag => tag.toLowerCase().includes(searchLower))
      )
    }

    // Sort results
    if (options.sortBy) {
      results.sort((a, b) => {
        let aValue: any, bValue: any

        switch (options.sortBy) {
          case 'name':
            aValue = a.name.toLowerCase()
            bValue = b.name.toLowerCase()
            break
          case 'date':
            aValue = a.metadata.uploadedAt.getTime()
            bValue = b.metadata.uploadedAt.getTime()
            break
          case 'size':
            aValue = a.size
            bValue = b.size
            break
          case 'downloads':
            const aAnalytics = this.analytics.get(a.id)
            const bAnalytics = this.analytics.get(b.id)
            aValue = aAnalytics?.downloads || 0
            bValue = bAnalytics?.downloads || 0
            break
          default:
            return 0
        }

        if (options.sortOrder === 'desc') {
          return aValue < bValue ? 1 : -1
        }
        return aValue > bValue ? 1 : -1
      })
    }

    // Apply pagination
    if (options.offset) {
      results = results.slice(options.offset)
    }
    if (options.limit) {
      results = results.slice(0, options.limit)
    }

    return results
  }

  async getAssetAnalytics(assetId: string): Promise<AssetAnalytics | null> {
    return this.analytics.get(assetId) || null
  }

  async getAssetSecurityScan(assetId: string): Promise<AssetSecurityScan | null> {
    return this.securityScans.get(assetId) || null
  }

  async regenerateThumbnails(assetId: string): Promise<void> {
    const asset = this.assets.get(assetId)
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`)
    }

    await this.generateThumbnails(asset)
    this.emit('thumbnailsRegenerated', asset)
  }

  async optimizeAsset(asset: Asset, options: AssetProcessOptions): Promise<void> {
    const jobId = uuidv4()

    try {
      // Implementation would depend on asset type
      switch (asset.type) {
        case 'image':
          await this.optimizeImage(asset, options)
          break
        case 'model':
          await this.optimizeModel(asset, options)
          break
        case 'audio':
          await this.optimizeAudio(asset, options)
          break
        case 'video':
          await this.optimizeVideo(asset, options)
          break
      }

      this.emit('assetOptimized', { asset, options })

    } catch (error) {
      this.emit('assetOptimizationError', { asset, options, error })
      throw error
    }
  }

  async exportAsset(assetId: string, format: 'json' | 'gltf' | 'obj' = 'json'): Promise<Buffer> {
    const asset = this.assets.get(assetId)
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`)
    }

    switch (format) {
      case 'json':
        return Buffer.from(JSON.stringify(asset, null, 2))
      case 'gltf':
        if (asset.type !== 'model') {
          throw new Error('GLTF export only supported for model assets')
        }
        return await this.exportGLTF(asset)
      case 'obj':
        if (asset.type !== 'model') {
          throw new Error('OBJ export only supported for model assets')
        }
        return await this.exportOBJ(asset)
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  private async initializeStorage(): Promise<void> {
    await fs.ensureDir(this.config.storagePath)
    await fs.ensureDir(path.join(this.config.storagePath, 'assets'))
    await fs.ensureDir(path.join(this.config.storagePath, 'thumbnails'))
    await fs.ensureDir(path.join(this.config.storagePath, 'processing'))
  }

  private async initializeCache(): Promise<void> {
    if (this.config.cacheSettings.enabled) {
      await fs.ensureDir(this.config.cacheSettings.storagePath)
    }
  }

  private calculateFileHash(buffer: Buffer | Uint8Array): string {
    return crypto.createHash('sha256').update(buffer).digest('hex')
  }

  private determineAssetType(extension: string): AssetType {
    const imageFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tga']
    const modelFormats = ['.gltf', '.glb', '.fbx', '.obj', '.dae', '.3ds']
    const audioFormats = ['.mp3', '.wav', '.ogg', '.aac', '.m4a']
    const videoFormats = ['.mp4', '.webm', '.ogg', '.mov', '.avi']
    const scriptFormats = ['.js', '.ts', '.json', '.html', '.css']

    if (imageFormats.includes(extension)) return 'image'
    if (modelFormats.includes(extension)) return 'model'
    if (audioFormats.includes(extension)) return 'audio'
    if (videoFormats.includes(extension)) return 'video'
    if (scriptFormats.includes(extension)) return 'script'

    return 'other'
  }

  private isFormatSupported(extension: string): boolean {
    return this.config.allowedFormats.includes(extension.slice(1) as SupportedAssetFormat)
  }

  private findAssetByHash(hash: string): Asset | undefined {
    return Array.from(this.assets.values()).find(asset => asset.hash === hash)
  }

  private async generateAssetUrl(assetId: string, extension: string): Promise<string> {
    if (this.config.cdnSettings.enabled) {
      return `${this.config.cdnSettings.baseUrl}/assets/${assetId}${extension}`
    }
    return `file://${this.config.storagePath}/assets/${assetId}${extension}`
  }

  private async saveAssetFile(assetId: string, file: Buffer | Uint8Array, extension: string): Promise<void> {
    const filePath = this.getAssetFilePath(assetId, extension.slice(1))
    await fs.writeFile(filePath, Buffer.from(file))
  }

  private getAssetFilePath(assetId: string, format: string): string {
    return path.join(this.config.storagePath, 'assets', `${assetId}.${format}`)
  }

  private async cleanupAssetFiles(assetId: string): Promise<void> {
    const assetDir = path.join(this.config.storagePath, 'assets')
    const thumbnailDir = path.join(this.config.storagePath, 'thumbnails')

    try {
      const files = await fs.readdir(assetDir)
      for (const file of files) {
        if (file.startsWith(assetId)) {
          await fs.remove(path.join(assetDir, file))
        }
      }

      const thumbFiles = await fs.readdir(thumbnailDir)
      for (const file of thumbFiles) {
        if (file.startsWith(assetId)) {
          await fs.remove(path.join(thumbnailDir, file))
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  private async validateAsset(asset: Asset): Promise<AssetValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      const filePath = this.getAssetFilePath(asset.id, asset.format)
      const fileBuffer = await fs.readFile(filePath)

      // Basic file validation
      if (fileBuffer.length === 0) {
        errors.push('File is empty')
      }

      // Format-specific validation would go here
      // This is a simplified implementation

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      }

    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
        warnings
      }
    }
  }

  private async scanAssetForSecurity(asset: Asset): Promise<AssetSecurityScan> {
    const scan: AssetSecurityScan = {
      assetId: asset.id,
      scannedAt: new Date(),
      threats: [],
      blocked: false
    }

    // Simplified security scanning
    // In a real implementation, this would use actual virus scanning
    // and content validation tools

    this.securityScans.set(asset.id, scan)
    return scan
  }

  private async optimizeAsset(asset: Asset, options: AssetProcessOptions): Promise<void> {
    // Simplified optimization implementation
    // In a real implementation, this would use image/model optimization tools
    console.log(`Optimizing asset ${asset.id} with options:`, options)
  }

  private async generateThumbnails(asset: Asset): Promise<void> {
    // Simplified thumbnail generation
    // In a real implementation, this would use image processing libraries
    console.log(`Generating thumbnails for asset ${asset.id}`)
  }

  private async convertAssetFormat(asset: Asset, targetFormat: string, quality?: number): Promise<string> {
    // Simplified format conversion
    // In a real implementation, this would use format conversion tools
    const outputPath = path.join(
      this.config.storagePath,
      'processing',
      `${asset.id}.${targetFormat}`
    )
    return outputPath
  }

  private async optimizeImage(asset: Asset, options: AssetProcessOptions): Promise<void> {
    // Image-specific optimization
  }

  private async optimizeModel(asset: Asset, options: AssetProcessOptions): Promise<void> {
    // Model-specific optimization
  }

  private async optimizeAudio(asset: Asset, options: AssetProcessOptions): Promise<void> {
    // Audio-specific optimization
  }

  private async optimizeVideo(asset: Asset, options: AssetProcessOptions): Promise<void> {
    // Video-specific optimization
  }

  private async exportGLTF(asset: Asset): Promise<Buffer> {
    // GLTF export implementation
    return Buffer.from('{"asset": {"version": "2.0"}}')
  }

  private async exportOBJ(asset: Asset): Promise<Buffer> {
    // OBJ export implementation
    return Buffer.from('# OBJ export')
  }
}