import { useState, useRef, useEffect } from 'react';
import { X, User, Globe, Palette, Bell, Wallet, LogOut, Copy, Check, Sun, Moon, Monitor, Shield, Download, Upload, Lock, KeyRound, Link2 } from 'lucide-react';
import { LanguageSelector } from './LanguageSelector';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { useNotificationStore } from '../../store/notificationStore';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import { PulsarBadge } from '../ui/PulsarBadge';
import { AdminModal } from '../admin/AdminModal';
import { DepositModal } from '../wallet/DepositModal';
import { exportKeys, importKeys, hasLocalKeys } from '../../crypto/keyManager';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

interface SettingsPanelProps {
  onClose: () => void;
}

type Tab = 'profile' | 'appearance' | 'notifications' | 'wallet' | 'admin';

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { t, locale, setLocale } = useI18n();
  const { user, setUser, logout } = useAuthStore();
  const { enabled: notificationsEnabled, soundEnabled, toggle, toggleSound } = useNotificationStore();
  const [tab, setTab] = useState<Tab>('profile');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLangSelector, setShowLangSelector] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [theme, setThemeState] = useState<'dark' | 'light' | 'system'>(
    () => (localStorage.getItem('theme') as any) || 'dark'
  );

  if (!user) return null;

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/users/me', {
        displayName: displayName || null,
        bio: bio || null,
      });
      setUser({ ...user, ...data });
      toast.success(t('profile.saved'));
    } catch {
      toast.error(t('profile.saveError'));
    } finally {
      setSaving(false);
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
    ...(isStaff ? [{ id: 'admin' as Tab, icon: Shield, label: t('admin.title') }] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-500">
          <h3 className="font-semibold text-lg">{t('settings.title')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar tabs */}
          <div className="w-44 border-r border-gray-200 dark:border-dark-500 p-2 space-y-1 shrink-0">
            {tabs.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => id === 'admin' ? setShowAdmin(true) : setTab(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${tab === id && id !== 'admin'
                    ? 'bg-primary-500/10 text-primary-500'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-600 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}

            <div className="pt-2 mt-2 border-t border-gray-200 dark:border-dark-500">
              <button
                onClick={() => { logout(); onClose(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={18} />
                {t('settings.logout')}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Profile */}
            {tab === 'profile' && (
              <div className="space-y-5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center text-white text-2xl font-bold shrink-0">
                    {user.username[0].toUpperCase()}
                  </div>
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

                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? t('common.loading') : t('common.save')}
                </button>
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

                {/* Language */}
                <div>
                  <label className="block text-sm font-medium mb-3">{t('settings.language')}</label>
                  <button
                    onClick={() => setShowLangSelector(true)}
                    className="w-full py-3 px-4 rounded-xl border-2 border-gray-200 dark:border-dark-500 hover:border-primary-500 text-sm font-medium transition-colors flex items-center justify-between"
                  >
                    <span>{locale.toUpperCase()}</span>
                    <Globe size={18} className="text-gray-400" />
                  </button>
                </div>
              </div>
            )}

            {/* Notifications */}
            {tab === 'notifications' && (
              <div className="space-y-4">
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
                  <button
                    onClick={() => setShowDeposit(true)}
                    className="mt-3 w-full py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-sm font-bold transition-colors"
                  >
                    {t('wallet.topUp')}
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

                {/* E2E ключи — экспорт/импорт */}
                <E2EKeysSection />
              </div>
            )}

            {/* Admin rendered as separate modal */}
          </div>
        </div>
      </div>
      {showLangSelector && <LanguageSelector onClose={() => setShowLangSelector(false)} />}
      {showAdmin && <AdminModal onClose={() => setShowAdmin(false)} />}
      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
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
