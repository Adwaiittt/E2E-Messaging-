import net from 'net'
import { EventEmitter } from 'events'
import { frameData, StreamFramer, encodePacket, decodePacket, WirePacket } from './packetCodec'

export interface TCPConnection {
  socket: net.Socket
  framer: StreamFramer
  remoteId: string
}

class TCPTransport extends EventEmitter {
  private server: net.Server | null = null
  private connections = new Map<string, TCPConnection>()

  startServer(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => this.handleIncoming(socket))
      this.server.listen(port, '0.0.0.0', () => {
        console.log(`[TCP] Server listening on :${port}`)
        resolve()
      })
      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`[TCP] Port ${port} in use, skipping...`)
          resolve() // Just resolve to allow app to open without inbound TCP
        } else {
          reject(err)
        }
      })
    })
  }



  private handleIncoming(socket: net.Socket): void {
    const framer = new StreamFramer()
    let remoteId = `${socket.remoteAddress}:${socket.remotePort}`

    const conn: TCPConnection = { socket, framer, remoteId }
    this.connections.set(remoteId, conn)

    socket.on('data', (chunk) => {
      const frames = framer.feed(chunk)
      for (const frame of frames) {
        try {
          const packet = decodePacket(frame)
          remoteId = packet.contactId  // update with real id
          conn.remoteId = remoteId
          this.connections.set(remoteId, conn)
          this.emit('packet', packet)
        } catch (e) {
          console.error('[TCP] Decode error:', e)
        }
      }
    })

    socket.on('close', () => {
      this.connections.delete(remoteId)
      this.emit('disconnected', remoteId)
    })

    socket.on('error', (err) => {
      console.error('[TCP] Socket error:', err.message)
      this.connections.delete(remoteId)
    })
  }

  connect(ip: string, port: number, contactId: string): Promise<TCPConnection> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: ip, port })
      const framer = new StreamFramer()
      const conn: TCPConnection = { socket, framer, remoteId: contactId }

      socket.on('connect', () => {
        this.connections.set(contactId, conn)
        socket.on('data', (chunk) => {
          const frames = framer.feed(chunk)
          for (const frame of frames) {
            try {
              const packet = decodePacket(frame)
              this.emit('packet', packet)
            } catch (e) {
              console.error('[TCP] Decode error:', e)
            }
          }
        })
        socket.on('close', () => {
          this.connections.delete(contactId)
          this.emit('disconnected', contactId)
        })
        socket.on('error', (err) => {
          console.error('[TCP] Socket error:', err.message)
          this.connections.delete(contactId)
        })
        resolve(conn)
      })

      socket.on('error', reject)
    })
  }

  send(contactId: string, packet: WirePacket): boolean {
    const conn = this.connections.get(contactId)
    if (!conn || conn.socket.destroyed) return false
    const encoded = encodePacket(packet)
    conn.socket.write(frameData(encoded))
    return true
  }

  isConnected(contactId: string): boolean {
    const conn = this.connections.get(contactId)
    return !!conn && !conn.socket.destroyed
  }

  disconnect(contactId: string): void {
    const conn = this.connections.get(contactId)
    conn?.socket.destroy()
    this.connections.delete(contactId)
  }

  stopServer(): void {
    this.server?.close()
  }
}

export const tcpTransport = new TCPTransport()
