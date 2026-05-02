import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Download, Smartphone, Monitor, Cpu, Globe, Loader2,
  ChevronDown, Apple, ExternalLink,
} from 'lucide-react';
import { useI18n } from '../i18n';

interface Asset {
  name: string;
  browser_download_url: string;
  size: number;
  download_count: number;
}
interface Release {
  tag_name: string;
  name: string;
  published_at: string;
  body: string;
  prerelease: boolean;
  draft: boolean;
  assets: Asset[];
  html_url: string;
}

type Platform = 'windows' | 'linux' | 'android' | 'mac' | 'unknown';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'mac';   // no iOS build, surface mac note
  if (/mac os|macintosh/.test(ua)) return 'mac';
  if (/linux/.test(ua) && !/mobile/.test(ua)) return 'linux';
  if (/windows/.test(ua)) return 'windows';
  return 'unknown';
}

function fmtBytes(n: number): string {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
  return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * Download landing — pulls releases from the public pulsar-node repo
 * and renders the canonical "Get Pulsar" page on our own domain.
 * Shows the latest desktop + Android builds with direct asset links
 * (no GitHub roundtrip), plus a collapsible history of older versions.
 */
export function DownloadPage() {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);

  const [releases, setReleases] = useState<Release[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOlder, setShowOlder] = useState<{ desktop: boolean; android: boolean }>({
    desktop: false, android: false,
  });
  const platform = useMemo(() => detectPlatform(), []);

  useEffect(() => {
    fetch('https://api.github.com/repos/SmooL-G/pulsar-node/releases?per_page=50')
      .then((r) => {
        if (!r.ok) throw new Error('GitHub API ' + r.status);
        return r.json();
      })
      .then((data: Release[]) => setReleases(data.filter((r) => !r.draft)))
      .catch((e) => setError(String(e.message || e)));
  }, []);

  const desktopReleases = useMemo(
    () => (releases ?? []).filter((r) => r.tag_name.startsWith('desktop-')),
    [releases],
  );
  const androidReleases = useMemo(
    () => (releases ?? []).filter((r) => r.tag_name.startsWith('android-')),
    [releases],
  );
  const latestDesktop = desktopReleases[0];
  const latestAndroid = androidReleases[0];

  return (
    <div className="bg-dark-900 text-white" style={{ height: '100dvh', overflowY: 'auto' }}>
      <div className="border-b border-dark-600 bg-dark-800/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-1.5 rounded-lg hover:bg-dark-600 text-gray-400">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold">{tx('Скачать Pulsar', 'Get Pulsar')}</h1>
          <a
            href="https://github.com/SmooL-G/pulsar-node"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1"
          >
            <ExternalLink size={11} /> {tx('исходники', 'source')}
          </a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <section className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-cyan-500">
            <Download size={32} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold">
            {tx('Pulsar на твоём устройстве', 'Pulsar on your device')}
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            {tx(
              'Все клиенты — open source, прямые ссылки без редиректов. Один аккаунт, разные устройства, сообщения синхронизируются.',
              'All clients are open source, direct download links — no redirects. One account, multiple devices, messages sync.',
            )}
          </p>
        </section>

        {/* Loading / error */}
        {!releases && !error && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-gray-500" />
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-400">
            {tx('Не удалось загрузить релизы:', "Couldn't load releases:")} {error}.{' '}
            <a href="https://github.com/SmooL-G/pulsar-node/releases" target="_blank" rel="noopener noreferrer" className="underline">
              {tx('Открыть на GitHub', 'Open on GitHub')}
            </a>
          </div>
        )}

        {/* Desktop section */}
        {releases && (
          <section className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Monitor size={20} className="text-cyan-400" />
                  {tx('Десктоп', 'Desktop')}
                  {(platform === 'windows' || platform === 'linux') && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                      {tx('Твоё устройство', 'Your device')}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {tx(
                    'Тауи-приложение со встроенной нодой. Установил один раз — нода в трее, PLS капают за uptime.',
                    'Tauri app with built-in relay node. Install once, lives in tray, earns PLS for uptime.',
                  )}
                </p>
              </div>
            </div>

            {latestDesktop ? (
              <ReleaseCard
                release={latestDesktop}
                ru={ru}
                highlight
                preferredOs={platform}
                kind="desktop"
              />
            ) : (
              <p className="text-sm text-gray-500">{tx('Релизов десктопа пока нет.', 'No desktop releases yet.')}</p>
            )}

            {desktopReleases.length > 1 && (
              <>
                <button
                  onClick={() => setShowOlder((s) => ({ ...s, desktop: !s.desktop }))}
                  className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                >
                  <ChevronDown size={12} className={`transition-transform ${showOlder.desktop ? 'rotate-180' : ''}`} />
                  {showOlder.desktop ? tx('Скрыть прошлые', 'Hide older') : tx(`Прошлые версии (${desktopReleases.length - 1})`, `Older versions (${desktopReleases.length - 1})`)}
                </button>
                {showOlder.desktop && (
                  <div className="space-y-2">
                    {desktopReleases.slice(1).map((r) => (
                      <ReleaseCard key={r.tag_name} release={r} ru={ru} preferredOs={platform} kind="desktop" />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Android section */}
        {releases && (
          <section className="space-y-3">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Smartphone size={20} className="text-emerald-400" />
                Android
                {platform === 'android' && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                    {tx('Твоё устройство', 'Your device')}
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {tx(
                  'TWA-обёртка нашей PWA. Сайт — источник истины: новые фичи прилетают по сети, реустанавливать APK не нужно.',
                  'TWA wrapper of our PWA. The website is the source of truth — new features arrive over the network, no need to reinstall the APK.',
                )}
              </p>
            </div>

            {latestAndroid ? (
              <ReleaseCard
                release={latestAndroid}
                ru={ru}
                highlight
                preferredOs={platform}
                kind="android"
              />
            ) : (
              <div className="rounded-xl border border-gray-500/20 bg-dark-800/50 p-4 text-sm text-gray-400">
                {tx(
                  'APK ещё собирается — загляни через несколько минут. Можно подписаться на ',
                  'APK is still building — check back in a few minutes. You can also subscribe to ',
                )}
                <a href="https://github.com/SmooL-G/pulsar-node/releases.atom" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">
                  RSS
                </a>.
              </div>
            )}

            {androidReleases.length > 1 && (
              <>
                <button
                  onClick={() => setShowOlder((s) => ({ ...s, android: !s.android }))}
                  className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                >
                  <ChevronDown size={12} className={`transition-transform ${showOlder.android ? 'rotate-180' : ''}`} />
                  {showOlder.android ? tx('Скрыть прошлые', 'Hide older') : tx(`Прошлые версии (${androidReleases.length - 1})`, `Older versions (${androidReleases.length - 1})`)}
                </button>
                {showOlder.android && (
                  <div className="space-y-2">
                    {androidReleases.slice(1).map((r) => (
                      <ReleaseCard key={r.tag_name} release={r} ru={ru} preferredOs={platform} kind="android" />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Web fallback */}
        <section className="rounded-2xl border border-primary-500/30 bg-gradient-to-br from-primary-500/5 to-primary-500/0 p-4 flex items-start gap-3">
          <Globe size={24} className="text-primary-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold">{tx('Или просто в браузере', 'Or just in the browser')}</p>
            <p className="text-xs text-gray-400 mt-1">
              {tx(
                'Pulsar — полноценная PWA. Открой pulsar-chat.fun в Chrome, жми «Установить» в адресной строке — поставится как нативное приложение.',
                'Pulsar is a full PWA. Open pulsar-chat.fun in Chrome, click "Install" in the address bar — works like a native app.',
              )}
            </p>
          </div>
          <Link to="/" className="px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold">
            {tx('Открыть', 'Open')}
          </Link>
        </section>

        {/* macOS / iOS notice */}
        {platform === 'mac' && (
          <p className="text-xs text-gray-500 text-center">
            {tx(
              'Сборки под macOS / iOS пока в планах. Можно использовать веб-версию через Safari (полнофункциональная PWA).',
              'macOS / iOS builds are planned. The web version works fully in Safari as a PWA.',
            )}
          </p>
        )}

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

// ─── Release card ──────────────────────────────────────────────────

function ReleaseCard({
  release, ru, highlight, preferredOs, kind,
}: {
  release: Release;
  ru: boolean;
  highlight?: boolean;
  preferredOs: Platform;
  kind: 'desktop' | 'android';
}) {
  const tx = (r: string, e: string) => (ru ? r : e);

  // Filter out signature/checksum/AAB files — only direct user installers
  const installers = release.assets.filter((a) => {
    const n = a.name.toLowerCase();
    if (n.endsWith('.sig') || n.endsWith('.sha256') || n.endsWith('.aab')) return false;
    return n.endsWith('.exe') || n.endsWith('.msi') || n.endsWith('.deb') || n.endsWith('.apk') || n.endsWith('.dmg') || n.endsWith('.appimage');
  });

  // Prioritize the user's OS first
  const osScore = (n: string) => {
    n = n.toLowerCase();
    if (preferredOs === 'windows' && (n.endsWith('.exe') || n.endsWith('.msi'))) return -2;
    if (preferredOs === 'linux' && (n.endsWith('.deb') || n.endsWith('.appimage'))) return -2;
    if (preferredOs === 'android' && n.endsWith('.apk')) return -2;
    if (preferredOs === 'mac' && n.endsWith('.dmg')) return -2;
    return 0;
  };
  const sorted = [...installers].sort((a, b) => osScore(a.name) - osScore(b.name));

  const date = new Date(release.published_at).toLocaleDateString(ru ? 'ru-RU' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <div className={`rounded-2xl border p-4 ${highlight ? 'border-primary-500/30 bg-gradient-to-br from-primary-500/5 to-cyan-500/5' : 'border-dark-500 bg-dark-800/50'}`}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <p className="font-bold">{release.name || release.tag_name}</p>
          <p className="text-[11px] text-gray-500">{date}{release.prerelease && ` · ${tx('пре-релиз', 'pre-release')}`}</p>
        </div>
        <a
          href={release.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-gray-500 hover:text-gray-300 flex items-center gap-1 shrink-0"
        >
          {tx('заметки', 'release notes')} <ExternalLink size={10} />
        </a>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-gray-500">{tx('Файлов в этом релизе нет.', 'No files in this release.')}</p>
      ) : (
        <div className="grid gap-2">
          {sorted.map((a) => (
            <FileButton key={a.name} asset={a} preferredOs={preferredOs} kind={kind} ru={ru} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileButton({
  asset, preferredOs, kind, ru,
}: { asset: Asset; preferredOs: Platform; kind: 'desktop' | 'android'; ru: boolean }) {
  const tx = (r: string, e: string) => (ru ? r : e);
  const n = asset.name.toLowerCase();
  let label = '', icon = <Download size={14} />, isPreferred = false;
  if (n.endsWith('.exe'))      { label = 'Windows · NSIS'; icon = <Monitor size={14} />; isPreferred = preferredOs === 'windows'; }
  else if (n.endsWith('.msi')) { label = 'Windows · MSI'; icon = <Monitor size={14} />; isPreferred = preferredOs === 'windows'; }
  else if (n.endsWith('.deb')) { label = 'Linux · Debian/Ubuntu'; icon = <Monitor size={14} />; isPreferred = preferredOs === 'linux'; }
  else if (n.endsWith('.appimage')) { label = 'Linux · AppImage'; icon = <Monitor size={14} />; isPreferred = preferredOs === 'linux'; }
  else if (n.endsWith('.apk')) { label = 'Android · APK'; icon = <Smartphone size={14} />; isPreferred = preferredOs === 'android'; }
  else if (n.endsWith('.dmg')) { label = 'macOS · DMG'; icon = <Apple size={14} />; isPreferred = preferredOs === 'mac'; }
  else label = asset.name;

  void kind;

  return (
    <a
      href={asset.browser_download_url}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        isPreferred
          ? 'bg-primary-500 hover:bg-primary-600 text-white'
          : 'bg-dark-700 hover:bg-dark-600 text-gray-200'
      }`}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className={`text-[10px] font-mono truncate ${isPreferred ? 'text-white/70' : 'text-gray-500'}`}>{asset.name}</p>
      </div>
      <span className={`text-[10px] font-mono shrink-0 ${isPreferred ? 'text-white/80' : 'text-gray-400'}`}>
        {fmtBytes(asset.size)}
      </span>
      {isPreferred && (
        <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/20 text-white shrink-0">
          {tx('Тебе', 'For you')}
        </span>
      )}
    </a>
  );
}
