import { HyperfyClient } from '../src/index.js'

async function basicUsage() {
  console.log('🚀 Starting Hyperfy SDK Basic Usage Example')

  // Create client instance
  const client = new HyperfyClient('ws://localhost:8080', {
    name: 'SDK Bot',
    avatar: 'https://example.com/bot-avatar.png',
    autoReconnect: true
  })

  try {
    // Connect to the world
    console.log('📡 Connecting to world...')
    await client.connect()
    console.log('✅ Connected successfully!')

    // Wait for world to be ready
    await new Promise((resolve) => {
      client.on('ready', (data) => {
        console.log(`🌍 World ready!`)
        console.log(`   Player: ${data.player.getDisplayName()}`)
        console.log(`   Entities: ${data.entities.length}`)
        console.log(`   Blueprints: ${data.blueprints.length}`)
        resolve()
      })
    })

    // Get current player position
    const playerPos = client.player.getPosition()
    console.log(`📍 Current position: [${playerPos.join(', ')}]`)

    // Move player around
    console.log('🚶 Moving player...')
    await client.movePlayer([10, 1, 10])
    console.log('✅ Player moved to [10, 1, 10]')

    // Teleport player
    console.log('🌀 Teleporting player...')
    await client.teleportPlayer([0, 5, 0], [0, 1, 0, 0])
    console.log('✅ Player teleported to [0, 5, 0]')

    // Send chat message
    console.log('💬 Sending chat message...')
    await client.sendChatMessage('Hello from Hyperfy Node.js SDK!')
    console.log('✅ Chat message sent')

    // List all entities
    const entities = client.getEntities()
    console.log(`📦 Found ${entities.length} entities:`)
    entities.forEach(entity => {
      console.log(`   - ${entity.getName()} (${entity.type}) at [${entity.getPosition().join(', ')}]`)
    })

    // List players
    const players = client.getPlayers()
    console.log(`👥 Found ${players.length} players:`)
    players.forEach(player => {
      console.log(`   - ${player.getDisplayName()} (${player.getRankName()})`)
    })

    // List apps
    const apps = client.getApps()
    console.log(`🎮 Found ${apps.length} apps:`)
    apps.forEach(app => {
      console.log(`   - ${app.getBlueprintName()} (pinned: ${app.isPinned()})`)
    })

    // Get client statistics
    const stats = client.getStats()
    console.log('📊 Client Statistics:')
    console.log(`   Connected: ${stats.client.connected}`)
    console.log(`   Ready: ${stats.client.ready}`)
    console.log(`   WebSocket state: ${stats.websocket.state}`)

    // Wait a bit before disconnecting
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Disconnect
    console.log('👋 Disconnecting...')
    client.disconnect()
    console.log('✅ Disconnected successfully')

  } catch (error) {
    console.error('❌ Error:', error.message)
    client.disconnect()
  }
}

// Run the example
basicUsage().catch(console.error)