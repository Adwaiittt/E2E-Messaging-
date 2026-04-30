# LanMsg — End-to-End Encrypted P2P Messenger

A cross-platform desktop messenger that works over LAN/WiFi with zero central servers.

## Stack
- **Runtime**: Node.js v20+ / TypeScript
- **Frontend**: React + Electron
- **Crypto**: libsodium-wrappers (X25519 + XSalsa20-Poly1305) + custom Double Ratchet
- **Transport**: TCP sockets (LAN mode) + WebRTC DataChannel via simple-peer (internet mode)
- **Discovery**: @homebridge/ciao mDNS
- **Database**: better-sqlite3-multiple-ciphers (SQLCipher)
- **State**: Zustand

## Prerequisites

1. **Node.js v20+** — https://nodejs.org
2. **Windows Build Tools** (for native modules):
   ```powershell
   npm install -g windows-build-tools
   # or install Visual C++ Build Tools from Visual Studio Installer
   ```

## Setup

```bash
cd "E2E Messaging app"
npm install
npm run dev       # Start in development mode
```

## Building

```bash
npm run build     # Build Electron app
npm run pack      # Package as installer
```

## Running Tests

```bash
npm test          # Jest crypto unit tests
```

---

## How Peer Discovery Works

1. On startup, LanMsg advertises a `_lanmsg._tcp.local.` mDNS service on port 54321 using `@homebridge/ciao`.
2. It simultaneously browses for other `_lanmsg._tcp.local.` services on the same LAN.
3. When a new device is found, its IP, port, and identity fingerprint are shown in the UI as "Nearby — not paired".
4. After QR code pairing, the peer becomes a trusted contact and direct TCP (or WebRTC) connection is established.

---

## How to Self-Host a TURN Server (coturn)

For internet mode when STUN alone cannot punch through NAT:

```bash
# Ubuntu/Debian
apt install coturn
```

Edit `/etc/turnserver.conf`:
```
listening-port=3478
realm=yourdomain.com
server-name=yourdomain.com
lt-cred-mech
user=alice:password123
fingerprint
```

Then in LanMsg Settings → TURN Server:
- URL: `turn:yourdomain.com:3478`
- Username: `alice`
- Credential: `password123`

> **Note**: TURN is only used for ICE hole-punching. Messages are still encrypted at the application layer before reaching the TURN relay.

---

## Threat Model Summary

| Threat | Mitigation |
|---|---|
| Network eavesdropping | All messages encrypted with XSalsa20-Poly1305 + Double Ratchet before transport |
| Man-in-the-middle during pairing | QR code pairing + verbal fingerprint verification (TOFU) |
| Compromised past messages | Double Ratchet provides forward secrecy; each message uses a derived key |
| Local device compromise | SQLCipher encrypts all data at rest; key derived via Argon2id from PIN |
| Private key exposure | Secret key only in main-process memory; never serialized unencrypted; never sent to renderer |
| Server-side breach | No server component. Zero data leaves the LAN (unless internet mode is enabled) |
| Physical device seizure | Panic wipe overwrites and deletes the database file |

### What LanMsg does NOT protect against
- Compromised endpoint (malware on device)
- Screen recording
- TURN relay server traffic analysis (IP metadata only; content still encrypted)
