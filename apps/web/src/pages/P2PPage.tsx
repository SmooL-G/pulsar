import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Coins, Plus, Loader2, Tag, Trash2, ChevronRight,
  AlertTriangle, CheckCircle2, XCircle, Clock, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../i18n';
import {
  formatFiat,
  plsToFiat,
  useDisplayCurrency,
  usePlsPrice,
  CURRENCIES,
  type Currency,
} from '../hooks/usePlsPrice';
import { TradeDetailModal } from '../components/p2p/TradeDetailModal';

interface Offer {
  id: string;
  seller: { id: string; username: string; displayName: string | null; avatarUrl: string | null; verificationLevel: number };
  pricePerPlsUsd: number;
  totalAmount: string;
  remainingAmount: string;
  minTrade: string;
  maxTrade: string;
  terms: string;
  createdAt: string;
}

interface MyOffer {
  id: string;
  pricePerPlsUsd: number;
  totalAmount: string;
  remainingAmount: string;
  minTrade: string;
  maxTrade: string;
  terms: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

interface Trade {
  id: string;
  offerId: string;
  amount: string;
  totalPriceUsd: number;
  status: 'PENDING_PAYMENT' | 'PAID' | 'RELEASED' | 'CANCELLED' | 'DISPUTED';
  paymentNote: string | null;
  paidAt: string | null;
  releasedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string;
  createdAt: string;
  myRole: 'buyer' | 'seller';
  buyer: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  seller: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
}

type Tab = 'browse' | 'mine' | 'trades';

export function P2PPage() {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('browse');
  const [openTradeId, setOpenTradeId] = useState<string | null>(null);

  return (
    <div className="bg-dark-900 text-white min-h-screen">
      <div className="border-b border-dark-600 bg-dark-800/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-1.5 rounded-lg hover:bg-dark-600 text-gray-400">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Coins size={18} className="text-amber-400" />
            P2P {tx('Биржа', 'Exchange')}
          </h1>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
            {tx('beta', 'beta')}
          </span>
        </div>
        <div className="max-w-3xl mx-auto px-4 flex gap-1">
          {(['browse', 'mine', 'trades'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-primary-500 text-white' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {t === 'browse' && tx('Объявления', 'Marketplace')}
              {t === 'mine' && tx('Мои объявления', 'My offers')}
              {t === 'trades' && tx('Мои сделки', 'My trades')}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {tab === 'browse' && <BrowseTab onOpenTrade={(id) => setOpenTradeId(id)} ru={ru} />}
        {tab === 'mine' && <MyOffersTab ru={ru} />}
        {tab === 'trades' && <MyTradesTab onOpen={(id) => setOpenTradeId(id)} ru={ru} />}
      </div>

      {openTradeId && (
        <TradeDetailModal
          tradeId={openTradeId}
          onClose={() => setOpenTradeId(null)}
        />
      )}
    </div>
  );
}

// ─── BROWSE TAB ─────────────────────────────────────────

function BrowseTab({ onOpenTrade, ru }: { onOpenTrade: (id: string) => void; ru: boolean }) {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [openTradeFor, setOpenTradeFor] = useState<Offer | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const tx = (r: string, e: string) => (ru ? r : e);

  const load = async () => {
    try {
      const { data } = await api.get('/p2p/offers');
      setOffers(data.offers ?? []);
    } catch {
      setOffers([]);
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-gray-400">
          {tx('Покупай PLS у других пользователей за СБП / USDT / любым удобным способом', 'Buy PLS from other users via local payments')}
        </h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={14} />
          {tx('Продать', 'Sell PLS')}
        </button>
      </div>

      {offers === null && (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-gray-500" />
        </div>
      )}

      {offers && offers.length === 0 && (
        <div className="rounded-xl border border-dashed border-dark-500 p-8 text-center">
          <Tag size={28} className="mx-auto text-gray-500 mb-2" />
          <p className="text-sm text-gray-400">{tx('Пока нет активных объявлений — будь первым!', 'No active offers yet — be the first!')}</p>
        </div>
      )}

      {offers && offers.length > 0 && (
        <div className="space-y-2">
          {offers.map((o) => <OfferCard key={o.id} offer={o} onBuy={() => setOpenTradeFor(o)} ru={ru} />)}
        </div>
      )}

      {showCreate && <CreateOfferModal onClose={() => { setShowCreate(false); load(); }} ru={ru} />}
      {openTradeFor && (
        <OpenTradeModal
          offer={openTradeFor}
          onClose={() => setOpenTradeFor(null)}
          onOpened={(tradeId) => { setOpenTradeFor(null); load(); onOpenTrade(tradeId); }}
          ru={ru}
        />
      )}
    </div>
  );
}

function OfferCard({ offer, onBuy, ru }: { offer: Offer; onBuy: () => void; ru: boolean }) {
  const snap = usePlsPrice();
  const currency = useDisplayCurrency((s) => s.currency);
  const tx = (r: string, e: string) => (ru ? r : e);
  const remaining = BigInt(offer.remainingAmount);
  const minT = BigInt(offer.minTrade);
  const maxT = BigInt(offer.maxTrade);

  // Render seller's USD price in user's local currency (purely informational)
  const priceInDisplayCcy = snap ? offer.pricePerPlsUsd * snap.fx[currency] : null;

  return (
    <div className="rounded-2xl border border-dark-500 bg-dark-700/50 p-4 hover:border-primary-500/40 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center font-bold text-sm shrink-0">
          {(offer.seller.displayName || offer.seller.username).slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-medium truncate">{offer.seller.displayName || offer.seller.username}</span>
            <span className="text-[11px] text-gray-500">@{offer.seller.username}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-500">{tx('Цена за 1 PLS', 'Price per PLS')}</p>
              <p className="font-bold text-emerald-400 tabular-nums">
                {priceInDisplayCcy !== null ? formatFiat(priceInDisplayCcy, currency, 6) : '—'}
              </p>
            </div>
            <div>
              <p className="text-gray-500">{tx('Доступно', 'Available')}</p>
              <p className="font-bold tabular-nums">{remaining.toLocaleString()} PLS</p>
            </div>
          </div>
          {(minT > 0n || maxT > 0n) && (
            <p className="text-[10px] text-gray-500 mt-1">
              {tx('Лимит', 'Limit')}: {minT > 0n ? minT.toLocaleString() : '—'}–{maxT > 0n ? maxT.toLocaleString() : '∞'} PLS
            </p>
          )}
          <p className="text-xs text-gray-300 mt-2 line-clamp-2 whitespace-pre-wrap">{offer.terms}</p>
        </div>
        <button
          onClick={onBuy}
          className="px-3 py-1.5 bg-primary-500/15 hover:bg-primary-500/25 text-primary-300 rounded-lg text-xs font-semibold transition-colors shrink-0"
        >
          {tx('Купить', 'Buy')}
        </button>
      </div>
    </div>
  );
}

// ─── CREATE OFFER ───────────────────────────────────────

function CreateOfferModal({ onClose, ru }: { onClose: () => void; ru: boolean }) {
  const tx = (r: string, e: string) => (ru ? r : e);
  const [amount, setAmount] = useState('');
  const [pricePerPls, setPricePerPls] = useState('');
  const [minTrade, setMinTrade] = useState('');
  const [maxTrade, setMaxTrade] = useState('');
  const [terms, setTerms] = useState('');
  const [busy, setBusy] = useState(false);
  const currency = useDisplayCurrency((s) => s.currency);
  const snap = usePlsPrice();

  const submit = async () => {
    if (!amount || !pricePerPls || terms.trim().length < 5) {
      toast.error(tx('Заполни все обязательные поля', 'Fill all required fields'));
      return;
    }
    setBusy(true);
    try {
      // Convert price from display currency to USD before sending.
      const priceInDisplay = Number(pricePerPls);
      const priceUsd = snap ? priceInDisplay / snap.fx[currency] : priceInDisplay;
      await api.post('/p2p/offers', {
        pricePerPlsUsd: priceUsd,
        totalAmount: amount,
        minTrade: minTrade || 0,
        maxTrade: maxTrade || 0,
        terms,
      });
      toast.success(tx('Объявление опубликовано', 'Offer posted'));
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
        <h3 className="text-lg font-bold mb-1">{tx('Продать PLS', 'Sell PLS')}</h3>
        <p className="text-xs text-gray-400 mb-4">{tx('Твои PLS залочатся в эскроу до завершения сделки. Комиссия платформы 1%.', 'Your PLS will be escrowed until the trade completes. 1% platform fee.')}</p>

        <Field label={tx('Сколько PLS продаёшь', 'PLS amount')}>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" placeholder="100000" />
        </Field>

        <Field label={`${tx('Цена за 1 PLS', 'Price per 1 PLS')} (${currency})`}>
          <input type="number" step="0.000001" value={pricePerPls} onChange={(e) => setPricePerPls(e.target.value)} className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" placeholder="0.001" />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label={tx('Мин. сделка', 'Min trade')}>
            <input type="number" value={minTrade} onChange={(e) => setMinTrade(e.target.value)} className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" placeholder="0" />
          </Field>
          <Field label={tx('Макс. сделка', 'Max trade')}>
            <input type="number" value={maxTrade} onChange={(e) => setMaxTrade(e.target.value)} className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" placeholder="∞" />
          </Field>
        </div>

        <Field label={tx('Условия и реквизиты', 'Terms & payment details')}>
          <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={4} className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:outline-none resize-none" placeholder={tx('СБП Сбербанк +7 900 123 45 67, оплата в течение 30 минут', 'SBP / USDT TRC-20: TXyz... — pay within 30 min')} />
        </Field>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 bg-dark-500 hover:bg-dark-400 rounded-lg text-sm font-medium">{tx('Отмена', 'Cancel')}</button>
          <button onClick={submit} disabled={busy} className="flex-1 py-2.5 bg-primary-500 hover:bg-primary-600 rounded-lg text-sm font-bold disabled:opacity-50">
            {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : tx('Опубликовать', 'Post offer')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="text-xs text-gray-400 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

// ─── OPEN TRADE ─────────────────────────────────────────

function OpenTradeModal({ offer, onClose, onOpened, ru }: { offer: Offer; onClose: () => void; onOpened: (tradeId: string) => void; ru: boolean }) {
  const tx = (r: string, e: string) => (ru ? r : e);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const snap = usePlsPrice();
  const currency = useDisplayCurrency((s) => s.currency);
  const remaining = BigInt(offer.remainingAmount);
  const minT = BigInt(offer.minTrade);
  const maxT = BigInt(offer.maxTrade);

  const amtNum = amount ? BigInt(amount) : 0n;
  const totalUsd = amtNum > 0n ? Number(amtNum) * offer.pricePerPlsUsd : 0;
  const totalDisplay = snap ? totalUsd * snap.fx[currency] : totalUsd;

  const valid =
    amtNum > 0n &&
    amtNum <= remaining &&
    (minT === 0n || amtNum >= minT) &&
    (maxT === 0n || amtNum <= maxT);

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/p2p/offers/${offer.id}/trades`, { amount: amount });
      toast.success(tx('Сделка открыта', 'Trade opened'));
      onOpened(data.trade.id);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? tx('Ошибка', 'Error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-dark-700 rounded-2xl w-full max-w-md p-5">
        <h3 className="text-lg font-bold mb-1">{tx('Купить у', 'Buy from')} {offer.seller.displayName || offer.seller.username}</h3>
        <p className="text-xs text-gray-400 mb-4">{tx('После открытия сделки у тебя 30 минут на оплату', 'After opening, you have 30 minutes to pay')}</p>

        <div className="rounded-xl bg-dark-800 p-3 mb-3 text-sm whitespace-pre-wrap">{offer.terms}</div>

        <Field label={tx('Сколько PLS купить', 'PLS amount')}>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:outline-none" placeholder="" />
        </Field>

        {amount && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 mb-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-gray-400">{tx('К оплате', 'You pay')}</span>
              <span className="font-bold text-emerald-300 tabular-nums text-base">{formatFiat(totalDisplay, currency)}</span>
            </div>
          </div>
        )}

        {!valid && amount && (
          <p className="text-xs text-rose-400 mb-3">
            {amtNum > remaining && tx(`Доступно только ${remaining}`, `Only ${remaining} available`)}
            {minT > 0n && amtNum < minT && tx(`Минимум ${minT}`, `Min ${minT}`)}
            {maxT > 0n && amtNum > maxT && tx(`Максимум ${maxT}`, `Max ${maxT}`)}
          </p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 bg-dark-500 hover:bg-dark-400 rounded-lg text-sm font-medium">{tx('Отмена', 'Cancel')}</button>
          <button onClick={submit} disabled={!valid || busy} className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-bold disabled:opacity-50 text-black">
            {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : tx('Открыть сделку', 'Open trade')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MY OFFERS ──────────────────────────────────────────

function MyOffersTab({ ru }: { ru: boolean }) {
  const [offers, setOffers] = useState<MyOffer[] | null>(null);
  const tx = (r: string, e: string) => (ru ? r : e);

  const load = async () => {
    try {
      const { data } = await api.get('/p2p/offers/mine');
      setOffers(data.offers ?? []);
    } catch {
      setOffers([]);
    }
  };
  useEffect(() => { load(); }, []);

  const cancel = async (id: string) => {
    if (!confirm(tx('Отменить объявление? PLS вернутся в кошелёк.', 'Cancel offer? PLS returns to wallet.'))) return;
    try {
      await api.delete(`/p2p/offers/${id}`);
      toast.success(tx('Отменено', 'Cancelled'));
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? tx('Ошибка', 'Error'));
    }
  };

  if (offers === null) return <Loader2 size={20} className="animate-spin mx-auto text-gray-500" />;
  if (offers.length === 0) return <p className="text-center text-gray-500 text-sm py-8">{tx('Нет объявлений', 'No offers yet')}</p>;

  return (
    <div className="space-y-2">
      {offers.map((o) => (
        <div key={o.id} className="rounded-xl border border-dark-500 bg-dark-700/50 p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs">
              <StatusPill status={o.status} ru={ru} />
              <span className="text-gray-500">{new Date(o.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-sm font-medium mt-1">
              {BigInt(o.remainingAmount).toLocaleString()} / {BigInt(o.totalAmount).toLocaleString()} PLS
              <span className="text-gray-500 ml-2 font-normal">@ ${o.pricePerPlsUsd}/PLS</span>
            </p>
            <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">{o.terms}</p>
          </div>
          {o.status === 'ACTIVE' && (
            <button onClick={() => cancel(o.id)} className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg" title={tx('Отменить', 'Cancel')}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── MY TRADES ──────────────────────────────────────────

function MyTradesTab({ onOpen, ru }: { onOpen: (id: string) => void; ru: boolean }) {
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const tx = (r: string, e: string) => (ru ? r : e);

  useEffect(() => {
    api.get('/p2p/trades/mine')
      .then(({ data }) => setTrades(data.trades ?? []))
      .catch(() => setTrades([]));
  }, []);

  if (trades === null) return <Loader2 size={20} className="animate-spin mx-auto text-gray-500" />;
  if (trades.length === 0) return <p className="text-center text-gray-500 text-sm py-8">{tx('Сделок ещё не было', 'No trades yet')}</p>;

  return (
    <div className="space-y-2">
      {trades.map((t) => {
        const counterparty = t.myRole === 'buyer' ? t.seller : t.buyer;
        return (
          <button
            key={t.id}
            onClick={() => onOpen(t.id)}
            className="w-full text-left rounded-xl border border-dark-500 bg-dark-700/50 hover:border-primary-500/40 p-3 flex items-center gap-3 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs">
                <TradeStatusPill status={t.status} ru={ru} />
                <span className="text-gray-500">{t.myRole === 'buyer' ? tx('покупаю у', 'buying from') : tx('продаю', 'selling to')} @{counterparty.username}</span>
              </div>
              <p className="text-sm font-medium mt-1 tabular-nums">
                {BigInt(t.amount).toLocaleString()} PLS · ${t.totalPriceUsd.toFixed(2)}
              </p>
            </div>
            <ChevronRight size={14} className="text-gray-500 shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

// ─── HELPERS ────────────────────────────────────────────

function StatusPill({ status, ru }: { status: MyOffer['status']; ru: boolean }) {
  const map: Record<MyOffer['status'], { label: { ru: string; en: string }; class: string }> = {
    ACTIVE: { label: { ru: 'активно', en: 'active' }, class: 'bg-emerald-500/15 text-emerald-300' },
    PAUSED: { label: { ru: 'на паузе', en: 'paused' }, class: 'bg-amber-500/15 text-amber-300' },
    COMPLETED: { label: { ru: 'завершено', en: 'completed' }, class: 'bg-gray-500/15 text-gray-400' },
    CANCELLED: { label: { ru: 'отменено', en: 'cancelled' }, class: 'bg-rose-500/15 text-rose-300' },
  };
  const m = map[status];
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider ${m.class}`}>{ru ? m.label.ru : m.label.en}</span>;
}

function TradeStatusPill({ status, ru }: { status: Trade['status']; ru: boolean }) {
  const map: Record<Trade['status'], { label: { ru: string; en: string }; class: string; icon: any }> = {
    PENDING_PAYMENT: { label: { ru: 'ждёт оплату', en: 'pending payment' }, class: 'bg-amber-500/15 text-amber-300', icon: Clock },
    PAID: { label: { ru: 'оплачено', en: 'paid' }, class: 'bg-cyan-500/15 text-cyan-300', icon: Sparkles },
    RELEASED: { label: { ru: 'завершено', en: 'released' }, class: 'bg-emerald-500/15 text-emerald-300', icon: CheckCircle2 },
    CANCELLED: { label: { ru: 'отменено', en: 'cancelled' }, class: 'bg-gray-500/15 text-gray-400', icon: XCircle },
    DISPUTED: { label: { ru: 'спор', en: 'dispute' }, class: 'bg-rose-500/15 text-rose-300', icon: AlertTriangle },
  };
  const m = map[status];
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider ${m.class}`}>
      <Icon size={10} />
      {ru ? m.label.ru : m.label.en}
    </span>
  );
}
