import { useEffect, useState } from 'react';
import { Crown, ShieldCheck, Loader2, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';

interface SubscriptionTier { months: number; pricePls: string }
interface MerchantInfo {
  merchantTier: 'NONE' | 'TRUSTED' | 'OFFICIAL';
  merchantExpiresAt: string | null;
  merchantSince: string | null;
  verificationLevel: number;
  pricing: { applicationFeePls: string; subscriptionTiers: SubscriptionTier[] };
  latestApplication: null | {
    id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    description: string;
    contactInfo: string | null;
    requestedMonths: number;
    reviewNotes: string | null;
    createdAt: string;
    reviewedAt: string | null;
  };
}

export function MerchantSection() {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);
  const [info, setInfo] = useState<MerchantInfo | null>(null);
  const [showApply, setShowApply] = useState(false);

  const load = () => {
    api.get('/merchant/me').then(({ data }) => setInfo(data)).catch(() => setInfo(null));
  };
  useEffect(load, []);

  if (!info) return null;

  const [renewOpen, setRenewOpen] = useState(false);
  const renew = async (months: number, pricePls: string) => {
    if (!confirm(tx(
      `Продлить подписку на ${months} мес за ${BigInt(pricePls).toLocaleString()} PLS?`,
      `Renew subscription for ${months} mo at ${BigInt(pricePls).toLocaleString()} PLS?`,
    ))) return;
    try {
      await api.post('/merchant/renew', { months });
      toast.success(tx(`Продлено на ${months} мес`, `Renewed for ${months} mo`));
      setRenewOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? tx('Ошибка', 'Error'));
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        {info.merchantTier === 'OFFICIAL' ? <Crown size={16} className="text-amber-400" />
          : info.merchantTier === 'TRUSTED' ? <ShieldCheck size={16} className="text-cyan-400" />
          : <ShieldCheck size={16} className="text-gray-500" />}
        <span className="text-sm font-medium">{tx('Статус мерчанта', 'Merchant status')}</span>
      </div>

      {/* Current tier */}
      <div className="rounded-xl bg-dark-700/50 border border-dark-500 p-3">
        <TierBadge tier={info.merchantTier} ru={ru} />
        {info.merchantTier === 'OFFICIAL' && info.merchantExpiresAt && (
          <p className="text-[11px] text-gray-400 mt-1">
            {tx('Подписка до', 'Subscription until')} <span className="font-mono tabular-nums">{new Date(info.merchantExpiresAt).toLocaleDateString()}</span>
            {info.merchantSince && (
              <> · {tx('с', 'since')} {new Date(info.merchantSince).toLocaleDateString()}</>
            )}
          </p>
        )}
        {info.merchantTier === 'OFFICIAL' && (
          <>
            <button
              onClick={() => setRenewOpen((v) => !v)}
              className="mt-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-xs font-bold"
            >
              {renewOpen ? tx('Свернуть', 'Hide') : tx('Продлить', 'Renew')}
            </button>
            {renewOpen && (
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {info.pricing.subscriptionTiers.map((tier) => (
                  <button
                    key={tier.months}
                    onClick={() => renew(tier.months, tier.pricePls)}
                    className="px-2 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-[11px]"
                  >
                    <div className="font-bold text-amber-300">{tier.months} {tx('мес', 'mo')}</div>
                    <div className="text-gray-300 tabular-nums">{BigInt(tier.pricePls).toLocaleString()} PLS</div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* TRUSTED criteria explanation */}
      {info.merchantTier !== 'OFFICIAL' && (
        <p className="text-[11px] text-gray-400 leading-relaxed">
          {tx(
            'TRUSTED — автоматически: ≥10 успешных сделок, 0 disputes за 30 дней, аккаунт ≥60 дней. Бесплатно.',
            'TRUSTED — automatic: ≥10 successful trades, 0 disputes in 30d, account ≥60d. Free.',
          )}
        </p>
      )}

      {/* OFFICIAL pitch + apply CTA */}
      {info.merchantTier !== 'OFFICIAL' && !info.latestApplication && (
        <>
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-yellow-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Crown size={14} className="text-amber-400" />
              <span className="text-xs font-bold text-amber-300">{tx('Official Merchant', 'Official Merchant')}</span>
            </div>
            <ul className="text-[11px] text-gray-300 space-y-1 list-disc list-inside">
              <li>{tx('Золотая иконка-корона на твоих объявлениях', 'Gold crown badge on your offers')}</li>
              <li>{tx('Прикреплён в верх marketplace выше обычных продавцов', 'Pinned above regular offers in marketplace')}</li>
              <li>{tx('Платформенная комиссия 0.5% вместо 1%', '0.5% platform fee instead of 1%')}</li>
              <li>{tx('Приоритет в спорах и арбитраже', 'Dispute priority')}</li>
            </ul>
            <p className="text-[10px] text-gray-400">
              {tx(
                `Стоимость: ${BigInt(info.pricing.applicationFeePls).toLocaleString()} PLS заявка (невозвратно). Подписку выберешь при подаче — от ${BigInt(info.pricing.subscriptionTiers[0].pricePls).toLocaleString()} PLS за месяц до ${BigInt(info.pricing.subscriptionTiers[info.pricing.subscriptionTiers.length - 1].pricePls).toLocaleString()} PLS за год (списывается при одобрении).`,
                `Cost: ${BigInt(info.pricing.applicationFeePls).toLocaleString()} PLS application (non-refundable). You'll pick a subscription length when applying — from ${BigInt(info.pricing.subscriptionTiers[0].pricePls).toLocaleString()} PLS for 1 month to ${BigInt(info.pricing.subscriptionTiers[info.pricing.subscriptionTiers.length - 1].pricePls).toLocaleString()} PLS for 1 year (charged on approval).`,
              )}
            </p>
          </div>
          <button
            onClick={() => setShowApply(true)}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-sm font-bold"
          >
            {tx('Подать заявку', 'Apply')}
          </button>
        </>
      )}

      {/* Application status banner */}
      {info.latestApplication && info.latestApplication.status === 'PENDING' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2 text-xs">
          <Clock size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-300">{tx('Заявка на рассмотрении', 'Application under review')}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {tx('Подана', 'Submitted')} {new Date(info.latestApplication.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}
      {info.latestApplication && info.latestApplication.status === 'REJECTED' && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-400" />
            <p className="font-semibold text-rose-300">{tx('Заявка отклонена', 'Application rejected')}</p>
          </div>
          {info.latestApplication.reviewNotes && (
            <p className="text-[11px] text-gray-300">{tx('Причина', 'Reason')}: {info.latestApplication.reviewNotes}</p>
          )}
          <button onClick={() => setShowApply(true)} className="text-[11px] text-primary-400 hover:text-primary-300 underline mt-1">
            {tx('Подать ещё раз', 'Apply again')}
          </button>
        </div>
      )}

      {showApply && <ApplyModal onClose={() => { setShowApply(false); load(); }} pricing={info.pricing} ru={ru} />}
    </div>
  );
}

function TierBadge({ tier, ru }: { tier: MerchantInfo['merchantTier']; ru: boolean }) {
  if (tier === 'OFFICIAL') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30">
        <Crown size={12} className="text-amber-400" />
        <span className="text-xs font-bold text-amber-300">Official Merchant</span>
      </div>
    );
  }
  if (tier === 'TRUSTED') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30">
        <ShieldCheck size={12} className="text-cyan-400" />
        <span className="text-xs font-bold text-cyan-300">Trusted Trader</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-dark-500 text-gray-400">
      <span className="text-xs">{ru ? 'Обычный пользователь' : 'Regular user'}</span>
    </div>
  );
}

function ApplyModal({ onClose, pricing, ru }: { onClose: () => void; pricing: MerchantInfo['pricing']; ru: boolean }) {
  const tx = (r: string, e: string) => (ru ? r : e);
  const [description, setDescription] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [months, setMonths] = useState<number>(12);
  const [busy, setBusy] = useState(false);

  const tier = pricing.subscriptionTiers.find((t) => t.months === months) ?? pricing.subscriptionTiers[pricing.subscriptionTiers.length - 1];

  const submit = async () => {
    if (description.trim().length < 30) {
      toast.error(tx('Опиши бизнес минимум в 30 символов', 'Describe your business in at least 30 characters'));
      return;
    }
    setBusy(true);
    try {
      await api.post('/merchant/apply', { description, contactInfo, months });
      toast.success(tx('Заявка отправлена', 'Application submitted'));
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? tx('Ошибка', 'Error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-dark-700 rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-1">{tx('Заявка на Official Merchant', 'Official Merchant application')}</h3>
        <p className="text-xs text-gray-400 mb-4">
          {tx(
            `Заявочный взнос ${BigInt(pricing.applicationFeePls).toLocaleString()} PLS спишется сразу. После одобрения админом — выбранная подписка ниже.`,
            `Application fee ${BigInt(pricing.applicationFeePls).toLocaleString()} PLS charges immediately. On approval, the selected subscription below is charged.`,
          )}
        </p>

        <div className="mb-3">
          <span className="text-xs text-gray-400 mb-1.5 block">{tx('Срок подписки', 'Subscription length')}</span>
          <div className="grid grid-cols-4 gap-1.5">
            {pricing.subscriptionTiers.map((t) => (
              <button
                key={t.months}
                type="button"
                onClick={() => setMonths(t.months)}
                className={`px-2 py-2 rounded-lg text-[11px] border transition-colors ${
                  months === t.months
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'border-dark-500 hover:border-amber-500/40 text-gray-300'
                }`}
              >
                <div className="font-bold">{t.months} {tx('мес', 'mo')}</div>
                <div className="text-[10px] tabular-nums opacity-80">{BigInt(t.pricePls).toLocaleString()}</div>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-500 mt-1.5">
            {tx('Итог при одобрении', 'On approval')}: <span className="text-amber-300 font-semibold">{BigInt(tier.pricePls).toLocaleString()} PLS</span>
          </p>
        </div>

        <label className="block mb-3">
          <span className="text-xs text-gray-400 mb-1 block">{tx('О бизнесе (мин. 30 символов)', 'About your business (min 30 chars)')}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-primary-500 focus:outline-none resize-none"
            placeholder={tx(
              'Кто ты, какой объём планируешь, какие платёжные методы поддерживаешь, ссылки на профиль/каналы для проверки.',
              'Who you are, expected volume, payment methods supported, links to profile/channels for verification.',
            )}
          />
          <p className="text-[10px] text-gray-500 mt-1 text-right tabular-nums">{description.length} / 2000</p>
        </label>

        <label className="block mb-4">
          <span className="text-xs text-gray-400 mb-1 block">{tx('Контакт (опционально)', 'Contact (optional)')}</span>
          <input
            type="text"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-primary-500 focus:outline-none"
            placeholder={tx('Telegram @username, email — на случай если админу нужны уточнения', 'Telegram @username, email — for admin clarifications')}
          />
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 bg-dark-500 hover:bg-dark-400 rounded-lg text-sm font-medium">{tx('Отмена', 'Cancel')}</button>
          <button onClick={submit} disabled={busy} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-sm font-bold disabled:opacity-50">
            {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : tx('Подать', 'Submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
