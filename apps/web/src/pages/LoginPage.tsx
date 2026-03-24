import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { useI18n } from '../i18n';
import { LanguageSelector } from '../components/settings/LanguageSelector';
import bs58 from 'bs58';

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
  const { publicKey, signMessage, connected } = useWallet();
  const [mode, setMode] = useState<'wallet' | 'login' | 'register'>('wallet');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLang, setShowLang] = useState(false);

  const handleWalletAuth = async () => {
    if (!publicKey || !signMessage) return;
    setLoading(true);
    setError('');

    try {
      const walletAddress = publicKey.toBase58();
      const { data: nonceData } = await api.post('/auth/wallet/nonce', { walletAddress });
      const message = new TextEncoder().encode(nonceData.nonce);
      const signature = await signMessage(message);
      const signatureB58 = bs58.encode(signature);
      const { data } = await api.post('/auth/wallet/verify', { walletAddress, signature: signatureB58 });
      await login(data.accessToken);
      navigateAfterLogin(navigate);
    } catch (err: any) {
      setError(err.response?.data?.message || t('auth.walletAuthFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { email, password });
      await login(data.accessToken);
      navigateAfterLogin(navigate);
    } catch (err: any) {
      setError(err.response?.data?.message || t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/register', { username, email, password });
      await login(data.accessToken);
      navigateAfterLogin(navigate);
    } catch (err: any) {
      setError(err.response?.data?.message || t('auth.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-900 via-dark-800 to-primary-900 p-4">
      <div className="w-full max-w-md">
        {/* Language toggle */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowLang(true)}
            className="px-3 py-1.5 rounded-lg bg-dark-700/50 hover:bg-dark-600 text-sm text-gray-300 transition-colors"
          >
            {locale.toUpperCase()}
          </button>
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t('auth.title')}</h1>
          <p className="text-gray-400">{t('auth.subtitle')}</p>
        </div>

        {/* Card */}
        <div className="bg-dark-700 rounded-2xl p-6 shadow-2xl">
          {/* Tabs */}
          <div className="flex gap-1 bg-dark-600 rounded-lg p-1 mb-6">
            {(['wallet', 'login', 'register'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setMode(tab); setError(''); }}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors
                  ${mode === tab
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-400 hover:text-white'}`}
              >
                {tab === 'wallet' ? t('auth.wallet') : tab === 'login' ? t('auth.login') : t('auth.register')}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Wallet Auth */}
          {mode === 'wallet' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400 text-center">{t('auth.connectWallet')}</p>
              <div className="flex justify-center">
                <WalletMultiButton />
              </div>
              {connected && publicKey && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 text-center font-mono">
                    {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
                  </p>
                  <button
                    onClick={handleWalletAuth}
                    disabled={loading}
                    className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {loading ? t('auth.signing') : t('auth.signIn')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Email Login */}
          {mode === 'login' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
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
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 bg-dark-600 rounded-lg text-white border border-dark-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-sm"
                  placeholder={t('auth.passwordPlaceholder')}
                />
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
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 bg-dark-600 rounded-lg text-white border border-dark-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-sm"
                  placeholder={t('auth.passwordPlaceholder')}
                />
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
      {showLang && <LanguageSelector onClose={() => setShowLang(false)} />}
    </div>
  );
}
