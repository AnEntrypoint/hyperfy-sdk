import fs from 'fs'
import path from 'path'

export class AppCodeEditor {
  constructor(client) {
    this.client = client
    this.currentApp = null
    this.currentCode = null
    this.isEditing = false
    this.editHistory = []
    this.maxHistory = 50

    // Event handlers
    this.onCodeChange = null
    this.onCodeSaved = null
    this.onCodeError = null
    this.onAppLoaded = null
  }

  // App management
  async loadApp(appId) {
    try {
      const app = this.client.getEntity(appId)
      if (!app || !app.isApp()) {
        throw new Error('Entity is not an app or does not exist')
      }

      this.currentApp = app
      this.currentCode = app.getBlueprintScript() || ''
      this.isEditing = false
      this.editHistory = []

      if (this.onAppLoaded) {
        this.onAppLoaded(app, this.currentCode)
      }

      return { app, code: this.currentCode }
    } catch (error) {
      throw new Error(`Failed to load app: ${error.message}`)
    }
  }

  unloadApp() {
    this.currentApp = null
    this.currentCode = null
    this.isEditing = false
    this.editHistory = []
  }

  // Code editing
  startEditing() {
    if (!this.currentApp) {
      throw new Error('No app loaded for editing')
    }

    this.isEditing = true
    this.addToHistory(this.currentCode, 'start')
    return this.currentCode
  }

  updateCode(newCode, metadata = {}) {
    if (!this.isEditing) {
      throw new Error('Not in editing mode. Call startEditing() first.')
    }

    const oldCode = this.currentCode
    this.currentCode = newCode

    this.addToHistory(newCode, 'update', {
      ...metadata,
      oldCode,
      change: this.calculateChange(oldCode, newCode)
    })

    if (this.onCodeChange) {
      this.onCodeChange(this.currentCode, oldCode, metadata)
    }

    return this.currentCode
  }

  insertCode(insertionPoint, code, metadata = {}) {
    if (!this.isEditing) {
      throw new Error('Not in editing mode')
    }

    const oldCode = this.currentCode
    const newCode = oldCode.slice(0, insertionPoint) + code + oldCode.slice(insertionPoint)

    return this.updateCode(newCode, {
      ...metadata,
      type: 'insert',
      insertionPoint,
      insertedCode: code
    })
  }

  replaceCode(start, end, replacement, metadata = {}) {
    if (!this.isEditing) {
      throw new Error('Not in editing mode')
    }

    const oldCode = this.currentCode
    const newCode = oldCode.slice(0, start) + replacement + oldCode.slice(end)

    return this.updateCode(newCode, {
      ...metadata,
      type: 'replace',
      start,
      end,
      replacedText: oldCode.slice(start, end),
      replacement
    })
  }

  deleteCode(start, end, metadata = {}) {
    if (!this.isEditing) {
      throw new Error('Not in editing mode')
    }

    const oldCode = this.currentCode
    const newCode = oldCode.slice(0, start) + oldCode.slice(end)

    return this.updateCode(newCode, {
      ...metadata,
      type: 'delete',
      start,
      end,
      deletedText: oldCode.slice(start, end)
    })
  }

  // Code validation
  validateCode(code = null) {
    const codeToValidate = code || this.currentCode
    const errors = []

    try {
      // Basic syntax validation
      new Function(codeToValidate)
    } catch (error) {
      errors.push({
        type: 'syntax',
        message: error.message,
        line: this.extractLineFromError(error),
        severity: 'error'
      })
    }

    // Check for common issues
    const commonIssues = this.checkCommonIssues(codeToValidate)
    errors.push(...commonIssues)

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // Code saving
  async saveCode(options = {}) {
    if (!this.isEditing || !this.currentApp) {
      throw new Error('No app is being edited')
    }

    const { validate = true, createBackup = true } = options

    // Validate code if requested
    if (validate) {
      const validation = this.validateCode()
      if (!validation.valid) {
        if (this.onCodeError) {
          this.onCodeError(validation.errors)
        }
        throw new Error(`Code validation failed: ${validation.errors.map(e => e.message).join(', ')}`)
      }
    }

    try {
      // Create backup if requested
      if (createBackup) {
        await this.createBackup()
      }

      // Update blueprint script
      const blueprint = this.currentApp.getBlueprint()
      if (!blueprint) {
        throw new Error('App blueprint not found')
      }

      const updatedBlueprint = {
        ...blueprint,
        script: this.currentCode,
        version: (blueprint.version || 0) + 1,
        lastModified: Date.now()
      }

      // Send update to server
      await this.client.send('blueprintModified', {
        id: blueprint.id,
        version: updatedBlueprint.version,
        script: this.currentCode
      })

      // Update local blueprint reference
      this.currentApp.blueprint = updatedBlueprint

      // Add to history
      this.addToHistory(this.currentCode, 'save', {
        blueprintVersion: updatedBlueprint.version
      })

      // Reset editing state
      this.isEditing = false

      if (this.onCodeSaved) {
        this.onCodeSaved(this.currentCode, updatedBlueprint)
      }

      return updatedBlueprint
    } catch (error) {
      if (this.onCodeError) {
        this.onCodeError([{
          type: 'save',
          message: error.message,
          severity: 'error'
        }])
      }
      throw error
    }
  }

  // Code templates
  getTemplate(type = 'basic') {
    const templates = {
      basic: `// Basic App Script
export function setup() {
  // This function runs once when the app is created
  console.log('App setup complete')
}

export function update(delta) {
  // This function runs every frame
  // delta is the time since last frame in milliseconds
}

export function onEvent(event, data) {
  // Handle events from other entities
  console.log('Received event:', event, data)
}`,

      interactive: `// Interactive App Script
export function setup() {
  this.state.clickCount = 0
  this.state.hovered = false
}

export function update(delta) {
  // Update based on state
  if (this.state.hovered) {
    // Add hover effect
  }
}

export function onClick() {
  this.state.clickCount++
  console.log('Clicked', this.state.clickCount, 'times')

  // Emit event to other entities
  this.emit('buttonClicked', {
    count: this.state.clickCount,
    timestamp: Date.now()
  })
}

export function onHover(isHovered) {
  this.state.hovered = isHovered
  console.log(isHovered ? 'Hover started' : 'Hover ended')
}`,

      game: `// Game App Script
export function setup() {
  this.state.score = 0
  this.state.gameRunning = false
  this.state.players = []
}

export function update(delta) {
  if (!this.state.gameRunning) return

  // Game logic here
  this.state.players.forEach(player => {
    // Update player positions, check collisions, etc.
  })
}

export function startGame() {
  this.state.gameRunning = true
  this.state.score = 0
  console.log('Game started!')
}

export function endGame() {
  this.state.gameRunning = false
  console.log('Game ended! Final score:', this.state.score)
}

export function onPlayerJoin(player) {
  this.state.players.push(player)
  console.log('Player joined:', player.name)
}

export function onPlayerLeave(player) {
  const index = this.state.players.indexOf(player)
  if (index > -1) {
    this.state.players.splice(index, 1)
  }
  console.log('Player left:', player.name)
}`,

      portal: `// Portal App Script
export function setup() {
  this.state.targetWorld = 'default'
  this.state.active = true
}

export function update(delta) {
  // Portal visual effects
  if (this.state.active) {
    // Rotate portal
    const rotation = this.getQuaternion()
    rotation[1] += delta * 0.001
    this.setQuaternion(rotation)
  }
}

export function onPlayerEnter(player) {
  if (!this.state.active) return

  console.log('Teleporting player to:', this.state.targetWorld)

  // Teleport player to target world/position
  this.emit('teleportPlayer', {
    player: player.id,
    target: this.state.targetWorld
  })
}

export function setTarget(worldName) {
  this.state.targetWorld = worldName
  console.log('Portal target set to:', worldName)
}`,

      spawner: `// Spawner App Script
export function setup() {
  this.state.spawnRate = 2000 // milliseconds
  this.state.maxEntities = 10
  this.state.spawnedEntities = []
  this.state.lastSpawn = 0
  this.state.blueprintId = null // Set this to your blueprint ID
}

export function update(delta) {
  const now = Date.now()

  if (now - this.state.lastSpawn > this.state.spawnRate) {
    this.spawnEntity()
    this.state.lastSpawn = now
  }

  // Clean up entities that are too far away
  this.cleanupEntities()
}

export function spawnEntity() {
  if (this.state.spawnedEntities.length >= this.state.maxEntities) {
    return
  }

  if (!this.state.blueprintId) {
    console.warn('No blueprint ID set for spawner')
    return
  }

  // Spawn entity near spawner
  const position = this.getPosition()
  const spawnPosition = [
    position[0] + (Math.random() - 0.5) * 5,
    position[1],
    position[2] + (Math.random() - 0.5) * 5
  ]

  this.emit('spawnEntity', {
    blueprint: this.state.blueprintId,
    position: spawnPosition
  })

  console.log('Spawned entity at:', spawnPosition)
}

export function cleanupEntities() {
  const myPosition = this.getPosition()
  const cleanupDistance = 50

  this.state.spawnedEntities = this.state.spawnedEntities.filter(entity => {
    const distance = this.calculateDistance(myPosition, entity.getPosition())
    return distance < cleanupDistance
  })
}`
    }

    return templates[type] || templates.basic
  }

  // Code utilities
  formatCode(code = null) {
    const codeToFormat = code || this.currentCode
    // Basic code formatting (can be enhanced with prettier integration)
    return codeToFormat
      .split('\n')
      .map(line => line.trimEnd())
      .join('\n')
  }

  minifyCode(code = null) {
    const codeToMinify = code || this.currentCode
    // Basic minification (remove comments and extra whitespace)
    return codeToMinify
      .replace(/\/\/.*$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\s*([{}();,])\s*/g, '$1') // Clean up around operators
      .trim()
  }

  beautifyCode(code = null) {
    const codeToBeautify = code || this.currentCode
    // Basic code beautification
    let beautified = ''
    let indent = 0
    const lines = codeToBeautify.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()

      // Decrease indent for closing braces
      if (trimmed.startsWith('}')) {
        indent = Math.max(0, indent - 2)
      }

      beautified += ' '.repeat(indent) + trimmed + '\n'

      // Increase indent for opening braces
      if (trimmed.endsWith('{')) {
        indent += 2
      }
    }

    return beautified.trim()
  }

  // History management
  undo() {
    if (this.editHistory.length <= 1) {
      return null // No history to undo to
    }

    this.editHistory.pop() // Remove current state
    const previousState = this.editHistory[this.editHistory.length - 1]

    this.currentCode = previousState.code
    return previousState
  }

  getHistory() {
    return [...this.editHistory]
  }

  clearHistory() {
    this.editHistory = [{ code: this.currentCode, action: 'clear', timestamp: Date.now() }]
  }

  // File operations
  async loadCodeFromFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`)
      }

      const code = fs.readFileSync(filePath, 'utf8')
      return this.updateCode(code, { type: 'file', source: filePath })
    } catch (error) {
      throw new Error(`Failed to load code from file: ${error.message}`)
    }
  }

  async saveCodeToFile(filePath, code = null) {
    try {
      const codeToSave = code || this.currentCode
      const dir = path.dirname(filePath)

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.writeFileSync(filePath, codeToSave, 'utf8')
      return filePath
    } catch (error) {
      throw new Error(`Failed to save code to file: ${error.message}`)
    }
  }

  // Internal methods
  addToHistory(code, action, metadata = {}) {
    const historyEntry = {
      code,
      action,
      timestamp: Date.now(),
      ...metadata
    }

    this.editHistory.push(historyEntry)

    // Maintain history limit
    if (this.editHistory.length > this.maxHistory) {
      this.editHistory.shift()
    }
  }

  calculateChange(oldCode, newCode) {
    // Simple change detection
    if (oldCode === newCode) {
      return { type: 'none' }
    }

    const oldLines = oldCode.split('\n')
    const newLines = newCode.split('\n')

    if (oldLines.length !== newLines.length) {
      return { type: 'lines', count: Math.abs(newLines.length - oldLines.length) }
    }

    let changedLines = 0
    for (let i = 0; i < oldLines.length; i++) {
      if (oldLines[i] !== newLines[i]) {
        changedLines++
      }
    }

    return { type: 'modified', lines: changedLines }
  }

  checkCommonIssues(code) {
    const issues = []

    // Check for missing semicolons (basic check)
    if (!code.endsWith(';') && !code.endsWith('}') && !code.trim().endsWith('\n')) {
      issues.push({
        type: 'style',
        message: 'Consider adding semicolons for consistency',
        line: code.split('\n').length,
        severity: 'warning'
      })
    }

    // Check for very long lines
    const lines = code.split('\n')
    lines.forEach((line, index) => {
      if (line.length > 120) {
        issues.push({
          type: 'style',
          message: `Line ${index + 1} is very long (${line.length} characters)`,
          line: index + 1,
          severity: 'warning'
        })
      }
    })

    return issues
  }

  extractLineFromError(error) {
    const match = error.message.match(/line (\d+)/)
    return match ? parseInt(match[1]) : null
  }

  async createBackup() {
    if (!this.currentApp || !this.currentCode) return

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = `./backups/${this.currentApp.id}_${timestamp}.js`

    try {
      const dir = path.dirname(backupPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.writeFileSync(backupPath, this.currentCode, 'utf8')
      return backupPath
    } catch (error) {
      console.warn('Failed to create backup:', error.message)
      return null
    }
  }

  calculateDistance(pos1, pos2) {
    const [x1, y1, z1] = pos1
    const [x2, y2, z2] = pos2
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2)
  }

  // Events
  on(event, callback) {
    switch (event) {
      case 'codeChange':
        this.onCodeChange = callback
        break
      case 'codeSaved':
        this.onCodeSaved = callback
        break
      case 'codeError':
        this.onCodeError = callback
        break
      case 'appLoaded':
        this.onAppLoaded = callback
        break
      default:
        throw new Error(`Unknown editor event: ${event}`)
    }
  }

  off(event) {
    switch (event) {
      case 'codeChange':
        this.onCodeChange = null
        break
      case 'codeSaved':
        this.onCodeSaved = null
        break
      case 'codeError':
        this.onCodeError = null
        break
      case 'appLoaded':
        this.onAppLoaded = null
        break
      default:
        throw new Error(`Unknown editor event: ${event}`)
    }
  }

  // Debug
  toString() {
    const status = this.isEditing ? 'editing' : 'idle'
    return `AppCodeEditor(${status}, ${this.currentApp?.id || 'no app'})`
  }
}