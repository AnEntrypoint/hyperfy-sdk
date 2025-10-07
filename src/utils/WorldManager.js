import { SDKUtils } from './SDKUtils.js'

export class WorldManager {
  constructor(client) {
    this.client = client
    this.worldInfo = null
    this.entitiesCache = new Map()
    this.lastUpdate = 0
    this.autoRefresh = false
    this.refreshInterval = 5000

    // Event handlers
    this.onWorldUpdate = null
    this.onEntityAdded = null
    this.onEntityRemoved = null
    this.onEntityModified = null
  }

  // World information
  getWorldInfo() {
    if (!this.worldInfo) {
      this.worldInfo = this.extractWorldInfo()
    }
    return this.worldInfo
  }

  extractWorldInfo() {
    const snapshot = {
      playerCount: this.client.getPlayers().length,
      appCount: this.client.getApps().length,
      totalEntities: this.client.entities.size,
      blueprintCount: this.client.blueprints.size,
      connected: this.client.isConnected(),
      ready: this.client.isReady(),
      url: this.client.url,
      timestamp: Date.now()
    }

    if (this.client.player) {
      snapshot.playerId = this.client.player.id
      snapshot.playerName = this.client.player.getName()
      snapshot.playerRank = this.client.player.getRankName()
    }

    return snapshot
  }

  // Entity management with caching
  refreshCache() {
    this.entitiesCache.clear()
    this.client.entities.forEach((entity, id) => {
      this.entitiesCache.set(id, this.createEntitySummary(entity))
    })
    this.lastUpdate = Date.now()
    return this.entitiesCache
  }

  createEntitySummary(entity) {
    const summary = {
      id: entity.id,
      type: entity.type,
      name: entity.getName(),
      position: entity.getPosition(),
      distance: this.client.player ?
        SDKUtils.distance(this.client.player.getPosition(), entity.getPosition()) :
        null,
      lastSeen: Date.now()
    }

    if (entity.isApp()) {
      summary.blueprintId = entity.blueprintId
      summary.blueprintName = entity.getBlueprintName()
      summary.pinned = entity.isPinned()
      summary.uploading = entity.isBeingUploaded()
    }

    if (entity.isPlayer()) {
      summary.displayName = entity.getDisplayName()
      summary.rank = entity.getRankName()
      summary.sessionTime = entity.getFormattedSessionTime()
    }

    return summary
  }

  // Entity discovery
  findEntitiesNear(position, radius) {
    const nearby = []
    this.client.entities.forEach(entity => {
      const distance = SDKUtils.distance(position, entity.getPosition())
      if (distance <= radius) {
        nearby.push({ entity, distance })
      }
    })
    return nearby.sort((a, b) => a.distance - b.distance)
  }

  findEntitiesByType(type) {
    return this.client.getEntitiesByType(type)
  }

  findEntitiesByName(name, exact = false) {
    const entities = this.client.getEntities()
    return entities.filter(entity => {
      const entityName = entity.getName()
      return exact ? entityName === name :
                     entityName.toLowerCase().includes(name.toLowerCase())
    })
  }

  findEntitiesInRange(minDistance, maxDistance = Infinity) {
    if (!this.client.player) return []

    const playerPos = this.client.player.getPosition()
    const inRange = []

    this.client.entities.forEach(entity => {
      if (entity.id === this.client.player.id) return

      const distance = SDKUtils.distance(playerPos, entity.getPosition())
      if (distance >= minDistance && distance <= maxDistance) {
        inRange.push({ entity, distance })
      }
    })

    return inRange.sort((a, b) => a.distance - b.distance)
  }

  // Spatial queries
  getEntitiesInArea(center, size) {
    const [cx, cy, cz] = center
    const [sx, sy, sz] = size

    return this.client.entities.filter(entity => {
      const [x, y, z] = entity.getPosition()
      return x >= cx - sx/2 && x <= cx + sx/2 &&
             y >= cy - sy/2 && y <= cy + sy/2 &&
             z >= cz - sz/2 && z <= cz + sz/2
    })
  }

  getEntitiesInSphere(center, radius) {
    return this.client.entities.filter(entity => {
      const distance = SDKUtils.distance(center, entity.getPosition())
      return distance <= radius
    })
  }

  // Player management
  getPlayersInRange(radius) {
    const results = this.findEntitiesInRange(0, radius)
    return results
      .filter(r => r.entity.isPlayer())
      .map(r => ({ player: r.entity, distance: r.distance }))
  }

  getPlayersByRank(rank) {
    return this.client.getPlayers().filter(player => {
      switch (rank) {
        case 'admin': return player.isAdmin()
        case 'builder': return player.isBuilder()
        case 'visitor': return player.isVisitor()
        default: return player.getRankName().toLowerCase() === rank.toLowerCase()
      }
    })
  }

  // App management
  getAppsByBlueprint(blueprintId) {
    return this.client.getApps().filter(app => app.blueprintId === blueprintId)
  }

  getAppsByAuthor(author) {
    return this.client.getApps().filter(app =>
      app.getBlueprintAuthor() === author
    )
  }

  getPinnedApps() {
    return this.client.getApps().filter(app => app.isPinned())
  }

  getUploadingApps() {
    return this.client.getApps().filter(app => app.isBeingUploaded())
  }

  // World state analysis
  getWorldStats() {
    const entities = this.client.getEntities()
    const players = this.client.getPlayers()
    const apps = this.client.getApps()

    const stats = {
      total: entities.length,
      players: players.length,
      apps: apps.length,
      other: entities.length - players.length - apps.length,
      playerRanks: this.countPlayerRanks(players),
      blueprintUsage: this.countBlueprintUsage(apps),
      spatialDistribution: this.analyzeSpatialDistribution(entities)
    }

    if (this.client.player) {
      stats.playerDistance = this.calculatePlayerDistances()
      stats.nearbyEntities = this.findEntitiesInRange(0, 50).length
    }

    return stats
  }

  countPlayerRanks(players) {
    const ranks = { admin: 0, builder: 0, visitor: 0 }
    players.forEach(player => {
      if (player.isAdmin()) ranks.admin++
      else if (player.isBuilder()) ranks.builder++
      else ranks.visitor++
    })
    return ranks
  }

  countBlueprintUsage(apps) {
    const usage = {}
    apps.forEach(app => {
      const bpId = app.blueprintId
      usage[bpId] = (usage[bpId] || 0) + 1
    })
    return usage
  }

  analyzeSpatialDistribution(entities) {
    if (entities.length === 0) return null

    const positions = entities.map(e => e.getPosition())
    const center = this.calculateCenter(positions)
    const distances = positions.map(pos => SDKUtils.distance(center, pos))

    return {
      center,
      averageDistance: distances.reduce((sum, d) => sum + d, 0) / distances.length,
      maxDistance: Math.max(...distances),
      minDistance: Math.min(...distances),
      spread: Math.max(...distances) - Math.min(...distances)
    }
  }

  calculateCenter(positions) {
    const sum = positions.reduce((acc, pos) => [
      acc[0] + pos[0],
      acc[1] + pos[1],
      acc[2] + pos[2]
    ], [0, 0, 0])

    return sum.map(coord => coord / positions.length)
  }

  calculatePlayerDistances() {
    if (!this.client.player) return null

    const playerPos = this.client.player.getPosition()
    const distances = this.client.getPlayers()
      .filter(p => p.id !== this.client.player.id)
      .map(player => SDKUtils.distance(playerPos, player.getPosition()))

    if (distances.length === 0) return null

    return {
      nearest: Math.min(...distances),
      farthest: Math.max(...distances),
      average: distances.reduce((sum, d) => sum + d, 0) / distances.length,
      count: distances.length
    }
  }

  // World interactions
  async teleportTo(entity, offset = [2, 0, 0]) {
    if (!this.client.player) {
      throw new Error('No player available for teleportation')
    }

    const targetPos = entity.getPosition()
    const finalPos = [
      targetPos[0] + offset[0],
      targetPos[1] + offset[1],
      targetPos[2] + offset[2]
    ]

    return this.client.teleportPlayer(finalPos)
  }

  async teleportToPosition(position) {
    if (!this.client.player) {
      throw new Error('No player available for teleportation')
    }

    return this.client.teleportPlayer(position)
  }

  async findAndTeleport(entityName, maxDistance = 100) {
    const entities = this.findEntitiesByName(entityName)
    if (entities.length === 0) {
      throw new Error(`No entity found with name: ${entityName}`)
    }

    // Find nearest entity
    const nearby = this.findEntitiesInRange(0, maxDistance)
      .filter(r => r.entity.getName().toLowerCase().includes(entityName.toLowerCase()))

    if (nearby.length === 0) {
      throw new Error(`No entity named "${entityName}" found within ${maxDistance} units`)
    }

    return this.teleportTo(nearby[0].entity)
  }

  // Auto-refresh functionality
  startAutoRefresh(interval = null) {
    if (interval) this.refreshInterval = interval
    this.autoRefresh = true

    this.refreshTimer = setInterval(() => {
      this.refreshCache()
      if (this.onWorldUpdate) {
        this.onWorldUpdate(this.getWorldInfo())
      }
    }, this.refreshInterval)
  }

  stopAutoRefresh() {
    this.autoRefresh = false
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  // Event monitoring
  startEventMonitoring() {
    this.client.on('entityAdded', (entity) => {
      this.entitiesCache.set(entity.id, this.createEntitySummary(entity))
      if (this.onEntityAdded) this.onEntityAdded(entity)
    })

    this.client.on('entityRemoved', (entity) => {
      this.entitiesCache.delete(entity.id)
      if (this.onEntityRemoved) this.onEntityRemoved(entity)
    })

    this.client.on('entityModified', (entity) => {
      this.entitiesCache.set(entity.id, this.createEntitySummary(entity))
      if (this.onEntityModified) this.onEntityModified(entity)
    })
  }

  stopEventMonitoring() {
    // Remove all listeners
    this.client.removeAllListeners('entityAdded')
    this.client.removeAllListeners('entityRemoved')
    this.client.removeAllListeners('entityModified')
  }

  // World simulation
  simulateEntityMovement(entityId, path, duration = 5000) {
    const entity = this.client.getEntity(entityId)
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`)
    }

    const steps = 60
    const stepDelay = duration / steps
    const currentPosition = entity.getPosition()

    return new Promise((resolve) => {
      let currentStep = 0

      const moveStep = () => {
        if (currentStep >= steps) {
          resolve(entity)
          return
        }

        const t = currentStep / steps
        const position = SDKUtils.lerpVector3(currentPosition, path, t)

        entity.setPosition(position)
        currentStep++
        setTimeout(moveStep, stepDelay)
      }

      moveStep()
    })
  }

  // Export and utilities
  exportWorldState(format = 'json') {
    const worldState = {
      timestamp: Date.now(),
      worldInfo: this.getWorldInfo(),
      entities: Array.from(this.entitiesCache.values()),
      stats: this.getWorldStats()
    }

    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(worldState, null, 2)
      case 'summary':
        return this.generateWorldSummary(worldState)
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  generateWorldSummary(worldState) {
    const { worldInfo, entities, stats } = worldState

    let summary = `World Summary - ${new Date().toLocaleString()}\n`
    summary += `${'='.repeat(50)}\n\n`
    summary += `Players: ${stats.players} (Admins: ${stats.playerRanks.admin}, Builders: ${stats.playerRanks.builder})\n`
    summary += `Apps: ${stats.apps}\n`
    summary += `Total Entities: ${stats.total}\n\n`

    if (stats.spatialDistribution) {
      summary += `World Center: ${stats.spatialDistribution.center.map(n => n.toFixed(1)).join(', ')}\n`
      summary += `World Spread: ${stats.spatialDistribution.spread.toFixed(1)} units\n`
    }

    return summary
  }

  // Cleanup
  destroy() {
    this.stopAutoRefresh()
    this.stopEventMonitoring()
    this.entitiesCache.clear()
    this.worldInfo = null
  }

  // Debug
  toString() {
    const stats = this.getWorldStats()
    return `WorldManager(${stats.total} entities, ${stats.players} players, ${stats.apps} apps)`
  }
}