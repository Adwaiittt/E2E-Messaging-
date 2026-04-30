import { getSodium } from './sodium'

export interface EncryptedMessage {
  ciphertext: Uint8Array
  nonce: Uint8Array
}

/** X25519 ECDH — derives 32-byte shared secret */
export async function deriveSharedSecret(
  mySecretKey: Uint8Array,
  theirPublicKey: Uint8Array
): Promise<Uint8Array> {
  const sodium = await getSodium()
  return sodium.crypto_scalarmult(mySecretKey, theirPublicKey)
}

/** XSalsa20-Poly1305 symmetric encryption */
export async function encryptMessage(
  key: Uint8Array,
  plaintext: Uint8Array
): Promise<EncryptedMessage> {
  const sodium = await getSodium()
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, key)
  return { ciphertext, nonce }
}

export async function decryptMessage(
  key: Uint8Array,
  ciphertext: Uint8Array,
  nonce: Uint8Array
): Promise<Uint8Array> {
  const sodium = await getSodium()
  const result = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key)
  if (!result) throw new Error('Decryption failed')
  return result
}

/** HKDF using libsodium generichash (BLAKE2b) as PRF */
export async function hkdf(
  inputKeyMaterial: Uint8Array,
  salt: Uint8Array,
  info: string,
  outputLength: number
): Promise<Uint8Array> {
  const sodium = await getSodium()
  const infoBytes = new TextEncoder().encode(info)

  // Extract: PRK = HMAC-like = generichash(ikm, salt)
  const prk = new Uint8Array(sodium.crypto_generichash(32, inputKeyMaterial, salt))

  // Expand: T(1) = Hash(PRK || info || 0x01), etc.
  const chunks: Uint8Array[] = []
  let prev = new Uint8Array(0)
  let remaining = outputLength

  for (let i = 1; remaining > 0; i++) {
    const input = new Uint8Array(prev.length + infoBytes.length + 1)
    input.set(prev)
    input.set(infoBytes, prev.length)
    input[input.length - 1] = i
    prev = new Uint8Array(sodium.crypto_generichash(32, input, prk))
    chunks.push(prev)
    remaining -= 32
  }

  const output = new Uint8Array(outputLength)
  let offset = 0
  for (const chunk of chunks) {
    const take = Math.min(chunk.length, outputLength - offset)
    output.set(chunk.slice(0, take), offset)
    offset += take
  }
  return output
}

/** Encrypt a raw blob (file chunks) with a derived key */
export async function encryptBlob(
  key: Uint8Array,
  data: Uint8Array
): Promise<Uint8Array> {
  const { ciphertext, nonce } = await encryptMessage(key, data)
  // Prepend nonce to ciphertext
  const out = new Uint8Array(nonce.length + ciphertext.length)
  out.set(nonce)
  out.set(ciphertext, nonce.length)
  return out
}

export async function decryptBlob(
  key: Uint8Array,
  data: Uint8Array
): Promise<Uint8Array> {
  const sodium = await getSodium()
  const nonceLen = sodium.crypto_secretbox_NONCEBYTES
  const nonce = data.slice(0, nonceLen)
  const ciphertext = data.slice(nonceLen)
  return decryptMessage(key, ciphertext, nonce)
}
