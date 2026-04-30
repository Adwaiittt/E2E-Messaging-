import { getSodium } from './sodium'
import { deriveSharedSecret, hkdf, encryptMessage, decryptMessage } from './encryption'

export interface RatchetKeypair {
  publicKey: Uint8Array
  secretKey: Uint8Array
}

export interface RatchetHeader {
  dh: Uint8Array      // sender's current DH ratchet public key
  pn: number          // previous chain message count
  n: number           // current message number
}

export interface RatchetState {
  DHs: RatchetKeypair      // own DH ratchet keypair
  DHr: Uint8Array | null   // remote DH ratchet public key
  RK: Uint8Array           // root key (32 bytes)
  CKs: Uint8Array | null   // sending chain key
  CKr: Uint8Array | null   // receiving chain key
  Ns: number               // sent message counter
  Nr: number               // received message counter
  PN: number               // prev chain message count
}

export interface EncryptedRatchetMessage {
  header: RatchetHeader
  ciphertext: Uint8Array
  nonce: Uint8Array
}



async function generateDHKeypair(): Promise<RatchetKeypair> {
  const sodium = await getSodium()
  const kp = sodium.crypto_box_keypair()
  return { publicKey: kp.publicKey, secretKey: kp.privateKey }
}

async function kdfRK(rk: Uint8Array, dhOut: Uint8Array): Promise<[Uint8Array, Uint8Array]> {
  const derived = await hkdf(dhOut, rk, 'ratchet-root', 64)
  return [derived.slice(0, 32), derived.slice(32, 64)]
}

async function kdfCK(ck: Uint8Array): Promise<[Uint8Array, Uint8Array]> {
  const msgKey = await hkdf(ck, new Uint8Array(32), 'ratchet-msg-key', 32)
  const nextCK = await hkdf(ck, new Uint8Array(32), 'ratchet-chain-key', 32)
  return [nextCK, msgKey]
}

/** Alice initiates: she has Bob's public key, sets DHs, no DHr yet */
export async function initRatchetSender(
  sharedSecret: Uint8Array,
  remotePublicKey: Uint8Array
): Promise<RatchetState> {
  const DHs = await generateDHKeypair()
  const dhOut = await deriveSharedSecret(DHs.secretKey, remotePublicKey)
  const [RK, CKs] = await kdfRK(sharedSecret, dhOut)
  return { DHs, DHr: remotePublicKey, RK, CKs, CKr: null, Ns: 0, Nr: 0, PN: 0 }
}

/** Bob receives: he has his own keypair used in pairing */
export async function initRatchetReceiver(
  sharedSecret: Uint8Array,
  myKeypair: RatchetKeypair
): Promise<RatchetState> {
  return {
    DHs: myKeypair,
    DHr: null,
    RK: sharedSecret,
    CKs: null,
    CKr: null,
    Ns: 0,
    Nr: 0,
    PN: 0
  }
}

export async function ratchetEncrypt(
  state: RatchetState,
  plaintext: Uint8Array
): Promise<{ msg: EncryptedRatchetMessage; state: RatchetState }> {

  if (!state.CKs) throw new Error('Ratchet not initialized for sending')

  const [newCKs, mk] = await kdfCK(state.CKs)
  const { ciphertext, nonce } = await encryptMessage(mk, plaintext)

  const header: RatchetHeader = {
    dh: state.DHs.publicKey,
    pn: state.PN,
    n: state.Ns
  }

  return {
    msg: { header, ciphertext, nonce },
    state: { ...state, CKs: newCKs, Ns: state.Ns + 1 }
  }
}

export async function ratchetDecrypt(
  state: RatchetState,
  msg: EncryptedRatchetMessage
): Promise<{ plaintext: Uint8Array; state: RatchetState }> {
  const { header, ciphertext, nonce } = msg

  // DH ratchet step if new DH key from remote
  if (!state.DHr || !buffersEqual(header.dh, state.DHr)) {
    state = await performDHRatchetOnReceive(state, header.dh)
  }

  if (!state.CKr) throw new Error('Ratchet not initialized for receiving')

  const [newCKr, mk] = await kdfCK(state.CKr)
  const plaintext = await decryptMessage(mk, ciphertext, nonce)

  return {
    plaintext,
    state: { ...state, CKr: newCKr, Nr: state.Nr + 1 }
  }
}


async function performDHRatchetOnReceive(
  state: RatchetState,
  remoteDH: Uint8Array
): Promise<RatchetState> {
  const dhOut = await deriveSharedSecret(state.DHs.secretKey, remoteDH)
  const [newRK, newCKr] = await kdfRK(state.RK, dhOut)
  const newDHs = await generateDHKeypair()
  const dhOut2 = await deriveSharedSecret(newDHs.secretKey, remoteDH)
  const [newRK2, newCKs] = await kdfRK(newRK, dhOut2)

  return {
    DHs: newDHs,
    DHr: remoteDH,
    RK: newRK2,
    CKs: newCKs,
    CKr: newCKr,
    Ns: 0,
    Nr: 0,
    PN: state.Ns
  }
}

function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** Serialize ratchet state to buffer for DB storage */
export function serializeRatchetState(state: RatchetState): Buffer {
  const obj = {
    DHs_pub: Buffer.from(state.DHs.publicKey).toString('hex'),
    DHs_sec: Buffer.from(state.DHs.secretKey).toString('hex'),
    DHr: state.DHr ? Buffer.from(state.DHr).toString('hex') : null,
    RK: Buffer.from(state.RK).toString('hex'),
    CKs: state.CKs ? Buffer.from(state.CKs).toString('hex') : null,
    CKr: state.CKr ? Buffer.from(state.CKr).toString('hex') : null,
    Ns: state.Ns,
    Nr: state.Nr,
    PN: state.PN
  }
  return Buffer.from(JSON.stringify(obj))
}

export function deserializeRatchetState(buf: Buffer): RatchetState {
  const obj = JSON.parse(buf.toString())
  return {
    DHs: {
      publicKey: new Uint8Array(Buffer.from(obj.DHs_pub, 'hex')),
      secretKey: new Uint8Array(Buffer.from(obj.DHs_sec, 'hex'))
    },
    DHr: obj.DHr ? new Uint8Array(Buffer.from(obj.DHr, 'hex')) : null,
    RK: new Uint8Array(Buffer.from(obj.RK, 'hex')),
    CKs: obj.CKs ? new Uint8Array(Buffer.from(obj.CKs, 'hex')) : null,
    CKr: obj.CKr ? new Uint8Array(Buffer.from(obj.CKr, 'hex')) : null,
    Ns: obj.Ns,
    Nr: obj.Nr,
    PN: obj.PN
  }
}
