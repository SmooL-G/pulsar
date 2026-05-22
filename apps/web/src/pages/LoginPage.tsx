import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { useI18n } from '../i18n';
import { LANGUAGES } from '../components/settings/LanguageSelector';
import { UserCountInformer } from '../components/auth/UserCountInformer';
import { SplashScreen } from '../components/auth/SplashScreen';
import { PlsPriceBadge } from '../components/price/PlsPriceCard';
import { LiveActivityPulse } from '../components/economy/LiveActivityPulse';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';
import { AudienceTiles, TokenTease } from '../components/landing/PitchSections';

function navigateAfterLogin(navigate: ReturnType<typeof useNavigate>) {
  const pending = sessionStorage.getItem('pendingInvite');
  if (pending) {
    sessionStorage.removeItem('pendingInvite');
    navigate(pending, { replace: true });
  } else {
    navigate('/');
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const { t, locale, setLocale } = useI18n();
  const { login } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Referral capture: ?ref=<code> in the URL pre-fills the field on
  // the register form and shows a "you're invited by @X" preview.
  const [referralCode, setReferralCode] = useState<string>('');
  const [referrerInfo, setReferrerInfo] = useState<{
    referrer: { username?: string; displayName?: string };
    yourTierBonus: string;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (!ref) return;
    setReferralCode(ref);
    setMode('register');
    api.get(`/referrals/info/${encodeURIComponent(ref)}`)
      .then((r) => setReferrerInfo(r.data))
      .catch(() => { /* invalid code — silently ignore */ });
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Backend accepts emailOrUsername; the input field carries either.
      const { data } = await api.post('/auth/login', { emailOrUsername: email, password });
      await login(data.accessToken);
      // Show splash; navigation happens in <SplashScreen onDone>.
      setShowSplash(true);
    } catch (err: any) {
      setError(err.response?.data?.message || t('auth.loginFailed'));
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/register', {
        username,
        email,
        password,
        ...(referralCode ? { referralCode } : {}),
      });
      await login(data.accessToken);
      setShowSplash(true);
    } catch (err: any) {
      setError(err.response?.data?.message || t('auth.registerFailed'));
      setLoading(false);
    }
  };

  if (showSplash) {
    return <SplashScreen onDone={() => navigateAfterLogin(navigate)} />;
  }

  return (
    // Explicit h-dvh + overflow-y-auto because body has position:fixed
    // (needed for the chat page) and would otherwise prevent scrolling.
    <div className="h-dvh overflow-y-auto bg-gradient-to-br from-dark-900 via-dark-800 to-primary-900">
    {/* Auth section — fills first viewport, scrolls into pitch sections below */}
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t('auth.title')}</h1>
          <p className="text-gray-400">{t('auth.subtitle')}</p>
          {/* Positioning hook — single sentence visitors read in <2s */}
          <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto leading-snug">
            {locale === 'ru'
              ? 'Мессенджер + крипто-кошелёк + P2P-биржа в одном приложении.'
              : 'Messenger + crypto wallet + P2P exchange in one app.'}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[11px] font-bold text-amber-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"></span>
              </span>
              {locale === 'ru' ? 'ОТКРЫТАЯ BETA' : 'OPEN BETA'}
            </span>
            <PlsPriceBadge />
            <LiveActivityPulse compact />
          </div>
        </div>

        {/* Выбор языка — над формой */}
        <div ref={langRef} className="relative flex justify-center mb-4 z-30">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dark-500/50 bg-dark-800/80 backdrop-blur-md hover:border-primary-500/40 transition-all"
          >
            <span className="text-base">{LANGUAGES.find((l) => l.id === locale)?.flag}</span>
            <span className="text-xs text-gray-300">{LANGUAGES.find((l) => l.id === locale)?.name}</span>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
          </button>
          {langOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setLangOpen(false)} />
              <div className="absolute top-full mt-1 z-20 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl py-1 min-w-[160px] max-h-[60vh] overflow-y-auto animate-fade-in">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => { setLocale(lang.id); setLangOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                      locale === lang.id
                        ? 'bg-primary-500/15 text-primary-400'
                        : 'text-gray-300 hover:bg-dark-600'
                    }`}
                  >
                    <span className="text-base">{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Card */}
        <div className="bg-dark-700 rounded-2xl p-6 shadow-2xl relative z-10">
          {/* Tabs */}
          <div className="flex gap-1 bg-dark-600 rounded-lg p-1 mb-6">
            {(['login', 'register'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setMode(tab); setError(''); }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors
                  ${mode === tab
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-400 hover:text-white'}`}
              >
                {tab === 'login' ? t('auth.login') : t('auth.register')}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Email Login */}
          {mode === 'login' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  {locale === 'ru' ? 'Email или ник' : 'Email or username'}
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoCapitalize="none"
                  autoComplete="username"
                  className="w-full px-4 py-2.5 bg-dark-600 rounded-lg text-white border border-dark-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-sm"
                  placeholder={locale === 'ru' ? 'you@example.com или your_nick' : 'you@example.com or your_nick'}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('auth.password')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-2.5 pr-10 bg-dark-600 rounded-lg text-white border border-dark-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-sm"
                    placeholder={t('auth.passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <Link
                  to="/forgot-password"
                  className="block text-xs text-primary-400 hover:text-primary-300 mt-1.5 text-right transition-colors"
                >
                  {t('forgot.link')}
                </Link>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? t('auth.signingIn') : t('auth.loginButton')}
              </button>
            </form>
          )}

          {/* Register */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Referral preview banner — visible when ?ref=<code> resolved */}
              {referrerInfo && (
                <div className="rounded-xl border border-primary-500/40 bg-primary-500/10 p-3 text-sm">
                  <div className="text-primary-300 font-semibold">
                    {locale === 'ru' ? 'Тебя пригласил' : 'Invited by'}{' '}
                    @{referrerInfo.referrer.username || '?'}
                  </div>
                  <div className="text-xs text-gray-300 mt-1">
                    {locale === 'ru'
                      ? `При регистрации вы оба получите ${referrerInfo.yourTierBonus} PLS (после Verification Level 1).`
                      : `On signup both of you get ${referrerInfo.yourTierBonus} PLS (after Verification Level 1).`}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('auth.username')}</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[a-zA-Z0-9_\-]+"
                  className="w-full px-4 py-2.5 bg-dark-600 rounded-lg text-white border border-dark-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-sm"
                  placeholder={t('auth.usernamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('auth.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-dark-600 rounded-lg text-white border border-dark-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-sm"
                  placeholder={t('auth.emailPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('auth.password')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-2.5 pr-10 bg-dark-600 rounded-lg text-white border border-dark-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-sm"
                    placeholder={t('auth.passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
              </button>
              <p className="text-xs text-gray-500 text-center">{t('auth.walletNote')}</p>
              <p className="text-xs text-gray-500 text-center">
                {t('privacy.agreePrefix')}{' '}
                <a href="/privacy" target="_blank" className="text-primary-400 hover:text-primary-300 underline">
                  {t('privacy.agreeLink')}
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
      <UserCountInformer />
      <div className="fixed top-[72px] right-4 z-20 flex gap-2">
        <Link
          to="/features"
          className="px-3 py-1.5 rounded-lg border border-primary-500/20 bg-dark-800/80 backdrop-blur-md text-xs font-medium text-primary-400 hover:text-primary-300 hover:border-primary-500/40 transition-all shadow-[0_0_12px_rgba(92,124,250,0.08)]"
        >
          {locale === 'ru' ? 'Возможности' : 'Features'}
        </Link>
        <Link
          to="/info"
          className="px-3 py-1.5 rounded-lg border border-primary-500/20 bg-dark-800/80 backdrop-blur-md text-xs font-medium text-primary-400 hover:text-primary-300 hover:border-primary-500/40 transition-all shadow-[0_0_12px_rgba(92,124,250,0.08)]"
        >
          {t('info.link')}
        </Link>
        <Link
          to="/roadmap"
          className="px-3 py-1.5 rounded-lg border border-primary-500/20 bg-dark-800/80 backdrop-blur-md text-xs font-medium text-primary-400 hover:text-primary-300 hover:border-primary-500/40 transition-all shadow-[0_0_12px_rgba(92,124,250,0.08)]"
        >
          {t('roadmap.link')}
        </Link>
      </div>
    </div>
    {/* Pitch sections — scroll into view below the auth viewport */}
    <AudienceTiles showFeaturesLink={true} compact={false} />
    <TokenTease deep={false} />
    {/* Spacer + mini-footer */}
    <footer className="border-t border-white/5 py-6 text-center text-xs text-gray-500">
      <div className="flex flex-wrap justify-center gap-4">
        <Link to="/features" className="hover:text-white transition-colors">
          {locale === 'ru' ? 'Возможности' : 'Features'}
        </Link>
        <Link to="/privacy" className="hover:text-white transition-colors">
          {locale === 'ru' ? 'Приватность' : 'Privacy'}
        </Link>
        <Link to="/roadmap" className="hover:text-white transition-colors">
          {locale === 'ru' ? 'Дорожная карта' : 'Roadmap'}
        </Link>
        <Link to="/info" className="hover:text-white transition-colors">
          {locale === 'ru' ? 'О проекте' : 'About'}
        </Link>
      </div>
    </footer>
    </div>
  );
}
