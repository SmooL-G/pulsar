import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Code, Map, Heart, Shield, FileText, Cookie, Sparkles, Bot } from 'lucide-react';

interface Tile {
  to: string;
  icon: any;
  title: { en: string; ru: string };
  desc: { en: string; ru: string };
  color: string;
  badge?: string;
}

const TILES: Tile[] = [
  {
    to: '/developers',
    icon: Code,
    title: { en: 'For Developers', ru: 'Для разработчиков' },
    desc: { en: 'Build bots with our API. Full documentation + examples.', ru: 'Создавайте ботов через наш API. Полная документация + примеры.' },
    color: 'from-blue-500/20 to-blue-700/5 border-blue-500/30',
    badge: 'Bot API',
  },
  {
    to: '/roadmap',
    icon: Map,
    title: { en: 'Roadmap', ru: 'Дорожная карта' },
    desc: { en: 'See what\'s shipped and what\'s coming next.', ru: 'Что уже сделано и что впереди.' },
    color: 'from-emerald-500/20 to-emerald-700/5 border-emerald-500/30',
  },
  {
    to: '/donate',
    icon: Heart,
    title: { en: 'Support the Project', ru: 'Поддержать проект' },
    desc: { en: 'Help Pulsar grow. Donate PLS, SOL, or crypto.', ru: 'Помогите Pulsar развиваться. Донаты PLS, SOL, крипто.' },
    color: 'from-pink-500/20 to-pink-700/5 border-pink-500/30',
  },
  {
    to: '/privacy',
    icon: Shield,
    title: { en: 'Privacy Policy', ru: 'Политика конфиденциальности' },
    desc: { en: 'How we handle your data and messages.', ru: 'Как мы обращаемся с вашими данными.' },
    color: 'from-gray-500/20 to-gray-700/5 border-gray-500/30',
  },
  {
    to: '/terms',
    icon: FileText,
    title: { en: 'Terms of Service', ru: 'Условия использования' },
    desc: { en: 'Rules and agreements for using Pulsar.', ru: 'Правила и соглашения использования Pulsar.' },
    color: 'from-gray-500/20 to-gray-700/5 border-gray-500/30',
  },
  {
    to: '/cookies',
    icon: Cookie,
    title: { en: 'Cookies Policy', ru: 'Политика cookies' },
    desc: { en: 'How we use cookies and similar technologies.', ru: 'Как мы используем cookies и похожие технологии.' },
    color: 'from-amber-500/20 to-amber-700/5 border-amber-500/30',
  },
];

// Simple bilingual helper
function getLang(): 'en' | 'ru' {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('pulsar_locale') : null;
  if (stored === 'ru' || stored === 'en') return stored;
  return 'en';
}

export function InfoPage() {
  const navigate = useNavigate();
  const lang = getLang();

  return (
    <div className="bg-dark-900 text-white relative" style={{ height: '100dvh', overflowY: 'auto' }}>
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(76,110,245,0.08) 0%, transparent 60%)',
      }} />

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-8 pb-16">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700/50 border border-dark-500/30 backdrop-blur-sm text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">{lang === 'ru' ? 'Назад' : 'Back'}</span>
        </button>

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-medium mb-4">
            <Sparkles size={12} />
            {lang === 'ru' ? 'Информация о проекте' : 'About the project'}
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-3">
            {lang === 'ru' ? 'Центр информации' : 'Info Center'}
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            {lang === 'ru'
              ? 'Всё что нужно знать о Pulsar — в одном месте.'
              : 'Everything you need to know about Pulsar — in one place.'}
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
                {tile.title[lang]}
              </h3>
              <p className="text-sm text-gray-400">{tile.desc[lang]}</p>
            </button>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-500">
            {lang === 'ru'
              ? 'Больше разделов скоро будет добавлено'
              : 'More sections coming soon'}
          </p>
        </div>
      </div>
    </div>
  );
}
