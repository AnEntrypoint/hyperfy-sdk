import { WorldManager, SDKUtils } from '../src/index.js'

async function worldAnalysis() {
  console.log('🌍 Starting World Analysis Example')

  const client = new HyperfyClient('ws://localhost:8080', {
    name: 'World Analyst Bot'
  })

  try {
    await client.connect()

    // Wait for world to be ready
    await new Promise((resolve) => {
      client.on('ready', resolve)
    })

    // Initialize World Manager
    console.log('🔍 Initializing World Manager...')
    const worldManager = new WorldManager(client)

    // Start event monitoring
    console.log('📡 Starting event monitoring...')
    worldManager.startEventMonitoring()

    // Monitor world events
    worldManager.onWorldUpdate = (worldInfo) => {
      console.log(`🌍 World updated: ${worldInfo.playerCount} players, ${worldInfo.appCount} apps`)
    }

    worldManager.onEntityAdded = (entity) => {
      console.log(`➕ Entity added: ${entity.getName()} (${entity.type})`)
    }

    worldManager.onEntityRemoved = (entity) => {
      console.log(`➖ Entity removed: ${entity.getName()} (${entity.type})`)
    }

    // Get initial world information
    console.log('📊 Getting world information...')
    const worldInfo = worldManager.getWorldInfo()
    console.log('🌍 World Information:')
    console.log(`   Connected: ${worldInfo.connected}`)
    console.log(`   Ready: ${worldInfo.ready}`)
    console.log(`   Players: ${worldInfo.playerCount}`)
    console.log(`   Apps: ${worldInfo.appCount}`)
    console.log(`   Total Entities: ${worldInfo.totalEntities}`)
    console.log(`   Blueprints: ${worldInfo.blueprintCount}`)

    // Analyze world statistics
    console.log('📈 Analyzing world statistics...')
    const stats = worldManager.getWorldStats()
    console.log('📊 World Statistics:')
    console.log(`   Total Entities: ${stats.total}`)
    console.log(`   Players: ${stats.players}`)
    console.log(`   Apps: ${stats.apps}`)
    console.log(`   Other Entities: ${stats.other}`)

    // Player rank distribution
    console.log('👥 Player Rank Distribution:')
    console.log(`   Admins: ${stats.playerRanks.admin}`)
    console.log(`   Builders: ${stats.playerRanks.builder}`)
    console.log(`   Visitors: ${stats.playerRanks.visitor}`)

    // Blueprint usage
    console.log('📦 Blueprint Usage:')
    Object.entries(stats.blueprintUsage).forEach(([blueprintId, count]) => {
      console.log(`   ${blueprintId}: ${count} apps`)
    })

    // Spatial analysis
    if (stats.spatialDistribution) {
      console.log('📍 Spatial Distribution:')
      console.log(`   World Center: [${stats.spatialDistribution.center.map(n => n.toFixed(1)).join(', ')}]`)
      console.log(`   Average Distance: ${stats.spatialDistribution.averageDistance.toFixed(1)} units`)
      console.log(`   Max Distance: ${stats.spatialDistribution.maxDistance.toFixed(1)} units`)
      console.log(`   Min Distance: ${stats.spatialDistribution.minDistance.toFixed(1)} units`)
      console.log(`   World Spread: ${stats.spatialDistribution.spread.toFixed(1)} units`)
    }

    // Player distance analysis
    if (stats.playerDistance) {
      console.log('👥 Player Distance Analysis:')
      console.log(`   Nearest Player: ${stats.playerDistance.nearest.toFixed(1)} units`)
      console.log(`   Farthest Player: ${stats.playerDistance.farthest.toFixed(1)} units`)
      console.log(`   Average Distance: ${stats.playerDistance.average.toFixed(1)} units`)
      console.log(`   Other Players: ${stats.playerDistance.count}`)
    }

    // Create mock entities for demonstration
    console.log('🏗️ Creating mock entities for analysis...')
    await createMockEntities(client)

    // Find entities near player
    console.log('🔍 Finding entities near player...')
    const nearbyEntities = worldManager.findEntitiesNear([0, 1, 0], 20)
    console.log(`📍 Found ${nearbyEntities.length} entities within 20 units:`)
    nearbyEntities.forEach(({ entity, distance }) => {
      console.log(`   - ${entity.getName()} (${entity.type}) at ${distance.toFixed(1)} units`)
    })

    // Find entities in specific area
    console.log('🗺️ Finding entities in area...')
    const areaEntities = worldManager.getEntitiesInArea([0, 1, 0], [20, 10, 20])
    console.log(`📍 Found ${areaEntities.length} entities in 20x10x20 area`)

    // Find entities in sphere
    console.log('🌐 Finding entities in sphere...')
    const sphereEntities = worldManager.getEntitiesInSphere([0, 1, 0], 15)
    console.log(`📍 Found ${sphereEntities.length} entities within 15 unit sphere`)

    // Analyze players by rank
    console.log('👑 Analyzing players by rank...')
    const admins = worldManager.getPlayersByRank('admin')
    const builders = worldManager.getPlayersByRank('builder')
    const visitors = worldManager.getPlayersByRank('visitor')

    console.log(`   Admins: ${admins.length}`)
    console.log(`   Builders: ${builders.length}`)
    console.log(`   Visitors: ${visitors.length}`)

    // Analyze apps by blueprint
    console.log('🎮 Analyzing apps by blueprint...')
    const blueprintUsage = {}
    client.getApps().forEach(app => {
      const bpId = app.blueprintId
      blueprintUsage[bpId] = (blueprintUsage[bpId] || 0) + 1
    })

    console.log('   Blueprint Usage:')
    Object.entries(blueprintUsage).forEach(([blueprintId, count]) => {
      console.log(`     ${blueprintId}: ${count} apps`)
    })

    // Find pinned apps
    const pinnedApps = worldManager.getPinnedApps()
    console.log(`📌 Found ${pinnedApps.length} pinned apps`)

    // Find apps by author
    console.log('👤 Finding apps by author...')
    const appsByAuthor = {}
    client.getApps().forEach(app => {
      const author = app.getBlueprintAuthor()
      appsByAuthor[author] = (appsByAuthor[author] || 0) + 1
    })

    console.log('   Apps by Author:')
    Object.entries(appsByAuthor).forEach(([author, count]) => {
      console.log(`     ${author}: ${count} apps`)
    })

    // Start auto-refresh
    console.log('🔄 Starting auto-refresh...')
    worldManager.startAutoRefresh(2000) // Refresh every 2 seconds

    // Monitor changes for a few seconds
    console.log('📡 Monitoring world changes for 10 seconds...')
    await new Promise(resolve => setTimeout(resolve, 10000))

    // Stop auto-refresh
    console.log('⏹️ Stopping auto-refresh...')
    worldManager.stopAutoRefresh()

    // Export world state
    console.log('📤 Exporting world state...')
    const worldExport = worldManager.exportWorldState('json')
    console.log(`📄 World state exported (${worldExport.length} characters)`)

    // Generate world summary
    console.log('📋 Generating world summary...')
    const worldSummary = worldManager.exportWorldState('summary')
    console.log('📄 World Summary:')
    console.log(worldSummary)

    // Demonstrate teleportation features
    console.log('🌀 Demonstrating teleportation features...')
    if (client.getEntities().length > 0) {
      const targetEntity = client.getEntities()[0]
      console.log(`🎯 Teleporting to ${targetEntity.getName()}...`)
      await worldManager.teleportTo(targetEntity, [3, 0, 3])
      console.log('✅ Teleported successfully')
    }

    // Find and teleport to entity by name
    const targetName = 'Test Entity'
    const foundEntities = worldManager.findEntitiesByName(targetName)
    if (foundEntities.length > 0) {
      console.log(`🔍 Found entity "${targetName}" and teleporting...`)
      await worldManager.findAndTeleport(targetName)
      console.log('✅ Teleported to named entity')
    } else {
      console.log(`❌ No entity found with name "${targetName}"`)
    }

    // Demonstrate entity movement simulation
    console.log('🎬 Simulating entity movement...')
    if (client.getEntities().length > 0) {
      const moveEntity = client.getEntities()[0]
      const targetPosition = [10, 1, 10]

      console.log(`🚶 Moving ${moveEntity.getName()} to [${targetPosition.join(', ')}]...`)
      await worldManager.simulateEntityMovement(moveEntity.id, targetPosition, 3000)
      console.log('✅ Entity movement simulation complete')
    }

    // Final statistics
    console.log('📊 Final world analysis:')
    const finalStats = worldManager.getWorldStats()
    console.log(`   Total Entities: ${finalStats.total}`)
    console.log(`   Players: ${finalStats.players}`)
    console.log(`   Apps: ${finalStats.apps}`)
    console.log(`   Spatial Spread: ${finalStats.spatialDistribution?.spread.toFixed(1) || 'N/A'} units`)

    // Cleanup
    console.log('🧹 Cleaning up World Manager...')
    worldManager.destroy()

    console.log('🎉 World analysis example completed!')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  } finally {
    await new Promise(resolve => setTimeout(resolve, 2000))
    client.disconnect()
  }
}

// Helper function to create mock entities
async function createMockEntities(client) {
  const mockEntities = [
    {
      id: 'player-1',
      type: 'player',
      name: 'TestPlayer',
      position: [0, 1, 0],
      rank: 'visitor'
    },
    {
      id: 'app-1',
      type: 'app',
      name: 'Test App 1',
      position: [5, 1, 5],
      blueprintId: 'blueprint-1',
      pinned: true,
      blueprint: { author: 'SDK Bot', name: 'Test Blueprint 1' }
    },
    {
      id: 'app-2',
      type: 'app',
      name: 'Test App 2',
      position: [-5, 1, -5],
      blueprintId: 'blueprint-2',
      pinned: false,
      blueprint: { author: 'Another Author', name: 'Test Blueprint 2' }
    },
    {
      id: 'entity-1',
      type: 'entity',
      name: 'Decorative Cube',
      position: [10, 1, 0]
    },
    {
      id: 'entity-2',
      type: 'entity',
      name: 'Test Entity',
      position: [0, 1, 10]
    },
    {
      id: 'player-2',
      type: 'player',
      name: 'AdminUser',
      position: [15, 1, 15],
      rank: 'admin'
    },
    {
      id: 'player-3',
      type: 'player',
      name: 'BuilderUser',
      position: [-10, 1, -10],
      rank: 'builder'
    }
  ]

  mockEntities.forEach(entityData => {
    const entity = createMockEntity(entityData)
    client.entities.set(entityData.id, entity)

    // Simulate entity addition event
    setTimeout(() => {
      if (client.worldManager) {
        client.worldManager.emit('entityAdded', entity)
      }
    }, Math.random() * 1000)
  })
}

// Mock entity factory
function createMockEntity(data) {
  const entity = {
    id: data.id,
    type: data.type,
    getName: () => data.name,
    getPosition: () => data.position,
    setPosition: async (pos) => { data.position = pos; },
    getQuaternion: () => [0, 0, 0, 1],
    setQuaternion: async (rot) => { /* mock */ },
    getScale: () => [1, 1, 1],
    getState: () => data.state || {},
    distanceTo: (other) => SDKUtils.distance(data.position, other.getPosition())
  }

  if (data.type === 'player') {
    entity.isPlayer = () => true
    entity.isApp = () => false
    entity.getRankName = () => data.rank?.toLowerCase() || 'visitor'
    entity.isAdmin = () => data.rank === 'admin'
    entity.isBuilder = () => data.rank === 'builder'
    entity.isVisitor = () => !data.rank || data.rank === 'visitor'
    entity.getDisplayName = () => data.name
    entity.getFormattedSessionTime = () => '5m 23s'
  } else if (data.type === 'app') {
    entity.isApp = () => true
    entity.isPlayer = () => false
    entity.blueprintId = data.blueprintId
    entity.isPinned = () => data.pinned || false
    entity.isBeingUploaded = () => false
    entity.getBlueprintName = () => data.blueprint?.name || 'Unknown Blueprint'
    entity.getBlueprintAuthor = () => data.blueprint?.author || 'Unknown Author'
    entity.getBlueprintProp = (key) => data.blueprint?.[key] || null
    entity.setBlueprintProp = (key, value) => {
      if (!data.blueprint) data.blueprint = {}
      data.blueprint[key] = value
    }
    entity.emit = (event, eventData) => {
      console.log(`📡 App ${entity.id} emitted ${event}:`, eventData)
    }
  } else {
    entity.isApp = () => false
    entity.isPlayer = () => false
  }

  return entity
}

// Mock HyperfyClient for the example
class HyperfyClient {
  constructor(url, options) {
    this.url = url
    this.options = options
    this.entities = new Map()
    this.blueprints = new Map()
    this.events = new Map()
    this.worldManager = null
  }

  async connect() {
    await new Promise(resolve => setTimeout(resolve, 100))
    return true
  }

  async send(packet, data) {
    console.log(`📡 Sent packet: ${packet}`, data)
    return true
  }

  movePlayer(position) {
    return this.send('playerMove', position)
  }

  teleportPlayer(position, rotation) {
    return this.send('playerTeleport', { position, rotation })
  }

  getEntity(id) {
    return this.entities.get(id)
  }

  getEntities() {
    return Array.from(this.entities.values())
  }

  getApps() {
    return this.getEntities().filter(e => e.isApp())
  }

  getPlayers() {
    return this.getEntities().filter(e => e.isPlayer())
  }

  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event).push(callback)

    if (event === 'ready') {
      setTimeout(() => {
        callback({
          player: this.getEntity('player-1'),
          entities: this.getEntities(),
          blueprints: Array.from(this.blueprints.values())
        })
      }, 100)
    }
  }

  emit(event, data) {
    if (this.events.has(event)) {
      this.events.get(event).forEach(callback => callback(data))
    }
  }

  disconnect() {
    console.log('👋 Disconnected')
  }
}

// Add EventEmitter functionality
HyperfyClient.prototype.on = HyperfyClient.prototype.on
HyperfyClient.prototype.emit = HyperfyClient.prototype.emit

// Run the example
worldAnalysis().catch(console.error)