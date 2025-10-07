import WebSocket from 'ws'
import { EventEmitter } from 'eventemitter3'
import { Packets } from '../protocol/Packets.js'

export class WebSocketManager extends EventEmitter {
  constructor(url, options = {}) {
    super()
    this.url = url
    this.options = options
    this.ws = null
    this.connected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5
    this.reconnectDelay = options.reconnectDelay || 1000
    this.heartbeatInterval = options.heartbeatInterval || 30000
    this.heartbeatTimer = null
    this.queue = []
    this.processingQueue = false
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)
        this.ws.binaryType = 'arraybuffer'

        this.ws.on('open', () => {
          console.log('WebSocket connected')
          this.connected = true
          this.reconnectAttempts = 0
          this.startHeartbeat()
          this.processQueue()
          this.emit('connected')
          resolve()
        })

        this.ws.on('message', (data) => {
          this.handleMessage(data)
        })

        this.ws.on('close', (code, reason) => {
          console.log(`WebSocket disconnected: ${code} - ${reason}`)
          this.connected = false
          this.stopHeartbeat()
          this.emit('disconnected', { code, reason })

          if (this.shouldReconnect()) {
            this.scheduleReconnect()
          }
        })

        this.ws.on('error', (error) => {
          console.error('WebSocket error:', error)
          this.emit('error', error)
          if (!this.connected) {
            reject(error)
          }
        })

      } catch (error) {
        reject(error)
      }
    })
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting')
      this.ws = null
    }
    this.connected = false
    this.stopHeartbeat()
    this.emit('disconnected')
  }

  send(packetName, data) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queue.push({ packetName, data })
      return false
    }

    try {
      const packet = Packets.writePacket(packetName, data)
      this.ws.send(packet)
      return true
    } catch (error) {
      console.error('Failed to send packet:', error)
      this.emit('error', error)
      return false
    }
  }

  sendRaw(packet) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false
    }

    try {
      this.ws.send(packet)
      return true
    } catch (error) {
      console.error('Failed to send raw packet:', error)
      this.emit('error', error)
      return false
    }
  }

  handleMessage(data) {
    try {
      const [method, payload] = Packets.readPacket(data)
      if (method) {
        this.emit('packet', { method, payload })
        this.emit(method, payload)
      }
    } catch (error) {
      console.error('Failed to handle message:', error)
      this.emit('error', error)
    }
  }

  processQueue() {
    if (this.processingQueue || this.queue.length === 0) {
      return
    }

    this.processingQueue = true

    while (this.queue.length > 0) {
      const { packetName, data } = this.queue.shift()
      this.send(packetName, data)
    }

    this.processingQueue = false
  }

  startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.send('ping', Date.now())
    }, this.heartbeatInterval)
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  shouldReconnect() {
    return this.reconnectAttempts < this.maxReconnectAttempts
  }

  scheduleReconnect() {
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts)
    console.log(`Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`)

    setTimeout(async () => {
      this.reconnectAttempts++
      try {
        await this.connect()
      } catch (error) {
        console.error('Reconnect failed:', error)
        if (this.shouldReconnect()) {
          this.scheduleReconnect()
        } else {
          console.error('Max reconnect attempts reached')
          this.emit('maxReconnectAttemptsReached')
        }
      }
    }, delay)
  }

  getConnectionState() {
    if (!this.ws) return 'DISCONNECTED'

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING'
      case WebSocket.OPEN: return 'OPEN'
      case WebSocket.CLOSING: return 'CLOSING'
      case WebSocket.CLOSED: return 'CLOSED'
      default: return 'UNKNOWN'
    }
  }

  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN
  }

  getStats() {
    return {
      connected: this.isConnected(),
      state: this.getConnectionState(),
      reconnectAttempts: this.reconnectAttempts,
      queueLength: this.queue.length,
      url: this.url
    }
  }
}