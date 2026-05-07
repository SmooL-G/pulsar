import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, X } from 'lucide-react';
import { useI18n } from '../../i18n';

const STORAGE_KEY = 'pulsar:p2p:risk-acknowledged-v1';

export function hasAcknowledgedP2PRisks(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function RiskWarningModal({
  onClose,
  onAccept,
}: {
  onClose: () => void;
  onAccept: () => void;
}) {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);
  const [agree, setAgree] = useState(false);

  const accept = () => {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* ignore */ }
    onAccept();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-dark-700 rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-400" />
            {tx('Важно: риски P2P-сделок', 'Important: P2P trade risks')}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-dark-500"><X size={16} /></button>
        </div>

        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 mb-3 text-xs space-y-2 text-amber-100">
          <p>
            {tx(
              'Pulsar только сводит покупателя и продавца, но НЕ контролирует переводы фиата и не возмещает убытки.',
              'Pulsar only matches buyer and seller — we do NOT process fiat transfers and do NOT reimburse losses.',
            )}
          </p>
          <p>
            {tx(
              'Совершай сделки ТОЛЬКО с проверенными пользователями. У новых аккаунтов начинай с маленьких сумм для теста.',
              'Trade ONLY with verified users. Start small with new accounts to test trust.',
            )}
          </p>
        </div>

        <ul className="text-xs space-y-2 mb-4">
          <li className="flex gap-2">
            <span className="text-amber-400 shrink-0">•</span>
            <span>{tx(
              'Никогда не отправляй фиат до открытия сделки в Pulsar — иначе нет защиты эскроу.',
              "Never send fiat before opening the trade in Pulsar — otherwise there's no escrow protection.",
            )}</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 shrink-0">•</span>
            <span>{tx(
              'Используй проверенные методы: СБП с подтверждением имени, USDT-TRC20 со скриншотом транзакции.',
              'Use trusted methods: SBP with name verification, USDT-TRC20 with transaction screenshot.',
            )}</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 shrink-0">•</span>
            <span>{tx(
              'Перед релизом PLS как продавец — обязательно убедись, что фиат пришёл и не зависнет (банковская блокировка, отмена платежа).',
              "As seller, verify the fiat actually arrived and won't be reversed (bank hold, chargeback) before releasing PLS.",
            )}</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 shrink-0">•</span>
            <span>{tx(
              'Никогда не передавай контрагенту свои пароли, OTP-коды, QR-коды банка.',
              'Never share your passwords, OTPs, or banking QR codes with a counterparty.',
            )}</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 shrink-0">•</span>
            <span>{tx(
              'Налоговые обязательства от полученной прибыли — на тебе. Pulsar не выступает налоговым агентом.',
              "You're responsible for any tax owed on profits — Pulsar is not a withholding agent.",
            )}</span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-400 shrink-0">•</span>
            <span>{tx(
              'При споре администрация может выступить арбитром, но решение окончательное и не обжалуется.',
              'In a dispute, admins may arbitrate — but the decision is final and not appealable.',
            )}</span>
          </li>
        </ul>

        <Link to="/p2p/terms" className="block text-xs text-primary-400 hover:text-primary-300 mb-4 underline">
          {tx('Полные Условия использования P2P-биржи →', 'Full P2P Exchange Terms →')}
        </Link>

        <label className="flex items-start gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-emerald-500 cursor-pointer"
          />
          <span className="text-xs">
            {tx(
              'Я прочитал предупреждение и понимаю, что Pulsar не несёт ответственности за результаты P2P-сделок.',
              "I've read the warning and understand Pulsar isn't liable for P2P trade outcomes.",
            )}
          </span>
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 bg-dark-500 hover:bg-dark-400 rounded-lg text-sm font-medium">
            {tx('Назад', 'Back')}
          </button>
          <button
            onClick={accept}
            disabled={!agree}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {tx('Принимаю и продолжаю', 'I accept, continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
