import { useEffect } from 'react';
import { Zap, ZapOff, Loader2 } from 'lucide-react';
import { usePeerStore } from '../../p2p/peerStore';
import { useRelayStatusStore } from '../../p2p/relayStatusStore';
import { ensurePeer, dropPeer } from '../../p2p/PeerConnection';
import { useI18n } from '../../i18n';

interface Props {
  remoteUserId: string;
}

export function P2PIndicator({ remoteUserId }: Props) {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const entry = usePeerStore((s) => s.peers[remoteUserId]);
  const setEnabled = usePeerStore((s) => s.setEnabled);
  const relayLabel = useRelayStatusStore((s) => s.label);

  // Effect: when enabled flips on, open a peer; off → tear down.
  useEffect(() => {
    if (entry?.enabled && entry.state !== 'open' && entry.state !== 'connecting') {
      try { ensurePeer(remoteUserId); } catch { /* localUserId not set yet */ }
    }
    if (entry && !entry.enabled && entry.state !== 'idle' && entry.state !== 'closed') {
      dropPeer(remoteUserId, 'user-toggle-off');
    }
  }, [entry?.enabled, entry?.state, remoteUserId]);

  const enabled = !!entry?.enabled;
  const state = entry?.state ?? 'idle';

  // Add the relay label whenever we know which one the local browser
  // is currently subscribed to — answers the "where did my signaling
  // packets go" question directly in the tooltip.
  const viaSuffix = relayLabel && relayLabel !== '—'
    ? (ru ? ` · через ${relayLabel}` : ` · via ${relayLabel}`)
    : '';
  const tooltip = !enabled
    ? (ru ? 'Включить прямое соединение (P2P)' : 'Enable direct connection (P2P)')
    : state === 'open'
      ? (ru ? `Прямое соединение активно — мимо сервера${viaSuffix}` : `Direct connection active — bypassing server${viaSuffix}`)
      : state === 'connecting'
        ? (ru ? `Поднимаю прямое соединение…${viaSuffix}` : `Establishing direct connection…${viaSuffix}`)
        : state === 'failed'
          ? (ru ? 'Не получилось — отправка через сервер' : 'Direct connection failed — using server')
          : (ru ? `Прямое соединение готово${viaSuffix}` : `Direct ready${viaSuffix}`);

  return (
    <button
      onClick={() => {
        const next = !enabled;
        console.log('[P2PIndicator] toggle', { remoteUserId, was: enabled, next, state });
        setEnabled(remoteUserId, next);
      }}
      title={tooltip}
      className={`relative p-2 rounded-lg transition-colors ${
        enabled && state === 'open'
          ? 'text-emerald-500 hover:bg-emerald-500/10'
          : enabled && state === 'connecting'
            ? 'text-amber-400 hover:bg-amber-500/10'
            : enabled && state === 'failed'
              ? 'text-rose-400 hover:bg-rose-500/10'
              : enabled
                ? 'text-primary-500 hover:bg-primary-500/10'
                : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-500'
      }`}
    >
      {!enabled
        ? <ZapOff size={18} />
        : state === 'connecting'
          ? <Loader2 size={18} className="animate-spin" />
          : <Zap size={18} fill={state === 'open' ? 'currentColor' : 'none'} />}
      {/* Tiny dot to make state visible without hovering for a tooltip */}
      {enabled && (
        <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
          state === 'open' ? 'bg-emerald-500' :
          state === 'connecting' ? 'bg-amber-400 animate-pulse' :
          state === 'failed' ? 'bg-rose-500' :
          'bg-primary-400'
        }`} />
      )}
    </button>
  );
}
