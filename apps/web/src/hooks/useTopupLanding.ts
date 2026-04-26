import { useEffect } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

/**
 * On app mount, if the URL has ?topup=ok and we previously stored a
 * payment id (set right before redirecting to YooKassa), poll the
 * /wallet/topup/check endpoint until the purchase is PAID or CANCELLED.
 * The endpoint is idempotent — webhook may have credited it already.
 */
export function useTopupLanding() {
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('topup') !== 'ok') return;
    const pid = (() => {
      try { return localStorage.getItem('pulsar_pending_topup'); } catch { return null; }
    })();
    if (!pid) return;

    let stopped = false;
    let attempts = 0;
    const maxAttempts = 12; // ~1 minute total at 5s intervals

    const poll = async () => {
      if (stopped) return;
      attempts++;
      try {
        const { data } = await api.get(`/wallet/topup/check/${pid}`);
        const purchase = data.purchase;
        if (purchase?.status === 'PAID') {
          toast.success(`+${Number(purchase.amountPls).toLocaleString()} PLS`);
          try { localStorage.removeItem('pulsar_pending_topup'); } catch {}
          // Refresh user (PLS balance is on /auth/me).
          try {
            const me = await api.get('/auth/me');
            setUser(me.data);
          } catch {}
          // Strip ?topup=ok from URL without reload.
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
        if (purchase?.status === 'CANCELLED') {
          toast.error('Платёж отменён');
          try { localStorage.removeItem('pulsar_pending_topup'); } catch {}
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
      } catch { /* retry */ }
      if (attempts < maxAttempts) {
        setTimeout(poll, 5000);
      } else {
        // Give up polling but leave the pending id so a manual refresh can resume.
        toast('Платёж в обработке. Баланс обновится автоматически.', { icon: '⏳' });
        window.history.replaceState({}, '', window.location.pathname);
      }
    };
    poll();

    return () => { stopped = true; };
  }, [setUser]);
}
