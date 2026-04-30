// Global type augmentation for window.electronAPI
import type { ElectronAPI } from '../preload'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
