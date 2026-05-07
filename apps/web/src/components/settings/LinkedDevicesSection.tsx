import { useEffect, useState } from 'react';
import { Smartphone, Trash2, Loader2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { getLocalIdentityPubB64 } from '../../crypto/keyManager';
import { useI18n } from '../../i18n';

interface Device {
  id: string;
  identityKeyPub: string;
  deviceName: string | null;
  createdAt: string;
  lastSeenAt: string;
}

function formatRelative(iso: string, ru: boolean): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return ru ? 'только что' : 'just now';
  if (min < 60) return ru ? `${min} мин назад` : `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return ru ? `${h} ч назад` : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return ru ? `${d} дн назад` : `${d}d ago`;
  return new Date(iso).toLocaleDateString(ru ? 'ru-RU' : 'en-US');
}

export function LinkedDevicesSection() {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [myPub, setMyPub] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = async () => {
    try {
      const [{ data }, pub] = await Promise.all([
        api.get('/keys/my-devices'),
        getLocalIdentityPubB64(),
      ]);
      setDevices(data.devices ?? []);
      setMyPub(pub);
    } catch {
      setDevices([]);
    }
  };

  useEffect(() => { load(); }, []);

  const revoke = async (id: string, isCurrent: boolean) => {
    if (isCurrent) {
      toast.error(ru
        ? 'Нельзя отозвать текущее устройство — выйди из аккаунта вместо этого'
        : "Can't revoke current device — sign out instead");
      return;
    }
    if (!confirm(ru
      ? 'Отозвать устройство? Оно перестанет получать новые сообщения.'
      : 'Revoke device? It will stop receiving new messages.')) return;
    setRevoking(id);
    try {
      await api.delete(`/keys/devices/${id}`);
      setDevices((d) => d?.filter((x) => x.id !== id) ?? null);
      toast.success(ru ? 'Устройство отозвано' : 'Device revoked');
    } catch {
      toast.error(ru ? 'Не удалось отозвать' : 'Revoke failed');
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Smartphone size={16} className="text-cyan-400" />
        <span className="text-sm font-medium">
          {ru ? 'Связанные устройства' : 'Linked devices'}
        </span>
      </div>
      <p className="text-xs text-gray-400">
        {ru
          ? 'Каждое устройство имеет свою пару E2E-ключей. Сообщения шифруются для всех связанных устройств — ты видишь чат на любом из них.'
          : 'Each device holds its own E2E keypair. Messages are encrypted for every linked device — you see the chat on any of them.'}
      </p>

      {devices === null && (
        <div className="flex justify-center py-3">
          <Loader2 size={16} className="animate-spin text-gray-400" />
        </div>
      )}

      {devices && devices.length === 0 && (
        <p className="text-xs text-gray-500 italic">
          {ru ? 'Нет зарегистрированных устройств' : 'No registered devices'}
        </p>
      )}

      {devices && devices.length > 0 && (
        <ul className="space-y-2">
          {devices.map((d) => {
            const isCurrent = !!myPub && d.identityKeyPub === myPub;
            return (
              <li
                key={d.id}
                className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${
                  isCurrent
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-dark-500 bg-dark-700/50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="truncate">{d.deviceName || (ru ? 'Без названия' : 'Unnamed')}</span>
                    {isCurrent && (
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-400 shrink-0">
                        <ShieldCheck size={10} />
                        {ru ? 'это устройство' : 'this device'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {ru ? 'Активно ' : 'Last seen '}{formatRelative(d.lastSeenAt, ru)}
                  </p>
                </div>
                <button
                  onClick={() => revoke(d.id, isCurrent)}
                  disabled={revoking === d.id}
                  className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors disabled:opacity-40"
                  title={ru ? 'Отозвать' : 'Revoke'}
                >
                  {revoking === d.id
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Trash2 size={14} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
