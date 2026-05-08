import { useEffect, useState } from 'react';
import { Crown, Check, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';

interface PendingApp {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  description: string;
  contactInfo: string | null;
  applicationFeePls: string;
  requestedMonths?: number;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    verificationLevel: number;
    createdAt: string;
  };
}

export function MerchantAdminSection() {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);
  const [apps, setApps] = useState<PendingApp[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    api.get('/merchant/admin/applications?status=PENDING').then(({ data }) => setApps(data.applications ?? [])).catch(() => setApps([]));
  };
  useEffect(load, []);

  const approve = async (id: string) => {
    if (!confirm(tx('Одобрить заявку? С пользователя будет списана годовая подписка.', 'Approve? Annual subscription will be charged.'))) return;
    setBusy(id);
    try {
      await api.post(`/merchant/admin/applications/${id}/approve`);
      toast.success(tx('Одобрено', 'Approved'));
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? tx('Ошибка', 'Error'));
    } finally {
      setBusy(null);
    }
  };

  const reject = async (id: string) => {
    const notes = prompt(tx('Причина отказа (видна пользователю)', 'Rejection reason (visible to applicant)'));
    if (!notes || notes.trim().length < 5) {
      toast.error(tx('Нужна причина минимум 5 символов', 'Reason required, min 5 chars'));
      return;
    }
    setBusy(id);
    try {
      await api.post(`/merchant/admin/applications/${id}/reject`, { notes });
      toast.success(tx('Отклонено', 'Rejected'));
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? tx('Ошибка', 'Error'));
    } finally {
      setBusy(null);
    }
  };

  if (!apps) return null;

  return (
    <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Crown size={16} className="text-amber-400" />
        <span className="text-sm font-medium">{tx('Заявки мерчантов (админ)', 'Merchant applications (admin)')}</span>
        {apps.length > 0 && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold tabular-nums">
            {apps.length} {tx('в очереди', 'pending')}
          </span>
        )}
      </div>

      {apps.length === 0 && (
        <p className="text-xs text-gray-500 italic text-center py-2">{tx('Нет заявок в очереди', 'No pending applications')}</p>
      )}

      {apps.map((a) => (
        <div key={a.id} className="rounded-xl bg-dark-700/50 border border-dark-500 p-3 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-sm">{a.user.displayName || a.user.username}</span>
            <span className="text-[10px] text-gray-500">@{a.user.username}</span>
            <span className="text-[10px] text-gray-500">L{a.user.verificationLevel}</span>
            <span className="ml-auto text-[10px] text-gray-500 tabular-nums">{new Date(a.createdAt).toLocaleString()}</span>
          </div>
          <div className="rounded-lg bg-dark-800 p-2 text-xs text-gray-100 whitespace-pre-wrap">{a.description}</div>
          {a.contactInfo && (
            <p className="text-[11px] text-gray-400">
              <span className="text-gray-500">{tx('Контакт', 'Contact')}: </span>{a.contactInfo}
            </p>
          )}
          <p className="text-[10px] text-gray-500">
            {tx('Аккаунт с', 'Account from')} {new Date(a.user.createdAt).toLocaleDateString()} ·
            {tx(' взнос ', ' fee ')}{BigInt(a.applicationFeePls).toLocaleString()} PLS
            {a.requestedMonths && (
              <> · <span className="text-amber-300 font-semibold">{tx('хочет', 'wants')} {a.requestedMonths} {tx('мес', 'mo')}</span></>
            )}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => reject(a.id)}
              disabled={busy === a.id}
              className="flex-1 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <X size={12} />
              {tx('Отклонить', 'Reject')}
            </button>
            <button
              onClick={() => approve(a.id)}
              disabled={busy === a.id}
              className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {busy === a.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {tx('Одобрить', 'Approve')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
