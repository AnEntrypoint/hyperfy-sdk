import { EntityBuilder, AppBuilder, SDKUtils } from '../src/index.js'

async function entityManagement() {
  console.log('🏗️ Starting Entity Management Example')

  const client = new HyperfyClient('ws://localhost:8080', {
    name: 'Entity Builder Bot'
  })

  try {
    await client.connect()

    // Wait for world to be ready
    await new Promise((resolve) => {
      client.on('ready', resolve)
    })

    console.log('🏗️ Building entities...')

    // Create Entity Builder
    const entityBuilder = new EntityBuilder(client)

    // Build a simple decorative cube
    console.log('📦 Creating decorative cube...')
    const cube = await entityBuilder
      .name('Decorative Cube')
      .position(5, 1, 5)
      .rotation(0, 0.707, 0, 0.707) // 45 degree rotation
      .scale(2, 2, 2)
      .setState({
        color: '#ff0000',
        type: 'decoration',
        interactive: false
      })
      .build()

    console.log(`✅ Created cube: ${cube.id}`)

    // Build multiple entities in a circle
    console.log('⭕ Creating entities in circle...')
    const circleEntities = await entityBuilder
      .position(0, 1, 0)
      .buildCircle(8, 10, (builder, index, angle) => {
        builder
          .name(`Circle Entity ${index + 1}`)
          .randomScale(0.5, 1.5)
          .setState({
            angle: angle,
            circleIndex: index
          })
      })

    console.log(`✅ Created ${circleEntities.length} entities in circle`)

    // Create scattered entities
    console.log('🎲 Creating scattered entities...')
    const scatteredEntities = await entityBuilder
      .randomPosition(20)
      .randomRotation()
      .uniformScale(1)
      .buildMany(5, (builder, index) => {
        builder
          .name(`Scattered Entity ${index + 1}`)
          .setState({
            scatterIndex: index,
            created: Date.now()
          })
      })

    console.log(`✅ Created ${scatteredEntities.length} scattered entities`)

    // Create App Builder
    const appBuilder = new AppBuilder(client)

    // Create a portal app
    console.log('🌀 Creating portal app...')
    const portal = await appBuilder
      .blueprint('portal-blueprint')
      .name('Teleport Portal')
      .position(0, 1, 10)
      .pinned(true)
      .asPortal('destination-world')
      .author('SDK Bot')
      .description('Teleport portal to destination world')
      .build()

    console.log(`✅ Created portal: ${portal.id}`)

    // Create interactive button apps
    console.log('🔘 Creating button apps...')
    const buttons = await appBuilder
      .blueprint('button-blueprint')
      .position(0, 1, 0)
      .buildGrid(3, 2, 3, (builder, row, col) => {
        const colors = ['#ff0000', '#00ff00', '#0000ff']
        const actions = ['teleport', 'spawn', 'message', 'effect', 'sound', 'light']

        builder
          .name(`Button ${row}-${col}`)
          .setBlueprintProp('color', colors[col])
          .setBlueprintProp('action', actions[row * 2 + col])
          .setBlueprintProp('label', `${actions[row * 2 + col].toUpperCase()}`)
          .asButton(actions[row * 2 + col], `${actions[row * 2 + col]} Button`)
      })

    console.log(`✅ Created ${buttons.length} button apps`)

    // Create media apps
    console.log('🖼️ Creating media apps...')
    const mediaApps = await appBuilder
      .blueprint('media-blueprint')
      .name('Media Display')
      .position(-10, 2, 0)
      .asMedia('https://example.com/image.jpg', 'image')
      .setState({
        autoplay: false,
        loop: true,
        volume: 0.5
      })
      .buildMany(3, (builder, index) => {
        builder
          .position(-10 + index * 4, 2, 0)
          .name(`Media ${index + 1}`)
          .setBlueprintProp('url', `https://example.com/media${index + 1}.jpg`)
      })

    console.log(`✅ Created ${mediaApps.length} media apps`)

    // Create game app
    console.log('🎮 Creating game app...')
    const game = await appBuilder
      .blueprint('game-blueprint')
      .name('Mini Game')
      .position(10, 1, 10)
      .asGame('collector', {
        scoreTarget: 100,
        timeLimit: 60,
        difficulty: 'medium'
      })
      .build()

    console.log(`✅ Created game: ${game.id}`)

    // Create spawner app
    console.log('🌟 Creating spawner app...')
    const spawner = await appBuilder
      .blueprint('spawner-blueprint')
      .name('Entity Spawner')
      .position(15, 1, 15)
      .asSpawner('item-blueprint', 3000)
      .setBlueprintProp('maxEntities', 10)
      .setBlueprintProp('spawnRadius', 5)
      .build()

    console.log(`✅ Created spawner: ${spawner.id}`)

    // Demonstrate entity manipulation
    console.log('🔄 Demonstrating entity manipulation...')

    // Move the cube
    const newPos = [cube.getPosition()[0] + 2, 1, cube.getPosition()[2]]
    await cube.setPosition(newPos)
    console.log(`📍 Moved cube to [${newPos.join(', ')}]`)

    // Rotate portal
    const portalRotation = portal.getQuaternion()
    const newRotation = SDKUtils.quaternionMultiply(
      portalRotation,
      SDKUtils.eulerToQuaternion(0, Math.PI / 4, 0)
    )
    await portal.setQuaternion(newRotation)
    console.log('🔄 Rotated portal by 45 degrees')

    // Wait and check entity count
    await new Promise(resolve => setTimeout(resolve, 1000))

    const allEntities = client.getEntities()
    const allApps = client.getApps()

    console.log('📊 Entity Summary:')
    console.log(`   Total entities: ${allEntities.length}`)
    console.log(`   Apps: ${allApps.length}`)
    console.log(`   Other entities: ${allEntities.length - allApps.length}`)

    // Create entity relationships
    console.log('🔗 Creating entity relationships...')

    // Make buttons emit events to portal
    buttons.forEach((button, index) => {
      button.emit('linkedTo', { targetId: portal.id, linkType: 'activation' })
    })

    // Make spawner spawn towards circle
    spawner.setState('targetArea', {
      center: [0, 1, 0],
      radius: 10
    })

    console.log('✅ Entity relationships created')

    // Clean up some entities after demonstration
    console.log('🧹 Cleaning up demo entities...')

    // Remove scattered entities
    for (const entity of scatteredEntities) {
      await entity.remove()
    }
    console.log(`✅ Removed ${scatteredEntities.length} scattered entities`)

    // Keep main entities for manual inspection

    console.log('🎉 Entity management example completed!')
    console.log('📝 Check the world to see the created entities')

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await new Promise(resolve => setTimeout(resolve, 2000))
    client.disconnect()
  }
}

// Mock HyperfyClient for the example
class HyperfyClient {
  constructor(url, options) {
    this.url = url
    this.options = options
    this.entities = new Map()
    this.blueprints = new Map()
    this.player = null
    this.events = new Map()
  }

  async connect() {
    // Mock connection
    await new Promise(resolve => setTimeout(resolve, 100))
    this.mockWorldData()
    return true
  }

  mockWorldData() {
    // Mock player
    this.player = {
      id: 'player-1',
      getName: () => this.options.name,
      getPosition: () => [0, 1, 0],
      setPosition: async (pos) => { /* mock */ },
      getQuaternion: () => [0, 0, 0, 1],
      setQuaternion: async (rot) => { /* mock */ }
    }

    // Mock blueprints
    const blueprints = [
      'portal-blueprint',
      'button-blueprint',
      'media-blueprint',
      'game-blueprint',
      'spawner-blueprint',
      'item-blueprint'
    ]

    blueprints.forEach(id => {
      this.blueprints.set(id, { id, name: id.replace('-blueprint', '') })
    })
  }

  async send(packet, data) {
    console.log(`📡 Sent packet: ${packet}`, data)
    return true
  }

  sendChatMessage(message) {
    return this.send('command', ['chat', message])
  }

  movePlayer(position) {
    return this.player.setPosition(position)
  }

  teleportPlayer(position, rotation) {
    if (rotation) {
      return this.player.setQuaternion(rotation)
    }
    return this.player.setPosition(position)
  }

  getEntities() {
    return Array.from(this.entities.values())
  }

  getApps() {
    return this.getEntities().filter(e => e.type === 'app')
  }

  getPlayers() {
    return this.getEntities().filter(e => e.type === 'player')
  }

  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event).push(callback)

    if (event === 'ready') {
      setTimeout(() => {
        callback({
          player: this.player,
          entities: this.getEntities(),
          blueprints: Array.from(this.blueprints.values())
        })
      }, 100)
    }
  }

  disconnect() {
    console.log('👋 Disconnected')
  }

  getStats() {
    return {
      client: {
        connected: true,
        ready: true,
        playerCount: this.getPlayers().length,
        appCount: this.getApps().length,
        totalEntities: this.entities.size,
        blueprintCount: this.blueprints.size,
        url: this.url
      },
      websocket: {
        connected: true,
        state: 'OPEN',
        reconnectAttempts: 0,
        queueLength: 0
      },
      errors: {
        total: 0,
        recent: []
      }
    }
  }
}

// Add mock Entity and App classes
class MockEntity {
  constructor(data) {
    this.id = data.id
    this.type = data.type || 'entity'
    this.name = data.name || 'Entity'
    this.position = data.position || [0, 0, 0]
    this.quaternion = data.quaternion || [0, 0, 0, 1]
    this.scale = data.scale || [1, 1, 1]
    this.state = data.state || {}
  }

  getName() { return this.name }
  getPosition() { return this.position }
  setPosition(pos) { this.position = pos; return Promise.resolve() }
  getQuaternion() { return this.quaternion }
  setQuaternion(rot) { this.quaternion = rot; return Promise.resolve() }
  getState(key) { return key ? this.state[key] : this.state }
  setState(key, value) { this.state[key] = value; return Promise.resolve() }
  emit(event, data) { console.log(`📡 Emitted ${event}:`, data) }
  remove() { return Promise.resolve() }
}

class MockApp extends MockEntity {
  constructor(data) {
    super(data)
    this.type = 'app'
    this.blueprintId = data.blueprint
    this.pinned = data.pinned || false
  }

  isApp() { return true }
  isPinned() { return this.pinned }
}

// Patch the client's send method to create mock entities
const originalSend = HyperfyClient.prototype.send
HyperfyClient.prototype.send = async function(packet, data) {
  if (packet === 'entityAdded') {
    const entity = data.type === 'app' ? new MockApp(data) : new MockEntity(data)
    this.entities.set(data.id, entity)
  }
  return originalSend.call(this, packet, data)
}

// Run the example
entityManagement().catch(console.error)