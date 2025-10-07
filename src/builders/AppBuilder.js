export class AppBuilder {
  constructor(client) {
    this.client = client
    this.reset()
  }

  reset() {
    this.data = {
      type: 'app',
      position: [0, 0, 0],
      quaternion: [0, 0, 0, 1],
      scale: [1, 1, 1],
      state: {},
      name: null,
      blueprint: null,
      owner: null,
      userId: null,
      pinned: false,
      mover: null,
      uploader: null
    }
    this.blueprintData = null
    return this
  }

  // Basic positioning (inherited from EntityBuilder)
  position(x, y, z) {
    this.data.position = [x, y, z]
    return this
  }

  rotation(x, y, z, w) {
    this.data.quaternion = [x, y, z, w]
    return this
  }

  scale(x, y, z) {
    this.data.scale = [x, y, z]
    return this
  }

  name(name) {
    this.data.name = name
    return this
  }

  // App-specific methods
  blueprint(blueprintId) {
    this.data.blueprint = blueprintId
    return this
  }

  useBlueprint(blueprintObj) {
    this.blueprintData = blueprintObj
    this.data.blueprint = blueprintObj.id
    return this
  }

  pinned(isPinned = true) {
    this.data.pinned = isPinned
    return this
  }

  // Blueprint configuration
  setBlueprintProp(key, value) {
    if (!this.blueprintData) {
      this.blueprintData = {}
    }
    if (!this.blueprintData.props) {
      this.blueprintData.props = {}
    }
    this.blueprintData.props[key] = value
    return this
  }

  setBlueprintProps(propsObj) {
    if (!this.blueprintData) {
      this.blueprintData = {}
    }
    this.blueprintData.props = { ...this.blueprintData.props, ...propsObj }
    return this
  }

  // Blueprint metadata
  withMetadata(metadata) {
    if (!this.blueprintData) {
      this.blueprintData = {}
    }
    Object.assign(this.blueprintData, metadata)
    return this
  }

  author(author) {
    return this.withMetadata({ author })
  }

  description(desc) {
    return this.withMetadata({ desc })
  }

  image(imageUrl) {
    return this.withMetadata({ image: imageUrl })
  }

  model(modelUrl) {
    return this.withMetadata({ model: modelUrl })
  }

  script(scriptContent) {
    return this.withMetadata({ script: scriptContent })
  }

  version(version) {
    return this.withMetadata({ version })
  }

  // Blueprint flags
  locked(isLocked = true) {
    return this.withMetadata({ locked: isLocked })
  }

  frozen(isFrozen = true) {
    return this.withMetadata({ frozen: isFrozen })
  }

  unique(isUnique = true) {
    return this.withMetadata({ unique: isUnique })
  }

  scene(isScene = true) {
    return this.withMetadata({ scene: isScene })
  }

  disabled(isDisabled = true) {
    return this.withMetadata({ disabled: isDisabled })
  }

  // App state management
  setAppState(key, value) {
    this.data.state[key] = value
    return this
  }

  setAppStates(stateObj) {
    Object.assign(this.data.state, stateObj)
    return this
  }

  // Convenience methods for common app types
  asPortal(targetWorld) {
    return this
      .setBlueprintProp('targetWorld', targetWorld)
      .setBlueprintProp('type', 'portal')
  }

  asButton(action, label) {
    return this
      .setBlueprintProp('action', action)
      .setBlueprintProp('label', label)
      .setBlueprintProp('type', 'button')
  }

  asMedia(mediaUrl, mediaType = 'image') {
    return this
      .setBlueprintProp('url', mediaUrl)
      .setBlueprintProp('mediaType', mediaType)
      .setBlueprintProp('type', 'media')
  }

  asInteractable(interactionType) {
    return this
      .setBlueprintProp('interactionType', interactionType)
      .setBlueprintProp('type', 'interactable')
  }

  asSpawner(blueprintId, spawnInterval = 5000) {
    return this
      .setBlueprintProp('spawnBlueprint', blueprintId)
      .setBlueprintProp('spawnInterval', spawnInterval)
      .setBlueprintProp('type', 'spawner')
  }

  asTeleporter(targetPosition, targetRotation = null) {
    const props = {
      targetPosition,
      type: 'teleporter'
    }
    if (targetRotation) {
      props.targetRotation = targetRotation
    }
    return this.setBlueprintProps(props)
  }

  asGame(gameType, options = {}) {
    return this
      .setBlueprintProp('gameType', gameType)
      .setBlueprintProps(options)
      .setBlueprintProp('type', 'game')
  }

  // Upload-related methods
  fromUpload(uploadId) {
    this.data.uploader = uploadId
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

  onGround(y = 0) {
    this.data.position[1] = y
    return this
  }

  randomPosition(range = 10) {
    this.data.position[0] = (Math.random() - 0.5) * range * 2
    this.data.position[1] = (Math.random() - 0.5) * range * 2
    this.data.position[2] = (Math.random() - 0.5) * range * 2
    return this
  }

  // Building methods
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  build(id = null) {
    const validation = this.validate()
    if (!validation.valid) {
      return Promise.reject(new Error(`AppBuilder validation failed: ${validation.errors.join(', ')}`))
    }

    const appId = id || this.generateId()
    const appData = {
      id: appId,
      ...this.data
    }

    // If we have blueprint data, create/update the blueprint first
    if (this.blueprintData) {
      return this.client.send('blueprintAdded', {
        id: this.blueprintData.id || this.generateId(),
        ...this.blueprintData
      }).then(() => {
        return this.client.send('entityAdded', appData).then(() => {
          return this.client.getEntity(appId)
        })
      })
    } else {
      return this.client.send('entityAdded', appData).then(() => {
        return this.client.getEntity(appId)
      })
    }
  }

  buildMany(count, generator = null) {
    const promises = []
    const originalData = JSON.parse(JSON.stringify(this.data))
    const originalBlueprintData = this.blueprintData ? JSON.parse(JSON.stringify(this.blueprintData)) : null

    for (let i = 0; i < count; i++) {
      if (generator) {
        generator(this, i)
      } else {
        // Add some variation for multiple apps
        this.randomPosition(5)
      }

      promises.push(this.build())

      // Reset to original data for next iteration
      this.data = JSON.parse(JSON.stringify(originalData))
      this.blueprintData = originalBlueprintData ? JSON.parse(JSON.stringify(originalBlueprintData)) : null
    }

    return Promise.all(promises)
  }

  // Create app grid
  buildGrid(rows, columns, spacing = 2, generator = null) {
    const promises = []
    const originalData = JSON.parse(JSON.stringify(this.data))
    const originalBlueprintData = this.blueprintData ? JSON.parse(JSON.stringify(this.blueprintData)) : null

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        this.data.position[0] = originalData.position[0] + col * spacing
        this.data.position[2] = originalData.position[2] + row * spacing

        if (generator) {
          generator(this, row, col)
        }

        promises.push(this.build())

        // Reset to original data for next iteration
        this.data = JSON.parse(JSON.stringify(originalData))
        this.blueprintData = originalBlueprintData ? JSON.parse(JSON.stringify(originalBlueprintData)) : null
      }
    }

    return Promise.all(promises)
  }

  // Create app circle
  buildCircle(count, radius = 5, generator = null) {
    const promises = []
    const originalData = JSON.parse(JSON.stringify(this.data))
    const originalBlueprintData = this.blueprintData ? JSON.parse(JSON.stringify(this.blueprintData)) : null

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      this.data.position[0] = originalData.position[0] + Math.cos(angle) * radius
      this.data.position[2] = originalData.position[2] + Math.sin(angle) * radius

      if (generator) {
        generator(this, i, angle)
      }

      promises.push(this.build())

      // Reset to original data for next iteration
      this.data = JSON.parse(JSON.stringify(originalData))
      this.blueprintData = originalBlueprintData ? JSON.parse(JSON.stringify(originalBlueprintData)) : null
    }

    return Promise.all(promises)
  }

  // Validation
  validate() {
    const errors = []

    if (!this.data.blueprint) {
      errors.push('App must have a blueprint specified')
    }

    if (!Array.isArray(this.data.position) || this.data.position.length !== 3) {
      errors.push('Position must be an array of 3 numbers')
    }

    if (!Array.isArray(this.data.quaternion) || this.data.quaternion.length !== 4) {
      errors.push('Quaternion must be an array of 4 numbers')
    }

    if (!Array.isArray(this.data.scale) || this.data.scale.length !== 3) {
      errors.push('Scale must be an array of 3 numbers')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // Preview
  preview() {
    return {
      appData: JSON.parse(JSON.stringify(this.data)),
      blueprintData: this.blueprintData ? JSON.parse(JSON.stringify(this.blueprintData)) : null
    }
  }

  toString() {
    const pos = this.data.position.map(n => n.toFixed(1)).join(', ')
    const bpName = this.blueprintData?.name || this.data.blueprint || 'unknown'
    return `AppBuilder(${bpName} at [${pos}])`
  }
}