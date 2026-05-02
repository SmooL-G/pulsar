import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Smartphone, Monitor, Cpu, Globe } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Public landing page for "get Pulsar on your device". Shows tiles for
 * Android (TWA APK), Windows desktop (Tauri installer that doubles as
 * a relay node), and a "stay in browser" option. Mobile-detect surfaces
 * the relevant tile first.
 */
export function DownloadPage() {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);

  const [platform, setPlatform] = useState<'android' | 'desktop' | 'unknown'>('unknown');
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/android/.test(ua)) setPlatform('android');
    else if (/windows|mac|linux/.test(ua) && !/mobile/.test(ua)) setPlatform('desktop');
  }, []);

  const tiles: Array<{
    id: 'android' | 'desktop' | 'web';
    icon: any;
    title: string;
    desc: string;
    download: string;
    secondary?: string;
    note?: string;
    color: string;
  }> = [
    {
      id: 'android',
      icon: Smartphone,
      title: tx('Android', 'Android'),
      desc: tx(
        'Установить .apk напрямую — без Google Play. Авто-обновления по сети, не нужно качать новые версии вручную.',
        'Install .apk directly — no Google Play needed. Updates land over the network, no manual reinstall.',
      ),
      download: 'https://github.com/SmooL-G/pulsar-node/releases/latest/download/pulsar-android.apk',
      secondary: 'https://github.com/SmooL-G/pulsar-node/releases?q=android',
      note: tx(
        'На телефоне: разреши «Установка из неизвестных источников» в Настройках → Безопасность.',
        'On phone: enable "Install from unknown sources" in Settings → Security.',
      ),
      color: 'from-emerald-500/20 to-emerald-700/5 border-emerald-500/30',
    },
    {
      id: 'desktop',
      icon: Monitor,
      title: tx('Windows / Linux', 'Windows / Linux'),
      desc: tx(
        'Десктоп-приложение со встроенной нодой. Ставишь — забываешь, нода в трее, PLS капают за uptime.',
        'Desktop app with built-in relay node. Install once, lives in tray, earn PLS for uptime.',
      ),
      download: 'https://github.com/SmooL-G/pulsar-node/releases/latest',
      note: tx(
        '.exe / .msi для Windows, .deb для Linux. Запуск ноды требует Elite-верификации (25 000 PLS).',
        '.exe / .msi for Windows, .deb for Linux. Running the node requires Elite verification (25 000 PLS).',
      ),
      color: 'from-cyan-500/20 to-cyan-700/5 border-cyan-500/30',
    },
    {
      id: 'web',
      icon: Globe,
      title: tx('В браузере', 'In browser'),
      desc: tx(
        'Открой pulsar-chat.fun в Chrome/Edge — у нас полноценная PWA: установится одной кнопкой, работает как нативное приложение, поддерживает push-уведомления.',
        'Just open pulsar-chat.fun in Chrome/Edge — we ship a real PWA: install with one click, runs like a native app, push notifications included.',
      ),
      download: '/',
      color: 'from-primary-500/20 to-primary-700/5 border-primary-500/30',
    },
  ];

  // Surface the user's most relevant platform first
  const ordered = [...tiles].sort((a, b) =>
    a.id === platform ? -1 : b.id === platform ? 1 : 0,
  );

  return (
    <div className="bg-dark-900 text-white" style={{ height: '100dvh', overflowY: 'auto' }}>
      {/* Header */}
      <div className="border-b border-dark-600 bg-dark-800/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-1.5 rounded-lg hover:bg-dark-600 text-gray-400">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">{tx('Скачать Pulsar', 'Get Pulsar')}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <section className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-cyan-500">
            <Download size={32} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold">
            {tx('Pulsar на твоём устройстве', 'Pulsar on your device')}
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            {tx(
              'Один аккаунт, разные клиенты. Один аккаунт работает везде, сообщения синхронизируются.',
              'One account, multiple clients. Same account everywhere, messages sync across them.',
            )}
          </p>
        </section>

        <div className="grid gap-4">
          {ordered.map((tile) => {
            const Icon = tile.icon;
            const isYours = tile.id === platform;
            return (
              <div
                key={tile.id}
                className={`rounded-2xl border bg-gradient-to-br ${tile.color} p-5`}
              >
                <div className="flex items-start gap-4">
                  <Icon size={32} className="text-primary-400 shrink-0 mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold">{tile.title}</h3>
                      {isYours && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                          {tx('Твоё устройство', 'Your device')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300">{tile.desc}</p>
                    {tile.note && (
                      <p className="text-[11px] text-gray-500 mt-2">{tile.note}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <a
                    href={tile.download}
                    {...(tile.id === 'web' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold"
                  >
                    {tile.id === 'web'
                      ? <><Globe size={14} /> {tx('Открыть', 'Open')}</>
                      : <><Download size={14} /> {tx('Скачать', 'Download')}</>}
                  </a>
                  {tile.secondary && (
                    <a
                      href={tile.secondary}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-500/40 text-gray-300 hover:bg-gray-500/10 text-sm font-medium"
                    >
                      {tx('Все версии', 'All versions')}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mining cross-link */}
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
          <Cpu size={24} className="text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {tx('Хочешь зарабатывать PLS?', 'Want to earn PLS?')}
            </p>
            <p className="text-xs text-gray-400">
              {tx(
                'Запусти ноду на десктопе или сервере. 50 PLS / час онлайна, до 2 500 PLS / день.',
                'Run a node on desktop or server. 50 PLS / hour online, up to 2 500 PLS / day.',
              )}
            </p>
          </div>
          <Link
            to="/mining"
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-xs font-semibold"
          >
            {tx('Узнать больше', 'Learn more')}
          </Link>
        </section>

        <p className="text-center text-xs text-gray-600 pt-4">
          {tx('Все клиенты — open source.', 'All clients are open source.')}{' '}
          <a href="https://github.com/SmooL-G/pulsar-node" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
            github.com/SmooL-G/pulsar-node
          </a>
        </p>
      </div>
    </div>
  );
}
