import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { IPC } from './ipc/channels'
import { openDatabase, deriveDatabaseKey, closeDatabase, getDatabase } from './db/database'
import { runMigrations } from './db/migrations'
import { saveContact, getContacts, getContact, deleteContact } from './db/contactStore'
import {
  saveMessage, getMessages, updateMessageStatus, deleteExpiredMessages,
  saveRatchetState, getRatchetState, getSetting, setSetting, getLastMessage, getUnreadCount
} from './db/messageStore'
import { mdnsService } from './discovery/mdnsService'
import { tcpTransport } from './transport/tcpTransport'
import { transportManager } from './transport/transportManager'
import { generateIdentityKeypair, deriveFingerprint, exportPublicKeyHex, importPublicKeyHex } from './crypto/identity'
import { getSodium } from './crypto/sodium'
import { deriveSharedSecret, encryptMessage, decryptMessage, encryptBlob, decryptBlob, hkdf } from './crypto/encryption'
import {
  initRatchetSender, ratchetEncrypt, ratchetDecrypt,
  serializeRatchetState, deserializeRatchetState, RatchetState,
  RatchetKeypair
} from './crypto/ratchet'
import { WirePacket } from './transport/packetCodec'
import { v4 as uuidv4 } from 'uuid'

const TCP_PORT = 54321
const DB_FILENAME = 'lanmsg.db'
const META_FILENAME = 'lanmsg.meta.json'
const FILE_CHUNK_SIZE = 16 * 1024

let mainWindow: BrowserWindow | null = null
let dbPath = ''
let metaPath = ''
let cleanupInterval: NodeJS.Timeout | null = null
let myPublicKey: Uint8Array | null = null
let mySecretKey: Uint8Array | null = null
let myFingerprint = ''
let dbKey = ''

function getAppDataPath() { return path.join(app.getPath('userData'), 'data') }

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 750, minWidth: 800, minHeight: 600,
    backgroundColor: '#0d0d18',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: 'hidden', frame: false, show: false
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
  mainWindow.once('ready-to-show', () => mainWindow?.show())
}

async function initApp() {
  await getSodium()
  const dataDir = getAppDataPath()
  fs.mkdirSync(dataDir, { recursive: true })
  dbPath = path.join(dataDir, DB_FILENAME)
  metaPath = path.join(dataDir, META_FILENAME)
}

async function openDB(pin: string): Promise<boolean> {
  try {
    let salt: Buffer
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
      salt = Buffer.from(meta.salt, 'hex')
    } else {
      salt = crypto.randomBytes(16)
    }
    const { key } = await deriveDatabaseKey(pin, salt)
    dbKey = key
    await openDatabase(dbPath)
    runMigrations()
    if (!fs.existsSync(metaPath)) {
      fs.writeFileSync(metaPath, JSON.stringify({ salt: salt.toString('hex') }))
    }
    return true
  } catch (e) {
    console.error('[DB] openDB error:', e)
    return false
  }
}

async function loadIdentityFromDB() {
  const pubHex = getSetting('identity.publicKey')
  const secEnc = getSetting('identity.secretKeyEnc')
  const secNonce = getSetting('identity.secretKeyNonce')
  if (pubHex && secEnc && secNonce) {
    myPublicKey = importPublicKeyHex(pubHex)
    const keyBuf = Buffer.from(dbKey, 'hex').slice(0, 32)
    mySecretKey = await decryptMessage(
      new Uint8Array(keyBuf),
      new Uint8Array(Buffer.from(secEnc, 'hex')),
      new Uint8Array(Buffer.from(secNonce, 'hex'))
    )
    myFingerprint = deriveFingerprint(myPublicKey)
  }
}

async function createIdentity() {
  const kp = await generateIdentityKeypair()
  myPublicKey = kp.publicKey
  mySecretKey = kp.secretKey
  myFingerprint = deriveFingerprint(kp.publicKey)
  const keyBuf = Buffer.from(dbKey, 'hex').slice(0, 32)
  const { ciphertext, nonce } = await encryptMessage(new Uint8Array(keyBuf), kp.secretKey)
  setSetting('identity.publicKey', exportPublicKeyHex(kp.publicKey))
  setSetting('identity.secretKeyEnc', Buffer.from(ciphertext).toString('hex'))
  setSetting('identity.secretKeyNonce', Buffer.from(nonce).toString('hex'))
}

async function startNetworking() {
  transportManager.init()
  await tcpTransport.startServer(TCP_PORT)
  mdnsService.setLocalFingerprint(myFingerprint)
  await mdnsService.startAdvertising(TCP_PORT, exportPublicKeyHex(myPublicKey!), myFingerprint)
  await mdnsService.startDiscovery()
  mdnsService.on('peerFound', (peer) => mainWindow?.webContents.send(IPC.PEER_FOUND, peer))
  mdnsService.on('peerLost', (peer) => mainWindow?.webContents.send(IPC.PEER_LOST, peer))
  transportManager.on('packet', async (pkt: WirePacket) => handleIncomingPacket(pkt))
  transportManager.on('webrtc-signal', ({ contactId, data }: any) => {
    const pkt: WirePacket = { type: 'webrtc-signal', id: uuidv4(), contactId: myFingerprint, payload: Buffer.from(JSON.stringify(data)), timestamp: Date.now() }
    tcpTransport.send(contactId, pkt)
  })
  cleanupInterval = setInterval(() => { try { deleteExpiredMessages() } catch {} }, 60_000)
}

async function getOrCreateRatchetState(contactId: string, theirPubKey: Uint8Array): Promise<RatchetState> {
  const blob = getRatchetState(contactId)
  if (blob) return deserializeRatchetState(Buffer.from(blob, 'base64'))
  const sharedSecret = await deriveSharedSecret(mySecretKey!, theirPubKey)
  const state = await initRatchetSender(sharedSecret, theirPubKey)
  saveRatchetState(contactId, serializeRatchetState(state).toString('base64'))
  return state
}

const incomingFiles = new Map<string, { meta: any; chunks: Map<number, Buffer> }>()

async function handleIncomingPacket(pkt: WirePacket) {
  if (pkt.type === 'message') {
    const contact = getContact(pkt.contactId)
    if (!contact || !mySecretKey) return
    try {
      const msgData = JSON.parse(Buffer.from(pkt.payload).toString())
      const { header, ciphertext, nonce } = msgData
      const blob = getRatchetState(pkt.contactId)
      if (!blob) return
      let state = deserializeRatchetState(Buffer.from(blob, 'base64'))
      const ratchetMsg = {
        header: { dh: new Uint8Array(header.dh), pn: header.pn, n: header.n },
        ciphertext: new Uint8Array(ciphertext),
        nonce: new Uint8Array(nonce)
      }
      const { plaintext, state: newState } = await ratchetDecrypt(state, ratchetMsg)
      saveRatchetState(pkt.contactId, serializeRatchetState(newState).toString('base64'))
      const text = new TextDecoder().decode(plaintext)
      const msg = saveMessage({
        contact_id: pkt.contactId, direction: 'received',
        ciphertext: Buffer.from(pkt.payload).toString('hex'),
        plaintext: text, timestamp: pkt.timestamp, status: 'delivered', expires_at: null
      })
      mainWindow?.webContents.send(IPC.MESSAGES_INCOMING, msg)
      transportManager.send(pkt.contactId, Buffer.from(JSON.stringify({ msgId: msg.id })), 'ack')
    } catch (e) { console.error('[Main] Decrypt error:', e) }
  } else if (pkt.type === 'ack') {
    const { msgId } = JSON.parse(Buffer.from(pkt.payload).toString())
    updateMessageStatus(msgId, 'delivered')
  } else if (pkt.type === 'read-receipt') {
    const { msgId } = JSON.parse(Buffer.from(pkt.payload).toString())
    updateMessageStatus(msgId, 'read')
  } else if (pkt.type === 'webrtc-signal') {
    mainWindow?.webContents.send(IPC.WEBRTC_SIGNAL_IN, {
      contactId: pkt.contactId,
      signal: JSON.parse(Buffer.from(pkt.payload).toString())
    })
  } else if (pkt.type === 'file-meta') {
    const meta = JSON.parse(Buffer.from(pkt.payload).toString())
    incomingFiles.set(meta.transferId, { meta, chunks: new Map() })
  } else if (pkt.type === 'file-chunk') {
    const data = JSON.parse(Buffer.from(pkt.payload).toString())
    const transfer = incomingFiles.get(data.transferId)
    if (!transfer) return
    const decKey = new Uint8Array(Buffer.from(data.key, 'hex'))
    const decrypted = await decryptBlob(decKey, new Uint8Array(Buffer.from(data.chunk, 'hex')))
    transfer.chunks.set(data.seq, Buffer.from(decrypted))
    const progress = (transfer.chunks.size / transfer.meta.totalChunks) * 100
    mainWindow?.webContents.send(IPC.FILE_PROGRESS, { transferId: data.transferId, progress, contactId: pkt.contactId })
    if (transfer.chunks.size === transfer.meta.totalChunks) {
      const parts: Buffer[] = []
      for (let i = 0; i < transfer.meta.totalChunks; i++) parts.push(transfer.chunks.get(i)!)
      const savePath = path.join(app.getPath('downloads'), transfer.meta.filename)
      fs.writeFileSync(savePath, Buffer.concat(parts))
      incomingFiles.delete(data.transferId)
      mainWindow?.webContents.send(IPC.FILE_RECEIVED, {
        transferId: data.transferId, contactId: pkt.contactId,
        filename: transfer.meta.filename, path: savePath
      })
    }
  }
}

function registerIPCHandlers() {
  ipcMain.handle(IPC.SETUP_IS_COMPLETE, () => {
    const setupMarker = path.join(getAppDataPath(), 'setup.complete')
    return fs.existsSync(setupMarker)
  })

  ipcMain.handle(IPC.SETUP_COMPLETE, async (_, pin: string, displayName: string) => {
    const ok = await openDB(pin)
    if (!ok) return { ok: false, error: 'Failed to open DB' }
    await createIdentity()
    setSetting('displayName', displayName)
    setSetting('setup.complete', '1')
    await startNetworking()
    fs.writeFileSync(path.join(getAppDataPath(), 'setup.complete'), '1')
    return { ok: true, fingerprint: myFingerprint, publicKey: exportPublicKeyHex(myPublicKey!) }
  })

  ipcMain.handle(IPC.PIN_VERIFY, async (_, pin: string) => {
    const ok = await openDB(pin)
    if (ok) {
      await loadIdentityFromDB()
      await startNetworking()
    }
    return ok
  })

  ipcMain.handle(IPC.IDENTITY_GET, () => ({
    publicKey: myPublicKey ? exportPublicKeyHex(myPublicKey) : null,
    fingerprint: myFingerprint,
    displayName: getSetting('displayName') ?? 'Unknown'
  }))

  ipcMain.handle(IPC.CONTACTS_GET, () => {
    return getContacts().map(c => ({
      ...c,
      lastMessage: getLastMessage(c.id),
      unread: getUnreadCount(c.id)
    }))
  })

  ipcMain.handle(IPC.CONTACTS_SAVE, (_, contact: any) => {
    return saveContact({ ...contact, paired_at: contact.paired_at ?? Date.now() })
  })

  ipcMain.handle(IPC.CONTACTS_DELETE, (_, id: string) => deleteContact(id))
  ipcMain.handle(IPC.MESSAGES_GET, (_, contactId: string) => getMessages(contactId, 100))

  ipcMain.handle(IPC.MESSAGES_SEND, async (_, contactId: string, text: string) => {
    const contact = getContact(contactId)
    if (!contact) return { ok: false, error: 'Contact not found' }
    const theirPubKey = importPublicKeyHex(contact.public_key)
    let state = await getOrCreateRatchetState(contactId, theirPubKey)
    const plainBytes = new TextEncoder().encode(text)
    const { msg: rMsg, state: newState } = await ratchetEncrypt(state, plainBytes)
    saveRatchetState(contactId, serializeRatchetState(newState).toString('base64'))

    const payload = Buffer.from(JSON.stringify({
      header: { dh: Array.from(rMsg.header.dh), pn: rMsg.header.pn, n: rMsg.header.n },
      ciphertext: Array.from(rMsg.ciphertext),
      nonce: Array.from(rMsg.nonce)
    }))

    const message = saveMessage({
      contact_id: contactId, direction: 'sent',
      ciphertext: payload.toString('hex'), plaintext: text,
      timestamp: Date.now(), status: 'sent', expires_at: null
    })

    const sent = transportManager.send(contactId, new Uint8Array(payload))
    if (!sent) updateMessageStatus(message.id, 'failed')
    return { ok: sent, message }
  })

  ipcMain.handle(IPC.MESSAGES_UPDATE_STATUS, (_, id: string, status: string) => {
    updateMessageStatus(id, status as any)
  })

  ipcMain.handle(IPC.PEERS_GET, () => mdnsService.getPeers())
  ipcMain.handle(IPC.PEERS_ADD_MANUAL, (_, ip: string, port: number, pubkeyHex: string, fp: string) => {
    return mdnsService.addManualPeer(ip, port, pubkeyHex, fp)
  })

  ipcMain.handle(IPC.TRANSPORT_CONNECT, async (_, contactId: string, ip: string, port: number) => {
    try { await tcpTransport.connect(ip, port, contactId); return { ok: true } }
    catch (e: any) { return { ok: false, error: e.message } }
  })

  ipcMain.handle(IPC.TRANSPORT_STATUS, (_, contactId: string) => transportManager.isConnected(contactId))

  ipcMain.handle(IPC.FILE_SEND, async (_, contactId: string, filePath: string) => {
    const fileData = fs.readFileSync(filePath)
    if (fileData.length > 50 * 1024 * 1024) return { ok: false, error: 'File too large (max 50 MB)' }
    const transferId = uuidv4()
    const filename = path.basename(filePath)
    const totalChunks = Math.ceil(fileData.length / FILE_CHUNK_SIZE)
    const transferKey = crypto.randomBytes(32)
    transportManager.send(contactId, Buffer.from(JSON.stringify({ transferId, filename, totalChunks, size: fileData.length })), 'file-meta')
    for (let i = 0; i < totalChunks; i++) {
      const chunk = fileData.slice(i * FILE_CHUNK_SIZE, (i + 1) * FILE_CHUNK_SIZE)
      const chunkKey = await hkdf(new Uint8Array(transferKey), new Uint8Array(4).fill(i & 0xff), `chunk-${i}`, 32)
      const encrypted = await encryptBlob(chunkKey, new Uint8Array(chunk))
      transportManager.send(contactId, Buffer.from(JSON.stringify({
        transferId, seq: i,
        chunk: Buffer.from(encrypted).toString('hex'),
        key: Buffer.from(chunkKey).toString('hex')
      })), 'file-chunk')
      mainWindow?.webContents.send(IPC.FILE_PROGRESS, { transferId, progress: ((i + 1) / totalChunks) * 100, contactId })
    }
    return { ok: true, transferId }
  })

  ipcMain.handle(IPC.SETTINGS_GET, () => ({
    displayName: getSetting('displayName') ?? '',
    lanOnly: getSetting('settings.lanOnly') !== '0',
    stunServer: getSetting('settings.stunServer') ?? 'stun:stun.l.google.com:19302',
    turnUrl: getSetting('settings.turnUrl') ?? '',
    turnUser: getSetting('settings.turnUser') ?? '',
    turnCred: getSetting('settings.turnCred') ?? '',
    disappearAfter: parseInt(getSetting('settings.disappearAfter') ?? '0')
  }))

  ipcMain.handle(IPC.SETTINGS_SET, (_, s: any) => {
    if (s.displayName !== undefined) setSetting('displayName', s.displayName)
    if (s.lanOnly !== undefined) { setSetting('settings.lanOnly', s.lanOnly ? '1' : '0'); transportManager.setMode(s.lanOnly ? 'lan' : 'internet') }
    if (s.stunServer !== undefined) setSetting('settings.stunServer', s.stunServer)
    if (s.turnUrl !== undefined) setSetting('settings.turnUrl', s.turnUrl)
    if (s.turnUser !== undefined) setSetting('settings.turnUser', s.turnUser)
    if (s.turnCred !== undefined) setSetting('settings.turnCred', s.turnCred)
    if (s.disappearAfter !== undefined) setSetting('settings.disappearAfter', String(s.disappearAfter))
    return { ok: true }
  })

  ipcMain.on(IPC.WINDOW_MINIMIZE, () => mainWindow?.minimize())
  ipcMain.on(IPC.WINDOW_MAXIMIZE, () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on(IPC.WINDOW_CLOSE, () => mainWindow?.close())

  ipcMain.handle(IPC.PANIC_WIPE, async () => {
    closeDatabase()
    if (cleanupInterval) clearInterval(cleanupInterval)
    await mdnsService.stopAll().catch(() => {})
    tcpTransport.stopServer()
    for (const f of [dbPath, metaPath]) {
      if (fs.existsSync(f)) {
        const size = fs.statSync(f).size
        fs.writeFileSync(f, Buffer.alloc(size, 0))
        fs.unlinkSync(f)
      }
    }
    app.quit()
    return { ok: true }
  })

  ipcMain.handle(IPC.PIN_CHANGE, async (_, oldPin: string, newPin: string) => {
    const ok = await openDB(oldPin)
    if (!ok) return { ok: false, error: 'Invalid PIN' }
    const { key: newKey, salt: newSalt } = await deriveDatabaseKey(newPin)
    const newKeyBuf = Buffer.from(newKey, 'hex').slice(0, 32)
    if (mySecretKey) {
      const { ciphertext, nonce } = await encryptMessage(new Uint8Array(newKeyBuf), mySecretKey)
      setSetting('identity.secretKeyEnc', Buffer.from(ciphertext).toString('hex'))
      setSetting('identity.secretKeyNonce', Buffer.from(nonce).toString('hex'))
    }
    dbKey = newKey
    fs.writeFileSync(metaPath, JSON.stringify({ salt: newSalt.toString('hex') }))
    return { ok: true }
  })
}

app.whenReady().then(async () => {
  await initApp()
  registerIPCHandlers()
  createWindow()
})

app.on('window-all-closed', async () => {
  if (cleanupInterval) clearInterval(cleanupInterval)
  await mdnsService.stopAll().catch(() => {})
  closeDatabase()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
