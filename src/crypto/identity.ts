import { getSodium } from './sodium'

export interface IdentityKeypair {
  publicKey: Uint8Array
  secretKey: Uint8Array
}

export async function generateIdentityKeypair(): Promise<IdentityKeypair> {
  const sodium = await getSodium()
  const kp = sodium.crypto_box_keypair()
  return { publicKey: kp.publicKey, secretKey: kp.privateKey }
}

export function deriveFingerprint(publicKey: Uint8Array): string {
  return Buffer.from(publicKey.slice(0, 16)).toString('hex')
}

export function exportPublicKeyHex(publicKey: Uint8Array): string {
  return Buffer.from(publicKey).toString('hex')
}

export function importPublicKeyHex(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'))
}
