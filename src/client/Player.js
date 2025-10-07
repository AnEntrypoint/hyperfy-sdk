import { Entity } from './Entity.js'

export class Player extends Entity {
  constructor(client, data) {
    super(client, data)
    this.type = 'player'
    this.health = data.health || 100
    this.avatar = data.avatar || null
    this.sessionAvatar = data.sessionAvatar || null
    this.rank = data.rank || 0
    this.enteredAt = data.enteredAt || Date.now()
    this.isLocalPlayer = data.id === client.player?.id
  }

  // Player-specific properties
  getHealth() {
    return this.health
  }

  setHealth(health) {
    this.health = health
    return this.sync()
  }

  getAvatar() {
    return this.sessionAvatar || this.avatar
  }

  setAvatar(avatarUrl) {
    this.avatar = avatarUrl
    return this.sync()
  }

  getSessionAvatar() {
    return this.sessionAvatar
  }

  setSessionAvatar(avatarUrl) {
    this.sessionAvatar = avatarUrl
    return this.client.send('playerSessionAvatar', {
      networkId: this.id,
      avatar: avatarUrl
    })
  }

  getRank() {
    return this.rank
  }

  setRank(rank) {
    this.rank = rank
    return this.sync()
  }

  // Rank checking
  isAdmin() {
    return this.rank >= 2
  }

  isBuilder() {
    return this.rank >= 1
  }

  isVisitor() {
    return this.rank === 0
  }

  // Movement methods
  move(position, rotation = null) {
    if (this.isLocalPlayer) {
      return this.setTransform(position, rotation, this.scale)
    } else {
      return this.client.send('playerTeleport', {
        networkId: this.id,
        position,
        rotation
      })
    }
  }

  teleport(data) {
    if (data.position) this.position = [...data.position]
    if (data.quaternion) this.quaternion = [...data.quaternion]
    if (data.scale) this.scale = [...data.scale]

    this.client.emit('playerTeleported', {
      player: this,
      position: this.position,
      quaternion: this.quaternion
    })
  }

  push(force) {
    this.client.emit('playerPushed', {
      player: this,
      force
    })
  }

  // Session time
  getSessionTime() {
    return Date.now() - this.enteredAt
  }

  getFormattedSessionTime() {
    const seconds = Math.floor(this.getSessionTime() / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  // Chat
  sendChatMessage(message) {
    return this.client.sendChatMessage(message)
  }

  sendCommand(command, ...args) {
    return this.client.sendCommand(command, ...args)
  }

  // Permissions
  hasPermission(permission) {
    switch (permission) {
      case 'admin':
        return this.isAdmin()
      case 'build':
        return this.isBuilder()
      case 'chat':
        return true // Everyone can chat by default
      default:
        return false
    }
  }

  // Utility methods
  getDisplayName() {
    return this.name || `Player-${this.id.slice(0, 8)}`
  }

  getRankName() {
    switch (this.rank) {
      case 2:
        return 'Admin'
      case 1:
        return 'Builder'
      default:
        return 'Visitor'
    }
  }

  // Serialization
  toJSON() {
    return {
      ...super.toJSON(),
      health: this.health,
      avatar: this.avatar,
      sessionAvatar: this.sessionAvatar,
      rank: this.rank,
      enteredAt: this.enteredAt,
      isLocalPlayer: this.isLocalPlayer,
      rankName: this.getRankName(),
      displayName: this.getDisplayName()
    }
  }

  // Update from server (override for player-specific data)
  update(data) {
    super.update(data)

    if (data.health !== undefined) this.health = data.health
    if (data.avatar !== undefined) this.avatar = data.avatar
    if (data.sessionAvatar !== undefined) this.sessionAvatar = data.sessionAvatar
    if (data.rank !== undefined) this.rank = data.rank
    if (data.enteredAt !== undefined) this.enteredAt = data.enteredAt
  }

  // Debug
  toString() {
    return `Player(${this.getDisplayName()}, ${this.getRankName()}, ${this.id.slice(0, 8)})`
  }
}