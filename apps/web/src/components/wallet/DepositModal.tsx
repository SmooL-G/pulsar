import { useState } from 'react';
import { X, Copy, Check, ArrowRight, Loader2 } from 'lucide-react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import toast from 'react-hot-toast';

interface DepositModalProps {
  onClose: () => void;
}

const PLATFORM_WALLET = import.meta.env.VITE_PLATFORM_WALLET || '';
const PLS_PER_SOL = 100_000;

export function DepositModal({ onClose }: DepositModalProps) {
  const { t } = useI18n();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { user } = useAuthStore();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'input' | 'sending' | 'confirming' | 'crediting' | 'done'>('input');
  const [copied, setCopied] = useState(false);

  const solAmount = parseFloat(amount) || 0;
  const plsAmount = Math.floor(solAmount * PLS_PER_SOL);
  const isValid = solAmount >= 0.01 && publicKey && PLATFORM_WALLET;

  const copyAddress = () => {
    navigator.clipboard.writeText(PLATFORM_WALLET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeposit = async () => {
    if (!publicKey || !PLATFORM_WALLET) return;

    try {
      setStep('sending');

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(PLATFORM_WALLET),
          lamports: Math.floor(solAmount * LAMPORTS_PER_SOL),
        })
      );

      const signature = await sendTransaction(tx, connection);
      setStep('confirming');

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      // Register deposit on server
      setStep('crediting');
      await api.post('/wallet/deposit', {
        solSignature: signature,
        solAmount: solAmount,
      });

      // Balance updates via socket event automatically
      setStep('done');
      toast.success(`+${plsAmount.toLocaleString()} PLS`);
    } catch (err: any) {
      setStep('input');
      toast.error(err.message || t('wallet.depositError'));
    }
  };

  const presets = [0.01, 0.05, 0.1, 0.5, 1];

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-500">
          <h3 className="font-semibold">{t('wallet.deposit')}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'done' ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-400" />
              </div>
              <p className="text-lg font-bold">+{plsAmount.toLocaleString()} PLS</p>
              <p className="text-sm text-gray-400 mt-1">{t('wallet.depositSuccess')}</p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium"
              >
                {t('common.close')}
              </button>
            </div>
          ) : (
            <>
              {/* Platform address */}
              {PLATFORM_WALLET && (
                <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 mb-1">{t('wallet.platformAddress')}</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-gray-300 flex-1 truncate">{PLATFORM_WALLET}</code>
                    <button onClick={copyAddress} className="p-1 shrink-0">
                      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-gray-400" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Amount input */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">{t('wallet.amountSol')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-dark-600 rounded-lg text-lg font-mono border-none outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={step !== 'input'}
                />
              </div>

              {/* Presets */}
              <div className="flex gap-2">
                {presets.map((p) => (
                  <button
                    key={p}
                    onClick={() => setAmount(p.toString())}
                    className="flex-1 py-1.5 text-xs font-medium bg-dark-600 hover:bg-dark-500 rounded-lg transition-colors"
                  >
                    {p} SOL
                  </button>
                ))}
              </div>

              {/* Conversion preview */}
              {solAmount > 0 && (
                <div className="flex items-center justify-center gap-3 py-3 bg-primary-500/10 rounded-xl">
                  <span className="text-sm font-mono">{solAmount} SOL</span>
                  <ArrowRight size={16} className="text-primary-400" />
                  <span className="text-sm font-bold text-primary-400">{plsAmount.toLocaleString()} PLS</span>
                </div>
              )}

              {/* Rate info */}
              <p className="text-[10px] text-gray-500 text-center">
                {t('wallet.rate')}: 1 SOL = {PLS_PER_SOL.toLocaleString()} PLS · Min: 0.01 SOL
              </p>

              {/* Pay button */}
              <button
                onClick={handleDeposit}
                disabled={!isValid || step !== 'input'}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {step !== 'input' && <Loader2 size={16} className="animate-spin" />}
                {step === 'input' && t('wallet.payNow')}
                {step === 'sending' && t('wallet.sending')}
                {step === 'confirming' && t('wallet.confirming')}
                {step === 'crediting' && t('wallet.crediting')}
              </button>

              {!publicKey && (
                <p className="text-xs text-amber-400 text-center">{t('wallet.connectFirst')}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
