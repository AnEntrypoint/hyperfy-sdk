import { Packr } from 'msgpackr';

const packr = new Packr({ structuredClone: true });

// Packet names matching browser client exactly
const packetNames = [
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
] as const;

export type PacketType = typeof packetNames[number];

interface PacketInfo {
  id: number;
  name: PacketType;
  method: string;
}

const byName = new Map<string, PacketInfo>();
const byId = new Map<number, PacketInfo>();

// Build lookup tables
let id = -1;
for (const name of packetNames) {
  const packetId = ++id;
  const info: PacketInfo = {
    id: packetId,
    name,
    method: `on${name.charAt(0).toUpperCase() + name.slice(1)}`, // eg 'connect' -> 'onConnect'
  };
  byName.set(name, info);
  byId.set(packetId, info);
}

/**
 * Write a packet to binary format using msgpackr
 * @param name Packet type name
 * @param data Packet data payload
 * @returns Buffer containing the serialized packet
 */
export function writePacket(name: PacketType, data: any): Buffer {
  const info = byName.get(name);
  if (!info) {
    throw new Error(`writePacket failed: ${name} (name not found)`);
  }

  const packet = packr.pack([info.id, data]);
  return Buffer.from(packet);
}

/**
 * Read a packet from binary format using msgpackr
 * @param packet Buffer containing the packet data
 * @returns [method, data] tuple where method is the handler function name
 */
export function readPacket(buffer: Buffer): [string, any] {
  try {
    // Add buffer validation
    if (!buffer || buffer.length === 0) {
      console.warn('Empty buffer received in readPacket');
      return ['', null];
    }
    
    // Use safe unpacking with proper error handling
    const info = unpacker.unpack(buffer);
    
    if (!info || typeof info !== 'object') {
      console.warn('Invalid packet data - unpacking failed');
      return ['', null];
    }
    
    if (!info.method || typeof info.method !== 'string') {
      console.warn('Invalid packet data - missing or invalid method');
      return ['', null];
    }
    
    const data = info.data !== undefined ? info.data : null;
    return [info.method, data];
  } catch (err) {
    console.error('Packet read error:', err);
    // Enhanced debugging
    if (buffer) {
      console.error('Buffer details:', {
        length: buffer.length,
        firstBytes: buffer.slice(0, Math.min(20, buffer.length)).toString('hex'),
        bufferType: buffer.constructor.name
      });
    } else {
      console.error('Buffer is null or undefined');
    }
    
    // Return empty tuple to maintain compatibility
    return ['', null];
  }
}

/**
 * Get packet info by name
 * @param name Packet type name
 * @returns Packet info or undefined if not found
 */
export function getPacketInfo(name: string): PacketInfo | undefined {
  return byName.get(name as PacketType);
}

/**
 * Get packet info by ID
 * @param id Packet ID
 * @returns Packet info or undefined if not found
 */
export function getPacketInfoById(id: number): PacketInfo | undefined {
  return byId.get(id);
}

/**
 * Get all available packet types
 * @returns Array of packet type names
 */
export function getPacketTypes(): PacketType[] {
  return [...packetNames];
}

/**
 * Validate packet type
 * @param name Packet type name to validate
 * @returns true if valid packet type
 */
export function isValidPacketType(name: string): name is PacketType {
  return byName.has(name);
}

// Export packet types for external use
export { PacketInfo };