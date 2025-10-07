import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import pkg from 'crypto';
const { createHash } = pkg;

export class FileUploader {
  constructor(apiUrl, maxUploadSize = 50 * 1024 * 1024) {
    this.apiUrl = apiUrl
    this.maxUploadSize = maxUploadSize
    this.uploads = new Map()
    this.onProgress = null
    this.onComplete = null
    this.onError = null
  }

  // File validation
  validateFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`)
    }

    const stats = fs.statSync(filePath)
    if (stats.size > this.maxUploadSize) {
      throw new Error(`File size (${stats.size} bytes) exceeds maximum allowed size (${this.maxUploadSize} bytes)`)
    }

    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`)
    }

    return stats
  }

  // Hash calculation for deduplication
  calculateFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath)
    return createHash('sha256').update(fileBuffer).digest('hex')
  }

  // Upload check (deduplication)
  async checkUpload(hash) {
    try {
      const response = await fetch(`${this.apiUrl}/api/upload-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ hash })
      })

      if (!response.ok) {
        throw new Error(`Upload check failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      return result.exists || false
    } catch (error) {
      console.error('Upload check failed:', error)
      return false
    }
  }

  // Main upload method
  async upload(filePath, options = {}) {
    const uploadId = options.uploadId || crypto.randomUUID()
    const {
      name = path.basename(filePath),
      type = 'application/octet-stream',
      onProgress = null,
      metadata = {}
    } = options

    try {
      // Validate file
      const stats = this.validateFile(filePath)

      // Calculate hash for deduplication
      const hash = this.calculateFileHash(filePath)

      // Check if file already exists on server
      const exists = await this.checkUpload(hash)
      if (exists) {
        const result = {
          uploadId,
          filePath,
          name,
          size: stats.size,
          hash,
          url: `${this.apiUrl}/uploads/${hash}`,
          deduplicated: true,
          metadata
        }

        this.uploads.set(uploadId, result)
        if (onProgress) onProgress(100)
        if (this.onProgress) this.onProgress(uploadId, 100)
        if (this.onComplete) this.onComplete(uploadId, result)

        return result
      }

      // Create upload record
      const uploadRecord = {
        uploadId,
        filePath,
        name,
        type,
        size: stats.size,
        hash,
        deduplicated: false,
        metadata,
        startTime: Date.now(),
        progress: 0
      }

      this.uploads.set(uploadId, uploadRecord)

      // Perform upload
      const result = await this.performUpload(uploadId, filePath, {
        name,
        type,
        hash,
        onProgress: (progress) => {
          uploadRecord.progress = progress
          if (onProgress) onProgress(progress)
          if (this.onProgress) this.onProgress(uploadId, progress)
        }
      })

      // Update record
      uploadRecord.endTime = Date.now()
      uploadRecord.duration = uploadRecord.endTime - uploadRecord.startTime
      uploadRecord.url = result.url
      Object.assign(uploadRecord, result)

      if (this.onComplete) this.onComplete(uploadId, uploadRecord)

      return uploadRecord

    } catch (error) {
      const errorRecord = {
        uploadId,
        filePath,
        name,
        error: error.message,
        timestamp: Date.now()
      }

      if (this.onError) this.onError(uploadId, error)
      throw error
    }
  }

  // Actual upload implementation
  async performUpload(uploadId, filePath, options) {
    const { name, type, hash, onProgress } = options
    const fileBuffer = fs.readFileSync(filePath)

    // Create FormData for multipart upload
    const formData = new FormData()
    const blob = new Blob([fileBuffer], { type })

    formData.append('file', blob, name)
    formData.append('hash', hash)
    formData.append('name', name)
    formData.append('type', type)

    // Create upload request
    const xhr = new XMLHttpRequest()

    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          if (onProgress) onProgress(progress)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText)
            resolve(result)
          } catch (error) {
            reject(new Error(`Invalid response from server: ${error.message}`))
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'))
      })

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timeout'))
      })

      xhr.open('POST', `${this.apiUrl}/api/upload`)
      xhr.timeout = 5 * 60 * 1000 // 5 minutes
      xhr.send(formData)
    })
  }

  // Batch upload
  async uploadMultiple(filePaths, options = {}) {
    const {
      concurrent = 3,
      onProgress = null,
      onFileComplete = null,
      onFileError = null
    } = options

    const results = []
    const errors = []
    let completed = 0

    // Process files in batches
    for (let i = 0; i < filePaths.length; i += concurrent) {
      const batch = filePaths.slice(i, i + concurrent)
      const batchPromises = batch.map(async (filePath, index) => {
        try {
          const result = await this.upload(filePath, {
            ...options,
            onProgress: options.onFileProgress || null
          })

          completed++
          if (onProgress) onProgress(completed / filePaths.length * 100)
          if (onFileComplete) onFileComplete(result, i + index)

          return result
        } catch (error) {
          completed++
          errors.push({ filePath, error: error.message })
          if (onProgress) onProgress(completed / filePaths.length * 100)
          if (onFileError) onFileError(error, filePath, i + index)
          throw error
        }
      })

      try {
        const batchResults = await Promise.allSettled(batchPromises)
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            results.push(result.value)
          }
        })
      } catch (error) {
        console.error('Batch upload error:', error)
      }
    }

    return {
      results,
      errors,
      total: filePaths.length,
      successful: results.length,
      failed: errors.length
    }
  }

  // Upload management
  getUpload(uploadId) {
    return this.uploads.get(uploadId)
  }

  getAllUploads() {
    return Array.from(this.uploads.values())
  }

  getActiveUploads() {
    return this.getAllUploads().filter(upload => !upload.endTime)
  }

  getCompletedUploads() {
    return this.getAllUploads().filter(upload => upload.endTime)
  }

  // Statistics
  getUploadStats() {
    const uploads = this.getAllUploads()
    const completed = uploads.filter(u => u.endTime)
    const failed = uploads.filter(u => u.error)

    const totalSize = completed.reduce((sum, u) => sum + (u.size || 0), 0)
    const totalTime = completed.reduce((sum, u) => sum + (u.duration || 0), 0)
    const deduplicatedCount = completed.filter(u => u.deduplicated).length

    return {
      total: uploads.length,
      completed: completed.length,
      failed: failed.length,
      active: uploads.length - completed.length - failed.length,
      totalSize,
      totalTime,
      averageTime: completed.length > 0 ? totalTime / completed.length : 0,
      deduplicatedCount,
      deduplicatedSize: deduplicatedCount * (completed.length > 0 ? totalSize / completed.length : 0)
    }
  }

  // Cleanup
  clearUploads(olderThan = null) {
    if (olderThan === null) {
      this.uploads.clear()
      return
    }

    const cutoff = Date.now() - olderThan
    for (const [id, upload] of this.uploads.entries()) {
      if (upload.endTime && upload.endTime < cutoff) {
        this.uploads.delete(id)
      }
    }
  }

  // Events
  on(event, callback) {
    switch (event) {
      case 'progress':
        this.onProgress = callback
        break
      case 'complete':
        this.onComplete = callback
        break
      case 'error':
        this.onError = callback
        break
      default:
        throw new Error(`Unknown uploader event: ${event}`)
    }
  }

  off(event) {
    switch (event) {
      case 'progress':
        this.onProgress = null
        break
      case 'complete':
        this.onComplete = null
        break
      case 'error':
        this.onError = null
        break
      default:
        throw new Error(`Unknown uploader event: ${event}`)
    }
  }

  // Utility methods
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  // Debug
  toString() {
    const stats = this.getUploadStats()
    return `FileUploader(${stats.total} uploads, ${stats.active} active, ${this.formatBytes(stats.totalSize)} total)`
  }
}