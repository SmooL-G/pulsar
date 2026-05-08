import { useEffect, useRef, useState } from 'react';
import { X, Loader2, Clock, AlertTriangle, CheckCircle2, XCircle, Sparkles, Send, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';
import { formatFiat, plsToFiat, useDisplayCurrency, usePlsPrice } from '../../hooks/usePlsPrice';

interface Trade {
  id: string;
  offerId: string;
  offerTerms: string;
  pricePerPlsUsd: number;
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
  buyer: { id: string; username: string; displayName: string | null };
  seller: { id: string; username: string; displayName: string | null };
}

export function TradeDetailModal({ tradeId, onClose }: { tradeId: string; onClose: () => void }) {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [busy, setBusy] = useState(false);
  const [paymentNote, setPaymentNote] = useState('');
  const snap = usePlsPrice();
  const currency = useDisplayCurrency((s) => s.currency);

  const load = async () => {
    try {
      const { data } = await api.get(`/p2p/trades/${tradeId}`);
      setTrade(data.trade);
    } catch {
      toast.error(tx('Сделка не найдена', 'Trade not found'));
      onClose();
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5000); // refresh every 5s for status
    return () => clearInterval(id);
  }, [tradeId]);

  // Live countdown for PENDING_PAYMENT trades
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!trade) {
    return (
      <Wrap onClose={onClose}>
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-gray-500" />
        </div>
      </Wrap>
    );
  }

  const remaining = Math.max(0, new Date(trade.expiresAt).getTime() - now);
  const remMin = Math.floor(remaining / 60000);
  const remSec = Math.floor((remaining % 60000) / 1000);

  const counterparty = trade.myRole === 'buyer' ? trade.seller : trade.buyer;
  const totalDisplay = snap ? trade.totalPriceUsd * snap.fx[currency] : trade.totalPriceUsd;

  const action = async (path: string, body?: any, success?: string) => {
    setBusy(true);
    try {
      await api.post(`/p2p/trades/${tradeId}/${path}`, body ?? {});
      toast.success(success ?? tx('Готово', 'Done'));
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? tx('Ошибка', 'Error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Wrap onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold">
          {trade.myRole === 'buyer' ? tx('Покупка PLS', 'Buying PLS') : tx('Продажа PLS', 'Selling PLS')}
        </h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-dark-500"><X size={16} /></button>
      </div>

      <div className="space-y-3">
        <StatusBanner trade={trade} ru={ru} remainingMs={remaining} />

        <div className="rounded-xl bg-dark-800 p-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{tx('Сумма', 'Amount')}</p>
            <p className="font-bold tabular-nums">{BigInt(trade.amount).toLocaleString()} PLS</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{tx('К оплате', 'Fiat total')}</p>
            <p className="font-bold tabular-nums text-emerald-300">{formatFiat(totalDisplay, currency)}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">
              {trade.myRole === 'buyer' ? tx('Продавец', 'Seller') : tx('Покупатель', 'Buyer')}
            </p>
            <p className="font-medium">@{counterparty.username}</p>
          </div>
        </div>

        <div className="rounded-xl border border-dark-500 p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{tx('Условия и реквизиты', 'Terms & details')}</p>
          <p className="text-sm text-gray-100 whitespace-pre-wrap">{trade.offerTerms}</p>
        </div>

        {trade.paymentNote && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
            <p className="text-[10px] text-cyan-400 uppercase tracking-wider mb-1">{tx('Заметка', 'Note from buyer')}</p>
            <p className="text-sm text-gray-100 whitespace-pre-wrap">{trade.paymentNote}</p>
          </div>
        )}

        {/* ─── Buyer actions ─── */}
        {trade.status === 'PENDING_PAYMENT' && trade.myRole === 'buyer' && (
          <div className="space-y-2">
            <textarea
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              rows={2}
              className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-primary-500 focus:outline-none resize-none"
              placeholder={tx('Опционально: ID транзакции, заметка для продавца', 'Optional: transaction ID, note to seller')}
            />
            <div className="flex gap-2">
              <button
                onClick={() => action('cancel', { reason: 'Buyer cancelled' }, tx('Отменено', 'Cancelled'))}
                disabled={busy}
                className="flex-1 py-2.5 bg-dark-500 hover:bg-dark-400 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {tx('Отменить', 'Cancel')}
              </button>
              <button
                onClick={() => action('paid', { note: paymentNote }, tx('Оплата отмечена', 'Marked paid'))}
                disabled={busy}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : tx('Я оплатил', 'I paid')}
              </button>
            </div>
          </div>
        )}

        {/* ─── Seller actions ─── */}
        {trade.status === 'PENDING_PAYMENT' && trade.myRole === 'seller' && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-300">
            {tx('Ждём пока покупатель отправит оплату и нажмёт «Я оплатил».', 'Waiting for buyer to send payment and mark paid.')}
          </div>
        )}

        {trade.status === 'PAID' && trade.myRole === 'seller' && (
          <div className="space-y-2">
            <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-3 text-xs text-cyan-300">
              {tx('Покупатель отметил оплату. Проверь поступление средств и нажми «Подтвердить и отпустить» — PLS уйдёт покупателю.', 'Buyer marked paid. Verify funds arrived and press release — PLS will be sent to buyer.')}
            </div>
            <button
              onClick={() => action('release', undefined, tx('PLS отправлены', 'PLS released'))}
              disabled={busy}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : tx('Подтвердить и отпустить PLS', 'Release PLS')}
            </button>
            <button
              onClick={() => {
                const reason = prompt(tx('Опиши проблему для админа', 'Describe the issue for admin'));
                if (reason) action('dispute', { reason }, tx('Спор открыт', 'Dispute opened'));
              }}
              disabled={busy}
              className="w-full py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 rounded-lg text-xs font-medium"
            >
              {tx('Открыть спор', 'Open dispute')}
            </button>
          </div>
        )}

        {trade.status === 'PAID' && trade.myRole === 'buyer' && (
          <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-3 text-xs text-cyan-300">
            {tx('Ждём подтверждения от продавца. Если он не отвечает — открой спор.', 'Waiting for seller confirmation. If they go silent — open a dispute.')}
            <button
              onClick={() => {
                const reason = prompt(tx('Опиши проблему для админа', 'Describe the issue for admin'));
                if (reason) action('dispute', { reason }, tx('Спор открыт', 'Dispute opened'));
              }}
              className="w-full mt-2 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 rounded-lg text-xs font-medium"
            >
              {tx('Открыть спор', 'Open dispute')}
            </button>
          </div>
        )}

        {trade.status === 'RELEASED' && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 size={14} />
            {tx('Сделка завершена. ', 'Trade completed. ')}
            {trade.releasedAt && new Date(trade.releasedAt).toLocaleString()}
          </div>
        )}

        {trade.status === 'CANCELLED' && (
          <div className="rounded-xl bg-gray-500/10 border border-gray-500/20 p-3 text-xs text-gray-400 flex items-center gap-2">
            <XCircle size={14} />
            {tx('Сделка отменена', 'Trade cancelled')}
          </div>
        )}

        {trade.status === 'DISPUTED' && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle size={14} />
            {tx('Идёт разбирательство — админ свяжется с обеими сторонами.', 'Dispute in progress — admin will contact both parties.')}
          </div>
        )}

        {/* In-trade chat — buyer/seller can coordinate (СБП-номера, скрин чека, etc) */}
        <TradeChat tradeId={trade.id} myUserId={trade.myRole === 'buyer' ? trade.buyer.id : trade.seller.id} ru={ru} />
      </div>
    </Wrap>
  );
}

interface TradeMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
}

function TradeChat({ tradeId, myUserId, ru }: { tradeId: string; myUserId: string; ru: boolean }) {
  const tx = (r: string, e: string) => (ru ? r : e);
  const [messages, setMessages] = useState<TradeMessage[] | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const { data } = await api.get(`/p2p/trades/${tradeId}/messages`);
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => {
    load();
    // Poll every 3s while modal is open. Tradeoff vs sockets: simpler,
    // and the modal is short-lived (typically < 30 min for an active trade).
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [tradeId]);

  // Auto-scroll to newest message when count grows.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages?.length]);

  const send = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/p2p/trades/${tradeId}/messages`, { content });
      setMessages((prev) => [...(prev ?? []), data.message]);
      setInput('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? tx('Не отправилось', 'Send failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-dark-500 bg-dark-800/40 overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-1.5 text-[11px] text-gray-400 border-b border-dark-500/50">
        <MessageSquare size={11} />
        {tx('Чат сделки', 'Trade chat')}
        {messages && messages.length > 0 && (
          <span className="text-gray-500 ml-auto tabular-nums">{messages.length}</span>
        )}
      </div>

      <div ref={listRef} className="max-h-48 overflow-y-auto px-3 py-2 space-y-1.5">
        {messages === null && (
          <div className="flex justify-center py-2">
            <Loader2 size={14} className="animate-spin text-gray-500" />
          </div>
        )}
        {messages && messages.length === 0 && (
          <p className="text-[11px] text-gray-500 italic text-center py-2">
            {tx('Напиши первым — обсуди детали платежа', 'Say hi — coordinate the payment')}
          </p>
        )}
        {messages?.map((m) => {
          const isMine = m.senderId === myUserId;
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs whitespace-pre-wrap break-words ${
                  isMine
                    ? 'bg-primary-500/30 text-primary-50'
                    : 'bg-dark-600 text-gray-100'
                }`}
                title={new Date(m.createdAt).toLocaleString()}
              >
                {!isMine && (
                  <div className="text-[9px] text-gray-400 mb-0.5">@{m.sender.username}</div>
                )}
                {m.content}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 p-2 border-t border-dark-500/50 bg-dark-800/60">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          maxLength={2000}
          placeholder={tx('Сообщение…', 'Message…')}
          className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-gray-500 focus:border-primary-500 focus:outline-none"
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          className="p-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:opacity-40"
          title={tx('Отправить', 'Send')}
        >
          {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        </button>
      </div>
    </div>
  );
}

function Wrap({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-dark-700 rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function StatusBanner({ trade, ru, remainingMs }: { trade: Trade; ru: boolean; remainingMs: number }) {
  const tx = (r: string, e: string) => (ru ? r : e);
  if (trade.status === 'PENDING_PAYMENT') {
    const min = Math.floor(remainingMs / 60000);
    const sec = Math.floor((remainingMs % 60000) / 1000);
    return (
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex items-center gap-2">
        <Clock size={16} className="text-amber-400 shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-amber-300">{tx('Ждёт оплату', 'Awaiting payment')}</p>
          <p className="text-[11px] text-amber-200/70 tabular-nums">
            {tx('Авто-отмена через', 'Auto-cancel in')} {min}:{sec.toString().padStart(2, '0')}
          </p>
        </div>
      </div>
    );
  }
  return null;
}
