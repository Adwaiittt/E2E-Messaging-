import { generateIdentityKeypair, deriveFingerprint, exportPublicKeyHex } from '../identity'
import { deriveSharedSecret, encryptMessage, decryptMessage, hkdf, encryptBlob, decryptBlob } from '../encryption'
import {
  initRatchetSender,
  initRatchetReceiver,
  ratchetEncrypt,
  ratchetDecrypt,
  serializeRatchetState,
  deserializeRatchetState,
  RatchetKeypair
} from '../ratchet'

// Suppress "no test" warning
jest.setTimeout(30000)

describe('Identity', () => {
  test('generates keypair with correct lengths', async () => {
    const kp = await generateIdentityKeypair()
    expect(kp.publicKey.length).toBe(32)
    expect(kp.secretKey.length).toBe(32)
  })

  test('fingerprint is 32 hex chars (16 bytes)', async () => {
    const kp = await generateIdentityKeypair()
    const fp = deriveFingerprint(kp.publicKey)
    expect(fp).toMatch(/^[0-9a-f]{32}$/)
  })

  test('exportPublicKeyHex round-trips', async () => {
    const kp = await generateIdentityKeypair()
    const hex = exportPublicKeyHex(kp.publicKey)
    expect(hex.length).toBe(64)
    expect(Buffer.from(hex, 'hex')).toEqual(Buffer.from(kp.publicKey))
  })
})

describe('Encryption primitives', () => {
  test('encrypt/decrypt round-trip', async () => {
    const kp = await generateIdentityKeypair()
    const key = new Uint8Array(32).fill(42)
    const plaintext = new TextEncoder().encode('hello world')
    const { ciphertext, nonce } = await encryptMessage(key, plaintext)
    const recovered = await decryptMessage(key, ciphertext, nonce)
    expect(Buffer.from(recovered).toString()).toBe('hello world')
  })

  test('wrong key fails decryption', async () => {
    const key1 = new Uint8Array(32).fill(1)
    const key2 = new Uint8Array(32).fill(2)
    const plaintext = new TextEncoder().encode('secret')
    const { ciphertext, nonce } = await encryptMessage(key1, plaintext)
    await expect(decryptMessage(key2, ciphertext, nonce)).rejects.toThrow()
  })

  test('X25519 shared secret is symmetric', async () => {
    const alice = await generateIdentityKeypair()
    const bob = await generateIdentityKeypair()
    const s1 = await deriveSharedSecret(alice.secretKey, bob.publicKey)
    const s2 = await deriveSharedSecret(bob.secretKey, alice.publicKey)
    expect(Buffer.from(s1).toString('hex')).toBe(Buffer.from(s2).toString('hex'))
  })

  test('HKDF produces deterministic output', async () => {
    const ikm = new Uint8Array(32).fill(7)
    const salt = new Uint8Array(32).fill(3)
    const out1 = await hkdf(ikm, salt, 'test-info', 64)
    const out2 = await hkdf(ikm, salt, 'test-info', 64)
    expect(Buffer.from(out1).toString('hex')).toBe(Buffer.from(out2).toString('hex'))
  })

  test('encryptBlob/decryptBlob round-trip', async () => {
    const key = new Uint8Array(32).fill(9)
    const data = new Uint8Array([1, 2, 3, 4, 5])
    const enc = await encryptBlob(key, data)
    const dec = await decryptBlob(key, enc)
    expect(dec).toEqual(data)
  })
})

describe('Double Ratchet', () => {
  async function setupRatchet() {
    const aliceKP = await generateIdentityKeypair()
    const bobKP = await generateIdentityKeypair()
    const sharedSecret = await deriveSharedSecret(aliceKP.secretKey, bobKP.publicKey)

    // Alice sends, Bob receives
    const aliceState = await initRatchetSender(sharedSecret, bobKP.publicKey)
    const bobRatchetKP: RatchetKeypair = { publicKey: bobKP.publicKey, secretKey: bobKP.secretKey }
    const bobState = await initRatchetReceiver(sharedSecret, bobRatchetKP)

    return { aliceState, bobState }
  }

  test('10 sequential messages Alice→Bob', async () => {
    let { aliceState, bobState } = await setupRatchet()

    for (let i = 0; i < 10; i++) {
      const text = `message ${i}`
      const plainBytes = new TextEncoder().encode(text)
      const { msg, state: as } = await ratchetEncrypt(aliceState, plainBytes)
      aliceState = as

      const { plaintext, state: bs } = await ratchetDecrypt(bobState, msg)
      bobState = bs

      expect(new TextDecoder().decode(plaintext)).toBe(text)
    }
  })

  test('ratchet state serialization round-trip', async () => {
    const { aliceState } = await setupRatchet()
    const buf = serializeRatchetState(aliceState)
    const restored = deserializeRatchetState(buf)

    expect(Buffer.from(restored.RK).toString('hex')).toBe(
      Buffer.from(aliceState.RK).toString('hex')
    )
    expect(restored.Ns).toBe(aliceState.Ns)
  })


})
