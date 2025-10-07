import { Packr } from 'msgpackr'

const packr = new Packr({ structuredClone: true })

// Packet names matching the browser client
const names = [
  'snapshot',
  'command',
  'chatAdded',
  'chatCleared',
  'blueprintAdded',
  'blueprintModified',
  'entityAdded',
  'entityModified',
  'entityEvent',
  'entityRemoved',
  'playerTeleport',
  'playerPush',
  'playerSessionAvatar',
  'liveKitLevel',
  'mute',
  'settingsModified',
  'spawnModified',
  'modifyRank',
  'kick',
  'ping',
  'pong',
  'errorReport',
  'getErrors',
  'clearErrors',
  'errors',
  'mcpSubscribeErrors',
  'mcpErrorEvent',
]

const byName = {}
const byId = {}
let ids = -1

for (const name of names) {
  const id = ++ids
  const info = {
    id,
    name,
    method: `on${capitalize(name)}`,
  }
  byName[name] = info
  byId[id] = info
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export class Packets {
  static writePacket(name, data) {
    const info = byName[name]
    if (!info) throw new Error(`writePacket failed: ${name} (name not found)`)
    const packet = packr.pack([info.id, data])
    return packet
  }

  static readPacket(packet) {
    try {
      const unpacked = packr.unpack(packet)
      if (!Array.isArray(unpacked)) {
        throw new Error(`readPacket failed: unpacked is not iterable (${typeof unpacked})`)
      }
      const [id, data] = unpacked
      const info = byId[id]
      if (!info) throw new Error(`readPacket failed: ${id} (id not found)`)
      return [info.method, data]
    } catch (err) {
      console.error('readPacket error:', err)
      console.error('packet type:', typeof packet, 'length:', packet?.length)
      return []
    }
  }

  static getPacketNames() {
    return [...names]
  }

  static getMethodInfo(methodName) {
    return Object.values(byName).find(info => info.method === methodName)
  }

  static getPacketInfo(packetName) {
    return byName[packetName]
  }
}

// Export packet names for easy access
export const PACKET_NAMES = Object.freeze(names)