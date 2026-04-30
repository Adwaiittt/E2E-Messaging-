import { Bonjour, Service } from 'bonjour-service'
import { EventEmitter } from 'events'

export interface DiscoveredPeer {
  id: string           // fingerprint
  ip: string
  port: number
  publicKeyHex: string
  trusted: boolean
  lastSeen: number
}

class MdnsService extends EventEmitter {
  private bonjour: Bonjour | null = null
  private publishedService: Service | null = null
  private browser: ReturnType<Bonjour['find']> | null = null
  private peers = new Map<string, DiscoveredPeer>()
  private localFingerprint: string | null = null

  async startAdvertising(port: number, publicKeyHex: string, fingerprint: string): Promise<void> {
    if (!this.bonjour) this.bonjour = new Bonjour()
    this.publishedService = this.bonjour.publish({
      name: `lanmsg-${fingerprint}`,
      type: 'lanmsg',
      port,
      protocol: 'tcp',
      txt: { pubkey: publicKeyHex, fp: fingerprint }
    })
    console.log(`[mDNS] Advertising on port ${port}, fingerprint=${fingerprint}`)
  }

  async startDiscovery(): Promise<void> {
    if (!this.bonjour) this.bonjour = new Bonjour()

    this.browser = this.bonjour.find({ type: 'lanmsg', protocol: 'tcp' })

    this.browser.on('up', (service: Service) => {
      const addresses: string[] = (service as any).addresses ?? []
      const ip = addresses.find(a => /^\d+\.\d+\.\d+\.\d+$/.test(a)) ?? addresses[0]
      if (!ip) return

      const txt: any = (service as any).txt ?? {}
      const peer: DiscoveredPeer = {
        id: txt.fp ?? service.name,
        ip,
        port: service.port ?? 54321,
        publicKeyHex: txt.pubkey ?? '',
        trusted: false,
        lastSeen: Date.now()
      }

      if (this.localFingerprint && peer.id === this.localFingerprint) return

      this.peers.set(peer.id, peer)
      this.emit('peerFound', peer)
    })

    this.browser.on('down', (service: Service) => {
      const txt: any = (service as any).txt ?? {}
      const fp = txt.fp ?? service.name
      const peer = this.peers.get(fp)
      if (peer) {
        this.peers.delete(fp)
        this.emit('peerLost', peer)
      }
    })

    this.browser.start()
  }

  setLocalFingerprint(fp: string): void {
    this.localFingerprint = fp
  }

  getPeers(): DiscoveredPeer[] {
    return Array.from(this.peers.values())
  }

  getPeer(id: string): DiscoveredPeer | null {
    return this.peers.get(id) ?? null
  }

  updatePeerTrust(id: string, trusted: boolean): void {
    const peer = this.peers.get(id)
    if (peer) this.peers.set(id, { ...peer, trusted })
  }

  addManualPeer(ip: string, port: number, publicKeyHex: string, fingerprint: string): DiscoveredPeer {
    const peer: DiscoveredPeer = { id: fingerprint, ip, port, publicKeyHex, trusted: false, lastSeen: Date.now() }
    this.peers.set(fingerprint, peer)
    this.emit('peerFound', peer)
    return peer
  }

  async stopAll(): Promise<void> {
    this.browser?.stop()
    this.publishedService?.stop()
    this.bonjour?.destroy()
  }
}

export const mdnsService = new MdnsService()
