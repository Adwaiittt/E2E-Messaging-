import SimplePeer from 'simple-peer'
import { EventEmitter } from 'events'
import { encodePacket, decodePacket, WirePacket } from './packetCodec'

export interface RTCConfig {
  stunServer?: string
  turnServer?: { url: string; username: string; credential: string }
}

function buildIceServers(cfg: RTCConfig) {
  const servers: any[] = [{ urls: cfg.stunServer ?? 'stun:stun.l.google.com:19302' }]
  if (cfg.turnServer) {
    servers.push({
      urls: cfg.turnServer.url,
      username: cfg.turnServer.username,
      credential: cfg.turnServer.credential
    })
  }
  return servers
}

class WebRTCTransport extends EventEmitter {
  private peers = new Map<string, SimplePeer.Instance>()

  createOffer(contactId: string, cfg: RTCConfig = {}): { peer: SimplePeer.Instance } {
    const peer = new SimplePeer({
      initiator: true,
      trickle: true,
      config: { iceServers: buildIceServers(cfg) }
    })
    this.setupPeer(peer, contactId)
    return { peer }
  }

  acceptOffer(contactId: string, cfg: RTCConfig = {}): { peer: SimplePeer.Instance } {
    const peer = new SimplePeer({
      initiator: false,
      trickle: true,
      config: { iceServers: buildIceServers(cfg) }
    })
    this.setupPeer(peer, contactId)
    return { peer }
  }

  private setupPeer(peer: SimplePeer.Instance, contactId: string): void {
    this.peers.set(contactId, peer)

    peer.on('signal', (data) => this.emit('signal', { contactId, data }))

    peer.on('data', (chunk: Buffer) => {
      try {
        const packet = decodePacket(chunk)
        this.emit('packet', packet)
      } catch (e) {
        console.error('[WebRTC] Decode error:', e)
      }
    })

    peer.on('connect', () => {
      console.log(`[WebRTC] Connected to ${contactId}`)
      this.emit('connected', contactId)
    })

    peer.on('close', () => {
      this.peers.delete(contactId)
      this.emit('disconnected', contactId)
    })

    peer.on('error', (err) => {
      console.error(`[WebRTC] Error for ${contactId}:`, err.message)
      this.peers.delete(contactId)
      this.emit('disconnected', contactId)
    })
  }

  signal(contactId: string, signalData: any): void {
    this.peers.get(contactId)?.signal(signalData)
  }

  send(contactId: string, packet: WirePacket): boolean {
    const peer = this.peers.get(contactId)
    if (!peer || !peer.connected) return false
    peer.send(encodePacket(packet))
    return true
  }

  isConnected(contactId: string): boolean {
    return this.peers.get(contactId)?.connected ?? false
  }

  disconnect(contactId: string): void {
    this.peers.get(contactId)?.destroy()
    this.peers.delete(contactId)
  }
}

export const webrtcTransport = new WebRTCTransport()
