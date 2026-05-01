import { api } from '../services/api';

// Baseline STUN servers — free, anonymous, used for NAT discovery.
const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

// Cached TURN creds. coturn issues 4h credentials; we refresh ~5 min
// before they expire to avoid mid-call drops.
let cachedTurn: { servers: RTCIceServer[]; expiresAt: number } | null = null;

/**
 * Returns ICE servers to use for new RTCPeerConnections. Public STUN
 * always; TURN added if the platform has it enabled and we're authed.
 * TURN-fetch failures are silent — the connection just runs STUN-only
 * and may fall back to server-relayed messaging if symmetric NAT bites.
 */
export async function getIceServers(): Promise<RTCIceServer[]> {
  if (cachedTurn && Date.now() < cachedTurn.expiresAt) {
    return [...STUN_SERVERS, ...cachedTurn.servers];
  }
  try {
    const { data } = await api.get('/turn/credentials');
    if (data?.urls?.length && data?.username && data?.credential) {
      cachedTurn = {
        servers: [{
          urls: data.urls,
          username: data.username,
          credential: data.credential,
        }],
        // refresh a minute before TURN-server-side expiry
        expiresAt: Date.now() + (data.ttl - 60) * 1000,
      };
      return [...STUN_SERVERS, ...cachedTurn.servers];
    }
  } catch { /* TURN unavailable — STUN only is fine */ }
  return STUN_SERVERS;
}

// Sync export kept for callers that don't need TURN (legacy path).
export const ICE_SERVERS = STUN_SERVERS;
