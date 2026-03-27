import { useState, useEffect } from 'react';
import { X, Loader2, ImageOff, Sparkles, Image, Lock, Coins } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { api } from '../../services/api';
import { GenerativeAvatar, getGenerativeAvatarUrl } from '../ui/GenerativeAvatar';
import { NftCard } from '../nft/NftCard';
import toast from 'react-hot-toast';

// Список бесплатных аватаров — просто файлы из /avatars/free/
// Добавляй png/jpg/webp в эту папку и обновляй массив
const FREE_AVATARS: string[] = [
  // Пока пусто — будешь добавлять картинки сюда:
  // '/avatars/free/avatar1.png',
  // '/avatars/free/avatar2.png',
];

// Премиум аватары за PLS
const PREMIUM_AVATARS: { url: string; price: number }[] = [
  // Будут добавлены позже:
  // { url: '/avatars/premium/gold1.png', price: 5000 },
];

type Tab = 'free' | 'generate' | 'nft' | 'premium';

interface AvatarGalleryProps {
  onClose: () => void;
}

export function AvatarGallery({ onClose }: AvatarGalleryProps) {
  const { t } = useI18n();
  const { user, setUser } = useAuthStore();
  const [tab, setTab] = useState<Tab>('generate');
  const [saving, setSaving] = useState(false);

  // NFT
  const [nfts, setNfts] = useState<any[]>([]);
  const [nftLoading, setNftLoading] = useState(false);
  const [selectedNftMint, setSelectedNftMint] = useState<string | null>(null);

  // Генеративные — несколько вариантов на основе seed
  const seeds = user ? [
    user.walletAddress,
    user.walletAddress + ':1',
    user.walletAddress + ':2',
    user.walletAddress + ':3',
    user.walletAddress + ':4',
    user.walletAddress + ':5',
    user.walletAddress + ':6',
    user.walletAddress + ':7',
    user.username,
    user.username + ':alt',
    user.username + ':v2',
    user.username + ':v3',
  ] : [];

  const [selectedSeed, setSelectedSeed] = useState<string | null>(null);
  const [selectedFree, setSelectedFree] = useState<string | null>(null);
  const [selectedPremium, setSelectedPremium] = useState<string | null>(null);

  useEffect(() => {
    if (tab === 'nft' && nfts.length === 0 && !nftLoading) {
      setNftLoading(true);
      api.get('/nft/gallery')
        .then(({ data }) => setNfts(data.nfts || []))
        .catch(() => {})
        .finally(() => setNftLoading(false));
    }
  }, [tab]);

  if (!user) return null;

  const handleSaveGenerative = async () => {
    if (!selectedSeed) return;
    setSaving(true);
    try {
      // Генерируем SVG data URL и отправляем как avatarUrl
      const avatarUrl = getGenerativeAvatarUrl(selectedSeed);
      const { data } = await api.patch('/users/me', { avatarUrl, nftAvatarMint: null });
      setUser({ ...user, ...data });
      toast.success(t('profile.saved'));
      onClose();
    } catch {
      toast.error(t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFree = async () => {
    if (!selectedFree) return;
    setSaving(true);
    try {
      const { data } = await api.patch('/users/me', { avatarUrl: selectedFree, nftAvatarMint: null });
      setUser({ ...user, ...data });
      toast.success(t('profile.saved'));
      onClose();
    } catch {
      toast.error(t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNft = async () => {
    if (!selectedNftMint) return;
    setSaving(true);
    try {
      const { data } = await api.post('/nft/set-avatar', { mintAddress: selectedNftMint });
      if (user) {
        setUser({ ...user, avatarUrl: data.user.avatarUrl, nftAvatarMint: data.user.nftAvatarMint } as any);
      }
      toast.success(t('profile.saved'));
      onClose();
    } catch {
      toast.error(t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleBuyPremium = async () => {
    if (!selectedPremium) return;
    const avatar = PREMIUM_AVATARS.find((a) => a.url === selectedPremium);
    if (!avatar) return;
    setSaving(true);
    try {
      await api.post('/wallet/purchase-avatar', { avatarUrl: avatar.url, price: avatar.price });
      const { data } = await api.patch('/users/me', { avatarUrl: avatar.url, nftAvatarMint: null });
      setUser({ ...user, ...data });
      toast.success(t('profile.saved'));
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (tab === 'generate') handleSaveGenerative();
    else if (tab === 'free') handleSaveFree();
    else if (tab === 'nft') handleSaveNft();
    else if (tab === 'premium') handleBuyPremium();
  };

  const canSave =
    (tab === 'generate' && selectedSeed) ||
    (tab === 'free' && selectedFree) ||
    (tab === 'nft' && selectedNftMint) ||
    (tab === 'premium' && selectedPremium);

  const tabs: { key: Tab; icon: React.ReactNode; label: string }[] = [
    { key: 'generate', icon: <Sparkles size={14} />, label: t('avatar.generate') },
    { key: 'free', icon: <Image size={14} />, label: t('avatar.free') },
    { key: 'nft', icon: <Lock size={14} />, label: 'NFT' },
    { key: 'premium', icon: <Coins size={14} />, label: 'PLS' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-dark-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl animate-fade-in max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500 shrink-0">
          <h3 className="font-semibold text-white">{t('avatar.gallery')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Вкладки */}
        <div className="flex border-b border-dark-500 shrink-0">
          {tabs.map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
                tab === key
                  ? 'text-primary-400 border-b-2 border-primary-500'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Генеративные */}
          {tab === 'generate' && (
            <div className="grid grid-cols-4 gap-3">
              {seeds.map((seed) => (
                <button
                  key={seed}
                  onClick={() => setSelectedSeed(seed)}
                  className={`rounded-xl p-2 transition-all ${
                    selectedSeed === seed
                      ? 'bg-primary-500/20 ring-2 ring-primary-500'
                      : 'hover:bg-dark-600'
                  }`}
                >
                  <GenerativeAvatar seed={seed} size={80} className="mx-auto" />
                </button>
              ))}
            </div>
          )}

          {/* Бесплатные */}
          {tab === 'free' && (
            FREE_AVATARS.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <ImageOff size={48} className="mb-3 opacity-50" />
                <p className="text-sm">{t('avatar.comingSoon')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {FREE_AVATARS.map((url) => (
                  <button
                    key={url}
                    onClick={() => setSelectedFree(url)}
                    className={`rounded-xl overflow-hidden border-2 transition-all ${
                      selectedFree === url
                        ? 'border-primary-500 ring-2 ring-primary-500/30'
                        : 'border-transparent hover:border-dark-400'
                    }`}
                  >
                    <img src={url} alt="" className="w-full aspect-square object-cover" />
                  </button>
                ))}
              </div>
            )
          )}

          {/* NFT */}
          {tab === 'nft' && (
            nftLoading ? (
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
                {nfts.map((nft: any) => (
                  <NftCard
                    key={nft.mint}
                    {...nft}
                    selected={selectedNftMint === nft.mint}
                    onSelect={setSelectedNftMint}
                  />
                ))}
              </div>
            )
          )}

          {/* Премиум */}
          {tab === 'premium' && (
            PREMIUM_AVATARS.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Coins size={48} className="mb-3 opacity-50" />
                <p className="text-sm">{t('avatar.comingSoon')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {PREMIUM_AVATARS.map(({ url, price }) => (
                  <button
                    key={url}
                    onClick={() => setSelectedPremium(url)}
                    className={`rounded-xl overflow-hidden border-2 transition-all relative ${
                      selectedPremium === url
                        ? 'border-amber-500 ring-2 ring-amber-500/30'
                        : 'border-transparent hover:border-dark-400'
                    }`}
                  >
                    <img src={url} alt="" className="w-full aspect-square object-cover" />
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1 text-center">
                      <span className="text-[10px] font-bold text-amber-400">{price.toLocaleString()} PLS</span>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        {/* Кнопка сохранения */}
        <div className="px-5 py-4 border-t border-dark-500 shrink-0">
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {tab === 'premium' && selectedPremium
              ? `${t('avatar.buy')} (${PREMIUM_AVATARS.find(a => a.url === selectedPremium)?.price?.toLocaleString()} PLS)`
              : t('avatar.apply')
            }
          </button>
        </div>
      </div>
    </div>
  );
}
