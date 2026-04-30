import { pack, unpack } from 'msgpackr'

export type PacketType = 'message' | 'ack' | 'file-chunk' | 'file-meta' | 'handshake' | 'read-receipt' | 'webrtc-signal'

export interface WirePacket {
  type: PacketType
  id: string           // packet id
  contactId: string
  payload: Uint8Array  // encrypted bytes
  timestamp: number
  seq?: number         // file chunk sequence
}

export function encodePacket(packet: WirePacket): Buffer {
  return pack(packet)
}

export function decodePacket(data: Buffer | Uint8Array): WirePacket {
  return unpack(Buffer.isBuffer(data) ? data : Buffer.from(data))
}

/** 4-byte big-endian length prefix framing */
export function frameData(data: Buffer): Buffer {
  const lenBuf = Buffer.allocUnsafe(4)
  lenBuf.writeUInt32BE(data.length, 0)
  return Buffer.concat([lenBuf, data])
}

export class StreamFramer {
  private buf = Buffer.alloc(0)

  feed(chunk: Buffer): Buffer[] {
    this.buf = Buffer.concat([this.buf, chunk])
    const frames: Buffer[] = []

    while (this.buf.length >= 4) {
      const len = this.buf.readUInt32BE(0)
      if (this.buf.length < 4 + len) break
      frames.push(this.buf.slice(4, 4 + len))
      this.buf = this.buf.slice(4 + len)
    }

    return frames
  }
}
