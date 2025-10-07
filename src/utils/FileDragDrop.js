import fs from 'fs'
import path from 'path'
import pkg from 'glob';
const { glob } = pkg;

export class FileDragDrop {
  constructor(client) {
    this.client = client
    this.uploadQueue = []
    this.isProcessing = false
    this.onFileAdded = null
    this.onFileRemoved = null
    this.onUploadStart = null
    this.onUploadComplete = null
    this.onUploadError = null
    this.onProgress = null
  }

  // File discovery methods
  async discoverFiles(pattern, options = {}) {
    const {
      cwd = process.cwd(),
      ignore = ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
      maxFiles = 1000
    } = options

    try {
      const files = await glob(pattern, {
        cwd,
        ignore,
        nodir: true,
        maxFiles
      })

      return files.map(filePath => ({
        path: path.resolve(cwd, filePath),
        name: path.basename(filePath),
        relative: filePath,
        size: this.getFileSize(path.resolve(cwd, filePath)),
        type: this.getMimeType(path.resolve(cwd, filePath)),
        lastModified: this.getFileModified(path.resolve(cwd, filePath))
      }))
    } catch (error) {
      throw new Error(`File discovery failed: ${error.message}`)
    }
  }

  // Drag and drop simulation
  simulateDragDrop(filePaths, options = {}) {
    const {
      concurrent = 3,
      autoUpload = true,
      validateFiles = true,
      deduplicate = true
    } = options

    const files = Array.isArray(filePaths) ? filePaths : [filePaths]
    const validFiles = []

    // Process files
    files.forEach(filePath => {
      if (typeof filePath === 'string') {
        const fileInfo = this.createFileInfo(filePath)
        if (validateFiles && !this.validateFile(fileInfo)) {
          return
        }
        validFiles.push(fileInfo)
      } else if (typeof filePath === 'object' && filePath.path) {
        const fileInfo = { ...filePath }
        if (validateFiles && !this.validateFile(fileInfo)) {
          return
        }
        validFiles.push(fileInfo)
      }
    })

    // Deduplicate if requested
    let filesToProcess = validFiles
    if (deduplicate) {
      filesToProcess = this.deduplicateFiles(validFiles)
    }

    // Add to queue
    filesToProcess.forEach(file => {
      this.uploadQueue.push({
        ...file,
        addedAt: Date.now(),
        status: 'queued',
        progress: 0,
        uploadId: null,
        error: null
      })
    })

    // Trigger callback
    if (this.onFileAdded) {
      filesToProcess.forEach(file => this.onFileAdded(file))
    }

    // Start processing if auto-upload is enabled
    if (autoUpload && !this.isProcessing) {
      this.processUploadQueue(concurrent)
    }

    return filesToProcess
  }

  // Directory upload simulation
  simulateDirectoryDrop(dirPath, options = {}) {
    const {
      recursive = true,
      pattern = '**/*',
      maxDepth = 10,
      ...fileOptions
    } = options

    try {
      if (!fs.existsSync(dirPath)) {
        throw new Error(`Directory does not exist: ${dirPath}`)
      }

      if (!fs.statSync(dirPath).isDirectory()) {
        throw new Error(`Path is not a directory: ${dirPath}`)
      }

      const searchPattern = recursive ? path.join(dirPath, pattern) : path.join(dirPath, '*')
      return this.discoverFiles(searchPattern, {
        cwd: dirPath,
        ...fileOptions
      }).then(files => {
        return this.simulateDragDrop(files, {
          ...fileOptions,
          validateFiles: true,
          deduplicate: true
        })
      })
    } catch (error) {
      throw new Error(`Directory drop simulation failed: ${error.message}`)
    }
  }

  // File type filtering
  filterByType(files, types) {
    const allowedTypes = Array.isArray(types) ? types : [types]
    return files.filter(file => {
      const fileExt = path.extname(file.path).toLowerCase()
      return allowedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExt === type.toLowerCase()
        } else if (type.includes('/')) {
          return file.type === type
        } else {
          return fileExt === `.${type.toLowerCase()}`
        }
      })
    })
  }

  filterBySize(files, maxSize = null, minSize = 0) {
    return files.filter(file => {
      return file.size >= minSize && (!maxSize || file.size <= maxSize)
    })
  }

  filterByPattern(files, pattern, flags = 'i') {
    const regex = new RegExp(pattern, flags)
    return files.filter(file => regex.test(file.name))
  }

  // Upload queue management
  async processUploadQueue(concurrent = 3) {
    if (this.isProcessing) return
    this.isProcessing = true

    while (this.uploadQueue.length > 0) {
      const batch = this.uploadQueue
        .filter(item => item.status === 'queued')
        .slice(0, concurrent)

      if (batch.length === 0) break

      const uploadPromises = batch.map(async (fileItem) => {
        fileItem.status = 'uploading'
        fileItem.uploadId = this.generateUploadId()

        if (this.onUploadStart) {
          this.onUploadStart(fileItem)
        }

        try {
          const result = await this.client.uploadFile(fileItem.path, {
            uploadId: fileItem.uploadId,
            onProgress: (progress) => {
              fileItem.progress = progress
              if (this.onProgress) {
                this.onProgress(fileItem, progress)
              }
            }
          })

          fileItem.status = 'completed'
          fileItem.progress = 100
          fileItem.result = result

          // Remove from queue after successful upload
          const index = this.uploadQueue.indexOf(fileItem)
          if (index > -1) {
            this.uploadQueue.splice(index, 1)
          }

          if (this.onUploadComplete) {
            this.onUploadComplete(fileItem, result)
          }

          return result
        } catch (error) {
          fileItem.status = 'error'
          fileItem.error = error.message

          if (this.onUploadError) {
            this.onUploadError(fileItem, error)
          }

          throw error
        }
      })

      try {
        await Promise.allSettled(uploadPromises)
      } catch (error) {
        console.error('Batch upload error:', error)
      }
    }

    this.isProcessing = false
  }

  // Queue manipulation
  addToQueue(files) {
    return this.simulateDragDrop(files, { autoUpload: false })
  }

  removeFromQueue(uploadId) {
    const index = this.uploadQueue.findIndex(item => item.uploadId === uploadId)
    if (index > -1) {
      const removed = this.uploadQueue.splice(index, 1)[0]
      if (this.onFileRemoved) {
        this.onFileRemoved(removed)
      }
      return removed
    }
    return null
  }

  clearQueue() {
    const cleared = [...this.uploadQueue]
    this.uploadQueue = []
    cleared.forEach(file => {
      if (this.onFileRemoved) {
        this.onFileRemoved(file)
      }
    })
    return cleared
  }

  retryFailedUploads() {
    const failed = this.uploadQueue.filter(item => item.status === 'error')
    failed.forEach(item => {
      item.status = 'queued'
      item.error = null
      item.progress = 0
    })

    if (failed.length > 0 && !this.isProcessing) {
      this.processUploadQueue()
    }

    return failed.length
  }

  // Queue status
  getQueueStatus() {
    const queued = this.uploadQueue.filter(item => item.status === 'queued')
    const uploading = this.uploadQueue.filter(item => item.status === 'uploading')
    const completed = this.uploadQueue.filter(item => item.status === 'completed')
    const error = this.uploadQueue.filter(item => item.status === 'error')

    const totalSize = this.uploadQueue.reduce((sum, item) => sum + (item.size || 0), 0)
    const uploadedSize = completed.reduce((sum, item) => sum + (item.size || 0), 0)

    return {
      total: this.uploadQueue.length,
      queued: queued.length,
      uploading: uploading.length,
      completed: completed.length,
      error: error.length,
      totalSize,
      uploadedSize,
      progress: totalSize > 0 ? (uploadedSize / totalSize) * 100 : 0,
      isProcessing: this.isProcessing
    }
  }

  getQueueItems(filter = null) {
    let items = [...this.uploadQueue]

    if (filter) {
      items = items.filter(item => {
        switch (filter) {
          case 'queued': return item.status === 'queued'
          case 'uploading': return item.status === 'uploading'
          case 'completed': return item.status === 'completed'
          case 'error': return item.status === 'error'
          default: return item.status === filter
        }
      })
    }

    return items
  }

  // Utility methods
  createFileInfo(filePath) {
    const resolvedPath = path.resolve(filePath)
    const stats = fs.statSync(resolvedPath)

    return {
      path: resolvedPath,
      name: path.basename(resolvedPath),
      size: stats.size,
      type: this.getMimeType(resolvedPath),
      lastModified: stats.mtime.getTime(),
      extension: path.extname(resolvedPath).toLowerCase(),
      directory: path.dirname(resolvedPath)
    }
  }

  validateFile(fileInfo) {
    try {
      if (!fs.existsSync(fileInfo.path)) {
        console.warn(`File does not exist: ${fileInfo.path}`)
        return false
      }

      if (!fs.statSync(fileInfo.path).isFile()) {
        console.warn(`Path is not a file: ${fileInfo.path}`)
        return false
      }

      if (fileInfo.size === 0) {
        console.warn(`File is empty: ${fileInfo.path}`)
        return false
      }

      return true
    } catch (error) {
      console.warn(`File validation failed for ${fileInfo.path}: ${error.message}`)
      return false
    }
  }

  deduplicateFiles(files) {
    const seen = new Set()
    const deduplicated = []

    files.forEach(file => {
      const key = `${file.path}:${file.size}:${file.lastModified}`
      if (!seen.has(key)) {
        seen.add(key)
        deduplicated.push(file)
      }
    })

    return deduplicated
  }

  getFileSize(filePath) {
    try {
      return fs.statSync(filePath).size
    } catch (error) {
      return 0
    }
  }

  getFileModified(filePath) {
    try {
      return fs.statSync(filePath).mtime.getTime()
    } catch (error) {
      return 0
    }
  }

  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.glb': 'model/gltf-binary',
      '.gltf': 'model/gltf+json',
      '.obj': 'model/obj',
      '.fbx': 'model/fbx',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.html': 'text/html',
      '.css': 'text/css',
      '.txt': 'text/plain',
      '.md': 'text/markdown'
    }

    return mimeTypes[ext] || 'application/octet-stream'
  }

  generateUploadId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Events
  on(event, callback) {
    switch (event) {
      case 'fileAdded':
        this.onFileAdded = callback
        break
      case 'fileRemoved':
        this.onFileRemoved = callback
        break
      case 'uploadStart':
        this.onUploadStart = callback
        break
      case 'uploadComplete':
        this.onUploadComplete = callback
        break
      case 'uploadError':
        this.onUploadError = callback
        break
      case 'progress':
        this.onProgress = callback
        break
      default:
        throw new Error(`Unknown drag drop event: ${event}`)
    }
  }

  off(event) {
    switch (event) {
      case 'fileAdded':
        this.onFileAdded = null
        break
      case 'fileRemoved':
        this.onFileRemoved = null
        break
      case 'uploadStart':
        this.onUploadStart = null
        break
      case 'uploadComplete':
        this.onUploadComplete = null
        break
      case 'uploadError':
        this.onUploadError = null
        break
      case 'progress':
        this.onProgress = null
        break
      default:
        throw new Error(`Unknown drag drop event: ${event}`)
    }
  }

  // Debug
  toString() {
    const status = this.getQueueStatus()
    return `FileDragDrop(${status.total} files, ${status.uploading} uploading, ${this.formatBytes(status.totalSize)} total)`
  }
}