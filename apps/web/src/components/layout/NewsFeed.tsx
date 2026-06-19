import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { GenerativeAvatar } from '../ui/GenerativeAvatar';
import { NftAvatarBorder } from '../ui/NftAvatarBorder';
import { PulsarBadge } from '../ui/PulsarBadge';
import { ProfileBadgeIcon } from '../ui/ProfileBadgeIcon';
import { SettingsPanel } from '../settings/SettingsPanel';
import { WalletPanel } from '../wallet/WalletPanel';
import { ShieldCheck, Award, Wallet, ArrowUpRight, ArrowDownLeft, Copy, Check } from 'lucide-react';
import { PlsPriceCard } from '../price/PlsPriceCard';
import { BurnedSupplyCard } from '../economy/BurnedSupplyCard';
import { LiveActivityPulse } from '../economy/LiveActivityPulse';
import { useHomeTileVisible } from '../../hooks/useHomeTiles';
import toast from 'react-hot-toast';

export function NewsFeed() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const [showSettings, setShowSettings] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [copied, setCopied] = useState(false);
  // Per-user tile visibility — set in Settings → Appearance → Главная.
  const showProfile = useHomeTileVisible('profile');
  const showWalletTile = useHomeTileVisible('wallet');
  const showPlsPrice = useHomeTileVisible('plsPrice');
  const showBurns = useHomeTileVisible('burns');
  const showActivity = useHomeTileVisible('activity');
  const showQuickActions = useHomeTileVisible('quickActions');
  const showP2P = useHomeTileVisible('p2p');
  const showGpt = useHomeTileVisible('gpt');
  const showMarketplace = useHomeTileVisible('marketplace');

  if (!user) return null;

  const plsBalance = BigInt((user as any).plsBalance || '0');
  const verificationLevel = (user as any).verificationLevel || 0;

  const copyWallet = () => {
    navigator.clipboard.writeText(user.walletAddress);
    setCopied(true);
    toast.success(t('profile.copyWallet'));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-dark-800 overflow-y-auto">
      <div className="p-6 max-w-2xl mx-auto w-full space-y-4">

        {/* Greeting */}
        <div className="mb-2">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {t('dashboard.greeting')}, {user.displayName || user.username} 👋
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">{t('dashboard.subtitle')}</p>
        </div>

        {/* Tiles grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {showProfile && (
          /* Profile tile */
          <button
            onClick={() => setShowSettings(true)}
            className="group relative bg-white dark:bg-dark-700 rounded-2xl p-5 text-left shadow-sm border border-gray-100 dark:border-dark-600 hover:border-primary-400 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <NftAvatarBorder isNft={!!(user as any).nftAvatarMint} size={56}>
                <div className="w-14 h-14 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-xl overflow-hidden shrink-0">
                  {(user as any).avatarUrl ? (
                    <img src={(user as any).avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <GenerativeAvatar seed={user.id} size={56} />
                  )}
                </div>
              </NftAvatarBorder>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base truncate flex items-center gap-1.5">
                  {user.displayName || user.username}
                  <PulsarBadge level={verificationLevel} size={14} role={(user as any).role} />
                  <ProfileBadgeIcon badge={(user as any).profileBadge} size={14} />
                </p>
                <p className="text-xs text-gray-400">@{user.username}</p>

                {/* Verification & badge row */}
                <div className="flex items-center gap-2 mt-2">
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium
                    ${verificationLevel > 0
                      ? 'bg-primary-500/10 text-primary-500'
                      : 'bg-gray-100 dark:bg-dark-600 text-gray-400'}`}>
                    <ShieldCheck size={11} />
                    {verificationLevel > 0 ? `Level ${verificationLevel}` : t('dashboard.noVerification')}
                  </span>
                  {(user as any).profileBadge && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 font-medium">
                      <Award size={11} />
                      {(user as any).profileBadge}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Open hint */}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowUpRight size={16} className="text-primary-400" />
            </div>
          </button>

          {/* Close profile tile gate */}
          )}
          {showWalletTile && (
          /* Wallet tile */
          <button
            onClick={() => setShowWallet(true)}
            className="group relative bg-gradient-to-br from-amber-500/15 to-amber-600/5 dark:from-amber-500/20 dark:to-amber-600/10 rounded-2xl p-5 text-left shadow-sm border border-amber-500/20 hover:border-amber-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Wallet size={16} className="text-amber-500" />
              </div>
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{t('profile.wallet')}</span>
            </div>

            {/* PLS Balance */}
            <p className="text-3xl font-bold font-mono text-amber-500 leading-none">
              {plsBalance.toLocaleString()}
            </p>
            <p className="text-xs text-amber-400/70 mt-0.5 mb-4">PLS</p>

            {/* Wallet address */}
            <div
              className="flex items-center gap-2 bg-white/50 dark:bg-dark-600/50 rounded-xl px-3 py-2 cursor-pointer hover:bg-white/80 dark:hover:bg-dark-600 transition-colors"
              onClick={(e) => { e.stopPropagation(); copyWallet(); }}
            >
              <span className="font-mono text-[11px] text-gray-500 truncate flex-1">
                {user.walletAddress.slice(0, 8)}...{user.walletAddress.slice(-6)}
              </span>
              {copied ? <Check size={13} className="text-green-500 shrink-0" /> : <Copy size={13} className="text-gray-400 shrink-0" />}
            </div>

            {/* Wallet type badge */}
            <div className="mt-3 flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                ${(user as any).walletType === 'EXTERNAL'
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-gray-200 dark:bg-dark-500 text-gray-400'}`}>
                {(user as any).walletType === 'EXTERNAL' ? t('profile.external') : t('profile.custodial')}
              </span>
            </div>

            {/* Open hint */}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowUpRight size={16} className="text-amber-400" />
            </div>
          </button>
          )}

        </div>

        {showPlsPrice && <PlsPriceCard balancePls={plsBalance} />}
        {showBurns && <BurnedSupplyCard />}
        {showActivity && <LiveActivityPulse />}

        {showQuickActions && (
        /* Quick actions */
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowWallet(true)}
            className="flex items-center gap-2.5 px-4 py-3 bg-white dark:bg-dark-700 rounded-xl border border-gray-100 dark:border-dark-600 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all text-sm font-medium text-gray-600 dark:text-gray-300"
          >
            <ArrowDownLeft size={18} className="text-primary-500" />
            {t('wallet.topUp')}
          </button>
          <button
            onClick={() => setShowWallet(true)}
            className="flex items-center gap-2.5 px-4 py-3 bg-white dark:bg-dark-700 rounded-xl border border-gray-100 dark:border-dark-600 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all text-sm font-medium text-gray-600 dark:text-gray-300"
          >
            <ArrowUpRight size={18} className="text-amber-500" />
            {t('wallet.transfer')}
          </button>
        </div>
        )}

        {showP2P && (
        /* P2P exchange tile — sell/buy PLS for fiat */
        <a
          href="/p2p"
          className="group bg-gradient-to-br from-amber-500/10 to-emerald-500/10 dark:from-amber-500/15 dark:to-emerald-500/15 rounded-2xl p-5 border border-amber-500/30 hover:border-amber-400 hover:shadow-md transition-all flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-emerald-500 flex items-center justify-center shrink-0">
            <span className="text-2xl">💱</span>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-gray-700 dark:text-gray-100">P2P Exchange</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {(window as any).__I18N_RU__ !== false
                ? 'Продай или купи PLS у других пользователей'
                : 'Buy or sell PLS with other users'}
            </p>
          </div>
          <span className="text-[10px] px-2 py-1 bg-emerald-500/15 text-emerald-500 rounded-full font-bold shrink-0">
            beta
          </span>
          <ArrowUpRight size={16} className="text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
        )}

        {showGpt && (
        /* Pulsar GPT — multi-model AI bot, lives as @pulsargpt_pls DM */
        <a
          href="/pulsargpt_pls"
          className="group bg-gradient-to-br from-primary-500/10 to-cyan-500/10 dark:from-primary-500/15 dark:to-cyan-500/15 rounded-2xl p-5 border border-primary-500/30 hover:border-primary-400 hover:shadow-md transition-all flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center shrink-0">
            <span className="text-2xl">🤖</span>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-gray-700 dark:text-gray-100">Pulsar GPT</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {(window as any).__I18N_RU__ !== false
                ? 'Чат с ИИ, картинки, оживление, видео из текста'
                : 'AI chat, image generation, animation, text-to-video'}
            </p>
          </div>
          <span className="text-[10px] px-2 py-1 bg-amber-500/15 text-amber-500 rounded-full font-bold shrink-0">
            beta
          </span>
          <ArrowUpRight size={16} className="text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
        )}

        {showMarketplace && (
        /* Marketplace placeholder tile */
        <div className="bg-white dark:bg-dark-700 rounded-2xl p-5 border border-dashed border-gray-200 dark:border-dark-500 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center shrink-0">
            <span className="text-2xl">🛍</span>
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-700 dark:text-gray-200">{t('dashboard.marketplace')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t('dashboard.comingSoon')}</p>
          </div>
          <span className="ml-auto text-[10px] px-2 py-1 bg-purple-500/10 text-purple-400 rounded-full font-medium shrink-0">
            {t('dashboard.wip')}
          </span>
        </div>
        )}

      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showWallet && <WalletPanel onClose={() => setShowWallet(false)} />}
    </div>
  );
}
