import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import {
  BuildMode,
  BuildTool,
  BuildAction,
  BuildHistory,
  BuildSession,
  BuilderPermissions,
  SnapSettings,
  GridSettings,
  SelectionGroup,
  BuilderHotkey,
  MaterialPreset,
  BuilderSelection,
  BuilderViewport,
  RaycastResult,
  Transform3D,
  BoundingBox,
  Entity,
  Vector3,
  Quaternion,
  AppEntity,
  Blueprint,
  AssetFile
} from '../types/index.js'

export interface BuilderConfig {
  enabled: boolean
  permissions: BuilderPermissions
  snapSettings: SnapSettings
  gridSettings: GridSettings
  hotkeys: BuilderHotkey[]
  materialPresets: MaterialPreset[]
  maxHistorySize: number
  autoSave: boolean
  autoSaveInterval: number
  collaboration: boolean
}

export interface BuilderToolConfig {
  tool: BuildTool
  mode: BuildMode
  settings: Record<string, any>
  active: boolean
}

export interface FileDropInfo {
  file: File | Buffer
  position: Vector3
  rotation: Quaternion
  type: 'model' | 'texture' | 'audio' | 'script'
  url?: string
}

export class BuilderManager extends EventEmitter {
  public readonly id: string
  public config: BuilderConfig

  private isEnabled: boolean = false
  private currentTool: BuildTool = BuildTool.GRAB
  private currentMode: BuildMode = BuildMode.SELECT
  private selection: BuilderSelection = { entities: [] }
  private viewport: BuilderViewport
  private buildHistory: BuildHistory[] = []
  private undoStack: BuildAction[] = []
  private redoStack: BuildAction[] = []
  private activeSession?: BuildSession
  private selectionGroups: Map<string, SelectionGroup> = new Map()
  private materialPresets: Map<string, MaterialPreset> = new Map()
  private customTools: Map<string, BuilderToolConfig> = new Map()

  private raycastCallback?: (origin: Vector3, direction: Vector3) => RaycastResult[]
  private entityCreateCallback?: (data: any) => Promise<Entity>
  private entityModifyCallback?: (id: string, data: any) => Promise<void>
  private entityDeleteCallback?: (id: string) => Promise<void>
  private assetUploadCallback?: (file: File | Buffer, type: string) => Promise<AssetFile>

  constructor(config: Partial<BuilderConfig> = {}) {
    super()

    this.id = uuidv4()
    this.config = {
      enabled: false,
      permissions: {
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canPublish: false,
        canManageCollaborators: false
      },
      snapSettings: {
        enabled: true,
        distance: 1.0,
        angle: 45,
        scale: 0.25
      },
      gridSettings: {
        visible: true,
        size: 10,
        divisions: 10,
        color: [0.5, 0.5, 0.5, 0.3],
        orientation: 'y'
      },
      hotkeys: this.getDefaultHotkeys(),
      materialPresets: [],
      maxHistorySize: 50,
      autoSave: true,
      autoSaveInterval: 30000,
      collaboration: false,
      ...config
    }

    this.viewport = {
      camera: {
        position: [0, 5, 10],
        rotation: [0, 0, 0, 1],
        fov: 75,
        near: 0.1,
        far: 1000
      },
      grid: this.config.gridSettings,
      gizmos: true,
      wireframe: false,
      bounds: false
    }

    this.initializeMaterialPresets()
  }

  enable(): void {
    if (!this.config.permissions.canEdit) {
      throw new Error('Insufficient permissions to enable builder mode')
    }

    this.isEnabled = true
    this.startSession()
    this.emit('enabled')
    this.emit('toolChanged', { tool: this.currentTool, mode: this.currentMode })
  }

  disable(): void {
    this.isEnabled = false
    this.clearSelection()
    this.stopSession()
    this.emit('disabled')
  }

  setTool(tool: BuildTool, mode?: BuildMode): void {
    if (!this.isEnabled) return

    const previousTool = this.currentTool
    const previousMode = this.currentMode

    this.currentTool = tool
    if (mode) {
      this.currentMode = mode
    }

    this.emit('toolChanged', {
      tool: this.currentTool,
      mode: this.currentMode,
      previousTool,
      previousMode
    })
  }

  selectEntities(entityIds: string[], mode: 'replace' | 'add' | 'remove' | 'toggle' = 'replace'): void {
    if (!this.isEnabled) return

    const previousSelection = [...this.selection.entities]

    switch (mode) {
      case 'replace':
        this.selection.entities = entityIds
        break
      case 'add':
        entityIds.forEach(id => {
          if (!this.selection.entities.includes(id)) {
            this.selection.entities.push(id)
          }
        })
        break
      case 'remove':
        this.selection.entities = this.selection.entities.filter(
          id => !entityIds.includes(id)
        )
        break
      case 'toggle':
        entityIds.forEach(id => {
          const index = this.selection.entities.indexOf(id)
          if (index >= 0) {
            this.selection.entities.splice(index, 1)
          } else {
            this.selection.entities.push(id)
          }
        })
        break
    }

    this.updateSelectionBounds()
    this.emit('selectionChanged', {
      selection: this.selection,
      previousSelection
    })
  }

  clearSelection(): void {
    if (this.selection.entities.length === 0) return

    const previousSelection = [...this.selection.entities]
    this.selection.entities = []
    this.selection.boundingBox = undefined
    this.selection.group = undefined

    this.emit('selectionChanged', {
      selection: this.selection,
      previousSelection
    })
  }

  async performAction(action: Omit<BuildAction, 'id' | 'timestamp' | 'buildVersion'>): Promise<void> {
    if (!this.isEnabled || !this.hasPermission(action.type)) {
      throw new Error('Insufficient permissions for this action')
    }

    const buildAction: BuildAction = {
      id: uuidv4(),
      ...action,
      timestamp: new Date(),
      buildVersion: this.activeSession?.actions.length || 0
    }

    try {
      await this.executeBuildAction(buildAction)

      this.undoStack.push(buildAction)
      this.redoStack = []

      if (this.activeSession) {
        this.activeSession.actions.push(buildAction)
      }

      this.addToHistory(buildAction)
      this.trimHistory()

      this.emit('actionPerformed', buildAction)

      if (this.config.autoSave) {
        this.scheduleAutoSave()
      }

    } catch (error) {
      this.emit('actionError', { action: buildAction, error })
      throw error
    }
  }

  async undo(): Promise<boolean> {
    if (this.undoStack.length === 0) return false

    const action = this.undoStack.pop()!
    const inverseAction = this.createInverseAction(action)

    if (inverseAction) {
      try {
        await this.executeBuildAction(inverseAction)
        this.redoStack.push(action)

        if (this.activeSession) {
          this.activeSession.actions.push(inverseAction)
        }

        this.addToHistory(inverseAction)
        this.emit('actionUndone', action)
        return true

      } catch (error) {
        this.undoStack.push(action)
        this.emit('undoError', { action, error })
        return false
      }
    }

    return false
  }

  async redo(): Promise<boolean> {
    if (this.redoStack.length === 0) return false

    const action = this.redoStack.pop()!

    try {
      await this.executeBuildAction(action)
      this.undoStack.push(action)

      if (this.activeSession) {
        this.activeSession.actions.push(action)
      }

      this.addToHistory(action)
      this.emit('actionRedone', action)
      return true

    } catch (error) {
      this.redoStack.push(action)
      this.emit('redoError', { action, error })
      return false
    }
  }

  async createEntity(type: string, data: any, position?: Vector3): Promise<Entity> {
    if (!this.entityCreateCallback) {
      throw new Error('Entity creation callback not set')
    }

    const entityData = {
      type,
      position: position || this.viewport.camera.position,
      rotation: [0, 0, 0, 1] as Quaternion,
      scale: [1, 1, 1] as Vector3,
      ...data
    }

    const entity = await this.entityCreateCallback(entityData)

    await this.performAction({
      type: 'create',
      entityId: entity.id,
      data: entityData,
      userId: this.activeSession?.userId || 'system'
    })

    return entity
  }

  async deleteEntities(entityIds: string[]): Promise<void> {
    for (const entityId of entityIds) {
      if (!this.entityDeleteCallback) {
        throw new Error('Entity deletion callback not set')
      }

      await this.entityDeleteCallback(entityId)

      await this.performAction({
        type: 'delete',
        entityId,
        data: { entityId },
        userId: this.activeSession?.userId || 'system'
      })
    }
  }

  async transformEntities(
    entityIds: string[],
    transform: Partial<Transform3D>,
    space: 'local' | 'world' = 'world'
  ): Promise<void> {
    for (const entityId of entityIds) {
      const data: any = { entityId, space }

      if (transform.position) {
        data.position = this.snapPosition(transform.position)
      }
      if (transform.rotation) {
        data.rotation = this.snapRotation(transform.rotation)
      }
      if (transform.scale) {
        data.scale = this.snapScale(transform.scale)
      }

      if (this.entityModifyCallback) {
        await this.entityModifyCallback(entityId, data)
      }

      const actionType = transform.position ? 'move' :
                       transform.rotation ? 'rotate' : 'scale'

      await this.performAction({
        type: actionType,
        entityId,
        data,
        userId: this.activeSession?.userId || 'system'
      })
    }
  }

  async duplicateEntities(entityIds: string[], offset?: Vector3): Promise<Entity[]> {
    const duplicatedEntities: Entity[] = []

    for (const entityId of entityIds) {
      const offsetPos = offset || [1, 0, 1] as Vector3

      if (this.entityCreateCallback) {
        const duplicateData = {
          sourceEntity: entityId,
          position: offsetPos,
          rotation: [0, 0, 0, 1] as Quaternion,
          scale: [1, 1, 1] as Vector3
        }

        const entity = await this.entityCreateCallback(duplicateData)
        duplicatedEntities.push(entity)

        await this.performAction({
          type: 'create',
          entityId: entity.id,
          data: duplicateData,
          userId: this.activeSession?.userId || 'system'
        })
      }
    }

    return duplicatedEntities
  }

  async handleFileDrop(dropInfo: FileDropInfo): Promise<Entity[]> {
    const entities: Entity[] = []

    try {
      if (this.assetUploadCallback) {
        const asset = await this.assetUploadCallback(dropInfo.file, dropInfo.type)

        const entityData = {
          type: 'app',
          blueprint: asset.id,
          position: dropInfo.position,
          rotation: dropInfo.rotation,
          scale: [1, 1, 1] as Vector3
        }

        if (this.entityCreateCallback) {
          const entity = await this.entityCreateCallback(entityData)
          entities.push(entity)

          await this.performAction({
            type: 'create',
            entityId: entity.id,
            data: entityData,
            userId: this.activeSession?.userId || 'system'
          })
        }
      }

      this.emit('filesDropped', { dropInfo, entities })
      return entities

    } catch (error) {
      this.emit('fileDropError', { dropInfo, error })
      throw error
    }
  }

  createSelectionGroup(name: string, entityIds?: string[]): SelectionGroup {
    const group: SelectionGroup = {
      id: uuidv4(),
      name,
      entities: entityIds || [...this.selection.entities],
      pivot: this.calculateGroupPivot(entityIds || this.selection.entities)
    }

    this.selectionGroups.set(group.id, group)
    this.emit('selectionGroupCreated', group)
    return group
  }

  deleteSelectionGroup(groupId: string): boolean {
    const group = this.selectionGroups.get(groupId)
    if (!group) return false

    this.selectionGroups.delete(groupId)
    this.emit('selectionGroupDeleted', group)
    return true
  }

  raycast(origin: Vector3, direction: Vector3): RaycastResult[] {
    if (!this.raycastCallback) return []
    return this.raycastCallback(origin, direction)
  }

  setCallbacks(callbacks: {
    raycast?: (origin: Vector3, direction: Vector3) => RaycastResult[]
    entityCreate?: (data: any) => Promise<Entity>
    entityModify?: (id: string, data: any) => Promise<void>
    entityDelete?: (id: string) => Promise<void>
    assetUpload?: (file: File | Buffer, type: string) => Promise<AssetFile>
  }): void {
    this.raycastCallback = callbacks.raycast
    this.entityCreateCallback = callbacks.entityCreate
    this.entityModifyCallback = callbacks.entityModify
    this.entityDeleteCallback = callbacks.entityDelete
    this.assetUploadCallback = callbacks.assetUpload
  }

  updateViewport(updates: Partial<BuilderViewport>): void {
    this.viewport = { ...this.viewport, ...updates }
    this.emit('viewportUpdated', this.viewport)
  }

  updateSnapSettings(settings: Partial<SnapSettings>): void {
    this.config.snapSettings = { ...this.config.snapSettings, ...settings }
    this.emit('snapSettingsUpdated', this.config.snapSettings)
  }

  updateGridSettings(settings: Partial<GridSettings>): void {
    this.config.gridSettings = { ...this.config.gridSettings, ...settings }
    this.viewport.grid = this.config.gridSettings
    this.emit('gridSettingsUpdated', this.config.gridSettings)
  }

  addMaterialPreset(preset: MaterialPreset): void {
    this.materialPresets.set(preset.id, preset)
    this.emit('materialPresetAdded', preset)
  }

  removeMaterialPreset(presetId: string): boolean {
    const removed = this.materialPresets.delete(presetId)
    if (removed) {
      this.emit('materialPresetRemoved', presetId)
    }
    return removed
  }

  getMaterialPreset(presetId: string): MaterialPreset | undefined {
    return this.materialPresets.get(presetId)
  }

  getMaterialPresets(): MaterialPreset[] {
    return Array.from(this.materialPresets.values())
  }

  getSelection(): BuilderSelection {
    return { ...this.selection }
  }

  getSelectedEntities(): string[] {
    return [...this.selection.entities]
  }

  getSelectionBounds(): BoundingBox | undefined {
    return this.selection.boundingBox
  }

  getBuildHistory(): BuildHistory[] {
    return [...this.buildHistory]
  }

  getSession(): BuildSession | undefined {
    return this.activeSession
  }

  getTool(): BuildTool {
    return this.currentTool
  }

  getMode(): BuildMode {
    return this.currentMode
  }

  isEnabled(): boolean {
    return this.isEnabled
  }

  hasPermission(action: string): boolean {
    switch (action) {
      case 'create':
        return this.config.permissions.canCreate
      case 'update':
      case 'move':
      case 'rotate':
      case 'scale':
        return this.config.permissions.canEdit
      case 'delete':
        return this.config.permissions.canDelete
      default:
        return false
    }
  }

  private startSession(): void {
    this.activeSession = {
      id: uuidv4(),
      appId: this.id,
      startTime: new Date(),
      userId: 'local',
      actions: [],
      entities: [],
      options: {}
    }

    this.emit('sessionStarted', this.activeSession)
  }

  private stopSession(): void {
    if (this.activeSession) {
      this.activeSession.endTime = new Date()
      this.emit('sessionEnded', this.activeSession)
      this.activeSession = undefined
    }
  }

  private async executeBuildAction(action: BuildAction): Promise<void> {
    this.emit('actionExecuting', action)
  }

  private createInverseAction(action: BuildAction): BuildAction | null {
    switch (action.type) {
      case 'create':
        return {
          id: uuidv4(),
          type: 'delete',
          entityId: action.entityId,
          data: { entityId: action.entityId },
          userId: action.userId,
          timestamp: new Date(),
          buildVersion: action.buildVersion
        }
      case 'delete':
        return {
          id: uuidv4(),
          type: 'create',
          entityId: action.entityId,
          data: action.data,
          userId: action.userId,
          timestamp: new Date(),
          buildVersion: action.buildVersion
        }
      case 'move':
        return {
          id: uuidv4(),
          type: 'move',
          entityId: action.entityId,
          data: {
            position: (action.data as any).previousPosition || action.data.position,
            previousPosition: action.data.position
          },
          userId: action.userId,
          timestamp: new Date(),
          buildVersion: action.buildVersion
        }
      default:
        return null
    }
  }

  private addToHistory(action: BuildAction): void {
    const historyEntry: BuildHistory = {
      id: uuidv4(),
      timestamp: new Date(),
      changes: [action],
      snapshot: [],
      userId: action.userId,
      buildVersion: action.buildVersion
    }

    this.buildHistory.push(historyEntry)
  }

  private trimHistory(): void {
    if (this.buildHistory.length > this.config.maxHistorySize) {
      this.buildHistory = this.buildHistory.slice(-this.config.maxHistorySize)
    }
  }

  private updateSelectionBounds(): void {
    if (this.selection.entities.length === 0) {
      this.selection.boundingBox = undefined
      return
    }

    this.selection.boundingBox = this.calculateBoundingBox(this.selection.entities)
  }

  private calculateBoundingBox(entityIds: string[]): BoundingBox {
    return {
      min: [0, 0, 0],
      max: [1, 1, 1],
      center: [0.5, 0.5, 0.5],
      size: [1, 1, 1]
    }
  }

  private calculateGroupPivot(entityIds: string[]): Vector3 {
    if (entityIds.length === 0) return [0, 0, 0]

    const bounds = this.calculateBoundingBox(entityIds)
    return bounds.center
  }

  private snapPosition(position: Vector3): Vector3 {
    if (!this.config.snapSettings.enabled) return position

    const snap = this.config.snapSettings.distance
    return [
      Math.round(position[0] / snap) * snap,
      Math.round(position[1] / snap) * snap,
      Math.round(position[2] / snap) * snap
    ]
  }

  private snapRotation(rotation: Quaternion): Quaternion {
    if (!this.config.snapSettings.enabled) return rotation

    return rotation
  }

  private snapScale(scale: Vector3): Vector3 {
    if (!this.config.snapSettings.enabled) return scale

    const snap = this.config.snapSettings.scale
    return [
      Math.round(scale[0] / snap) * snap,
      Math.round(scale[1] / snap) * snap,
      Math.round(scale[2] / snap) * snap
    ]
  }

  private getDefaultHotkeys(): BuilderHotkey[] {
    return [
      {
        key: 'g',
        tool: BuildTool.GRAB,
        description: 'Grab tool'
      },
      {
        key: 'm',
        tool: BuildTool.MOVE,
        description: 'Move tool'
      },
      {
        key: 'r',
        tool: BuildTool.ROTATE,
        description: 'Rotate tool'
      },
      {
        key: 's',
        tool: BuildTool.SCALE,
        description: 'Scale tool'
      },
      {
        key: 'd',
        modifiers: ['shift'],
        action: 'duplicate',
        description: 'Duplicate selected'
      },
      {
        key: 'Delete',
        action: 'delete',
        description: 'Delete selected'
      },
      {
        key: 'z',
        modifiers: ['ctrl'],
        action: 'undo',
        description: 'Undo'
      },
      {
        key: 'y',
        modifiers: ['ctrl'],
        action: 'redo',
        description: 'Redo'
      }
    ]
  }

  private initializeMaterialPresets(): void {
    this.config.materialPresets.forEach(preset => {
      this.materialPresets.set(preset.id, preset)
    })
  }

  private scheduleAutoSave(): void {
    setTimeout(() => {
      if (this.config.autoSave && this.activeSession) {
        this.emit('autoSave', this.activeSession)
      }
    }, this.config.autoSaveInterval)
  }
}