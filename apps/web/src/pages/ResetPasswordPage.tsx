import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, KeyRound, Loader2, Check, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api';
import { useI18n } from '../i18n';
import toast from 'react-hot-toast';

export function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const emailFromState = (location.state as any)?.email || '';

  const [email, setEmail] = useState(emailFromState);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !code || !newPassword) return;

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, code, newPassword });
      setSuccess(true);
      toast.success(t('reset.success'));
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('reset.invalidCode'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-dark-800 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-400" />
          </div>
          <p className="text-lg font-semibold">{t('reset.success')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('reset.redirecting')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link
          to="/forgot-password"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          {t('forgot.backToLogin')}
        </Link>

        <div className="bg-dark-700 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
              <KeyRound size={20} className="text-primary-400" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{t('reset.title')}</h2>
              <p className="text-xs text-gray-400">{t('reset.subtitle')}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!emailFromState && (
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-600 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">{t('reset.code')}</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full px-4 py-3 bg-dark-600 rounded-lg text-center text-2xl font-mono tracking-[0.5em] border-none outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">{t('reset.newPassword')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  minLength={8}
                  className="w-full px-4 py-2.5 pr-10 bg-dark-600 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-primary-500"
                  required
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
              disabled={loading || code.length !== 6 || newPassword.length < 8}
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? t('common.loading') : t('reset.resetButton')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
