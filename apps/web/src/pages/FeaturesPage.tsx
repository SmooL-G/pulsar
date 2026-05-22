import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Zap, Globe, Users } from 'lucide-react';
import { useI18n } from '../i18n';
import { AudienceTiles, TokenTease } from '../components/landing/PitchSections';

/**
 * Deep features page — anchor link from LoginPage's "Подробнее" and
 * footer. Re-uses the AudienceTiles + TokenTease blocks plus extra
 * sections for security/architecture/economy detail that a serious
 * visitor wants before signing up.
 */

export function FeaturesPage() {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const t = (r: string, e: string) => (ru ? r : e);

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-primary-900/30 text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-dark-900/70 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
            <span className="text-sm">{t('Назад', 'Back')}</span>
          </Link>
          <div className="text-sm font-bold tracking-wide text-white">
            {t('Возможности Pulsar', 'Pulsar Features')}
          </div>
          <div className="w-12" />
        </div>
      </header>

      {/* Hero */}
      <section className="w-full max-w-6xl mx-auto px-4 pt-12 pb-6 text-center">
        <span className="inline-block px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[11px] font-bold text-amber-300 mb-4">
          {t('ОТКРЫТАЯ BETA', 'OPEN BETA')}
        </span>
        <h1 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-blue-100 to-primary-300 bg-clip-text text-transparent">
          {t('Мессенджер на крипто-рельсах', 'A messenger on crypto rails')}
        </h1>
        <p className="text-base md:text-lg text-gray-300 max-w-3xl mx-auto leading-relaxed">
          {t(
            'Pulsar — это E2E-чат, P2P-биржа и децентрализованная сеть нод в одном приложении. Никаких номеров телефона, никакой централизованной БД переписок, никакого кошелька в банке-посреднике.',
            'Pulsar is an E2E chat, P2P exchange and decentralized node network in one app. No phone numbers, no centralized message DB, no bank-intermediated wallet.',
          )}
        </p>
      </section>

      {/* Audience tiles — reused from landing */}
      <AudienceTiles showFeaturesLink={false} compact={false} />

      {/* Security deep-dive */}
      <section className="w-full max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            {t('🔒 Безопасность под капотом', '🔒 Security under the hood')}
          </h2>
          <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
            {t(
              'Каждая фича безопасности — это не маркетинг, а конкретная криптография.',
              'Every security feature is a concrete crypto primitive, not a marketing line.',
            )}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              icon: Lock,
              title: t('nacl-box E2E', 'nacl-box E2E'),
              desc: t(
                'Curve25519 + XSalsa20-Poly1305 для каждой DM-пары. Сервер хранит только зашифрованные блобы — мы физически не можем расшифровать.',
                'Curve25519 + XSalsa20-Poly1305 per DM pair. Server stores only encrypted blobs — we physically cannot decrypt.',
              ),
              color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
            },
            {
              icon: Shield,
              title: t('Solana-подпись на сообщениях', 'Solana-signed messages'),
              desc: t(
                'Каждое сообщение подписано приватным ключом отправителя через wallet adapter. Невозможно вставить фейк от чужого имени.',
                'Every message signed by the sender\'s private key via wallet adapter. Forging a message from someone else is impossible.',
              ),
              color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
            },
            {
              icon: Zap,
              title: t('P2P WebRTC для DM', 'WebRTC P2P DMs'),
              desc: t(
                'Когда оба собеседника онлайн — сообщения идут direct между браузерами/устройствами, минуя наш сервер. STUN/TURN — стандартный WebRTC stack.',
                'When both peers are online, messages go direct between browsers/devices, bypassing our server. Standard WebRTC STUN/TURN stack.',
              ),
              color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
            },
            {
              icon: Globe,
              title: t('Сеть нод-хранителей', 'Decentralized node network'),
              desc: t(
                'Любой может запустить Pulsar Desktop как ноду. Чем больше нод — тем сложнее цензурировать. Финал — полностью децентрализованная сеть без single point of failure.',
                'Anyone can run Pulsar Desktop as a node. More nodes = harder to censor. End-game: a fully decentralized network with no single point of failure.',
              ),
              color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className={`rounded-2xl p-5 border bg-gradient-to-br from-white/5 to-transparent ${item.color.split(' ')[2]}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-gray-300 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* What we DON'T do — anti-list */}
      <section className="w-full max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            {t('⛔ Чего у нас НЕТ', '⛔ What we do NOT do')}
          </h2>
          <p className="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
            {t(
              'Не менее важно чем то что есть.',
              'No less important than what we DO have.',
            )}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(ru
            ? [
                'Не просим номер телефона',
                'Не просим email при регистрации через кошелёк',
                'Не храним переписку в открытом виде',
                'Не продаём данные третьим лицам (продавать нечего)',
                'Не блокируем по геолокации',
                'Не требуем KYC для p2p-сделок до $1000',
              ]
            : [
                "We don't ask for your phone number",
                "We don't ask for email if you sign up via wallet",
                "We don't store messages in plaintext",
                "We don't sell data to third parties (nothing to sell)",
                "We don't geoblock users",
                'No KYC required for P2P trades under $1000',
              ]
          ).map((line) => (
            <div key={line} className="flex items-start gap-2 px-4 py-3 bg-red-500/5 border border-red-500/20 rounded-xl">
              <span className="text-red-400 shrink-0">✕</span>
              <span className="text-sm text-gray-300">{line}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Token tease — deep variant */}
      <TokenTease deep={true} />

      {/* CTA */}
      <section className="w-full max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-3">
          {t('Готов попробовать?', 'Ready to try?')}
        </h2>
        <p className="text-gray-400 mb-6">
          {t(
            'Подключи Solana-кошелёк за 5 секунд. Регистрация не требует личных данных.',
            'Connect a Solana wallet in 5 seconds. No personal data required.',
          )}
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors shadow-xl shadow-primary-500/20"
        >
          <Users size={18} />
          {t('Войти в Pulsar', 'Enter Pulsar')}
        </Link>
      </section>

      {/* Footer mini-nav */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-gray-500">
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/privacy" className="hover:text-white transition-colors">
            {t('Приватность', 'Privacy')}
          </Link>
          <Link to="/roadmap" className="hover:text-white transition-colors">
            {t('Дорожная карта', 'Roadmap')}
          </Link>
          <Link to="/info" className="hover:text-white transition-colors">
            {t('О проекте', 'About')}
          </Link>
          <Link to="/download" className="hover:text-white transition-colors">
            {t('Скачать', 'Download')}
          </Link>
        </div>
      </footer>
    </div>
  );
}
