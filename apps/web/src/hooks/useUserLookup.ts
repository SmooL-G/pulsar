import { useEffect, useState } from 'react';
import { api } from '../services/api';

/**
 * Cached username → user-profile lookup used by chat mention rendering.
 *
 * Each unique username is fetched at most once per app session — same
 * @mention appearing across many messages doesn't re-hit the server.
 * Failures (404, network) are cached as `null` so we don't retry on
 * every render of a dead handle.
 *
 * Backend: GET /api/v1/u/:username (publicProfile.routes.ts).
 */
export interface ResolvedUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isBot: boolean;
  role?: string;
  verificationLevel?: number;
}

// In-memory cache: undefined = not loaded, null = known-missing, object = loaded.
const cache = new Map<string, ResolvedUser | null>();
const inflight = new Map<string, Promise<ResolvedUser | null>>();

export async function lookupUser(username: string): Promise<ResolvedUser | null> {
  const key = username.toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = (async () => {
    try {
      // axios response shape: { data: ResolvedUser, status, ... }
      const res = await api.get<ResolvedUser>(`/u/${encodeURIComponent(username)}`);
      const data = (res as any)?.data ?? res; // tolerate both wrapped + bare
      cache.set(key, data);
      return data;
    } catch {
      cache.set(key, null);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** React hook variant. `lazy` = only fetch on demand (call `load()`). */
export function useUserLookup(username: string | null | undefined, opts?: { lazy?: boolean }) {
  const [user, setUser] = useState<ResolvedUser | null | undefined>(() => {
    if (!username) return null;
    return cache.get(username.toLowerCase());
  });

  useEffect(() => {
    if (!username || opts?.lazy) return;
    let cancelled = false;
    lookupUser(username).then((u) => { if (!cancelled) setUser(u); });
    return () => { cancelled = true; };
  }, [username, opts?.lazy]);

  const load = () => {
    if (!username) return;
    lookupUser(username).then(setUser);
  };

  return { user, load };
}
