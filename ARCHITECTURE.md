# LanMsg Architecture — Message Data Flow

## Overview

```
Sender Device                           Receiver Device
──────────────────────────────────────────────────────────────
User types message
       │
       ▼
[React ChatWindow]
  sendMessage(contactId, text)
       │  IPC (contextBridge)
       ▼
[Electron Main Process]
  ipcMain.handle('messages:send')
       │
       ▼
[Ratchet State] ← SQLCipher DB
  loadRatchetState(contactId)
       │
       ▼
[Double Ratchet — ratchetEncrypt()]
  1. Derive per-message key from sending chain key (HKDF)
  2. Advance chain key
  3. If Ns % 100 == 0: DH ratchet step (new ephemeral keypair)
  4. XSalsa20-Poly1305 encrypt plaintext with per-message key
  Output: { header: { dh, pn, n }, ciphertext, nonce }
       │
       ▼
[saveRatchetState()] → SQLCipher DB
       │
       ▼
[MessagePack encode] (msgpackr)
  WirePacket { type:'message', contactId, payload: encrypted, timestamp }
       │
       ▼
[Transport Layer]
  LAN mode: TCP socket → 4-byte length frame → send()
  Internet: WebRTC DataChannel (simple-peer) → send()
       │
       │                     ┌─────────────────────────────────┐
       │  ──── network ────► │ TCP/WebRTC delivers frames       │
       │                     └────────────────┬────────────────┘
       │                                      │
       ▼                                      ▼
[Save to DB]                      [Electron Main Process]
  direction: 'sent'                 tcpTransport 'data' event
  ciphertext: payload               StreamFramer.feed(chunk)
  plaintext: text                            │
  status: 'sent'                             ▼
                                   [MessagePack decode]
                                   WirePacket { type, contactId, payload }
                                             │
                                             ▼
                                   [handleIncomingPacket()]
                                     1. getContact(contactId) from DB
                                     2. Load ratchetState from SQLCipher
                                             │
                                             ▼
                                   [Double Ratchet — ratchetDecrypt()]
                                     1. Check header.dh vs stored DHr
                                     2. If new DH key: perform DH ratchet step
                                     3. Derive per-message key from receive chain key (HKDF)
                                     4. Advance receive chain key
                                     5. XSalsa20-Poly1305 decrypt ciphertext
                                     Output: plaintext Uint8Array
                                             │
                                             ▼
                                   [saveRatchetState()] → SQLCipher
                                             │
                                             ▼
                                   [saveMessage()]
                                     direction: 'received'
                                     ciphertext: payload (raw)
                                     plaintext: decrypted text
                                     status: 'delivered'
                                             │
                                             ▼
                                   [ipcMain → renderer push]
                                   webContents.send('messages:incoming', msg)
                                             │  IPC
                                             ▼
                                   [React messagesStore]
                                   receiveMessage(msg)
                                             │
                                             ▼
                                   [ChatWindow re-renders]
                                   MessageBubble shows decrypted text
                                             │
                                             ▼
                                   [Send read receipt]
                                   transport.send(contactId, {msgId}, 'read-receipt')
```

---

## Key Derivation Hierarchy

```
PIN
 │ Argon2id (memoryCost=64MB, timeCost=3)
 ▼
Database Key (hex) ──► SQLCipher database encryption
 │
 │ also used to encrypt identity secret key at rest
 ▼
Identity Keypair (X25519)
 │
 │ X25519 ECDH with peer's public key
 ▼
Initial Shared Secret (32 bytes)
 │
 │ HKDF-BLAKE2b
 ▼
Root Key (32 bytes)
 │
 │ HKDF-BLAKE2b per message
 ├─► Sending Chain Key ──► Per-Message Key (XSalsa20-Poly1305)
 └─► Receiving Chain Key ──► Per-Message Key
```

---

## Double Ratchet State Machine

```
Initial state (Alice initiates):
  DHs = new ephemeral keypair
  DHr = Bob's identity public key
  RK  = HKDF(sharedSecret, X25519(DHs.sec, DHr))
  CKs = second 32 bytes of above HKDF output
  CKr = null
  Ns = Nr = PN = 0

Per message (send):
  [mkS, CKs] = HKDF(CKs, "ratchet-msg-key" / "ratchet-chain-key")
  ciphertext = XSalsa20-Poly1305(mkS, plaintext)
  header = { dh: DHs.pub, pn: PN, n: Ns }
  Ns += 1

Every 100 messages (DH ratchet step):
  DHs = new ephemeral keypair
  [RK, CKs] = KDF_RK(RK, X25519(DHs.sec, DHr))
  PN = Ns; Ns = 0

On receive with new DHr:
  [RK, CKr] = KDF_RK(RK, X25519(DHs.sec, newDHr))
  DHs = new ephemeral keypair
  [RK, CKs] = KDF_RK(RK, X25519(DHs.sec, newDHr))
  DHr = newDHr; Nr = Ns = 0
```

---

## Security Properties

| Property | Implementation |
|---|---|
| Confidentiality | XSalsa20-Poly1305 per-message encryption |
| Integrity | Poly1305 MAC authenticates every message |
| Forward secrecy | Chain key advances; past keys not derivable |
| Break-in recovery | DH ratchet step every 100 messages injects fresh entropy |
| Authentication | X25519 key pinned at pairing; verified via fingerprint |
| Storage security | SQLCipher (AES-256-CBC) with Argon2id-derived key |
| Key privacy | Secret key never crosses IPC boundary unencrypted |
