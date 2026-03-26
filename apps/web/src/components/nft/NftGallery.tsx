import { useState, useEffect } from 'react';
import { X, Loader2, ImageOff } from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { NftCard } from './NftCard';

interface NftItem {
  mint: string;
  name: string;
  image: string;
  collection?: string;
}

interface NftGalleryProps {
  onClose: () => void;
}

export function NftGallery({ onClose }: NftGalleryProps) {
  const { t } = useI18n();
  const { user, setUser } = useAuthStore();
  const [nfts, setNfts] = useState<NftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMint, setSelectedMint] = useState<string | null>(user?.nftAvatarMint || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/nft/gallery')
      .then(({ data }) => setNfts(data.nfts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSetAvatar = async () => {
    if (!selectedMint) return;
    setSaving(true);
    try {
      const { data } = await api.post('/nft/set-avatar', { mintAddress: selectedMint });
      if (user) {
        setUser({
          ...user,
          avatarUrl: data.user.avatarUrl,
          nftAvatarMint: data.user.nftAvatarMint,
        } as any);
      }
      onClose();
    } catch {
      // ошибка
    } finally {
      setSaving(false);
    }
  };

  const handleClearAvatar = async () => {
    setSaving(true);
    try {
      await api.post('/nft/clear-avatar');
      if (user) {
        setUser({ ...user, nftAvatarMint: null } as any);
      }
      setSelectedMint(null);
    } catch {
      // ошибка
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-dark-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl animate-fade-in max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500 shrink-0">
          <h3 className="font-semibold text-white">{t('nft.gallery')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-primary-500" />
            </div>
          ) : nfts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <ImageOff size={48} className="mb-3 opacity-50" />
              <p className="text-sm">{t('nft.noNfts')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {nfts.map((nft) => (
                <NftCard
                  key={nft.mint}
                  {...nft}
                  selected={selectedMint === nft.mint}
                  onSelect={setSelectedMint}
                />
              ))}
            </div>
          )}
        </div>

        {/* Кнопки */}
        {nfts.length > 0 && (
          <div className="px-5 py-4 border-t border-dark-500 flex gap-3 shrink-0">
            {user?.nftAvatarMint && (
              <button
                onClick={handleClearAvatar}
                disabled={saving}
                className="flex-1 py-2.5 bg-dark-600 hover:bg-dark-500 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {t('nft.clearAvatar')}
              </button>
            )}
            <button
              onClick={handleSetAvatar}
              disabled={!selectedMint || saving}
              className="flex-1 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {t('nft.setAvatar')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
