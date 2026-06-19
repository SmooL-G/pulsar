import { useState, useRef, useEffect } from 'react';
import { X, ArrowLeft, ChevronRight, Camera, User, Globe, Palette, Bell, Wallet, Copy, Check, Sun, Moon, Monitor, Shield, Download, Upload, Lock, KeyRound, Link2, ShieldCheck, Award, Loader2, Star, Coins, Trophy, Vote, Cpu, LogOut } from 'lucide-react';

import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { CHAT_WALLPAPERS, getStoredWallpaperId, setStoredWallpaperId } from '../../hooks/useChatTheme';
import { THEME_PRESETS, applyThemeColor, getStoredThemeColor, type ThemeColorId } from '../../hooks/useThemeColor';
import { StakingSection } from './StakingSection';
import { LotterySection } from './LotterySection';
import { TreasurySection } from './TreasurySection';
import { NodesSection } from './NodesSection';
import { ReferralsSection } from './ReferralsSection';
import { useNotificationStore } from '../../store/notificationStore';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import { PulsarBadge } from '../ui/PulsarBadge';
import { BADGE_CONFIG } from '../ui/ProfileBadgeIcon';
import { AdminModal } from '../admin/AdminModal';
import { DepositModal } from '../wallet/DepositModal';
import { HistoryModal } from '../wallet/HistoryModal';
import { TransferModal } from '../wallet/TransferModal';
import { exportKeys, importKeys, hasLocalKeys } from '../../crypto/keyManager';
import { LinkedDevicesSection } from './LinkedDevicesSection';
import { PlsPriceAdminSection } from './PlsPriceAdminSection';
import { MerchantSection } from './MerchantSection';
import { MerchantAdminSection } from './MerchantAdminSection';

function SuperAdminOnly({ children }: { children: React.ReactNode }) {
  const role = useAuthStore((s) => (s.user as any)?.role);
  return role === 'SUPER_ADMIN' ? <>{children}</> : null;
}
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { usePushNotifications } from '../../hooks/usePushNotifications';

interface SettingsPanelProps {
  onClose: () => void;
}

type Tab = 'profile' | 'appearance' | 'notifications' | 'wallet' | 'premium' | 'staking' | 'lottery' | 'treasury' | 'nodes' | 'referrals' | 'admin';

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { t, locale, setLocale } = useI18n();
  const { user, setUser, logout } = useAuthStore();
  const { enabled: notificationsEnabled, soundEnabled, toggle, toggleSound } = useNotificationStore();
  const [tab, setTab] = useState<Tab>('profile');
  // Mobile drill-down: null = section-list view; Tab value = drilled in.
  // Desktop ignores this state (always shows sidebar + content).
  const [mobileDrilled, setMobileDrilled] = useState<Tab | null>(null);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const initialLinks = (user as any)?.socialLinks || {};
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({
    telegram: initialLinks.telegram || '',
    twitter: initialLinks.twitter || '',
    youtube: initialLinks.youtube || '',
    instagram: initialLinks.instagram || '',
    github: initialLinks.github || '',
    website: initialLinks.website || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [showBadges, setShowBadges] = useState(false);
  const [theme, setThemeState] = useState<'dark' | 'light' | 'system'>(
    () => (localStorage.getItem('theme') as any) || 'dark'
  );
  const [themeColor, setThemeColorState] = useState<ThemeColorId>(() => getStoredThemeColor());

  const pickThemeColor = (id: ThemeColorId) => {
    setThemeColorState(id);
    applyThemeColor(id);
  };

  if (!user) return null;

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // Drop empty social-link strings — keep payload tight.
      const cleanLinks: Record<string, string> = {};
      for (const [k, v] of Object.entries(socialLinks)) {
        if (v.trim()) cleanLinks[k] = v.trim();
      }
      const { data } = await api.patch('/users/me', {
        displayName: displayName || null,
        bio: bio || null,
        socialLinks: cleanLinks,
      });
      setUser({ ...user, ...data });
      toast.success(t('profile.saved'));
    } catch {
      toast.error(t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data: uploadData } = await api.post('/upload/avatar', formData);
      const { data } = await api.patch('/users/me', {
        avatarUrl: uploadData.avatarUrl,
      });
      setUser({ ...user, ...data });
      toast.success(t('profile.saved'));
    } catch {
      toast.error(t('profile.saveError'));
    } finally {
      setUploadingAvatar(false);
      if (avatarFileRef.current) avatarFileRef.current.value = '';
    }
  };

  const setTheme = (newTheme: 'dark' | 'light' | 'system') => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else if (newTheme === 'light') {
      root.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  const copyWallet = () => {
    navigator.clipboard.writeText(user.walletAddress);
    setCopied(true);
    toast.success(t('profile.copyWallet'));
    setTimeout(() => setCopied(false), 2000);
  };

  const memberSince = new Date(user.createdAt).toLocaleDateString(
    locale === 'ru' ? 'ru-RU' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  const isStaff = user.role === 'MODERATOR' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

  const tabs: { id: Tab; icon: typeof User; label: string }[] = [
    { id: 'profile', icon: User, label: t('profile.title') },
    { id: 'appearance', icon: Palette, label: t('settings.appearance') },
    { id: 'notifications', icon: Bell, label: t('settings.notifications') },
    { id: 'wallet', icon: Wallet, label: t('profile.wallet') },
    { id: 'premium', icon: Star, label: t('premium.title') },
    { id: 'staking', icon: Coins, label: t('staking.title') },
    { id: 'lottery', icon: Trophy, label: t('lottery.title') },
    { id: 'treasury', icon: Vote, label: locale === 'ru' ? 'Голосования' : 'Votes' },
    { id: 'nodes', icon: Cpu, label: locale === 'ru' ? 'Ноды' : 'Nodes' },
    { id: 'referrals', icon: Award, label: locale === 'ru' ? 'Рефералы' : 'Referrals' },
    ...(isStaff ? [{ id: 'admin' as Tab, icon: Shield, label: t('admin.title') }] : []),
  ];

  const currentTabLabel = tabs.find((t) => t.id === tab)?.label || '';
  // On mobile the list-view shows when no section is drilled into; on
  // desktop drill state is ignored — sidebar+content always visible.
  const mobileShowList = mobileDrilled === null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header — on mobile, replaces title with back button when drilled in */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-500">
          {mobileDrilled ? (
            <button
              onClick={() => setMobileDrilled(null)}
              className="md:hidden flex items-center gap-2 -ml-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500"
            >
              <ArrowLeft size={18} />
              <span className="font-semibold">{currentTabLabel}</span>
            </button>
          ) : (
            <h3 className="font-semibold text-lg">{t('settings.title')}</h3>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Mobile: full-width list of large buttons (only when not drilled in).
              Desktop: vertical sidebar of compact tab buttons (always). */}
          {/* Mobile list view */}
          {mobileShowList && (
            <div className="md:hidden flex-1 overflow-y-auto p-3 space-y-1">
              {tabs.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => {
                    if (id === 'admin') { setShowAdmin(true); return; }
                    setTab(id);
                    setMobileDrilled(id);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-gray-50 dark:bg-dark-600 hover:bg-gray-100 dark:hover:bg-dark-500 text-left transition-colors"
                >
                  <span className="w-9 h-9 rounded-lg bg-primary-500/10 text-primary-500 flex items-center justify-center shrink-0">
                    <Icon size={18} />
                  </span>
                  <span className="flex-1 font-medium text-sm">{label}</span>
                  <ChevronRight size={16} className="text-gray-400" />
                </button>
              ))}
              {/* Logout — bottom of mobile list */}
              <button
                onClick={logout}
                className="w-full mt-4 flex items-center gap-3 px-4 py-3.5 rounded-xl bg-red-500/5 hover:bg-red-500/10 text-red-500 text-left transition-colors"
              >
                <span className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                  <LogOut size={18} />
                </span>
                <span className="flex-1 font-medium text-sm">{t('settings.logout')}</span>
              </button>
            </div>
          )}

          {/* Desktop sidebar tabs */}
          <div className="hidden md:block shrink-0 border-r border-gray-200 dark:border-dark-500 w-44 space-y-1 p-2 overflow-y-auto scrollbar-hidden">
            {tabs.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => id === 'admin' ? setShowAdmin(true) : setTab(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${tab === id && id !== 'admin'
                    ? 'bg-primary-500/10 text-primary-500'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-600 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                <Icon size={18} className="shrink-0" />
                {label}
              </button>
            ))}
            {/* Logout — bottom of desktop sidebar */}
            <button
              onClick={logout}
              className="w-full mt-3 flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={18} className="shrink-0" />
              {t('settings.logout')}
            </button>
          </div>

          {/* Content — desktop always shows; mobile shows only when drilled in */}
          <div className={`${mobileShowList ? 'hidden md:block' : ''} flex-1 overflow-y-auto p-5`}>
            {/* Profile */}
            {tab === 'profile' && (
              <div className="space-y-5">
                <div className="flex items-center gap-4 mb-6">
                  <button
                    onClick={() => avatarFileRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="relative w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center text-white text-2xl font-bold shrink-0 overflow-hidden group hover:ring-2 hover:ring-primary-400 transition-all"
                    title={t('profile.changeAvatar')}
                  >
                    {(user as any).avatarUrl ? (
                      <img src={(user as any).avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user.username[0].toUpperCase()
                    )}
                    <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      {uploadingAvatar
                        ? <Loader2 size={18} className="animate-spin text-white" />
                        : <Camera size={18} className="text-white" />}
                    </span>
                  </button>
                  <input
                    ref={avatarFileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <div>
                    <p className="font-semibold text-lg flex items-center gap-1.5">@{user.username}<PulsarBadge level={(user as any).verificationLevel || 0} size={16} /></p>
                    <p className="text-xs text-gray-400">{t('profile.memberSince')} {memberSince}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">{t('profile.displayName')}</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={user.username}
                    className="w-full px-4 py-2.5 bg-gray-100 dark:bg-dark-600 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">{t('profile.bio')}</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t('profile.bioPlaceholder')}
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-2.5 bg-gray-100 dark:bg-dark-600 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                  <p className="text-xs text-gray-400 text-right mt-1">{bio.length}/500</p>
                </div>

                {/* Social Links */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">{t('profile.socialLinks')}</label>
                  <div className="space-y-2">
                    {([
                      { key: 'telegram',  icon: '✈️', placeholder: '@username' },
                      { key: 'twitter',   icon: '𝕏',  placeholder: '@handle' },
                      { key: 'youtube',   icon: '▶️', placeholder: 'youtube.com/...' },
                      { key: 'instagram', icon: '📷', placeholder: '@username' },
                      { key: 'github',    icon: '🐙', placeholder: 'github.com/...' },
                      { key: 'website',   icon: '🌐', placeholder: 'https://...' },
                    ] as const).map(({ key, icon, placeholder }) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-sm w-6 text-center shrink-0">{icon}</span>
                        <input
                          type="text"
                          value={socialLinks[key] || ''}
                          onChange={(e) => setSocialLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="flex-1 px-3 py-2 bg-gray-100 dark:bg-dark-600 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? t('common.loading') : t('common.save')}
                </button>

                {/* Верификация и значки */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setShowVerification(true)}
                    className="flex items-center justify-center gap-2 py-2.5 bg-gray-100 dark:bg-dark-600 hover:bg-primary-500/10 hover:text-primary-500 rounded-lg text-sm font-medium transition-colors"
                  >
                    <ShieldCheck size={16} />
                    {t('wallet.verification')}
                  </button>
                  <button
                    onClick={() => setShowBadges(true)}
                    className="flex items-center justify-center gap-2 py-2.5 bg-gray-100 dark:bg-dark-600 hover:bg-pink-500/10 hover:text-pink-400 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Award size={16} />
                    {t('wallet.badges')}
                  </button>
                </div>

                <UsernameSection />
                <NickColorSection />
                <CustomizationSection />
              </div>
            )}

            {/* Appearance */}
            {tab === 'appearance' && (
              <div className="space-y-6">
                {/* Theme */}
                <div>
                  <label className="block text-sm font-medium mb-3">{t('settings.theme')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'dark' as const, icon: Moon, label: t('settings.dark') },
                      { id: 'light' as const, icon: Sun, label: t('settings.light') },
                      { id: 'system' as const, icon: Monitor, label: t('settings.system') },
                    ].map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        onClick={() => setTheme(id)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-colors
                          ${theme === id
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-gray-200 dark:border-dark-500 hover:border-gray-300 dark:hover:border-dark-400'}`}
                      >
                        <Icon size={22} className={theme === id ? 'text-primary-500' : 'text-gray-400'} />
                        <span className="text-xs font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary color */}
                <div>
                  <label className="block text-sm font-medium mb-3">
                    {t('settings.primaryColor') || 'Цвет акцента'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {THEME_PRESETS.map((p) => {
                      const isActive = themeColor === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => pickThemeColor(p.id)}
                          title={p.label}
                          className={`relative w-12 h-12 rounded-full transition-all ${
                            isActive ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-dark-700 ring-gray-500 scale-110' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: p.swatch }}
                        >
                          {isActive && (
                            <Check size={18} className="absolute inset-0 m-auto text-white drop-shadow" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">
                    {t('settings.primaryColorHint') || 'Применяется ко всем кнопкам, ссылкам и акцентам интерфейса.'}
                  </p>
                </div>

                {/* Language */}
                <div>
                  <label className="block text-sm font-medium mb-3">{t('settings.language')}</label>
                  <select
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                    className="w-full py-3 px-4 rounded-xl border-2 border-gray-200 dark:border-dark-500 hover:border-primary-500 text-sm font-medium transition-colors bg-white dark:bg-dark-600 text-gray-900 dark:text-gray-100 outline-none"
                  >
                    <option value="en">English</option>
                    <option value="ru">Русский</option>
                    <option value="uk">Українська</option>
                    <option value="de">Deutsch</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="pt">Português</option>
                    <option value="tr">Türkçe</option>
                    <option value="zh">中文</option>
                    <option value="ja">日本語</option>
                    <option value="ko">한국어</option>
                  </select>
                </div>
              </div>
            )}

            {/* Notifications */}
            {tab === 'notifications' && (
              <div className="space-y-4">
                <WebPushSection />
                <ToggleSetting
                  label={t('settings.pushNotifications')}
                  description={t('settings.pushDescription')}
                  enabled={notificationsEnabled}
                  onToggle={toggle}
                />
                <ToggleSetting
                  label={t('settings.sound')}
                  description={t('settings.soundDescription')}
                  enabled={soundEnabled}
                  onToggle={toggleSound}
                />
                <QuietHoursSection />
              </div>
            )}

            {/* Wallet */}
            {tab === 'wallet' && (
              <div className="space-y-5">
                {/* PLS Balance */}
                <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-amber-400 font-medium">{t('wallet.plsBalance')}</span>
                    <span className="text-[10px] text-gray-500">PLS</span>
                  </div>
                  <p className="text-2xl font-bold font-mono text-amber-400">
                    {BigInt((user as any).plsBalance || '0').toLocaleString()}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setShowDeposit(true)}
                      className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-sm font-bold transition-colors"
                    >
                      {t('wallet.topUp')}
                    </button>
                    <button
                      onClick={() => setShowTransfer(true)}
                      className="flex-1 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-bold transition-colors"
                    >
                      {t('wallet.transfer')}
                    </button>
                  </div>
                  <button
                    onClick={() => setShowHistory(true)}
                    className="mt-2 w-full py-2 bg-dark-600 hover:bg-dark-500 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    {t('wallet.history')}
                  </button>
                </div>

                {/* Solana Wallet */}
                <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-5 text-white">
                  <div className="flex items-center gap-2 mb-4">
                    <Wallet size={20} />
                    <span className="font-medium">Solana Wallet</span>
                  </div>
                  <p className="font-mono text-sm break-all opacity-90 mb-3">{user.walletAddress}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs opacity-70">
                      {user.walletType === 'EXTERNAL' ? t('profile.external') : t('profile.custodial')}
                    </span>
                    <button
                      onClick={copyWallet}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? t('profile.copyWallet') : t('info.copy')}
                    </button>
                  </div>
                </div>

                {/* Привязка внешнего кошелька — только для CUSTODIAL */}
                {user.walletType === 'CUSTODIAL' && (
                  <LinkWalletSection />
                )}

                <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.walletInfo')}
                  </p>
                </div>

                <a
                  href="/privacy"
                  target="_blank"
                  className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-dark-600 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-500 transition-colors"
                >
                  <Shield size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('settings.privacy')}</span>
                </a>

                {/* Связанные устройства — multi-device E2E */}
                <LinkedDevicesSection />

                {/* P2P merchant статус */}
                <MerchantSection />

                {/* Админ-секции — только SUPER_ADMIN */}
                <SuperAdminOnly><MerchantAdminSection /></SuperAdminOnly>
                <SuperAdminOnly><PlsPriceAdminSection /></SuperAdminOnly>

                {/* E2E ключи — экспорт/импорт */}
                <E2EKeysSection />
              </div>
            )}

            {tab === 'premium' && <PremiumSection />}
            {tab === 'staking' && <StakingSection />}
            {tab === 'lottery' && <LotterySection />}
            {tab === 'treasury' && <TreasurySection />}
            {tab === 'nodes' && <NodesSection />}
            {tab === 'referrals' && <ReferralsSection />}

            {/* Admin rendered as separate modal */}
          </div>
        </div>
      </div>
      {showAdmin && <AdminModal onClose={() => setShowAdmin(false)} />}
      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
      {showTransfer && <TransferModal onClose={() => setShowTransfer(false)} />}
      {showVerification && <VerificationModal onClose={() => setShowVerification(false)} />}
      {showBadges && <BadgesModal onClose={() => setShowBadges(false)} />}
    </div>
  );
}

// === Модалка верификации ===
function VerificationModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { user, setUser } = useAuthStore();
  const [buying, setBuying] = useState<number | null>(null);

  if (!user) return null;
  const plsBalance = BigInt((user as any).plsBalance || '0');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-500">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary-500" />
            <h3 className="font-semibold">{t('wallet.verification')}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-2">
          <p className="text-xs text-gray-400 mb-3">
            {t('wallet.plsBalance')}: <span className="text-amber-400 font-mono font-medium">{plsBalance.toLocaleString()} PLS</span>
          </p>
          {([
            { level: 1, price: 1000, color: 'from-gray-400 to-gray-500' },
            { level: 2, price: 5000, color: 'from-green-400 to-green-600' },
            { level: 3, price: 25000, color: 'from-amber-400 to-amber-600' },
          ] as const).map(({ level, price, color }) => {
            const currentLevel = (user as any).verificationLevel || 0;
            const owned = currentLevel >= level;
            const canAfford = plsBalance >= BigInt(price);
            return (
              <div key={level} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${owned ? 'border-green-500/30 bg-green-500/5' : 'border-gray-200 dark:border-dark-500'}`}>
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${color} flex items-center justify-center`}>
                  <PulsarBadge level={level} size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Level {level}</p>
                  <p className="text-xs text-gray-400 font-mono">{price.toLocaleString()} PLS</p>
                </div>
                {owned ? (
                  <span className="text-xs text-green-400 font-medium px-2 py-1 bg-green-500/10 rounded-lg flex items-center gap-1">
                    <Check size={12} />{t('wallet.owned')}
                  </span>
                ) : (
                  <button
                    onClick={async () => {
                      setBuying(level);
                      try {
                        const { data } = await api.post('/wallet/purchase-verification', { level });
                        setUser({ ...user, verificationLevel: data.verificationLevel, plsBalance: data.balance } as any);
                        toast.success(`${t('wallet.levelUp')} ${level}!`);
                      } catch (err: any) {
                        toast.error(err.response?.data?.message || 'Error');
                      } finally { setBuying(null); }
                    }}
                    disabled={!canAfford || buying !== null}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${canAfford ? 'bg-primary-500 hover:bg-primary-600 text-white' : 'bg-gray-200 dark:bg-dark-500 text-gray-400 cursor-not-allowed'}`}
                  >
                    {buying === level && <Loader2 size={12} className="animate-spin" />}
                    {t('wallet.buy')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// === Модалка профильных значков ===
function BadgesModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { user, setUser } = useAuthStore();
  const [buyingBadge, setBuyingBadge] = useState<string | null>(null);

  if (!user) return null;
  const plsBalance = BigInt((user as any).plsBalance || '0');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-500">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-pink-400" />
            <h3 className="font-semibold">{t('wallet.badges')}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-2">
          <p className="text-xs text-gray-400 mb-3">
            {t('wallet.plsBalance')}: <span className="text-amber-400 font-mono font-medium">{plsBalance.toLocaleString()} PLS</span>
          </p>
          {([
            { badge: 'BLOGGER', price: 10000 },
            { badge: 'AUTHOR', price: 10000 },
            { badge: 'BUSINESS', price: 50000 },
          ] as const).map(({ badge, price }) => {
            const owned = (user as any).profileBadge === badge;
            const canAfford = plsBalance >= BigInt(price);
            const cfg = BADGE_CONFIG[badge];
            return (
              <div key={badge} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${owned ? 'border-green-500/30 bg-green-500/5' : 'border-gray-200 dark:border-dark-500'}`}>
                <span className="text-xl w-8 text-center">{cfg?.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{cfg?.label}</p>
                  <p className="text-xs text-gray-400 font-mono">{price.toLocaleString()} PLS</p>
                </div>
                {owned ? (
                  <span className="text-xs text-green-400 font-medium px-2 py-1 bg-green-500/10 rounded-lg flex items-center gap-1">
                    <Check size={12} />{t('wallet.owned')}
                  </span>
                ) : (
                  <button
                    onClick={async () => {
                      setBuyingBadge(badge);
                      try {
                        const { data } = await api.post('/wallet/purchase-badge', { badge });
                        setUser({ ...user, profileBadge: data.profileBadge, plsBalance: data.balance } as any);
                        toast.success(`${t('wallet.badgeObtained')} ${cfg?.label}!`);
                      } catch (err: any) {
                        toast.error(err.response?.data?.message || 'Error');
                      } finally { setBuyingBadge(null); }
                    }}
                    disabled={!canAfford || buyingBadge !== null}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${canAfford ? 'bg-primary-500 hover:bg-primary-600 text-white' : 'bg-gray-200 dark:bg-dark-500 text-gray-400 cursor-not-allowed'}`}
                  >
                    {buyingBadge === badge && <Loader2 size={12} className="animate-spin" />}
                    {t('wallet.buy')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// === Привязка внешнего кошелька ===
function LinkWalletSection() {
  const { t } = useI18n();
  const { setUser, user } = useAuthStore();
  const { publicKey, signMessage, connected, disconnect, select, wallets, wallet } = useWallet();
  const [loading, setLoading] = useState(false);
  const [showWallets, setShowWallets] = useState(false);

  // После select() — когда wallet адаптер готов, вызываем connect()
  const pendingConnectRef = useRef(false);
  useEffect(() => {
    if (pendingConnectRef.current && wallet && !connected) {
      pendingConnectRef.current = false;
      wallet.adapter.connect().catch((err: any) => {
        console.error('Wallet connect error:', err);
      });
    }
  }, [wallet, connected]);

  // После подключения кошелька — автоматически запускаем привязку
  const autoLinkRef = useRef(false);
  useEffect(() => {
    if (autoLinkRef.current && connected && publicKey && signMessage) {
      autoLinkRef.current = false;
      handleLink();
    }
  }, [connected, publicKey]);

  const handleSelectWallet = (walletName: string) => {
    select(walletName as any);
    pendingConnectRef.current = true;
    autoLinkRef.current = true;
    setShowWallets(false);
  };

  const handleLink = async () => {
    if (!publicKey || !signMessage) return;
    setLoading(true);
    try {
      const walletAddress = publicKey.toBase58();

      // Шаг 1: получить nonce
      const { data: nonceData } = await api.post('/users/me/wallet/nonce', { walletAddress });

      // Шаг 2: подписать nonce кошельком
      const message = new TextEncoder().encode(nonceData.nonce);
      const signature = await signMessage(message);
      const signatureB58 = bs58.encode(signature);

      // Шаг 3: отправить подпись на сервер
      const { data } = await api.post('/users/me/wallet/link', {
        walletAddress,
        signature: signatureB58,
      });

      // Обновляем пользователя в сторе
      if (user) setUser({ ...user, ...data });
      toast.success(t('wallet.linkSuccess'));
    } catch (err: any) {
      const msg = err.response?.data?.message || t('wallet.linkError');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Фильтруем установленные кошельки
  const installedWallets = wallets.filter(w => w.readyState === 'Installed');
  const otherWallets = wallets.filter(w => w.readyState !== 'Installed');

  return (
    <div className="bg-gradient-to-br from-green-500/10 to-emerald-600/5 border border-green-500/20 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Link2 size={18} className="text-green-400" />
        <span className="text-sm font-medium">{t('wallet.linkTitle')}</span>
      </div>
      <p className="text-xs text-gray-400">{t('wallet.linkDescription')}</p>

      {!connected ? (
        <div className="space-y-2">
          {!showWallets ? (
            <button
              onClick={() => setShowWallets(true)}
              className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white rounded-lg text-sm font-medium transition-all"
            >
              {t('auth.connectWallet')}
            </button>
          ) : (
            <div className="space-y-1.5 animate-fade-in">
              {installedWallets.map((w) => (
                <button
                  key={w.adapter.name}
                  onClick={() => handleSelectWallet(w.adapter.name)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 bg-dark-500/50 hover:bg-dark-500 rounded-lg transition-colors"
                >
                  <img src={w.adapter.icon} alt={w.adapter.name} className="w-6 h-6" />
                  <span className="text-sm font-medium">{w.adapter.name}</span>
                  <span className="ml-auto text-[10px] text-green-400">Installed</span>
                </button>
              ))}
              {installedWallets.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-2">
                  {t('wallet.connectFirst')}
                </p>
              )}
              <button
                onClick={() => setShowWallets(false)}
                className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-dark-500/50 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              {wallet && <img src={wallet.adapter.icon} alt="" className="w-4 h-4" />}
              <p className="text-xs text-gray-300 font-mono">
                {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
              </p>
            </div>
            <button
              onClick={() => disconnect()}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              {t('wallet.disconnect')}
            </button>
          </div>
          <button
            onClick={handleLink}
            disabled={loading}
            className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('wallet.linkButton')}
          </button>
        </div>
      )}
    </div>
  );
}

// === E2E ключи: экспорт/импорт ===
function E2EKeysSection() {
  const { t } = useI18n();
  const [mode, setMode] = useState<null | 'export' | 'import'>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  useEffect(() => {
    hasLocalKeys().then(setHasKeys);
  }, []);

  // Экспорт ключей
  const handleExport = async () => {
    if (!password || password.length < 4) {
      toast.error(t('e2e.passwordTooShort'));
      return;
    }
    setLoading(true);
    try {
      const json = await exportKeys(password);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pulsar-e2e-keys-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('e2e.exportSuccess'));
      setMode(null);
      setPassword('');
    } catch {
      toast.error(t('e2e.exportError'));
    } finally {
      setLoading(false);
    }
  };

  // Импорт ключей
  const handleImport = async () => {
    if (!password || !fileContent) return;
    setLoading(true);
    try {
      await importKeys(fileContent, password);
      setHasKeys(true);
      toast.success(t('e2e.importSuccess'));
      setMode(null);
      setPassword('');
      setFileContent(null);
    } catch {
      toast.error(t('e2e.importError'));
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFileContent(reader.result as string);
    reader.readAsText(file);
  };

  return (
    <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={16} className="text-green-500" />
        <span className="text-sm font-medium">{t('e2e.keysTitle')}</span>
      </div>
      <p className="text-xs text-gray-400">{t('e2e.keysDescription')}</p>

      {hasKeys && (
        <div className="flex items-center gap-1.5 text-xs text-green-500">
          <Lock size={12} />
          {t('e2e.keysPresent')}
        </div>
      )}

      {!mode && (
        <div className="flex gap-2">
          <button
            onClick={() => setMode('export')}
            disabled={!hasKeys}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary-500/10 hover:bg-primary-500/20 text-primary-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            {t('e2e.export')}
          </button>
          <button
            onClick={() => setMode('import')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium transition-colors"
          >
            <Upload size={14} />
            {t('e2e.import')}
          </button>
        </div>
      )}

      {/* Экспорт */}
      {mode === 'export' && (
        <div className="space-y-2 animate-fade-in">
          <p className="text-xs text-gray-400">{t('e2e.exportHint')}</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('e2e.passwordPlaceholder')}
            className="w-full px-3 py-2 bg-dark-500 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={loading || password.length < 4}
              className="flex-1 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('e2e.downloadFile')}
            </button>
            <button
              onClick={() => { setMode(null); setPassword(''); }}
              className="px-3 py-2 bg-dark-500 hover:bg-dark-400 text-gray-300 rounded-lg text-xs transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Импорт */}
      {mode === 'import' && (
        <div className="space-y-2 animate-fade-in">
          <p className="text-xs text-gray-400">{t('e2e.importHint')}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleFile}
            className="w-full text-xs text-gray-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-dark-500 file:text-gray-300 hover:file:bg-dark-400"
          />
          {fileContent && (
            <div className="flex items-center gap-1.5 text-xs text-green-500">
              <Check size={12} />
              {t('e2e.fileLoaded')}
            </div>
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('e2e.passwordPlaceholder')}
            className="w-full px-3 py-2 bg-dark-500 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-amber-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              disabled={loading || !password || !fileContent}
              className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('e2e.restoreKeys')}
            </button>
            <button
              onClick={() => { setMode(null); setPassword(''); setFileContent(null); }}
              className="px-3 py-2 bg-dark-500 hover:bg-dark-400 text-gray-300 rounded-lg text-xs transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function WebPushSection() {
  const { t, locale } = useI18n();
  const { status, subscribe, unsubscribe } = usePushNotifications();

  const ru = locale === 'ru';
  const titles = {
    title: ru ? 'Push-уведомления на устройстве' : 'Device push notifications',
    desc: ru
      ? 'Получайте уведомления, даже когда Pulsar закрыт.'
      : 'Get notifications even when Pulsar is closed.',
    enable: ru ? 'Включить' : 'Enable',
    enabled: ru ? '✓ Включено' : '✓ Enabled',
    disable: ru ? 'Отключить' : 'Disable',
    pending: ru ? 'Минутку...' : 'Working...',
    denied: ru
      ? 'Доступ запрещён в браузере. Разрешите уведомления в настройках сайта.'
      : 'Permission denied. Enable notifications in your browser site settings.',
    unsupported: ru
      ? 'Браузер не поддерживает Web Push.'
      : 'Browser does not support Web Push.',
  };
  void t;

  return (
    <div className="p-4 bg-gray-50 dark:bg-dark-600 rounded-xl">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1">
          <p className="text-sm font-medium">{titles.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{titles.desc}</p>
        </div>
        {status === 'subscribed' && (
          <button
            onClick={unsubscribe}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
            title={titles.disable}
          >
            {titles.enabled}
          </button>
        )}
        {status === 'idle' && (
          <button
            onClick={subscribe}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-500 hover:bg-primary-600 text-white transition-colors"
          >
            {titles.enable}
          </button>
        )}
        {status === 'pending' && (
          <span className="shrink-0 px-3 py-1.5 rounded-lg text-xs text-gray-400 inline-flex items-center gap-1">
            <Loader2 size={12} className="animate-spin" />
            {titles.pending}
          </span>
        )}
      </div>
      {status === 'denied' && (
        <p className="text-xs text-amber-400 mt-1">{titles.denied}</p>
      )}
      {status === 'unsupported' && (
        <p className="text-xs text-gray-500 mt-1">{titles.unsupported}</p>
      )}
    </div>
  );
}

function NickColorSection() {
  const { user, setUser } = useAuthStore();
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const currentColor = (user as any)?.nickColor as string | null;
  const verificationLevel = (user as any)?.verificationLevel || 0;
  const isPro = verificationLevel >= 2;
  const ownsColor = !!currentColor;

  const presets = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4',
  ];

  const [selected, setSelected] = useState<string>(currentColor || presets[5]);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.post('/wallet/purchase-nick-color', { color: selected });
      if (user) {
        setUser({ ...user, nickColor: data.nickColor, ...(data.balance ? { plsBalance: data.balance } : {}) } as any);
      }
      const msg = data.charged
        ? (ru ? `Цвет применён! Списано 2000 PLS` : 'Color applied! 2000 PLS charged')
        : (ru ? 'Цвет обновлён' : 'Color updated');
      toast.success(msg);
    } catch (err: any) {
      toast.error(err.response?.data?.message || (ru ? 'Ошибка' : 'Error'));
    } finally {
      setBusy(false);
    }
  };

  const labelPrice = ownsColor
    ? (ru ? 'Применить (бесплатно)' : 'Apply (free)')
    : isPro
      ? (ru ? 'Применить (включено в Pro)' : 'Apply (Pro included)')
      : (ru ? 'Купить за 2000 PLS' : 'Buy for 2000 PLS');

  return (
    <div className="p-4 bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/20 rounded-xl space-y-3">
      <div>
        <p className="text-sm font-semibold flex items-center gap-2">
          🎨 {ru ? 'Цвет ника' : 'Nickname color'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {ru
            ? 'Выделяйтесь в чатах своим цветом ника. Изменяется бесплатно после покупки.'
            : 'Stand out in chats with your custom nickname color. Free changes after purchase.'}
        </p>
      </div>

      {/* Preview */}
      <div className="px-3 py-2 bg-dark-700/30 rounded-lg">
        <span className="text-xs text-gray-500">Preview:</span>{' '}
        <span className="text-sm font-semibold" style={{ color: selected }}>
          @{user?.username || 'username'}
        </span>
      </div>

      {/* Preset palette */}
      <div className="flex flex-wrap gap-2">
        {presets.map((c) => (
          <button
            key={c}
            onClick={() => setSelected(c)}
            className={`w-8 h-8 rounded-full border-2 transition-transform ${selected === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
            style={{ backgroundColor: c }}
            aria-label={c}
          />
        ))}
        <input
          type="color"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-8 h-8 rounded-full bg-transparent cursor-pointer border-2 border-dashed border-gray-500"
          title={ru ? 'Свой цвет' : 'Custom color'}
        />
      </div>

      <button
        onClick={apply}
        disabled={busy || (currentColor === selected)}
        className="w-full py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {busy ? '…' : labelPrice}
      </button>
    </div>
  );
}

// === Кастомизация: рамка аватара / фон профиля / цвет пузырей ===
function CustomizationSection() {
  const { user, setUser } = useAuthStore();
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);

  const balance = BigInt((user as any)?.plsBalance || '0');
  const ownsFrame = !!(user as any)?.avatarFrame;
  const ownsBg = !!(user as any)?.profileBg;
  const ownsBubble = !!(user as any)?.bubbleColor;

  const FRAME_PRICE = 5000n;
  const BG_PRICE = 3000n;
  const BUBBLE_PRICE = 2000n;

  const [busy, setBusy] = useState<'frame' | 'bg' | 'bubble' | null>(null);
  const [bubblePick, setBubblePick] = useState<string>((user as any)?.bubbleColor || '#7c3aed');

  const setSlot = async (slot: 'frame' | 'bg' | 'bubble', value: string | null) => {
    if (busy) return;
    setBusy(slot);
    try {
      const path = slot === 'frame' ? 'avatar-frame' : slot === 'bg' ? 'profile-bg' : 'bubble-color';
      const body: any = slot === 'frame' ? { frame: value }
        : slot === 'bg' ? { bg: value }
        : { color: value };
      const { data } = await api.post(`/customization/${path}`, body);
      const fields = (data.user || {}) as { avatarFrame?: string; bubbleColor?: string; profileBg?: string };
      if (user) setUser({ ...(user as any), ...fields, ...(data.balance ? { plsBalance: data.balance } : {}) });
      toast.success(data.charged ? tx(`Применено! Списано ${value ? '' : ''}PLS`, 'Applied!') : tx('Применено', 'Applied'));
    } catch (err: any) {
      toast.error(err.response?.data?.message || tx('Ошибка', 'Error'));
    } finally {
      setBusy(null);
    }
  };

  const FRAMES: { id: 'gold' | 'neon' | 'rainbow' | 'fire' | 'void' | 'aurora'; label: string }[] = [
    { id: 'gold', label: tx('Золото', 'Gold') },
    { id: 'neon', label: tx('Неон', 'Neon') },
    { id: 'rainbow', label: tx('Радуга', 'Rainbow') },
    { id: 'fire', label: tx('Огонь', 'Fire') },
    { id: 'void', label: tx('Пустота', 'Void') },
    { id: 'aurora', label: tx('Аврора', 'Aurora') },
  ];

  const BGS: { id: 'aurora' | 'sunset' | 'ocean' | 'midnight' | 'rose' | 'forest'; label: string; preview: string }[] = [
    { id: 'aurora', label: 'Aurora', preview: 'linear-gradient(135deg,#34D399,#06B6D4,#8B5CF6)' },
    { id: 'sunset', label: 'Sunset', preview: 'linear-gradient(135deg,#FBBF24,#F97316,#DC2626)' },
    { id: 'ocean', label: 'Ocean', preview: 'linear-gradient(135deg,#0EA5E9,#1E40AF)' },
    { id: 'midnight', label: 'Midnight', preview: 'linear-gradient(135deg,#1E1B4B,#581C87,#1E1B4B)' },
    { id: 'rose', label: 'Rose', preview: 'linear-gradient(135deg,#F472B6,#DB2777,#831843)' },
    { id: 'forest', label: 'Forest', preview: 'linear-gradient(135deg,#16A34A,#166534)' },
  ];

  const currentFrame = (user as any)?.avatarFrame as string | null;
  const currentBg = (user as any)?.profileBg as string | null;

  return (
    <div className="space-y-3">
      {/* Avatar frame */}
      <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold flex items-center gap-2">✨ {tx('Рамка аватара', 'Avatar frame')}</p>
          {!ownsFrame && <p className="text-xs text-gray-500">{fmtPls(FRAME_PRICE)} PLS</p>}
        </div>
        <div className="grid grid-cols-6 gap-2">
          {FRAMES.map((f) => {
            const selected = currentFrame === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setSlot('frame', selected ? null : f.id)}
                disabled={busy !== null || (!ownsFrame && balance < FRAME_PRICE)}
                title={f.label}
                className={`relative aspect-square rounded-full transition-transform ${selected ? 'ring-2 ring-white scale-110' : 'hover:scale-105'} disabled:opacity-30`}
              >
                <FrameThumbInline id={f.id} />
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-500">
          {ownsFrame
            ? tx('Смена рамки бесплатна. Нажмите на текущую чтобы убрать.', 'Frame change is free. Click current to remove.')
            : balance < FRAME_PRICE
              ? tx(`Нужно ${fmtPls(FRAME_PRICE)} PLS на балансе`, `Need ${fmtPls(FRAME_PRICE)} PLS on balance`)
              : tx('Анимированная рамка вокруг аватара во всех чатах', 'Animated border around your avatar across all chats')}
        </p>
      </div>

      {/* Profile background */}
      <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold flex items-center gap-2">🌌 {tx('Фон профиля', 'Profile background')}</p>
          {!ownsBg && <p className="text-xs text-gray-500">{fmtPls(BG_PRICE)} PLS</p>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {BGS.map((b) => {
            const selected = currentBg === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setSlot('bg', selected ? null : b.id)}
                disabled={busy !== null || (!ownsBg && balance < BG_PRICE)}
                className={`relative h-14 rounded-lg transition-all ${selected ? 'ring-2 ring-white' : 'hover:opacity-90'} disabled:opacity-30`}
                style={{ background: b.preview }}
                title={b.label}
              >
                <span className="absolute bottom-1 left-1.5 text-[10px] text-white/90 font-medium">{b.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-500">
          {ownsBg
            ? tx('Смена фона бесплатна.', 'Background change is free.')
            : balance < BG_PRICE
              ? tx(`Нужно ${fmtPls(BG_PRICE)} PLS на балансе`, `Need ${fmtPls(BG_PRICE)} PLS on balance`)
              : tx('Декоративный градиент в шапке вашего профиля', 'Decorative gradient at the top of your profile')}
        </p>
      </div>

      {/* Bubble color */}
      <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold flex items-center gap-2">💬 {tx('Цвет пузырей', 'Bubble color')}</p>
          {!ownsBubble && <p className="text-xs text-gray-500">{fmtPls(BUBBLE_PRICE)} PLS</p>}
        </div>
        <div className="px-3 py-2 bg-dark-700/30 rounded-lg flex items-center gap-2">
          <span className="text-xs text-gray-500">{tx('Превью:', 'Preview:')}</span>
          <span className="px-3 py-1.5 rounded-2xl text-white text-xs" style={{ backgroundColor: bubblePick }}>
            {tx('Привет!', 'Hello!')}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {['#7c3aed', '#ec4899', '#0ea5e9', '#10b981', '#f97316', '#dc2626', '#facc15'].map((c) => (
            <button
              key={c}
              onClick={() => setBubblePick(c)}
              className={`w-8 h-8 rounded-full border-2 ${bubblePick === c ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={bubblePick}
            onChange={(e) => setBubblePick(e.target.value)}
            className="w-8 h-8 rounded-full bg-transparent cursor-pointer border-2 border-dashed border-gray-500"
          />
        </div>
        <button
          onClick={() => setSlot('bubble', bubblePick)}
          disabled={busy !== null || (!ownsBubble && balance < BUBBLE_PRICE)}
          className="w-full py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold disabled:opacity-50"
        >
          {busy === 'bubble' ? '…'
            : ownsBubble ? tx('Применить (бесплатно)', 'Apply (free)')
            : tx(`Купить за ${fmtPls(BUBBLE_PRICE)} PLS`, `Buy for ${fmtPls(BUBBLE_PRICE)} PLS`)}
        </button>
        {ownsBubble && (
          <button
            onClick={() => setSlot('bubble', null)}
            disabled={busy !== null}
            className="w-full py-1.5 text-[11px] text-gray-500 hover:text-gray-300"
          >
            {tx('Убрать кастомный цвет', 'Remove custom color')}
          </button>
        )}
      </div>
    </div>
  );
}

function fmtPls(v: bigint): string {
  return v.toLocaleString('ru-RU');
}

// === Username change with cooldown ===
function UsernameSection() {
  const { user, setUser } = useAuthStore();
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(user?.username || '');
  const [busy, setBusy] = useState(false);

  const changedAt = (user as any)?.usernameChangedAt as string | null | undefined;
  const cooldownDays = 30;
  const daysLeft = (() => {
    if (!changedAt) return 0;
    const elapsed = Date.now() - new Date(changedAt).getTime();
    const remaining = cooldownDays * 24 * 3600 * 1000 - elapsed;
    return remaining > 0 ? Math.ceil(remaining / (24 * 3600 * 1000)) : 0;
  })();
  const isLocked = daysLeft > 0;

  const VALID = /^[A-Za-z0-9_-]{3,32}$/;

  const submit = async () => {
    const desired = draft.trim();
    if (!VALID.test(desired)) {
      toast.error(tx('Только латиница, цифры, _ и -, 3-32 символа', 'Latin/digits/_-/3-32 chars only'));
      return;
    }
    if (desired === user?.username) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.patch('/users/me/username', { username: desired });
      if (user) setUser({ ...(user as any), username: data.username, usernameChangedAt: data.usernameChangedAt });
      toast.success(tx('Ник изменён', 'Username updated'));
      setEditing(false);
    } catch (err: any) {
      const code = err.response?.data?.error;
      const msg =
        code === 'TAKEN' ? tx('Уже занят', 'Already taken')
        : code === 'RESERVED' ? tx('Зарезервирован системой', 'Reserved by system')
        : code === 'COOLDOWN' ? tx(`Можно сменить через ${err.response?.data?.daysLeft} дней`, `Available in ${err.response?.data?.daysLeft} days`)
        : code === 'BAD_USERNAME' ? tx('Неверный формат ника', 'Bad username format')
        : err.response?.data?.message || tx('Ошибка', 'Error');
      toast.error(msg);
    } finally { setBusy(false); }
  };

  return (
    <div className="p-4 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border border-blue-500/20 rounded-xl space-y-3">
      <div>
        <p className="text-sm font-semibold flex items-center gap-2">@ {tx('Уникальный ник', 'Username')}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {tx(
            'Используется для входа, ссылок профиля (pulsar-chat.fun/your_nick) и упоминаний @.',
            'Used for login, profile share-links (pulsar-chat.fun/your_nick) and @ mentions.',
          )}
        </p>
      </div>

      {!editing ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-dark-700/30 rounded-lg text-sm font-mono">@{user?.username}</code>
          <button
            onClick={() => { setDraft(user?.username || ''); setEditing(true); }}
            disabled={isLocked}
            className="px-3 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium disabled:opacity-40"
            title={isLocked ? tx(`Доступно через ${daysLeft} дней`, `Available in ${daysLeft} days`) : ''}
          >
            {tx('Сменить', 'Change')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center bg-dark-700/30 rounded-lg overflow-hidden">
            <span className="px-3 py-2 text-gray-500 font-mono">@</span>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={32}
              autoFocus
              className="flex-1 bg-transparent py-2 pr-3 text-sm font-mono outline-none"
              placeholder="new_username"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={busy || !VALID.test(draft.trim())}
              className="flex-1 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {busy ? '…' : tx('Сохранить', 'Save')}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-lg bg-dark-600 text-gray-300 text-sm"
            >
              {tx('Отмена', 'Cancel')}
            </button>
          </div>
          <p className="text-[10px] text-gray-500">
            {tx('После смены — кулдаун 30 дней.', 'After change — 30-day cooldown.')}
          </p>
        </div>
      )}

      {isLocked && !editing && (
        <p className="text-[10px] text-amber-400">
          {tx(`Следующая смена доступна через ${daysLeft} дн.`, `Next change in ${daysLeft} day(s)`)}
        </p>
      )}
    </div>
  );
}

// Inline frame thumb so we don't need to import FrameThumb at top of file
function FrameThumbInline({ id }: { id: 'gold' | 'neon' | 'rainbow' | 'fire' | 'void' | 'aurora' }) {
  const grad: Record<string, string> = {
    gold: 'linear-gradient(135deg, #FCD34D, #F59E0B, #B45309, #FCD34D)',
    neon: 'linear-gradient(135deg, #EC4899, #06B6D4, #8B5CF6, #EC4899)',
    rainbow: 'linear-gradient(135deg, #EF4444, #F59E0B, #84CC16, #06B6D4, #8B5CF6, #EF4444)',
    fire: 'linear-gradient(135deg, #FBBF24, #F97316, #DC2626, #7F1D1D, #FBBF24)',
    void: 'linear-gradient(135deg, #1E1B4B, #581C87, #1E1B4B, #4C1D95)',
    aurora: 'linear-gradient(135deg, #34D399, #06B6D4, #8B5CF6, #34D399)',
  };
  return (
    <div
      className="absolute inset-0 rounded-full"
      style={{
        background: grad[id],
        backgroundSize: '300% 300%',
        animation: 'nft-border-spin 4s linear infinite',
      }}
    />
  );
}

function ToggleSetting({ label, description, enabled, onToggle }: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-600 rounded-xl">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-dark-400'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

// Helpers for HH:MM <-> minutes-from-midnight conversion.
function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function hhmmToMinutes(s: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

function ChatWallpaperPicker({ disabled }: { disabled: boolean }) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState<string>(() => getStoredWallpaperId());

  const pick = (id: string) => {
    if (disabled) return;
    setSelected(id);
    setStoredWallpaperId(id);
  };

  return (
    <div className="bg-dark-800/50 border border-dark-500 rounded-xl p-4">
      <p className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-3">
        {t('premium.wallpapersTitle')}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {CHAT_WALLPAPERS.map((w) => (
          <button
            key={w.id}
            onClick={() => pick(w.id)}
            disabled={disabled}
            className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
              selected === w.id ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-dark-500 hover:border-dark-400'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            style={{ background: w.preview }}
            title={w.name[locale === 'ru' ? 'ru' : 'en']}
          >
            {selected === w.id && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Check size={20} className="text-white drop-shadow-md" />
              </span>
            )}
          </button>
        ))}
      </div>
      {disabled && (
        <p className="text-xs text-amber-300/80 mt-2">{t('premium.wallpapersLocked')}</p>
      )}
    </div>
  );
}

function PremiumSection() {
  const { t, locale } = useI18n();
  const { user, setUser } = useAuthStore();
  const [status, setStatus] = useState<{
    active: boolean;
    isPremium: boolean;
    trialUsed: boolean;
    subscription: { expiresAt: string; autoRenew: boolean; isTrial: boolean } | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      const { data } = await api.get('/wallet/subscription');
      setStatus(data);
    } catch { /* silent */ }
  };

  useEffect(() => { reload(); }, []);

  const refreshUser = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch { /* silent */ }
  };

  const startTrial = async () => {
    setBusy(true);
    try {
      await api.post('/wallet/subscribe/trial');
      await Promise.all([reload(), refreshUser()]);
      toast.success(t('premium.trialActivated'));
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('premium.failed'));
    } finally { setBusy(false); }
  };

  const subscribe = async () => {
    setBusy(true);
    try {
      await api.post('/wallet/subscribe');
      await Promise.all([reload(), refreshUser()]);
      toast.success(t('premium.subscribed'));
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('premium.failed'));
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await api.post('/wallet/subscribe/cancel');
      await reload();
      toast.success(t('premium.cancelled'));
    } catch { /* silent */ } finally { setBusy(false); }
  };

  const resume = async () => {
    setBusy(true);
    try {
      await api.post('/wallet/subscribe/resume');
      await reload();
      toast.success(t('premium.resumed'));
    } catch { /* silent */ } finally { setBusy(false); }
  };

  const perks: { ru: string; en: string }[] = [
    { ru: '⭐ Бейдж Premium виден везде', en: '⭐ Premium badge visible everywhere' },
    { ru: '📎 Файлы до 100 МБ (вместо 20)', en: '📎 100 MB files (vs 20)' },
    { ru: '📤 До 20 файлов за раз', en: '📤 Up to 20 attachments per message' },
    { ru: '📡 Создание до 10 каналов', en: '📡 Create up to 10 channels' },
    { ru: '🎨 Кастомные темы чата', en: '🎨 Custom chat themes' },
    { ru: '🌟 Анимированный аватар', en: '🌟 Animated avatar' },
  ];

  const balance = BigInt((user as any)?.plsBalance || '0');
  const enoughForMonth = balance >= 5000n;
  const expiresFmt = status?.subscription
    ? new Date(status.subscription.expiresAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US')
    : null;

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-primary-500/10 border border-amber-500/30 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Star size={20} className="text-amber-400" fill="currentColor" />
          <h3 className="text-lg font-bold">Pulsar Premium</h3>
          {status?.active && (
            <span className="ml-auto text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
              {status.subscription?.isTrial ? t('premium.statusTrial') : t('premium.statusActive')}
            </span>
          )}
        </div>
        {status?.active ? (
          <p className="text-sm text-gray-300">
            {t('premium.activeUntil')} <span className="font-mono text-amber-400">{expiresFmt}</span>
            {status.subscription?.autoRenew && !status.subscription?.isTrial && (
              <span className="text-xs text-gray-400 block mt-1">{t('premium.willAutoRenew')}</span>
            )}
            {!status.subscription?.autoRenew && (
              <span className="text-xs text-amber-300/80 block mt-1">{t('premium.willExpire')}</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-gray-300">{t('premium.tagline')}</p>
        )}
      </div>

      {/* Perks list */}
      <div className="bg-dark-800/50 border border-dark-500 rounded-xl p-4 space-y-2">
        <p className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-1">
          {t('premium.perks')}
        </p>
        {perks.map((p) => (
          <p key={p.en} className="text-sm text-gray-300">{locale === 'ru' ? p.ru : p.en}</p>
        ))}
      </div>

      {/* Wallpaper picker — Premium-gated */}
      <ChatWallpaperPicker disabled={!status?.active} />

      {/* Action area */}
      <div className="space-y-2">
        {!status?.active && !status?.trialUsed && (
          <button
            onClick={startTrial}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold transition-all disabled:opacity-50"
          >
            {busy ? '…' : `🎁 ${t('premium.startTrial')}`}
          </button>
        )}
        {!status?.active && (
          <button
            onClick={subscribe}
            disabled={busy || !enoughForMonth}
            className="w-full py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? '…' : `${t('premium.subscribeFor')} 5,000 PLS / ${t('premium.month')}`}
          </button>
        )}
        {!enoughForMonth && !status?.active && (
          <p className="text-xs text-amber-300/80 text-center">
            {t('premium.notEnoughPls')} ({balance.toLocaleString()} / 5000 PLS)
          </p>
        )}
        {status?.active && status.subscription?.autoRenew && !status.subscription?.isTrial && (
          <button
            onClick={cancel}
            disabled={busy}
            className="w-full py-2.5 rounded-xl bg-dark-600 hover:bg-dark-500 text-gray-300 transition-colors disabled:opacity-50"
          >
            {t('premium.cancelAutoRenew')}
          </button>
        )}
        {status?.active && !status.subscription?.autoRenew && !status.subscription?.isTrial && (
          <button
            onClick={resume}
            disabled={busy}
            className="w-full py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white transition-colors disabled:opacity-50"
          >
            {t('premium.resumeAutoRenew')}
          </button>
        )}
        {status?.active && status.subscription?.isTrial && (
          <button
            onClick={subscribe}
            disabled={busy || !enoughForMonth}
            className="w-full py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('premium.upgradeFromTrial')} — 5,000 PLS
          </button>
        )}
      </div>
    </div>
  );
}

function QuietHoursSection() {
  const { t } = useI18n();
  const { user, setUser } = useAuthStore();

  const initialEnabled = user?.pushMuteFrom != null && user?.pushMuteTo != null && !!user?.pushMuteTimezone;
  const [enabled, setEnabled] = useState(initialEnabled);
  const [from, setFrom] = useState<string>(
    user?.pushMuteFrom != null ? minutesToHHMM(user.pushMuteFrom) : '23:00',
  );
  const [to, setTo] = useState<string>(
    user?.pushMuteTo != null ? minutesToHHMM(user.pushMuteTo) : '08:00',
  );
  const [saving, setSaving] = useState(false);
  const tz = user?.pushMuteTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const persist = async (next: { enabled: boolean; from: string; to: string }) => {
    setSaving(true);
    try {
      const body = next.enabled
        ? {
            pushMuteFrom: hhmmToMinutes(next.from),
            pushMuteTo: hhmmToMinutes(next.to),
            pushMuteTimezone: tz,
          }
        : { pushMuteFrom: null, pushMuteTo: null, pushMuteTimezone: null };
      const { data } = await api.patch('/users/me', body);
      setUser({ ...(user as any), ...data });
    } catch { /* keep local state */ }
    setSaving(false);
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-dark-600 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{t('settings.quietHours')}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('settings.quietHoursDescription')}</p>
        </div>
        <button
          onClick={() => {
            const next = !enabled;
            setEnabled(next);
            persist({ enabled: next, from, to });
          }}
          disabled={saving}
          className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-dark-400'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {enabled && (
        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-dark-500">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500 mb-1 block">{t('settings.quietHoursFrom')}</span>
              <input
                type="time"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                onBlur={() => persist({ enabled, from, to })}
                className="w-full bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-500 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 mb-1 block">{t('settings.quietHoursTo')}</span>
              <input
                type="time"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                onBlur={() => persist({ enabled, from, to })}
                className="w-full bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-500 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
            </label>
          </div>
          <p className="text-xs text-gray-400">
            {t('settings.quietHoursTimezone')}: <span className="font-mono">{tz}</span>
          </p>
        </div>
      )}
    </div>
  );
}
