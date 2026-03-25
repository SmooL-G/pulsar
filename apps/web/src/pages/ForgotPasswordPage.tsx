import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useI18n } from '../i18n';
import toast from 'react-hot-toast';

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      toast.success(t('forgot.codeSent'));
      navigate('/reset-password', { state: { email } });
    } catch (err: any) {
      if (err.response?.status === 429) {
        toast.error(t('forgot.rateLimit'));
      } else {
        // Still navigate — we don't reveal if email exists
        toast.success(t('forgot.codeSent'));
        navigate('/reset-password', { state: { email } });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          {t('forgot.backToLogin')}
        </Link>

        <div className="bg-dark-700 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
              <Mail size={20} className="text-primary-400" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{t('forgot.title')}</h2>
              <p className="text-xs text-gray-400">{t('forgot.subtitle')}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-2.5 bg-dark-600 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? t('common.loading') : t('forgot.sendCode')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
