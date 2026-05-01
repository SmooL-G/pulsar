// Public signaling relays (Pulsar P2P Phase 2).
// Add a community-run relay by appending to this list. Order matters:
// the client tries them top-to-bottom and sticks with the first that
// connects. wss:// only — browsers refuse mixed content from https.
export const RELAYS: string[] = [
  // Reference relay run by the project. Reverse-proxied by the host
  // nginx at /relay-ws → pulsar-relay:3030/ws.
  `${typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws'}://${typeof window !== 'undefined' ? window.location.host : 'pulsar-chat.fun'}/relay-ws`,
];

// Local-dev fallback when the page is loaded from localhost. Production
// hosts will skip this entry.
export const DEV_RELAY = 'ws://localhost:3030/ws';

export function pickRelays(): string[] {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return [DEV_RELAY, ...RELAYS];
  }
  return RELAYS;
}
