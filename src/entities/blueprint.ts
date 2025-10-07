import { EventEmitter } from 'eventemitter3';
import { NodeLogger } from '../utils/logger';
import { ValidationError, BlueprintError } from '../utils/errors';
import { generateId } from '../utils/helpers';
import {
  Blueprint,
  BlueprintVersion,
  BlueprintAsset,
  BlueprintMetadata,
  BlueprintCollaborator,
  BlueprintComment,
  BlueprintTag,
  BlueprintTemplate,
  CollaboratorRole,
  AssetType
} from '../types';

export interface BlueprintConfig {
  id?: string;
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
  maxInstances?: number;
}

export interface BlueprintCreateOptions {
  validateAssets?: boolean;
  optimizeAssets?: boolean;
  generateThumbnail?: boolean;
  autoVersion?: boolean;
}

export interface BlueprintUpdateOptions {
  createVersion?: boolean;
  versionMessage?: string;
  notifyCollaborators?: boolean;
  validateChanges?: boolean;
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

export class BlueprintEntity extends EventEmitter {
  public readonly id: string;
  public readonly createdAt: Date;
  public updatedAt: Date;

  private logger: NodeLogger;
  private versions: Map<number, BlueprintVersion> = new Map();
  private currentVersion: number = 1;
  private collaborators: Map<string, BlueprintCollaborator> = new Map();
  private comments: BlueprintComment[] = [];
  private assets: Map<string, BlueprintAsset> = new Map();
  private tags: Set<string> = new Set();
  private metadata: BlueprintMetadata;

  constructor(
    private config: BlueprintConfig,
    private options: BlueprintCreateOptions = {}
  ) {
    super();
    this.id = config.id || generateId();
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.logger = new NodeLogger(`Blueprint:${this.id}`);

    this.initializeBlueprint();
  }

  // Initialization
  private initializeBlueprint(): void {
    this.logger.info(`Initializing blueprint: ${this.config.name}`);

    // Set up metadata
    this.metadata = {
      downloads: 0,
      rating: 0,
      ratingCount: 0,
      views: 0,
      shares: 0,
      fileSize: 0,
      lastAccessed: new Date(),
      featured: false,
      verified: false,
    };

    // Add initial version
    this.createInitialVersion();

    // Set up tags
    if (this.config.tags) {
      this.config.tags.forEach(tag => this.tags.add(tag));
    }

    // Add author as owner collaborator
    this.addCollaborator(this.config.author, CollaboratorRole.OWNER);

    // Validate if required
    if (this.options.validateAssets) {
      this.validateAssets();
    }

    this.logger.info(`Blueprint initialized: ${this.id} v${this.currentVersion}`);
    this.emit('initialized', this);
  }

  private createInitialVersion(): void {
    const version: BlueprintVersion = {
      number: 1,
      createdAt: new Date(),
      message: 'Initial version',
      author: this.config.author,
      changes: this.getVersionChanges(),
      assets: this.getAssetReferences(),
      checksum: this.calculateChecksum(),
    };

    this.versions.set(1, version);
  }

  // Version Management
  async createVersion(
    message: string = '',
    author?: string,
    changes?: Record<string, any>
  ): Promise<BlueprintVersion> {
    const versionNumber = this.currentVersion + 1;
    const versionAuthor = author || this.config.author;

    const version: BlueprintVersion = {
      number: versionNumber,
      createdAt: new Date(),
      message,
      author: versionAuthor,
      changes: changes || this.getVersionChanges(),
      assets: this.getAssetReferences(),
      checksum: this.calculateChecksum(),
      parentVersion: this.currentVersion,
    };

    this.versions.set(versionNumber, version);
    this.currentVersion = versionNumber;
    this.updatedAt = new Date();

    this.logger.info(`Created version ${versionNumber}: ${message}`);
    this.emit('versionCreated', version);

    return version;
  }

  getVersion(versionNumber?: number): BlueprintVersion | null {
    return this.versions.get(versionNumber || this.currentVersion) || null;
  }

  getAllVersions(): BlueprintVersion[] {
    return Array.from(this.versions.values()).sort((a, b) => b.number - a.number);
  }

  async rollbackToVersion(versionNumber: number): Promise<boolean> {
    const version = this.versions.get(versionNumber);
    if (!version) {
      throw new ValidationError(`Version ${versionNumber} not found`);
    }

    try {
      // Create a rollback version
      await this.createVersion(
        `Rollback to version ${versionNumber}`,
        this.config.author,
        { rollbackFrom: this.currentVersion, rollbackTo: versionNumber }
      );

      // Restore version state
      this.restoreVersionState(version);

      this.logger.info(`Rolled back to version ${versionNumber}`);
      this.emit('rollback', { fromVersion: this.currentVersion, toVersion: versionNumber });

      return true;

    } catch (error) {
      this.logger.error(`Failed to rollback to version ${versionNumber}`, error);
      throw new BlueprintError('Failed to rollback blueprint', error);
    }
  }

  // Update Operations
  async update(updateConfig: Partial<BlueprintConfig>, options: BlueprintUpdateOptions = {}): Promise<void> {
    // Validate changes if required
    if (options.validateChanges) {
      await this.validateChanges(updateConfig);
    }

    const previousState = this.getBlueprintData();

    // Apply updates
    if (updateConfig.name !== undefined) this.config.name = updateConfig.name;
    if (updateConfig.description !== undefined) this.config.description = updateConfig.description;
    if (updateConfig.model !== undefined) this.config.model = updateConfig.model;
    if (updateConfig.script !== undefined) this.config.script = updateConfig.script;
    if (updateConfig.props !== undefined) this.config.props = updateConfig.props;
    if (updateConfig.thumbnail !== undefined) this.config.thumbnail = updateConfig.thumbnail;
    if (updateConfig.public !== undefined) this.config.public = updateConfig.public;
    if (updateConfig.locked !== undefined) this.config.locked = updateConfig.locked;
    if (updateConfig.frozen !== undefined) this.config.frozen = updateConfig.frozen;
    if (updateConfig.unique !== undefined) this.config.unique = updateConfig.unique;
    if (updateConfig.scene !== undefined) this.config.scene = updateConfig.scene;
    if (updateConfig.disabled !== undefined) this.config.disabled = updateConfig.disabled;
    if (updateConfig.category !== undefined) this.config.category = updateConfig.category;
    if (updateConfig.license !== undefined) this.config.license = updateConfig.license;
    if (updateConfig.dependencies !== undefined) this.config.dependencies = updateConfig.dependencies;
    if (updateConfig.maxInstances !== undefined) this.config.maxInstances = updateConfig.maxInstances;

    // Update tags
    if (updateConfig.tags) {
      this.tags.clear();
      updateConfig.tags.forEach(tag => this.tags.add(tag));
    }

    this.updatedAt = new Date();

    // Create new version if required
    if (options.createVersion) {
      await this.createVersion(
        options.versionMessage || 'Updated blueprint',
        this.config.author,
        { previousState, changes: updateConfig }
      );
    }

    this.logger.info('Blueprint updated');
    this.emit('updated', { previousState, currentState: this.getBlueprintData() });
  }

  // Asset Management
  addAsset(asset: Omit<BlueprintAsset, 'id'>): BlueprintAsset {
    const assetWithId: BlueprintAsset = {
      id: generateId(),
      ...asset,
      addedAt: new Date(),
    };

    this.assets.set(assetWithId.id, assetWithId);
    this.updateMetadata();

    this.logger.debug(`Asset added: ${assetWithId.type} - ${assetWithId.url}`);
    this.emit('assetAdded', assetWithId);

    return assetWithId;
  }

  removeAsset(assetId: string): boolean {
    const asset = this.assets.get(assetId);
    if (!asset) {
      return false;
    }

    this.assets.delete(assetId);
    this.updateMetadata();

    this.logger.debug(`Asset removed: ${assetId}`);
    this.emit('assetRemoved', assetId);

    return true;
  }

  getAsset(assetId: string): BlueprintAsset | null {
    return this.assets.get(assetId) || null;
  }

  getAllAssets(): BlueprintAsset[] {
    return Array.from(this.assets.values());
  }

  getAssetsByType(type: AssetType): BlueprintAsset[] {
    return Array.from(this.assets.values()).filter(asset => asset.type === type);
  }

  async validateAssets(): Promise<void> {
    this.logger.debug('Validating assets');

    for (const asset of this.assets.values()) {
      try {
        await this.validateAsset(asset);
      } catch (error) {
        this.logger.error(`Asset validation failed: ${asset.id}`, error);
        throw new BlueprintError(`Asset validation failed: ${asset.id}`, error);
      }
    }

    this.logger.debug('All assets validated successfully');
    this.emit('assetsValidated');
  }

  private async validateAsset(asset: BlueprintAsset): Promise<void> {
    // Implement asset validation logic
    if (!asset.url) {
      throw new ValidationError('Asset URL is required');
    }

    if (!asset.type) {
      throw new ValidationError('Asset type is required');
    }

    // Additional validation based on asset type
    switch (asset.type) {
      case 'model':
        await this.validateModelAsset(asset);
        break;
      case 'texture':
        await this.validateTextureAsset(asset);
        break;
      case 'audio':
        await this.validateAudioAsset(asset);
        break;
      case 'script':
        await this.validateScriptAsset(asset);
        break;
    }
  }

  private async validateModelAsset(asset: BlueprintAsset): Promise<void> {
    // Validate model file format, size, etc.
    const supportedFormats = ['.glb', '.gltf', '.fbx', '.obj'];
    const fileExtension = asset.url.split('.').pop()?.toLowerCase();

    if (!fileExtension || !supportedFormats.includes(`.${fileExtension}`)) {
      throw new ValidationError(`Unsupported model format: ${fileExtension}`);
    }

    // Additional model validation would go here
  }

  private async validateTextureAsset(asset: BlueprintAsset): Promise<void> {
    // Validate texture file format, size, dimensions
    const supportedFormats = ['.jpg', '.jpeg', '.png', '.webp'];
    const fileExtension = asset.url.split('.').pop()?.toLowerCase();

    if (!fileExtension || !supportedFormats.includes(`.${fileExtension}`)) {
      throw new ValidationError(`Unsupported texture format: ${fileExtension}`);
    }
  }

  private async validateAudioAsset(asset: BlueprintAsset): Promise<void> {
    // Validate audio file format, duration, etc.
    const supportedFormats = ['.mp3', '.wav', '.ogg'];
    const fileExtension = asset.url.split('.').pop()?.toLowerCase();

    if (!fileExtension || !supportedFormats.includes(`.${fileExtension}`)) {
      throw new ValidationError(`Unsupported audio format: ${fileExtension}`);
    }
  }

  private async validateScriptAsset(asset: BlueprintAsset): Promise<void> {
    // Validate script syntax, security, etc.
    if (!asset.url.endsWith('.js')) {
      throw new ValidationError('Script assets must be JavaScript files');
    }

    // Additional script validation would go here
  }

  // Collaboration
  addCollaborator(userId: string, role: CollaboratorRole, invitedBy?: string): BlueprintCollaborator {
    if (this.collaborators.has(userId)) {
      throw new ValidationError(`User ${userId} is already a collaborator`);
    }

    const collaborator: BlueprintCollaborator = {
      userId,
      role,
      addedAt: new Date(),
      invitedBy: invitedBy || this.config.author,
      permissions: this.getRolePermissions(role),
    };

    this.collaborators.set(userId, collaborator);

    this.logger.info(`Collaborator added: ${userId} (${role})`);
    this.emit('collaboratorAdded', collaborator);

    return collaborator;
  }

  removeCollaborator(userId: string): boolean {
    const collaborator = this.collaborators.get(userId);
    if (!collaborator) {
      return false;
    }

    // Cannot remove the owner
    if (collaborator.role === CollaboratorRole.OWNER) {
      throw new ValidationError('Cannot remove the blueprint owner');
    }

    this.collaborators.delete(userId);

    this.logger.info(`Collaborator removed: ${userId}`);
    this.emit('collaboratorRemoved', userId);

    return true;
  }

  updateCollaboratorRole(userId: string, newRole: CollaboratorRole): boolean {
    const collaborator = this.collaborators.get(userId);
    if (!collaborator) {
      return false;
    }

    // Cannot change owner role
    if (collaborator.role === CollaboratorRole.OWNER || newRole === CollaboratorRole.OWNER) {
      throw new ValidationError('Cannot modify owner role');
    }

    collaborator.role = newRole;
    collaborator.permissions = this.getRolePermissions(newRole);
    collaborator.updatedAt = new Date();

    this.logger.info(`Collaborator role updated: ${userId} -> ${newRole}`);
    this.emit('collaboratorUpdated', collaborator);

    return true;
  }

  getCollaborator(userId: string): BlueprintCollaborator | null {
    return this.collaborators.get(userId) || null;
  }

  getAllCollaborators(): BlueprintCollaborator[] {
    return Array.from(this.collaborators.values());
  }

  hasPermission(userId: string, permission: string): boolean {
    const collaborator = this.collaborators.get(userId);
    if (!collaborator) {
      return false;
    }

    return collaborator.permissions.includes(permission);
  }

  // Comments
  addComment(
    userId: string,
    content: string,
    parentId?: string,
    versionNumber?: number
  ): BlueprintComment {
    const comment: BlueprintComment = {
      id: generateId(),
      userId,
      content,
      createdAt: new Date(),
      parentId,
      versionNumber,
      resolved: false,
    };

    if (parentId) {
      const parentComment = this.comments.find(c => c.id === parentId);
      if (!parentComment) {
        throw new ValidationError('Parent comment not found');
      }
      parentComment.replies = parentComment.replies || [];
      parentComment.replies.push(comment);
    } else {
      this.comments.push(comment);
    }

    this.logger.debug(`Comment added: ${comment.id} by ${userId}`);
    this.emit('commentAdded', comment);

    return comment;
  }

  resolveComment(commentId: string, userId: string): boolean {
    const comment = this.findComment(commentId);
    if (!comment) {
      return false;
    }

    comment.resolved = true;
    comment.resolvedBy = userId;
    comment.resolvedAt = new Date();

    this.logger.debug(`Comment resolved: ${commentId} by ${userId}`);
    this.emit('commentResolved', comment);

    return true;
  }

  private findComment(commentId: string): BlueprintComment | null {
    // Search top-level comments
    const topLevelComment = this.comments.find(c => c.id === commentId);
    if (topLevelComment) {
      return topLevelComment;
    }

    // Search replies
    for (const comment of this.comments) {
      if (comment.replies) {
        const reply = comment.replies.find(r => r.id === commentId);
        if (reply) {
          return reply;
        }
      }
    }

    return null;
  }

  getAllComments(): BlueprintComment[] {
    return [...this.comments];
  }

  getUnresolvedComments(): BlueprintComment[] {
    const unresolved: BlueprintComment[] = [];

    for (const comment of this.comments) {
      if (!comment.resolved) {
        unresolved.push(comment);
      }
      if (comment.replies) {
        unresolved.push(...comment.replies.filter(r => !r.resolved));
      }
    }

    return unresolved;
  }

  // Tags
  addTag(tag: string): boolean {
    if (this.tags.has(tag)) {
      return false;
    }

    this.tags.add(tag);
    this.emit('tagAdded', tag);
    return true;
  }

  removeTag(tag: string): boolean {
    const removed = this.tags.delete(tag);
    if (removed) {
      this.emit('tagRemoved', tag);
    }
    return removed;
  }

  getAllTags(): string[] {
    return Array.from(this.tags);
  }

  // Metadata
  private updateMetadata(): void {
    this.metadata.fileSize = this.calculateFileSize();
    this.metadata.lastAccessed = new Date();
  }

  incrementViews(): void {
    this.metadata.views++;
    this.metadata.lastAccessed = new Date();
    this.emit('viewed');
  }

  incrementDownloads(): void {
    this.metadata.downloads++;
    this.metadata.lastAccessed = new Date();
    this.emit('downloaded');
  }

  updateRating(newRating: number): void {
    const totalRating = this.metadata.rating * this.metadata.ratingCount + newRating;
    this.metadata.ratingCount++;
    this.metadata.rating = totalRating / this.metadata.ratingCount;

    this.emit('ratingUpdated', this.metadata.rating);
  }

  // Templates
  async createTemplate(name: string, description: string, author: string): Promise<BlueprintTemplate> {
    const template: BlueprintTemplate = {
      id: generateId(),
      name,
      description,
      author,
      blueprintId: this.id,
      blueprintVersion: this.currentVersion,
      createdAt: new Date(),
      category: this.config.category,
      tags: this.getAllTags(),
      thumbnail: this.config.thumbnail,
      downloads: 0,
      rating: 0,
      ratingCount: 0,
    };

    this.logger.info(`Template created: ${template.id}`);
    this.emit('templateCreated', template);

    return template;
  }

  // Import/Export
  export(): any {
    return {
      blueprint: this.getBlueprintData(),
      versions: this.getAllVersions(),
      collaborators: this.getAllCollaborators(),
      comments: this.getAllComments(),
      assets: this.getAllAssets(),
      metadata: this.metadata,
    };
  }

  static async import(data: any): Promise<BlueprintEntity> {
    try {
      const blueprint = new BlueprintEntity(data.blueprint);

      // Import versions
      for (const version of data.versions || []) {
        blueprint.versions.set(version.number, version);
      }

      // Import collaborators
      for (const collaborator of data.collaborators || []) {
        blueprint.collaborators.set(collaborator.userId, collaborator);
      }

      // Import comments
      blueprint.comments = data.comments || [];

      // Import assets
      for (const asset of data.assets || []) {
        blueprint.assets.set(asset.id, asset);
      }

      // Import metadata
      blueprint.metadata = data.metadata || blueprint.metadata;

      return blueprint;
    } catch (error) {
      throw new BlueprintError('Failed to import blueprint', error);
    }
  }

  // Search
  static async search(options: BlueprintSearchOptions): Promise<BlueprintEntity[]> {
    // This would typically query a database or search service
    // For now, return empty array
    return [];
  }

  // Getters
  getBlueprintData(): Blueprint {
    return {
      id: this.id,
      name: this.config.name,
      description: this.config.description,
      author: this.config.author,
      model: this.config.model,
      script: this.config.script,
      props: this.config.props || {},
      thumbnail: this.config.thumbnail,
      tags: this.getAllTags(),
      public: this.config.public || false,
      locked: this.config.locked || false,
      frozen: this.config.frozen || false,
      unique: this.config.unique || false,
      scene: this.config.scene || false,
      disabled: this.config.disabled || false,
      category: this.config.category,
      license: this.config.license,
      dependencies: this.config.dependencies || [],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.currentVersion,
      metadata: this.metadata,
    };
  }

  // Private Helpers
  private getVersionChanges(): Record<string, any> {
    return {
      name: this.config.name,
      description: this.config.description,
      model: this.config.model,
      script: this.config.script,
      props: this.config.props,
      thumbnail: this.config.thumbnail,
      tags: this.getAllTags(),
      assets: this.getAssetReferences(),
    };
  }

  private getAssetReferences(): string[] {
    return Array.from(this.assets.keys());
  }

  private calculateChecksum(): string {
    // Simple checksum calculation - in production, use proper hashing
    const data = JSON.stringify(this.getVersionChanges());
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private calculateFileSize(): number {
    // Calculate total file size of all assets
    let totalSize = 0;
    for (const asset of this.assets.values()) {
      totalSize += asset.size || 0;
    }
    return totalSize;
  }

  private getRolePermissions(role: CollaboratorRole): string[] {
    switch (role) {
      case CollaboratorRole.OWNER:
        return ['read', 'write', 'delete', 'manage_collaborators', 'manage_versions'];
      case CollaboratorRole.EDITOR:
        return ['read', 'write', 'manage_versions'];
      case CollaboratorRole.VIEWER:
        return ['read'];
      default:
        return [];
    }
  }

  private restoreVersionState(version: BlueprintVersion): void {
    // Restore blueprint state from version data
    // This would involve restoring the specific configuration from that version
    this.logger.debug(`Restoring state from version ${version.number}`);
  }

  private async validateChanges(updateConfig: Partial<BlueprintConfig>): Promise<void> {
    // Validate that changes don't break existing dependencies
    if (updateConfig.dependencies) {
      await this.validateDependencies(updateConfig.dependencies);
    }

    // Validate model and script changes
    if (updateConfig.model && this.config.model !== updateConfig.model) {
      await this.validateModelChange(updateConfig.model);
    }

    if (updateConfig.script && this.config.script !== updateConfig.script) {
      await this.validateScriptChange(updateConfig.script);
    }
  }

  private async validateDependencies(dependencies: string[]): Promise<void> {
    // Validate that all dependencies exist and are accessible
    for (const dep of dependencies) {
      // In a real implementation, this would check if the dependency exists
      this.logger.debug(`Validating dependency: ${dep}`);
    }
  }

  private async validateModelChange(newModel: string): Promise<void> {
    // Validate that the new model is compatible
    this.logger.debug(`Validating model change: ${this.config.model} -> ${newModel}`);
  }

  private async validateScriptChange(newScript: string): Promise<void> {
    // Validate that the new script is syntactically correct and secure
    this.logger.debug(`Validating script change`);
    try {
      // Basic syntax validation
      new Function(newScript);
    } catch (error) {
      throw new ValidationError('Script contains syntax errors');
    }
  }
}