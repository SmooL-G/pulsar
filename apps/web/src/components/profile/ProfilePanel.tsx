import { useState, useRef, useEffect } from 'react';
import { X, Camera, Copy, Check, Wallet, Send, Globe, Image, Shield, Loader2 } from 'lucide-react';
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
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);

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
            <div className="relative">
              {/* Avatar — click to preview */}
              <button
                onClick={() => user.avatarUrl && setShowAvatarPreview(true)}
                className="w-24 h-24 rounded-full bg-primary-500 flex items-center justify-center text-white text-3xl font-bold overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary-400 transition-all"
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  user.username[0].toUpperCase()
                )}
              </button>
            </div>
            {/* Change avatar link */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-sm text-primary-400 hover:text-primary-300 mt-2 transition-colors flex items-center gap-1"
            >
              <Camera size={14} />
              {uploading ? t('common.loading') : t('profile.changeAvatar')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
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

          {/* Moderator Progress */}
          {(user as any).role === 'USER' && <ModeratorProgress />}

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

      {/* Avatar Preview Modal */}
      {showAvatarPreview && user.avatarUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] cursor-pointer"
          onClick={() => setShowAvatarPreview(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] animate-fade-in">
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain"
            />
            <p className="text-center text-white/70 text-sm mt-3">@{user.username}</p>
            <button
              onClick={(e) => { e.stopPropagation(); setShowAvatarPreview(false); }}
              className="absolute -top-3 -right-3 w-8 h-8 bg-dark-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Moderator progress tracker
function ModeratorProgress() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    api.get('/moderator/requirements').then((res) => {
      setData(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data || data.isAlreadyModerator) return null;

  const reqs = [
    { key: 'accountAge', label: 'Account age', value: `${data.requirements.accountAge.value} days`, target: `${data.requirements.accountAge.required} days` },
    { key: 'messages', label: 'Messages sent', value: data.requirements.messages.value.toLocaleString(), target: data.requirements.messages.required.toLocaleString() },
    { key: 'verification', label: 'Verification level', value: `Level ${data.requirements.verification.value}`, target: `Level ${data.requirements.verification.required}` },
    { key: 'noPunishments', label: 'No bans (90 days)', value: data.requirements.noPunishments.value === 0 ? 'Clean' : `${data.requirements.noPunishments.value} violations`, target: 'Clean' },
    { key: 'invited', label: 'Members invited', value: data.requirements.invited.value.toString(), target: data.requirements.invited.required.toString() },
  ];

  const handleApply = async () => {
    setApplying(true);
    try {
      await api.post('/moderator/apply');
      setApplied(true);
    } catch {
      // requirements not met
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="rounded-xl border border-dark-500/50 bg-dark-600/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield size={16} className="text-cyan-400" />
        <span className="text-sm font-semibold text-white">Become a Moderator</span>
        <span className="text-[10px] text-gray-500 ml-auto">{data.metCount}/{data.total}</span>
      </div>

      <div className="w-full h-1.5 bg-dark-500 rounded-full mb-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-cyan-500 transition-all"
          style={{ width: `${(data.metCount / data.total) * 100}%` }}
        />
      </div>

      <div className="space-y-2">
        {reqs.map((r) => {
          const met = data.requirements[r.key].met;
          return (
            <div key={r.key} className="flex items-center justify-between text-xs">
              <span className={met ? 'text-gray-300' : 'text-gray-500'}>
                {met ? <Check size={12} className="inline text-cyan-400 mr-1" /> : <span className="inline-block w-3 h-3 mr-1" />}
                {r.label}
              </span>
              <span className={met ? 'text-cyan-400 font-medium' : 'text-gray-500'}>
                {r.value} / {r.target}
              </span>
            </div>
          );
        })}
      </div>

      {applied ? (
        <div className="mt-3 text-center text-sm text-cyan-400 font-medium">
          <Check size={14} className="inline mr-1" />
          You are now a Moderator!
        </div>
      ) : (
        <button
          onClick={handleApply}
          disabled={!data.allMet || applying}
          className="w-full mt-3 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-dark-500 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {applying ? <Loader2 size={14} className="inline animate-spin mr-1" /> : <Shield size={14} className="inline mr-1" />}
          {data.allMet ? 'Apply for Moderator' : `${data.metCount}/${data.total} requirements met`}
        </button>
      )}
    </div>
  );
}
