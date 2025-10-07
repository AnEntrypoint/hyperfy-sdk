import { AppCodeEditor, AppTreeView, AppBuilder } from '../src/index.js'

async function appDevelopment() {
  console.log('🔧 Starting App Development Example')

  const client = new HyperfyClient('ws://localhost:8080', {
    name: 'App Developer Bot'
  })

  try {
    await client.connect()

    // Wait for world to be ready
    await new Promise((resolve) => {
      client.on('ready', resolve)
    })

    // Create an app to develop
    console.log('🏗️ Creating app for development...')
    const appBuilder = new AppBuilder(client)

    const app = await appBuilder
      .blueprint('interactive-blueprint')
      .name('Development Test App')
      .position(0, 1, 5)
      .setBlueprintProp('color', '#00ff00')
      .script(`
// Basic interactive app script
export function setup() {
  this.state.clickCount = 0
  this.state.hovered = false
  this.state.lastClick = 0
  console.log('App setup complete')
}

export function update(delta) {
  // Rotate when hovered
  if (this.state.hovered) {
    const rotation = this.getQuaternion()
    const yRotation = delta * 0.002
    const newRotation = [
      rotation[0],
      rotation[1] * Math.cos(yRotation) - rotation[3] * Math.sin(yRotation),
      rotation[2],
      rotation[1] * Math.sin(yRotation) + rotation[3] * Math.cos(yRotation)
    ]
    this.setQuaternion(newRotation)
  }
}

export function onClick() {
  this.state.clickCount++
  this.state.lastClick = Date.now()

  console.log('App clicked!', this.state.clickCount)

  // Emit event to other entities
  this.emit('appClicked', {
    count: this.state.clickCount,
    timestamp: this.state.lastClick,
    appId: this.id
  })

  // Change color
  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff']
  const color = colors[this.state.clickCount % colors.length]
  this.setBlueprintProp('color', color)
}

export function onHover(isHovered) {
  this.state.hovered = isHovered
  console.log(isHovered ? 'Hover started' : 'Hover ended')
}

export function onCollision(otherEntity) {
  console.log('Collision with:', otherEntity.getName())
}

export function onEvent(event, data) {
  console.log('Received event:', event, data)

  if (event === 'reset') {
    this.state.clickCount = 0
    this.setBlueprintProp('color', '#00ff00')
  }
}
      `)
      .build()

    console.log(`✅ Created app: ${app.id}`)

    // Initialize App Code Editor
    console.log('📝 Initializing App Code Editor...')
    const editor = new AppCodeEditor(client)

    // Load the app for editing
    const { code: initialCode } = await editor.loadApp(app.id)
    console.log(`📄 Loaded app code (${initialCode.length} characters)`)

    // Initialize App Tree View
    console.log('🌳 Initializing App Tree View...')
    const treeView = new AppTreeView(client)
    const treeData = await treeView.loadApp(app.id)
    console.log(`🌳 Loaded tree structure with ${countNodes(treeData)} nodes`)

    // Explore tree structure
    console.log('📋 App structure:')
    printTreeStructure(treeData, '')

    // Start editing session
    console.log('✏️ Starting code editing session...')
    await editor.startEditing()

    // Demonstrate code validation
    console.log('✅ Validating current code...')
    const validation = editor.validateCode()
    if (validation.valid) {
      console.log('✅ Code is valid!')
    } else {
      console.log('❌ Code validation errors:')
      validation.errors.forEach(error => {
        console.log(`   - ${error.type}: ${error.message} (line ${error.line})`)
      })
    }

    // Make code improvements
    console.log('🔄 Improving app code...')
    await editor.updateCode(`
// Enhanced interactive app script
export function setup() {
  this.state.clickCount = 0
  this.state.hovered = false
  this.state.lastClick = 0
  this.state.colorIndex = 0
  this.state.score = 0
  this.state.highScore = 0

  console.log('Enhanced app setup complete')

  // Emit setup event
  this.emit('appReady', {
    appId: this.id,
    initialColor: this.getBlueprintProp('color')
  })
}

export function update(delta) {
  // Enhanced rotation when hovered
  if (this.state.hovered) {
    const rotation = this.getQuaternion()
    const yRotation = delta * 0.003 // Faster rotation
    const newRotation = [
      rotation[0],
      rotation[1] * Math.cos(yRotation) - rotation[3] * Math.sin(yRotation),
      rotation[2],
      rotation[1] * Math.sin(yRotation) + rotation[3] * Math.cos(yRotation)
    ]
    this.setQuaternion(newRotation)

    // Pulsing scale effect
    const scale = this.getScale()
    const pulse = Math.sin(Date.now() * 0.005) * 0.1 + 1.0
    this.setScale([scale[0] * pulse, scale[1] * pulse, scale[2] * pulse])
  }
}

export function onClick() {
  this.state.clickCount++
  this.state.lastClick = Date.now()
  this.state.score += 10

  if (this.state.score > this.state.highScore) {
    this.state.highScore = this.state.score
  }

  console.log('App clicked!', {
    count: this.state.clickCount,
    score: this.state.score,
    highScore: this.state.highScore
  })

  // Enhanced event with more data
  this.emit('appClicked', {
    count: this.state.clickCount,
    score: this.state.score,
    highScore: this.state.highScore,
    timestamp: this.state.lastClick,
    appId: this.id,
    position: this.getPosition()
  })

  // Cycle through more colors
  const colors = [
    '#ff0000', '#00ff00', '#0000ff', '#ffff00',
    '#ff00ff', '#00ffff', '#ff8800', '#8800ff'
  ]
  this.state.colorIndex = (this.state.colorIndex + 1) % colors.length
  this.setBlueprintProp('color', colors[this.state.colorIndex])

  // Visual feedback - scale pulse
  const currentScale = this.getScale()
  this.setScale([currentScale[0] * 1.2, currentScale[1] * 1.2, currentScale[2] * 1.2])
  setTimeout(() => {
    this.setScale([1, 1, 1])
  }, 200)
}

export function onHover(isHovered) {
  this.state.hovered = isHovered
  console.log(isHovered ? '✨ Hover started' : '💫 Hover ended')

  this.emit('hoverState', {
    hovered: isHovered,
    timestamp: Date.now()
  })

  // Change appearance on hover
  if (isHovered) {
    this.setBlueprintProp('emissive', true)
    this.setBlueprintProp('emissiveColor', '#ffffff')
  } else {
    this.setBlueprintProp('emissive', false)
  }
}

export function onCollision(otherEntity) {
  console.log('💥 Collision with:', otherEntity.getName())

  // Bounce effect
  const myPos = this.getPosition()
  const otherPos = otherEntity.getPosition()
  const direction = [
    myPos[0] - otherPos[0],
    myPos[1] - otherPos[1],
    myPos[2] - otherPos[2]
  ]

  // Emit collision event
  this.emit('collision', {
    otherEntity: otherEntity.id,
    otherName: otherEntity.getName(),
    direction,
    force: 5.0,
    timestamp: Date.now()
  })
}

export function onEvent(event, data) {
  console.log('📡 Received event:', event, data)

  switch (event) {
    case 'reset':
      this.state.clickCount = 0
      this.state.score = 0
      this.state.colorIndex = 0
      this.setBlueprintProp('color', '#00ff00')
      this.emit('resetComplete')
      break

    case 'setColor':
      if (data.color) {
        this.setBlueprintProp('color', data.color)
      }
      break

    case 'multiplier':
      this.state.score *= (data.multiplier || 2)
      console.log('Score multiplied! New score:', this.state.score)
      break

    case 'gameOver':
      console.log('Game Over! Final score:', this.state.score)
      this.emit('finalScore', {
        score: this.state.score,
        highScore: this.state.highScore,
        clicks: this.state.clickCount
      })
      break

    default:
      console.log('Unknown event:', event, data)
  }
}

export function cleanup() {
  console.log('🧹 App cleanup')
  this.emit('appCleanup')
}
    `, { type: 'enhancement', reason: 'Add features and improvements' })

    // Validate updated code
    console.log('✅ Validating updated code...')
    const updatedValidation = editor.validateCode()
    if (updatedValidation.valid) {
      console.log('✅ Enhanced code is valid!')
    } else {
      console.log('❌ Enhanced code has errors:')
      updatedValidation.errors.forEach(error => {
        console.log(`   - ${error.type}: ${error.message}`)
      })
    }

    // Save the changes
    console.log('💾 Saving app changes...')
    await editor.saveCode({
      validate: true,
      createBackup: true
    })
    console.log('✅ App changes saved successfully!')

    // Demonstrate code templates
    console.log('📋 Demonstrating code templates...')
    const templates = ['basic', 'interactive', 'game', 'portal', 'spawner']

    templates.forEach(templateType => {
      const templateCode = editor.getTemplate(templateType)
      console.log(`📄 ${templateType} template (${templateCode.length} characters)`)
    })

    // Show tree view navigation
    console.log('🌳 Demonstrating tree view navigation...')

    // Find script node
    const scriptNode = treeView.findNode('/script')
    if (scriptNode) {
      console.log(`📄 Found script node with ${scriptNode.children.length} children`)

      // Expand script node
      treeView.expandNode(scriptNode)
      console.log('📂 Expanded script node')

      // Show function nodes
      const functions = treeView.filterNodes(node => node.type === 'function')
      console.log(`🔧 Found ${functions.length} functions:`)
      functions.forEach(func => {
        console.log(`   - ${func.name} (line ${func.metadata.line})`)
      })
    }

    // Export tree data
    console.log('📤 Exporting tree data...')
    const treeExport = treeView.export('text')
    console.log('📄 Tree structure exported:')
    console.log(treeExport.substring(0, 500) + '...')

    // Demonstrate code analysis
    console.log('🔍 Analyzing code structure...')

    const functions = editor.extractFunctions(editor.currentCode)
    console.log(`📊 Found ${functions.length} functions:`)
    functions.forEach(func => {
      console.log(`   - ${func.name}${func.isAsync ? ' (async)' : ''} with ${func.parameters.length} parameters`)
    })

    const imports = editor.extractImports(editor.currentCode)
    const exports = editor.extractExports(editor.currentCode)
    console.log(`📦 Imports: ${imports.length}, Exports: ${exports.length}`)

    // Create backup
    console.log('💾 Creating code backup...')
    const backupPath = await editor.saveCodeToFile('./backups/app-backup.js')
    console.log(`✅ Backup saved to: ${backupPath}`)

    // Demonstrate history
    console.log('📚 Showing edit history...')
    const history = editor.getHistory()
    console.log(`📝 Edit history contains ${history.length} entries:`)
    history.slice(-3).forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.action} at ${new Date(entry.timestamp).toLocaleTimeString()}`)
    })

    // Wait for user to see the results
    console.log('⏳ App development demo complete. Check the world to see the enhanced app!')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Reset the app to show state management
    console.log('🔄 Resetting app state...')
    app.emit('reset', {})

    await new Promise(resolve => setTimeout(resolve, 1000))

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  } finally {
    await new Promise(resolve => setTimeout(resolve, 2000))
    client.disconnect()
  }
}

// Helper functions
function countNodes(node) {
  if (!node) return 0
  let count = 1
  if (node.children) {
    node.children.forEach(child => {
      count += countNodes(child)
    })
  }
  return count
}

function printTreeStructure(node, indent) {
  console.log(`${indent}${node.name} (${node.type})`)
  if (node.children && node.children.length > 0) {
    node.children.forEach(child => {
      printTreeStructure(child, indent + '  ')
    })
  }
}

// Mock implementation for standalone example
class HyperfyClient {
  constructor(url, options) {
    this.url = url
    this.options = options
    this.entities = new Map()
    this.blueprints = new Map()
    this.events = new Map()
  }

  async connect() {
    await new Promise(resolve => setTimeout(resolve, 100))
    this.mockWorldData()
    return true
  }

  mockWorldData() {
    this.blueprints.set('interactive-blueprint', {
      id: 'interactive-blueprint',
      name: 'Interactive App',
      script: '// Initial script'
    })
  }

  async send(packet, data) {
    console.log(`📡 Sent packet: ${packet}`, data)
    return true
  }

  getEntity(id) {
    return this.entities.get(id)
  }

  getEntities() {
    return Array.from(this.entities.values())
  }

  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event).push(callback)

    if (event === 'ready') {
      setTimeout(() => {
        callback({
          player: { id: 'player-1', getName: () => this.options.name },
          entities: this.getEntities(),
          blueprints: Array.from(this.blueprints.values())
        })
      }, 100)
    }
  }

  disconnect() {
    console.log('👋 Disconnected')
  }
}

class MockApp {
  constructor(data) {
    this.id = data.id
    this.blueprintId = data.blueprint
    this.state = {}
    this.position = data.position || [0, 0, 0]
    this.quaternion = data.quaternion || [0, 0, 0, 1]
    this.scale = data.scale || [1, 1, 1]
  }

  isApp() { return true }
  getBlueprintProp(key) { return this.state[key] }
  setBlueprintProp(key, value) {
    this.state[key] = value
    console.log(`🔧 Set ${key} = ${value}`)
  }
  getPosition() { return this.position }
  getQuaternion() { return this.quaternion }
  getScale() { return this.scale }
  setPosition(pos) { this.position = pos }
  setQuaternion(rot) { this.quaternion = rot }
  setScale(scale) { this.scale = scale }
  emit(event, data) { console.log(`📡 Emitted ${event}:`, data) }
}

// Patch client to create mock app
const originalSend = HyperfyClient.prototype.send
HyperfyClient.prototype.send = async function(packet, data) {
  if (packet === 'entityAdded') {
    const app = new MockApp(data)
    this.entities.set(data.id, app)
  } else if (packet === 'blueprintModified') {
    const blueprint = this.blueprints.get(data.id)
    if (blueprint) {
      blueprint.script = data.script
      blueprint.version = data.version
    }
  }
  return originalSend.call(this, packet, data)
}

// Run the example
appDevelopment().catch(console.error)