import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

export type PushStatus = 'unsupported' | 'idle' | 'subscribed' | 'denied' | 'pending';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('idle');

  // Detect current state
  useEffect(() => {
    if (!isSupported()) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? 'subscribed' : 'idle'))
      .catch(() => setStatus('idle'));
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported()) return;
    setStatus('pending');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'denied' : 'idle');
        return;
      }

      const { data } = await api.get('/push/vapid-key');
      const publicKey = data?.publicKey;
      if (!publicKey) {
        setStatus('idle');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } };
      await api.post('/push/subscribe', {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        userAgent: navigator.userAgent,
      });

      setStatus('subscribed');
    } catch (err) {
      console.warn('[push] subscribe failed', err);
      setStatus('idle');
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!isSupported()) return;
    setStatus('pending');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setStatus('idle');
    } catch {
      setStatus('idle');
    }
  }, []);

  return { status, subscribe, unsubscribe };
}
