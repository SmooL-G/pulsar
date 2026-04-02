import { useState, useEffect } from 'react';
import { X, Wallet, Copy, Check } from 'lucide-react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { DepositModal } from './DepositModal';
import { PulsarBadge } from '../ui/PulsarBadge';
import toast from 'react-hot-toast';

interface WalletPanelProps {
  onClose: () => void;
}

export function WalletPanel({ onClose }: WalletPanelProps) {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [showDeposit, setShowDeposit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const addr = publicKey || (user?.walletAddress ? new PublicKey(user.walletAddress) : null);
        if (addr && connection) {
          const lamports = await connection.getBalance(addr instanceof PublicKey ? addr : new PublicKey(addr));
          setSolBalance(lamports / LAMPORTS_PER_SOL);
        }
      } catch {}
    };
    fetchBalance();
  }, [publicKey, user?.walletAddress, connection]);

  if (!user) return null;

  const plsBalance = BigInt((user as any).plsBalance || '0');

  const copyWallet = () => {
    navigator.clipboard.writeText(user.walletAddress);
    setCopied(true);
    toast.success(t('profile.copyWallet'));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-500">
          <h3 className="font-semibold flex items-center gap-2">
            <Wallet size={18} />
            {t('profile.wallet')}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* PLS Balance */}
          <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-amber-400 font-medium">{t('wallet.plsBalance')}</span>
              <PulsarBadge level={3} size={14} />
            </div>
            <p className="text-3xl font-bold font-mono text-amber-400">
              {plsBalance.toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-500 mt-1">PLS</p>
            {solBalance !== null && (
              <p className="text-xs text-gray-400 mt-1 font-mono">
                ◎ {solBalance.toFixed(4)} SOL
              </p>
            )}
            <button
              onClick={() => setShowDeposit(true)}
              className="mt-4 w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-sm font-bold transition-colors"
            >
              {t('wallet.topUp')}
            </button>
          </div>

          {/* Solana Wallet */}
          <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Wallet size={16} />
              <span className="text-sm font-medium">Solana</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-white/20 rounded-full">
                {user.walletType === 'EXTERNAL' ? t('profile.external') : t('profile.custodial')}
              </span>
              {user.walletType === 'CUSTODIAL' && (
                <span className="text-[10px] px-1.5 py-0.5 bg-yellow-400/30 text-yellow-200 rounded-full ml-auto">
                  🚧 {t('wallet.solanaDev')}
                </span>
              )}
            </div>
            <p className="font-mono text-xs break-all opacity-80 mb-3">{user.walletAddress}</p>
            <button
              onClick={copyWallet}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t('profile.copyWallet') : t('info.copy')}
            </button>
          </div>
        </div>
      </div>

      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
    </div>
  );
}
