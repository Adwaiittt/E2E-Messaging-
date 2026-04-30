import { EventEmitter } from 'events'
import { tcpTransport } from './tcpTransport'
import { webrtcTransport } from './webrtcTransport'
import { WirePacket } from './packetCodec'
import { v4 as uuidv4 } from 'uuid'

type TransportMode = 'lan' | 'internet'

class TransportManager extends EventEmitter {
  private mode: TransportMode = 'lan'
  private rtcConfig: { stunServer?: string; turnServer?: any } = {}

  setMode(mode: TransportMode): void { this.mode = mode }
  setRTCConfig(cfg: typeof this.rtcConfig): void { this.rtcConfig = cfg }

  init(): void {
    tcpTransport.on('packet', (pkt) => this.emit('packet', pkt))
    tcpTransport.on('disconnected', (id) => this.emit('disconnected', id))
    webrtcTransport.on('packet', (pkt) => this.emit('packet', pkt))
    webrtcTransport.on('disconnected', (id) => this.emit('disconnected', id))
    webrtcTransport.on('signal', (data) => this.emit('webrtc-signal', data))
    webrtcTransport.on('connected', (id) => this.emit('connected', id))
  }

  send(contactId: string, payload: Uint8Array, type: WirePacket['type'] = 'message'): boolean {
    const packet: WirePacket = { type, id: uuidv4(), contactId, payload, timestamp: Date.now() }

    if (this.mode === 'lan') return tcpTransport.send(contactId, packet)
    // Internet mode: prefer WebRTC, fallback to TCP
    if (webrtcTransport.isConnected(contactId)) return webrtcTransport.send(contactId, packet)
    return tcpTransport.send(contactId, packet)
  }

  sendRaw(packet: WirePacket): boolean {
    if (this.mode === 'lan') return tcpTransport.send(packet.contactId, packet)
    if (webrtcTransport.isConnected(packet.contactId)) return webrtcTransport.send(packet.contactId, packet)
    return tcpTransport.send(packet.contactId, packet)
  }

  isConnected(contactId: string): boolean {
    return tcpTransport.isConnected(contactId) || webrtcTransport.isConnected(contactId)
  }

  disconnect(contactId: string): void {
    tcpTransport.disconnect(contactId)
    webrtcTransport.disconnect(contactId)
  }

  initiateWebRTC(contactId: string): void {
    webrtcTransport.createOffer(contactId, this.rtcConfig)
  }

  acceptWebRTC(contactId: string): void {
    webrtcTransport.acceptOffer(contactId, this.rtcConfig)
  }

  handleSignal(contactId: string, signal: any): void {
    webrtcTransport.signal(contactId, signal)
  }
}

export const transportManager = new TransportManager()
