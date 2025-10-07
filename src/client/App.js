import { Entity } from './Entity.js'

export class App extends Entity {
  constructor(client, data) {
    super(client, data)
    this.type = 'app'
    this.blueprint = client.getBlueprint(data.blueprint) || null
    this.pinned = data.pinned || false
    this.mover = data.mover || null
    this.uploader = data.uploader || null
    this.isUploading = !!this.uploader
    this.fields = []
    this.onFields = null
  }

  // Blueprint management
  getBlueprint() {
    return this.blueprint || this.client.getBlueprint(this.blueprintId)
  }

  updateBlueprint() {
    this.blueprint = this.client.getBlueprint(this.blueprintId)
  }

  // Blueprint properties
  getBlueprintName() {
    const bp = this.getBlueprint()
    return bp ? bp.name : 'Unknown App'
  }

  getBlueprintDescription() {
    const bp = this.getBlueprint()
    return bp ? bp.desc : ''
  }

  getBlueprintAuthor() {
    const bp = this.getBlueprint()
    return bp ? bp.author : 'Unknown'
  }

  getBlueprintImage() {
    const bp = this.getBlueprint()
    return bp ? bp.image : null
  }

  getBlueprintModel() {
    const bp = this.getBlueprint()
    return bp ? bp.model : null
  }

  getBlueprintScript() {
    const bp = this.getBlueprint()
    return bp ? bp.script : null
  }

  getBlueprintProps() {
    const bp = this.getBlueprint()
    return bp ? (bp.props || {}) : {}
  }

  isLocked() {
    const bp = this.getBlueprint()
    return bp ? bp.locked : false
  }

  isFrozen() {
    const bp = this.getBlueprint()
    return bp ? bp.frozen : false
  }

  isUnique() {
    const bp = this.getBlueprint()
    return bp ? bp.unique : false
  }

  isScene() {
    const bp = this.getBlueprint()
    return bp ? bp.scene : false
  }

  isDisabled() {
    const bp = this.getBlueprint()
    return bp ? bp.disabled : false
  }

  // App state
  isPinned() {
    return this.pinned
  }

  setPinned(pinned) {
    this.pinned = pinned
    return this.client.send('entityModified', {
      id: this.id,
      pinned
    })
  }

  togglePin() {
    return this.setPinned(!this.pinned)
  }

  isBeingMoved() {
    return this.mover !== null
  }

  isBeingUploaded() {
    return this.isUploading
  }

  // Upload completion
  onUploaded() {
    this.isUploading = false
    this.mover = null
    this.uploader = null
    this.client.emit('appUploaded', this)
  }

  // App properties
  setBlueprintProperty(key, value) {
    const bp = this.getBlueprint()
    if (!bp) return Promise.reject(new Error('Blueprint not found'))

    const newProps = { ...bp.props, [key]: value }
    return this.client.send('blueprintModified', {
      id: bp.id,
      version: bp.version + 1,
      props: newProps
    })
  }

  getBlueprintProperty(key) {
    const props = this.getBlueprintProps()
    return props[key]
  }

  // Fields (dynamic properties from blueprint)
  getFields() {
    return [...this.fields]
  }

  addField(field) {
    this.fields.push(field)
    if (this.onFields) {
      this.onFields(this.getFields())
    }
  }

  updateField(fieldKey, value) {
    const field = this.fields.find(f => f.key === fieldKey)
    if (field) {
      field.value = value
      if (this.onFields) {
        this.onFields(this.getFields())
      }
    }
  }

  // App actions
  duplicate() {
    const blueprint = this.getBlueprint()
    if (!blueprint) return Promise.reject(new Error('Blueprint not found'))

    return this.client.send('entityAdded', {
      id: this.generateId(),
      type: 'app',
      blueprint: blueprint.id,
      position: [...this.position],
      quaternion: [...this.quaternion],
      scale: [...this.scale],
      mover: null,
      uploader: null,
      pinned: false,
      state: {}
    })
  }

  remove() {
    return super.remove()
  }

  // Events
  emit(eventName, data = {}) {
    this.client.send('entityEvent', [
      this.id,
      this.getState('version') || 0,
      eventName,
      data
    ])
  }

  // Utility methods
  getAppInfo() {
    return {
      id: this.id,
      name: this.getBlueprintName(),
      description: this.getBlueprintDescription(),
      author: this.getBlueprintAuthor(),
      position: this.position,
      pinned: this.pinned,
      isLocked: this.isLocked(),
      isFrozen: this.isFrozen(),
      isUploading: this.isUploading,
      blueprintId: this.blueprintId
    }
  }

  getFullInfo() {
    return {
      ...this.toJSON(),
      blueprint: this.getBlueprint(),
      blueprintName: this.getBlueprintName(),
      blueprintDescription: this.getBlueprintDescription(),
      blueprintAuthor: this.getBlueprintAuthor(),
      isLocked: this.isLocked(),
      isFrozen: this.isFrozen(),
      isUnique: this.isUnique(),
      isScene: this.isScene(),
      isDisabled: this.isDisabled(),
      isPinned: this.pinned,
      isBeingMoved: this.isBeingMoved(),
      isBeingUploaded: this.isBeingUploaded()
    }
  }

  // Update from server (override for app-specific data)
  update(data) {
    super.update(data)

    if (data.pinned !== undefined) this.pinned = data.pinned
    if (data.mover !== undefined) this.mover = data.mover
    if (data.uploader !== undefined) {
      this.uploader = data.uploader
      this.isUploading = !!this.uploader
    }

    // Update blueprint reference if changed
    if (data.blueprint !== undefined && data.blueprint !== this.blueprintId) {
      this.blueprintId = data.blueprint
      this.updateBlueprint()
    }
  }

  // Serialization
  toJSON() {
    return {
      ...super.toJSON(),
      blueprintName: this.getBlueprintName(),
      blueprintDescription: this.getBlueprintDescription(),
      blueprintAuthor: this.getBlueprintAuthor(),
      pinned: this.pinned,
      mover: this.mover,
      uploader: this.uploader,
      isUploading: this.isUploading,
      isLocked: this.isLocked(),
      isFrozen: this.isFrozen(),
      isUnique: this.isUnique(),
      isScene: this.isScene(),
      isDisabled: this.isDisabled()
    }
  }

  // Generate ID (utility)
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  // Debug
  toString() {
    return `App(${this.getBlueprintName()}, ${this.id.slice(0, 8)})`
  }
}