// Public signaling relays (Pulsar P2P Phase 2).
//
// The list seeds with a single hardcoded reference relay run by the
// project (proxied as /relay-ws by host nginx). At app boot we also
// fetch /api/v1/nodes/public and merge any community-run nodes that
// have a public endpoint. The result is shuffled so different sessions
// pick different nodes — gives node owners actual peer/bandwidth
// stats instead of all traffic going to one box.
//
// wss:// only — browsers refuse mixed content from https.
import { api } from '../services/api';

function defaultRelay(): string {
  if (typeof window === 'undefined') return 'wss://pulsar-chat.fun/relay-ws';
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/relay-ws`;
}

const SEED_RELAYS: string[] = [defaultRelay()];

// Local-dev fallback when the page is loaded from localhost.
export const DEV_RELAY = 'ws://localhost:3030/ws';

// Mutable list — bootstrapRelays() merges /public into it on first call.
const RELAYS: string[] = [...SEED_RELAYS];
let bootstrapped = false;
let bootstrapInflight: Promise<void> | null = null;

export async function bootstrapRelays(): Promise<void> {
  if (bootstrapped) return;
  if (bootstrapInflight) return bootstrapInflight;
  bootstrapInflight = (async () => {
    try {
      const { data } = await api.get('/nodes/public');
      const nodes: Array<{ endpoint: string | null }> = data?.nodes ?? [];
      const fresh = nodes
        .map((n) => n.endpoint)
        .filter((e): e is string => !!e && /^wss?:\/\//.test(e))
        // dedupe against seed list
        .filter((e) => !RELAYS.includes(e));
      // Insert community nodes BEFORE the reference relay so traffic
      // actually flows through them when available — the reference is
      // just a fallback safety net.
      RELAYS.unshift(...shuffle(fresh));
    } catch (err) {
      console.warn('[relays] bootstrap failed, sticking with reference relay', err);
    } finally {
      bootstrapped = true;
      bootstrapInflight = null;
    }
  })();
  return bootstrapInflight;
}

export function pickRelays(): string[] {
  const list =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? [DEV_RELAY, ...RELAYS]
      : RELAYS;
  // Return a copy so callers (RelayClient) can iterate without mutating.
  return [...list];
}

// Fisher–Yates so different sessions favour different community nodes.
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
