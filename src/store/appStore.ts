import { create } from 'zustand'

interface Settings {
  displayName: string
  lanOnly: boolean
  stunServer: string
  turnUrl: string
  turnUser: string
  turnCred: string
  disappearAfter: number  // seconds, 0 = off
}

interface Identity {
  publicKey: string
  fingerprint: string
  displayName: string
}

interface AppState {
  settings: Settings
  identity: Identity | null
  isSetupComplete: boolean
  isUnlocked: boolean
  loadSettings: () => Promise<void>
  loadIdentity: () => Promise<void>
  saveSettings: (patch: Partial<Settings>) => Promise<void>
  setUnlocked: (v: boolean) => void
  setSetupComplete: (v: boolean) => void
}

const DEFAULT_SETTINGS: Settings = {
  displayName: '',
  lanOnly: true,
  stunServer: 'stun:stun.l.google.com:19302',
  turnUrl: '',
  turnUser: '',
  turnCred: '',
  disappearAfter: 0
}

export const useAppStore = create<AppState>((set) => ({
  settings: DEFAULT_SETTINGS,
  identity: null,
  isSetupComplete: false,
  isUnlocked: false,

  loadSettings: async () => {
    const s = await window.electronAPI.getSettings()
    set({ settings: { ...DEFAULT_SETTINGS, ...s } })
  },

  loadIdentity: async () => {
    const id = await window.electronAPI.getIdentity()
    set({ identity: id })
  },

  saveSettings: async (patch) => {
    await window.electronAPI.setSettings(patch)
    set(s => ({ settings: { ...s.settings, ...patch } }))
  },

  setUnlocked: (v) => set({ isUnlocked: v }),
  setSetupComplete: (v) => set({ isSetupComplete: v })
}))
