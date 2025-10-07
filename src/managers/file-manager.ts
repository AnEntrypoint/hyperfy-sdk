import { EventEmitter } from 'eventemitter3';
import { NodeLogger } from '../utils/logger';
import { HttpClient } from '../network/http-client';
import { ValidationError, FileNotFoundError, AppError } from '../utils/errors';
import { FileUpload } from '../types';
import { formatFileSize, isValidUrl } from '../utils/helpers';
import * as fs from 'fs';
import * as path from 'path';
import * as FormData from 'form-data';
import { Readable } from 'stream';

export interface FileManagerConfig {
  httpClient: HttpClient;
  baseURL?: string;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  uploadTimeout?: number;
}

export interface UploadOptions {
  appId?: string;
  public?: boolean;
  metadata?: Record<string, any>;
  onProgress?: (progress: number) => void;
}

export interface UploadResult {
  file: FileUpload;
  url: string;
  cdnUrl?: string;
}

export interface FileInfo {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  isPublic: boolean;
  appId?: string;
  uploadedAt: Date;
  metadata?: Record<string, any>;
  downloadCount?: number;
}

export class FileManager extends EventEmitter {
  private httpClient: HttpClient;
  private baseURL: string;
  private config: Required<FileManagerConfig>;
  private logger: NodeLogger;

  constructor(config: FileManagerConfig) {
    super();
    this.httpClient = config.httpClient;
    this.baseURL = config.baseURL || '/files';
    this.config = {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'audio/mp3',
        'audio/wav',
        'audio/ogg',
        'video/mp4',
        'video/webm',
        'model/gltf+json',
        'model/gltf-binary',
        'application/json',
        'text/plain',
      ],
      uploadTimeout: 300000, // 5 minutes
      ...config,
    };
    this.logger = new NodeLogger('FileManager');
  }

  async uploadFile(
    filePath: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    if (!filePath) {
      throw new ValidationError('File path is required');
    }

    const stats = await fs.promises.stat(filePath);
    if (!stats.isFile()) {
      throw new ValidationError('Path must be a file');
    }

    if (stats.size > this.config.maxFileSize) {
      throw new ValidationError(`File size exceeds maximum allowed size of ${formatFileSize(this.config.maxFileSize)}`);
    }

    const fileName = path.basename(filePath);
    const fileStream = fs.createReadStream(filePath);

    return this.uploadStream(fileStream, fileName, stats.size, options);
  }

  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    if (!buffer || buffer.length === 0) {
      throw new ValidationError('Buffer cannot be empty');
    }

    if (buffer.length > this.config.maxFileSize) {
      throw new ValidationError(`Buffer size exceeds maximum allowed size of ${formatFileSize(this.config.maxFileSize)}`);
    }

    const stream = Readable.from(buffer);
    return this.uploadStream(stream, fileName, buffer.length, options);
  }

  async uploadStream(
    stream: Readable,
    fileName: string,
    size: number,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    this.validateFileName(fileName);

    const formData = new FormData();
    formData.append('file', stream, {
      filename: fileName,
      contentType: this.getMimeType(fileName),
    });

    if (options.appId) {
      formData.append('appId', options.appId);
    }

    if (options.public !== undefined) {
      formData.append('public', options.public.toString());
    }

    if (options.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    try {
      this.logger.info(`Starting file upload: ${fileName} (${formatFileSize(size)})`);
      this.emit('uploadStarted', { fileName, size });

      const response = await this.httpClient.post<UploadResult>(
        `${this.baseURL}/upload`,
        formData,
        {
          timeout: this.config.uploadTimeout,
          headers: {
            ...formData.getHeaders(),
            'Content-Length': formData.getLengthSync().toString(),
          },
        }
      );

      const result = response.data;
      result.file.uploadedAt = new Date(result.file.uploadedAt);

      this.logger.info(`File uploaded successfully: ${result.file.id}`);
      this.emit('uploadCompleted', result);

      return result;

    } catch (error) {
      this.logger.error(`File upload failed: ${fileName}`, error);
      this.emit('uploadFailed', { fileName, error });
      throw new AppError('File upload failed', error);
    }
  }

  async getFile(fileId: string): Promise<FileInfo> {
    if (!fileId) {
      throw new ValidationError('File ID is required');
    }

    try {
      const response = await this.httpClient.get<FileInfo>(`${this.baseURL}/${fileId}`);
      const fileInfo = response.data;
      fileInfo.uploadedAt = new Date(fileInfo.uploadedAt);
      return fileInfo;

    } catch (error) {
      this.logger.error(`Failed to get file: ${fileId}`, error);
      if (error instanceof AppError && error.details?.status === 404) {
        throw new FileNotFoundError(`File not found: ${fileId}`);
      }
      throw new AppError(`Failed to get file: ${fileId}`, error);
    }
  }

  async downloadFile(fileId: string, destinationPath: string): Promise<string> {
    const fileInfo = await this.getFile(fileId);

    try {
      const response = await this.httpClient.get(`${this.baseURL}/${fileId}/download`, {
        timeout: 0, // No timeout for large downloads
      });

      const buffer = Buffer.from(response.data);
      await fs.promises.writeFile(destinationPath, buffer);

      this.logger.info(`File downloaded: ${fileId} -> ${destinationPath}`);
      this.emit('fileDownloaded', { fileId, destinationPath, size: buffer.length });

      return destinationPath;

    } catch (error) {
      this.logger.error(`Failed to download file: ${fileId}`, error);
      throw new AppError(`Failed to download file: ${fileId}`, error);
    }
  }

  async downloadFileToBuffer(fileId: string): Promise<Buffer> {
    const fileInfo = await this.getFile(fileId);

    try {
      const response = await this.httpClient.get(`${this.baseURL}/${fileId}/download`, {
        timeout: 0, // No timeout for large downloads
      });

      const buffer = Buffer.from(response.data);

      this.logger.info(`File downloaded to buffer: ${fileId} (${buffer.length} bytes)`);
      this.emit('fileDownloaded', { fileId, size: buffer.length });

      return buffer;

    } catch (error) {
      this.logger.error(`Failed to download file to buffer: ${fileId}`, error);
      throw new AppError(`Failed to download file to buffer: ${fileId}`, error);
    }
  }

  async deleteFile(fileId: string): Promise<boolean> {
    if (!fileId) {
      throw new ValidationError('File ID is required');
    }

    try {
      await this.httpClient.delete(`${this.baseURL}/${fileId}`);
      this.logger.info(`File deleted: ${fileId}`);
      this.emit('fileDeleted', fileId);
      return true;

    } catch (error) {
      this.logger.error(`Failed to delete file: ${fileId}`, error);
      throw new AppError(`Failed to delete file: ${fileId}`, error);
    }
  }

  async updateFileMetadata(
    fileId: string,
    metadata: Record<string, any>
  ): Promise<FileInfo> {
    if (!fileId || !metadata) {
      throw new ValidationError('File ID and metadata are required');
    }

    try {
      const response = await this.httpClient.patch<FileInfo>(
        `${this.baseURL}/${fileId}/metadata`,
        { metadata }
      );

      const fileInfo = response.data;
      fileInfo.uploadedAt = new Date(fileInfo.uploadedAt);

      this.logger.info(`File metadata updated: ${fileId}`);
      this.emit('fileMetadataUpdated', { fileId, metadata });

      return fileInfo;

    } catch (error) {
      this.logger.error(`Failed to update file metadata: ${fileId}`, error);
      throw new AppError(`Failed to update file metadata: ${fileId}`, error);
    }
  }

  async listFiles(options: {
    appId?: string;
    public?: boolean;
    mimeType?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'name' | 'size' | 'uploadedAt';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{ files: FileInfo[], total: number, hasMore: boolean }> {
    const queryParams = new URLSearchParams();

    if (options.appId) queryParams.append('appId', options.appId);
    if (options.public !== undefined) queryParams.append('public', options.public.toString());
    if (options.mimeType) queryParams.append('mimeType', options.mimeType);
    if (options.limit) queryParams.append('limit', options.limit.toString());
    if (options.offset) queryParams.append('offset', options.offset.toString());
    if (options.sortBy) queryParams.append('sortBy', options.sortBy);
    if (options.sortOrder) queryParams.append('sortOrder', options.sortOrder);

    const url = queryParams.toString()
      ? `${this.baseURL}?${queryParams.toString()}`
      : this.baseURL;

    try {
      const response = await this.httpClient.get<{ files: FileInfo[], total: number, hasMore: boolean }>(url);

      const files = response.data.files.map(file => ({
        ...file,
        uploadedAt: new Date(file.uploadedAt),
      }));

      return { files, ...response.data };

    } catch (error) {
      this.logger.error('Failed to list files', error);
      throw new AppError('Failed to list files', error);
    }
  }

  async getFilesByApp(appId: string, options: Omit<Parameters<typeof this.listFiles>[0], 'appId'> = {}): Promise<FileInfo[]> {
    return this.listFiles({ ...options, appId }).then(result => result.files);
  }

  async getPublicFiles(options: Omit<Parameters<typeof this.listFiles>[0], 'public'> = {}): Promise<FileInfo[]> {
    return this.listFiles({ ...options, public: true }).then(result => result.files);
  }

  async getUsageStats(appId?: string): Promise<{
    totalFiles: number;
    totalSize: number;
    storageUsed: number;
    storageLimit: number;
    filesByType: Record<string, number>;
  }> {
    const url = appId ? `${this.baseURL}/stats?appId=${appId}` : `${this.baseURL}/stats`;

    try {
      const response = await this.httpClient.get(url);
      return response.data;

    } catch (error) {
      this.logger.error('Failed to get usage stats', error);
      throw new AppError('Failed to get usage stats', error);
    }
  }

  async getFileUrl(fileId: string, expiresIn?: number): Promise<string> {
    const fileInfo = await this.getFile(fileId);

    if (fileInfo.isPublic) {
      return fileInfo.url;
    }

    const queryParams = expiresIn ? `?expiresIn=${expiresIn}` : '';
    const url = `${this.baseURL}/${fileId}/url${queryParams}`;

    try {
      const response = await this.httpClient.get<{ url: string }>(url);
      return response.data.url;

    } catch (error) {
      this.logger.error(`Failed to get file URL: ${fileId}`, error);
      throw new AppError(`Failed to get file URL: ${fileId}`, error);
    }
  }

  private validateFileName(fileName: string): void {
    if (!fileName || fileName.trim().length === 0) {
      throw new ValidationError('File name is required');
    }

    if (fileName.length > 255) {
      throw new ValidationError('File name must be 255 characters or less');
    }

    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(fileName)) {
      throw new ValidationError('File name contains invalid characters');
    }

    const mimeType = this.getMimeType(fileName);
    if (this.config.allowedMimeTypes.length > 0 && !this.config.allowedMimeTypes.includes(mimeType)) {
      throw new ValidationError(`File type not allowed: ${mimeType}`);
    }
  }

  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp3': 'audio/mp3',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.gltf': 'model/gltf+json',
      '.glb': 'model/gltf-binary',
      '.json': 'application/json',
      '.txt': 'text/plain',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }
}