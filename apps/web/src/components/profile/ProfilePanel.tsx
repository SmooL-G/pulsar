import { useState, useRef } from 'react';
import { X, Camera, Copy, Check, Wallet, Send, Globe, Image } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { api } from '../../services/api';
import { PulsarBadge } from '../ui/PulsarBadge';
import { ProfileBadgeTag } from '../ui/ProfileBadgeIcon';
import { AvatarGallery } from './AvatarGallery';
import toast from 'react-hot-toast';

interface ProfilePanelProps {
  onClose: () => void;
}

export function ProfilePanel({ onClose }: ProfilePanelProps) {
  const { t, locale, setLocale } = useI18n();
  const { user, setUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const links = (user as any)?.socialLinks || {};
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({
    telegram: links.telegram || '',
    twitter: links.twitter || '',
    youtube: links.youtube || '',
    instagram: links.instagram || '',
    github: links.github || '',
    website: links.website || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAvatarGallery, setShowAvatarGallery] = useState(false);

  if (!user) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Filter out empty social links
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

    setUploading(true);
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
      setUploading(false);
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-500">
          <h3 className="font-semibold text-lg">{t('profile.title')}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-primary-500 flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  user.username[0].toUpperCase()
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera size={24} className="text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <p className="text-sm text-gray-400 mt-2">
              {uploading ? t('common.loading') : t('profile.changeAvatar')}
            </p>
            <button
              onClick={() => setShowAvatarGallery(true)}
              className="mt-1 flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 transition-colors"
            >
              <Image size={14} />
              {t('avatar.gallery')}
              {(user as any).nftAvatarMint && <span className="text-green-400 ml-1">NFT ✓</span>}
            </button>
            {user.displayName && user.displayName !== user.username && (
              <p className="text-lg font-semibold mt-1 flex items-center gap-1.5">
                {user.displayName}
                <PulsarBadge level={(user as any).verificationLevel || 0} size={16} role={(user as any).role} />
              </p>
            )}
            <p className={`flex items-center gap-1.5 ${user.displayName && user.displayName !== user.username ? 'text-sm text-gray-400' : 'text-lg font-semibold mt-1'}`}>
              @{user.username}
              {(!user.displayName || user.displayName === user.username) && <PulsarBadge level={(user as any).verificationLevel || 0} size={16} />}
            </p>
            {(user as any).profileBadge && <ProfileBadgeTag badge={(user as any).profileBadge} />}
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('profile.displayName')}</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={user.username}
              className="w-full px-4 py-2.5 bg-gray-100 dark:bg-dark-600 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">{t('profile.bio')}</label>
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
                { key: 'telegram', icon: '✈️', placeholder: '@username' },
                { key: 'twitter', icon: '𝕏', placeholder: '@handle' },
                { key: 'youtube', icon: '▶️', placeholder: 'youtube.com/...' },
                { key: 'instagram', icon: '📷', placeholder: '@username' },
                { key: 'github', icon: '🐙', placeholder: 'github.com/...' },
                { key: 'website', icon: '🌐', placeholder: 'https://...' },
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

          {/* Wallet */}
          <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wallet size={18} className="text-primary-500" />
              <span className="text-sm font-medium">{t('profile.wallet')}</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate font-mono">
                {user.walletAddress}
              </code>
              <button
                onClick={copyWallet}
                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-500 text-gray-400 shrink-0"
              >
                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              {t('profile.walletType')}: {user.walletType === 'EXTERNAL' ? t('profile.external') : t('profile.custodial')}
            </p>
          </div>

          {/* Member since */}
          <p className="text-xs text-gray-400 text-center">
            {t('profile.memberSince')} {memberSince}
          </p>

          {/* Language */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
              <Globe size={12} />
              {t('settings.language')}
            </label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-dark-600 border-none outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
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

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>

      {/* Avatar Gallery Modal */}
      {showAvatarGallery && <AvatarGallery onClose={() => setShowAvatarGallery(false)} />}
    </div>
  );
}
