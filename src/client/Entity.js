export class Entity {
  constructor(client, data) {
    this.client = client
    this.data = { ...data }
    this.id = data.id
    this.type = data.type || 'entity'
    this.blueprintId = data.blueprint || null
    this.position = [...(data.position || [0, 0, 0])]
    this.quaternion = [...(data.quaternion || [0, 0, 0, 1])]
    this.scale = [...(data.scale || [1, 1, 1])]
    this.state = data.state || {}
    this.owner = data.owner || null
    this.userId = data.userId || null
    this.name = data.name || `Entity-${this.id.slice(0, 8)}`
    this.createdAt = Date.now()
    this.lastModified = Date.now()
  }

  // Position and movement
  getPosition() {
    return [...this.position]
  }

  setPosition(position) {
    this.position = [...position]
    return this.sync()
  }

  getQuaternion() {
    return [...this.quaternion]
  }

  setQuaternion(quaternion) {
    this.quaternion = [...quaternion]
    return this.sync()
  }

  getScale() {
    return [...this.scale]
  }

  setScale(scale) {
    this.scale = [...scale]
    return this.sync()
  }

  setTransform(position, quaternion = null, scale = null) {
    if (position) this.position = [...position]
    if (quaternion) this.quaternion = [...quaternion]
    if (scale) this.scale = [...scale]
    return this.sync()
  }

  // State management
  setState(key, value) {
    this.state[key] = value
    return this.sync()
  }

  getState(key) {
    return key ? this.state[key] : { ...this.state }
  }

  updateState(newState) {
    this.state = { ...this.state, ...newState }
    return this.sync()
  }

  // Blueprint
  getBlueprint() {
    return this.client.getBlueprint(this.blueprintId)
  }

  setBlueprint(blueprintId) {
    this.blueprintId = blueprintId
    return this.sync()
  }

  // Metadata
  setName(name) {
    this.name = name
    return this.sync()
  }

  getName() {
    return this.name
  }

  // Type checking
  isApp() {
    return this.type === 'app'
  }

  isPlayer() {
    return this.type === 'player'
  }

  // Synchronization with server
  sync() {
    const data = {
      id: this.id,
      position: this.position,
      quaternion: this.quaternion,
      scale: this.scale,
      state: this.state,
      name: this.name
    }

    if (this.blueprintId) {
      data.blueprint = this.blueprintId
    }

    this.lastModified = Date.now()
    return this.client.send('entityModified', data)
  }

  // Update from server
  update(data) {
    if (data.position !== undefined) this.position = [...data.position]
    if (data.quaternion !== undefined) this.quaternion = [...data.quaternion]
    if (data.scale !== undefined) this.scale = [...data.scale]
    if (data.state !== undefined) this.state = { ...this.state, ...data.state }
    if (data.name !== undefined) this.name = data.name
    if (data.blueprint !== undefined) this.blueprintId = data.blueprint

    this.lastModified = Date.now()
  }

  // Events
  handleEvent(version, name, data) {
    this.client.emit('entityEvent', {
      entity: this,
      version,
      name,
      data
    })
  }

  // Actions
  remove() {
    return this.client.send('entityRemoved', this.id)
  }

  // Utility methods
  distanceTo(otherEntity) {
    const [x1, y1, z1] = this.position
    const [x2, y2, z2] = otherEntity.position
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2)
  }

  getBoundingSphere() {
    const maxScale = Math.max(...this.scale)
    return {
      center: this.position,
      radius: maxScale
    }
  }

  // Serialization
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      blueprintId: this.blueprintId,
      position: this.position,
      quaternion: this.quaternion,
      scale: this.scale,
      state: this.state,
      owner: this.owner,
      userId: this.userId,
      createdAt: this.createdAt,
      lastModified: this.lastModified
    }
  }

  // Cleanup
  destroy() {
    this.client.emit('entityDestroyed', this)
  }

  // Debug
  toString() {
    return `Entity(${this.type}, ${this.name}, ${this.id.slice(0, 8)})`
  }
}