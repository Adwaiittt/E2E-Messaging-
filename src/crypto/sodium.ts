import _sodium from 'libsodium-wrappers'

let _initialized = false

export async function getSodium() {
  if (!_initialized) {
    await _sodium.ready
    _initialized = true
  }
  return _sodium
}

export type Sodium = typeof _sodium
