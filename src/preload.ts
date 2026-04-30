import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from './ipc/channels'

const api = {
  // Identity
  getIdentity: () => ipcRenderer.invoke(IPC.IDENTITY_GET),
  createIdentity: (pin: string) => ipcRenderer.invoke(IPC.IDENTITY_CREATE, pin),

  // Setup
  isSetupComplete: () => ipcRenderer.invoke(IPC.SETUP_IS_COMPLETE),
  completeSetup: (pin: string, displayName: string) => ipcRenderer.invoke(IPC.SETUP_COMPLETE, pin, displayName),
  verifyPin: (pin: string) => ipcRenderer.invoke(IPC.PIN_VERIFY, pin),
  changePin: (oldPin: string, newPin: string) => ipcRenderer.invoke(IPC.PIN_CHANGE, oldPin, newPin),

  // Contacts
  getContacts: () => ipcRenderer.invoke(IPC.CONTACTS_GET),
  saveContact: (contact: any) => ipcRenderer.invoke(IPC.CONTACTS_SAVE, contact),
  deleteContact: (id: string) => ipcRenderer.invoke(IPC.CONTACTS_DELETE, id),

  // Messages
  getMessages: (contactId: string) => ipcRenderer.invoke(IPC.MESSAGES_GET, contactId),
  sendMessage: (contactId: string, text: string) => ipcRenderer.invoke(IPC.MESSAGES_SEND, contactId, text),
  updateMessageStatus: (id: string, status: string) => ipcRenderer.invoke(IPC.MESSAGES_UPDATE_STATUS, id, status),

  // Discovery
  getPeers: () => ipcRenderer.invoke(IPC.PEERS_GET),
  addManualPeer: (ip: string, port: number, pubkeyHex: string, fp: string) =>
    ipcRenderer.invoke(IPC.PEERS_ADD_MANUAL, ip, port, pubkeyHex, fp),

  // Transport
  connectToPeer: (contactId: string, ip: string, port: number) =>
    ipcRenderer.invoke(IPC.TRANSPORT_CONNECT, contactId, ip, port),
  getConnectionStatus: (contactId: string) => ipcRenderer.invoke(IPC.TRANSPORT_STATUS, contactId),

  // Files
  sendFile: (contactId: string, filePath: string) => ipcRenderer.invoke(IPC.FILE_SEND, contactId, filePath),

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSettings: (settings: any) => ipcRenderer.invoke(IPC.SETTINGS_SET, settings),

  // Panic
  panicWipe: () => ipcRenderer.invoke(IPC.PANIC_WIPE),

  // Window controls
  minimizeWindow: () => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
  maximizeWindow: () => ipcRenderer.send(IPC.WINDOW_MAXIMIZE),
  closeWindow: () => ipcRenderer.send(IPC.WINDOW_CLOSE),

  // Event listeners (main → renderer)
  onIncomingMessage: (cb: (msg: any) => void) => {
    ipcRenderer.on(IPC.MESSAGES_INCOMING, (_, msg) => cb(msg))
    return () => ipcRenderer.removeAllListeners(IPC.MESSAGES_INCOMING)
  },
  onPeerFound: (cb: (peer: any) => void) => {
    ipcRenderer.on(IPC.PEER_FOUND, (_, peer) => cb(peer))
    return () => ipcRenderer.removeAllListeners(IPC.PEER_FOUND)
  },
  onPeerLost: (cb: (peer: any) => void) => {
    ipcRenderer.on(IPC.PEER_LOST, (_, peer) => cb(peer))
    return () => ipcRenderer.removeAllListeners(IPC.PEER_LOST)
  },
  onFileProgress: (cb: (data: any) => void) => {
    ipcRenderer.on(IPC.FILE_PROGRESS, (_, data) => cb(data))
    return () => ipcRenderer.removeAllListeners(IPC.FILE_PROGRESS)
  },
  onFileReceived: (cb: (data: any) => void) => {
    ipcRenderer.on(IPC.FILE_RECEIVED, (_, data) => cb(data))
    return () => ipcRenderer.removeAllListeners(IPC.FILE_RECEIVED)
  },
  onWebRTCSignal: (cb: (data: any) => void) => {
    ipcRenderer.on(IPC.WEBRTC_SIGNAL_IN, (_, data) => cb(data))
    return () => ipcRenderer.removeAllListeners(IPC.WEBRTC_SIGNAL_IN)
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
