export class EntityBuilder {
  constructor(client) {
    this.client = client
    this.reset()
  }

  reset() {
    this.data = {
      type: 'entity',
      position: [0, 0, 0],
      quaternion: [0, 0, 0, 1],
      scale: [1, 1, 1],
      state: {},
      name: null,
      blueprint: null,
      owner: null,
      userId: null
    }
    return this
  }

  // Position methods
  position(x, y, z) {
    this.data.position = [x, y, z]
    return this
  }

  positionFrom(entity) {
    if (entity && entity.getPosition) {
      this.data.position = entity.getPosition()
    }
    return this
  }

  moveRelative(x, y, z) {
    this.data.position[0] += x
    this.data.position[1] += y
    this.data.position[2] += z
    return this
  }

  // Rotation methods
  rotation(x, y, z, w) {
    this.data.quaternion = [x, y, z, w]
    return this
  }

  rotationFrom(entity) {
    if (entity && entity.getQuaternion) {
      this.data.quaternion = entity.getQuaternion()
    }
    return this
  }

  eulerRotation(x, y, z) {
    // Convert Euler angles to quaternion (simplified)
    const cx = Math.cos(x / 2)
    const sx = Math.sin(x / 2)
    const cy = Math.cos(y / 2)
    const sy = Math.sin(y / 2)
    const cz = Math.cos(z / 2)
    const sz = Math.sin(z / 2)

    this.data.quaternion = [
      sx * cy * cz - cx * sy * sz,
      cx * sy * cz + sx * cy * sz,
      cx * cy * sz - sx * sy * cz,
      cx * cy * cz + sx * sy * sz
    ]
    return this
  }

  lookAt(targetX, targetY, targetZ) {
    const [px, py, pz] = this.data.position
    const dx = targetX - px
    const dy = targetY - py
    const dz = targetZ - pz

    // Calculate rotation to look at target (simplified)
    const yaw = Math.atan2(dx, dz)
    const pitch = Math.atan2(-dy, Math.sqrt(dx * dx + dz * dz))

    return this.eulerRotation(0, yaw, pitch)
  }

  // Scale methods
  scale(x, y, z) {
    this.data.scale = [x, y, z]
    return this
  }

  scaleFrom(entity) {
    if (entity && entity.getScale) {
      this.data.scale = entity.getScale()
    }
    return this
  }

  uniformScale(scale) {
    this.data.scale = [scale, scale, scale]
    return this
  }

  // Metadata methods
  name(name) {
    this.data.name = name
    return this
  }

  blueprint(blueprintId) {
    this.data.blueprint = blueprintId
    this.data.type = 'app' // Apps use blueprints
    return this
  }

  owner(ownerId) {
    this.data.owner = ownerId
    return this
  }

  userId(userId) {
    this.data.userId = userId
    return this
  }

  // State methods
  setState(key, value) {
    this.data.state[key] = value
    return this
  }

  setStateMany(stateObj) {
    Object.assign(this.data.state, stateObj)
    return this
  }

  removeState(key) {
    delete this.data.state[key]
    return this
  }

  // Convenience methods for common entity types
  asApp(blueprintId) {
    return this.type('app').blueprint(blueprintId)
  }

  asPlayer() {
    return this.type('player')
  }

  asGeneric() {
    return this.type('entity')
  }

  type(type) {
    this.data.type = type
    return this
  }

  // Utility methods
  near(entity, distance = 1) {
    if (entity && entity.getPosition) {
      const pos = entity.getPosition()
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * distance

      this.data.position[0] = pos[0] + Math.cos(angle) * radius
      this.data.position[1] = pos[1]
      this.data.position[2] = pos[2] + Math.sin(angle) * radius
    }
    return this
  }

  above(entity, height = 2) {
    if (entity && entity.getPosition) {
      const pos = entity.getPosition()
      this.data.position[0] = pos[0]
      this.data.position[1] = pos[1] + height
      this.data.position[2] = pos[2]
    }
    return this
  }

  randomPosition(range = 10) {
    this.data.position[0] = (Math.random() - 0.5) * range * 2
    this.data.position[1] = (Math.random() - 0.5) * range * 2
    this.data.position[2] = (Math.random() - 0.5) * range * 2
    return this
  }

  randomRotation() {
    const u1 = Math.random()
    const u2 = Math.random()
    const u3 = Math.random()

    const sqrt1 = Math.sqrt(1 - u1)
    const sqrt2 = Math.sqrt(u1)

    this.data.quaternion = [
      sqrt1 * Math.sin(2 * Math.PI * u2),
      sqrt1 * Math.cos(2 * Math.PI * u2),
      sqrt2 * Math.sin(2 * Math.PI * u3),
      sqrt2 * Math.cos(2 * Math.PI * u3)
    ]
    return this
  }

  randomScale(min = 0.5, max = 2) {
    const scale = min + Math.random() * (max - min)
    this.data.scale = [scale, scale, scale]
    return this
  }

  // Building methods
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  build(id = null) {
    const entityId = id || this.generateId()
    const entityData = {
      id: entityId,
      ...this.data
    }

    return this.client.send('entityAdded', entityData).then(() => {
      return this.client.getEntity(entityId)
    })
  }

  buildMany(count, generator = null) {
    const promises = []
    const originalData = JSON.parse(JSON.stringify(this.data))

    for (let i = 0; i < count; i++) {
      if (generator) {
        generator(this, i)
      } else {
        // Add some variation for multiple entities
        this.randomPosition(5)
        this.randomRotation()
      }

      promises.push(this.build())

      // Reset to original data for next iteration
      this.data = JSON.parse(JSON.stringify(originalData))
    }

    return Promise.all(promises)
  }

  // Validation
  validate() {
    const errors = []

    if (!Array.isArray(this.data.position) || this.data.position.length !== 3) {
      errors.push('Position must be an array of 3 numbers')
    }

    if (!Array.isArray(this.data.quaternion) || this.data.quaternion.length !== 4) {
      errors.push('Quaternion must be an array of 4 numbers')
    }

    if (!Array.isArray(this.data.scale) || this.data.scale.length !== 3) {
      errors.push('Scale must be an array of 3 numbers')
    }

    if (this.data.type === 'app' && !this.data.blueprint) {
      errors.push('App entities must have a blueprint specified')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // Preview
  preview() {
    return JSON.parse(JSON.stringify(this.data))
  }

  toString() {
    const pos = this.data.position.map(n => n.toFixed(1)).join(', ')
    return `EntityBuilder(${this.data.type} at [${pos}])`
  }
}