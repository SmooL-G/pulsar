import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { Users, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useI18n } from '../i18n';

export function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { setActiveChat, fetchChats } = useChatStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !code) return;

    const joinGroup = async () => {
      try {
        const { data } = await api.post(`/groups/join/${code}`);
        setStatus('success');
        await fetchChats();
        // Navigate to chat after short delay
        setTimeout(() => {
          const chat = useChatStore.getState().chats.find((c) => c.id === data.chatId);
          if (chat) setActiveChat(chat);
          navigate('/', { replace: true });
        }, 1500);
      } catch (err: any) {
        const error = err.response?.data?.error;
        if (error === 'ALREADY_MEMBER') {
          setStatus('already');
          setTimeout(() => navigate('/', { replace: true }), 1500);
        } else {
          setStatus('error');
          setErrorMsg(err.response?.data?.message || t('common.error'));
        }
      }
    };

    joinGroup();
  }, [isAuthenticated, code]);

  if (!isAuthenticated) {
    // Save invite URL and redirect to login
    sessionStorage.setItem('pendingInvite', `/invite/${code}`);
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-dark-800 flex items-center justify-center p-4">
      <div className="bg-dark-700 rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
        {status === 'loading' && (
          <>
            <Loader2 size={48} className="mx-auto text-primary-500 animate-spin" />
            <p className="text-gray-300">{t('invite.joining')}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <p className="text-white font-medium">{t('invite.success')}</p>
            <p className="text-gray-400 text-sm">{t('invite.redirecting')}</p>
          </>
        )}
        {status === 'already' && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary-500/10 flex items-center justify-center mx-auto">
              <Users size={32} className="text-primary-400" />
            </div>
            <p className="text-white font-medium">{t('invite.alreadyMember')}</p>
            <p className="text-gray-400 text-sm">{t('invite.redirecting')}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <AlertCircle size={32} className="text-red-400" />
            </div>
            <p className="text-white font-medium">{t('invite.error')}</p>
            <p className="text-gray-400 text-sm">{errorMsg}</p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="mt-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm transition-colors"
            >
              {t('invite.goHome')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
