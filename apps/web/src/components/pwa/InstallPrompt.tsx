import { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { useI18n } from '../../i18n';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pulsar_pwa_install_dismissed';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // a week

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

function isIOS(): boolean {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

function wasDismissedRecently(): boolean {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return ts && Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const { locale } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS doesn't fire beforeinstallprompt — show manual hint after a delay
    if (isIOS()) {
      const t = setTimeout(() => {
        setShowIosHint(true);
        setVisible(true);
      }, 4000);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onPrompt);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      setVisible(false);
    } else {
      dismiss();
    }
    setDeferred(null);
  };

  if (!visible) return null;

  const ru = locale === 'ru';

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[calc(100%-2rem)]">
      <div className="bg-dark-700/95 border border-primary-500/40 backdrop-blur-md rounded-2xl shadow-2xl shadow-primary-500/20 p-4 flex items-start gap-3 animate-slide-up">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
          <Smartphone size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">
            {ru ? 'Установить Pulsar' : 'Install Pulsar'}
          </p>
          {showIosHint ? (
            <p className="text-gray-300 text-xs mt-1 leading-relaxed">
              {ru
                ? 'Нажмите кнопку «Поделиться» в Safari, затем «На экран Домой».'
                : 'Tap the Share button in Safari, then "Add to Home Screen".'}
            </p>
          ) : (
            <p className="text-gray-400 text-xs mt-0.5">
              {ru
                ? 'Получайте уведомления и быстрый доступ с домашнего экрана.'
                : 'Get notifications and quick access from your home screen.'}
            </p>
          )}
          {!showIosHint && (
            <button
              onClick={install}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold transition-colors"
            >
              <Download size={12} />
              {ru ? 'Установить' : 'Install'}
            </button>
          )}
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 -mr-1 -mt-1 p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          aria-label="dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
