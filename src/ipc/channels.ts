export const IPC = {
  // Identity
  IDENTITY_GET: 'identity:get',
  IDENTITY_CREATE: 'identity:create',
  IDENTITY_FINGERPRINT: 'identity:fingerprint',

  // DB / Setup
  SETUP_IS_COMPLETE: 'setup:isComplete',
  SETUP_COMPLETE: 'setup:complete',
  PIN_VERIFY: 'pin:verify',
  PIN_CHANGE: 'pin:change',

  // Contacts
  CONTACTS_GET: 'contacts:get',
  CONTACTS_SAVE: 'contacts:save',
  CONTACTS_DELETE: 'contacts:delete',

  // Messages
  MESSAGES_GET: 'messages:get',
  MESSAGES_SEND: 'messages:send',
  MESSAGES_UPDATE_STATUS: 'messages:updateStatus',
  MESSAGES_INCOMING: 'messages:incoming',  // main→renderer push

  // Discovery
  PEERS_GET: 'peers:get',
  PEERS_ADD_MANUAL: 'peers:addManual',
  PEER_FOUND: 'peer:found',                // main→renderer push
  PEER_LOST: 'peer:lost',                  // main→renderer push

  // Transport
  TRANSPORT_CONNECT: 'transport:connect',
  TRANSPORT_STATUS: 'transport:status',

  // WebRTC signaling (relayed over TCP on LAN)
  WEBRTC_SIGNAL_OUT: 'webrtc:signal:out',
  WEBRTC_SIGNAL_IN: 'webrtc:signal:in',   // main→renderer push

  // Files
  FILE_SEND: 'file:send',
  FILE_PROGRESS: 'file:progress',          // main→renderer push
  FILE_RECEIVED: 'file:received',          // main→renderer push

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Panic
  PANIC_WIPE: 'panic:wipe',

  // Window
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
} as const
