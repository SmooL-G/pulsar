import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Code, Map, Heart, Shield, FileText, Cookie, Sparkles, Home, Cpu, Download } from 'lucide-react';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n';

interface Tile {
  to: string;
  icon: any;
  titleKey?: TranslationKey;
  descKey?: TranslationKey;
  // Inline RU/EN fallback for tiles whose strings aren't in the i18n
  // bundle yet (kept here so we don't have to expand 11-locale files
  // every time a new section is added).
  titleRu?: string;
  titleEn?: string;
  descRu?: string;
  descEn?: string;
  color: string;
  badge?: string;
}

const TILES: Tile[] = [
  {
    to: '/developers',
    icon: Code,
    titleKey: 'info.tiles.dev.title',
    descKey: 'info.tiles.dev.desc',
    color: 'from-blue-500/20 to-blue-700/5 border-blue-500/30',
    badge: 'Bot API',
  },
  {
    to: '/download',
    icon: Download,
    titleRu: 'Скачать',
    titleEn: 'Download',
    descRu: 'Pulsar для Android, Windows и Linux. Один аккаунт, разные клиенты.',
    descEn: 'Pulsar for Android, Windows, and Linux. One account, multiple clients.',
    color: 'from-primary-500/20 to-primary-700/5 border-primary-500/30',
    badge: 'APK',
  },
  {
    to: '/mining',
    icon: Cpu,
    titleRu: 'Майнинг',
    titleEn: 'Mining',
    descRu: 'Запусти ноду — получай PLS за поддержку сети. Формула наград и инструкция.',
    descEn: 'Run a node — earn PLS for supporting the network. Reward formula and setup guide.',
    color: 'from-cyan-500/20 to-cyan-700/5 border-cyan-500/30',
    badge: 'PLS',
  },
  {
    to: '/roadmap',
    icon: Map,
    titleKey: 'info.tiles.roadmap.title',
    descKey: 'info.tiles.roadmap.desc',
    color: 'from-emerald-500/20 to-emerald-700/5 border-emerald-500/30',
  },
  {
    to: '/donate',
    icon: Heart,
    titleKey: 'info.tiles.donate.title',
    descKey: 'info.tiles.donate.desc',
    color: 'from-pink-500/20 to-pink-700/5 border-pink-500/30',
  },
  {
    to: '/privacy',
    icon: Shield,
    titleKey: 'info.tiles.privacy.title',
    descKey: 'info.tiles.privacy.desc',
    color: 'from-gray-500/20 to-gray-700/5 border-gray-500/30',
  },
  {
    to: '/terms',
    icon: FileText,
    titleKey: 'info.tiles.terms.title',
    descKey: 'info.tiles.terms.desc',
    color: 'from-gray-500/20 to-gray-700/5 border-gray-500/30',
  },
  {
    to: '/cookies',
    icon: Cookie,
    titleKey: 'info.tiles.cookies.title',
    descKey: 'info.tiles.cookies.desc',
    color: 'from-amber-500/20 to-amber-700/5 border-amber-500/30',
  },
];

export function InfoPage() {
  const navigate = useNavigate();
  const { t, locale, setLocale } = useI18n();

  return (
    <div className="bg-dark-900 text-white relative" style={{ height: '100dvh', overflowY: 'auto' }}>
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(76,110,245,0.08) 0%, transparent 60%)',
      }} />

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-8 pb-16">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700/50 border border-dark-500/30 backdrop-blur-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="text-sm">{t('common.back')}</span>
          </button>

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-500/15 border border-primary-500/30 text-primary-400 hover:bg-primary-500/25 hover:text-primary-300 transition-colors text-sm font-medium"
          >
            <Home size={14} />
            Pulsar
          </button>

          {/* Language switcher */}
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as any)}
            className="px-3 py-2 rounded-lg bg-dark-700/50 border border-dark-500/30 backdrop-blur-sm text-gray-300 text-sm outline-none"
          >
            <option value="en">EN</option>
            <option value="ru">RU</option>
            <option value="uk">UA</option>
            <option value="de">DE</option>
            <option value="es">ES</option>
            <option value="fr">FR</option>
            <option value="pt">PT</option>
            <option value="tr">TR</option>
            <option value="zh">CN</option>
            <option value="ja">JP</option>
            <option value="ko">KR</option>
          </select>
        </div>

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold mb-4">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"></span>
            </span>
            {locale === 'ru' ? 'ОТКРЫТАЯ BETA' : 'OPEN BETA'}
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-3">
            {locale === 'ru'
              ? 'Telegram + крипто-кошелёк + P2P-биржа'
              : 'Telegram + crypto wallet + P2P exchange'}
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            {locale === 'ru'
              ? 'В одном чате. Майнинг встроен в десктоп — реальный вывод через P2P-обмен на СБП/USDT.'
              : 'In one chat. Mining built into the desktop app, real fiat withdrawal via P2P (SBP / USDT).'}
          </p>
        </div>

        {/* Tiles */}
        <div className="grid md:grid-cols-2 gap-4">
          {TILES.map((tile) => (
            <button
              key={tile.to}
              onClick={() => navigate(tile.to)}
              className={`text-left p-6 rounded-2xl bg-gradient-to-br ${tile.color} border backdrop-blur-sm hover:scale-[1.02] transition-all group`}
            >
              <div className="flex items-start justify-between mb-3">
                <tile.icon size={32} className="text-primary-400" />
                {tile.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-500/30 text-primary-300">
                    {tile.badge}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-white mb-1 group-hover:text-primary-300 transition-colors">
                {tile.titleKey ? t(tile.titleKey) : (locale === 'ru' ? tile.titleRu : tile.titleEn)}
              </h3>
              <p className="text-sm text-gray-400">
                {tile.descKey ? t(tile.descKey) : (locale === 'ru' ? tile.descRu : tile.descEn)}
              </p>
            </button>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-500">
            {t('info.more')}
          </p>
        </div>
      </div>
    </div>
  );
}
