import { useState } from 'react';
import { X, User, Globe, Palette, Bell, Wallet, LogOut, Copy, Check, Sun, Moon, Monitor, Shield } from 'lucide-react';
import { LanguageSelector } from './LanguageSelector';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { useNotificationStore } from '../../store/notificationStore';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

interface SettingsPanelProps {
  onClose: () => void;
}

type Tab = 'profile' | 'appearance' | 'notifications' | 'wallet';

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

  const tabs: { id: Tab; icon: typeof User; label: string }[] = [
    { id: 'profile', icon: User, label: t('profile.title') },
    { id: 'appearance', icon: Palette, label: t('settings.appearance') },
    { id: 'notifications', icon: Bell, label: t('settings.notifications') },
    { id: 'wallet', icon: Wallet, label: t('profile.wallet') },
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
                onClick={() => setTab(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${tab === id
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
                    <p className="font-semibold text-lg">@{user.username}</p>
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
              </div>
            )}
          </div>
        </div>
      </div>
      {showLangSelector && <LanguageSelector onClose={() => setShowLangSelector(false)} />}
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
