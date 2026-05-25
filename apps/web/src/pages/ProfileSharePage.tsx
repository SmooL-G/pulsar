import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { Loader2, AlertCircle, Bot, MessageCircle, ShieldCheck, Users, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { useI18n } from '../i18n';
import { GenerativeAvatar } from '../components/ui/GenerativeAvatar';
import { PulsarBadge } from '../components/ui/PulsarBadge';

interface PublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isBot: boolean;
  role: string;
  verificationLevel: number;
  profileBadge: string | null;
  nickColor: string | null;
  createdAt: string;
}

// Reserved top-level paths that React Router already owns. We block them
// so a user named e.g. "login" can't shadow the actual /login page.
const RESERVED = new Set([
  'login', 'invite', 'privacy', 'roadmap', 'developers', 'docs', 'info',
  'donate', 'terms', 'cookies', 'bots', 'forgot-password', 'reset-password',
  'api', 'socket.io', 'sw.js', 'manifest.webmanifest', 'favicon.svg',
  'icons', 'assets', '.well-known', 'u', 'g', 'mining', 'download', 'features',
]);

export function ProfileSharePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const ru = locale === 'ru';
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  // Group fallback: if /u/:name 404s, we try /g/:name. If that resolves,
  // we render a group-landing card instead of the user one.
  const [group, setGroup] = useState<{
    id: string;
    name: string;
    type: 'GROUP' | 'CHANNEL';
    description: string | null;
    avatarUrl: string | null;
    inviteCode: string | null;
    ownerId: string;
    membersCount: number;
    createdAt: string;
  } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'opening' | 'notfound' | 'error'>('loading');
  const [error, setError] = useState('');

  // Reserved word — bail out to home.
  if (username && RESERVED.has(username.toLowerCase())) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/u/${encodeURIComponent(username)}`);
        if (!cancelled) {
          setProfile(data);
          setStatus('ready');
        }
      } catch (err: any) {
        if (cancelled) return;
        if (err.response?.status === 404) {
          // Fallback: maybe the handle is a group/channel name.
          try {
            const { data } = await api.get(`/g/${encodeURIComponent(username)}`);
            if (!cancelled) {
              setGroup(data);
              setStatus('ready');
            }
          } catch (err2: any) {
            if (!cancelled) setStatus('notfound');
          }
        } else {
          setStatus('error');
          setError(err.response?.data?.message || (ru ? 'Ошибка' : 'Error'));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [username]);

  const openChat = async () => {
    if (!profile) return;
    setStatus('opening');
    try {
      const { data } = await api.post('/chats/direct', { targetUserId: profile.id });
      await useChatStore.getState().fetchChats();
      const chat = useChatStore.getState().chats.find((c) => c.id === data.id || c.id === data.chatId);
      if (chat) useChatStore.getState().setActiveChat(chat);
      navigate('/', { replace: true });
    } catch (err: any) {
      setStatus('ready');
      setError(err.response?.data?.message || (ru ? 'Не удалось открыть чат' : 'Failed to open chat'));
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-dark-800 flex items-center justify-center p-4">
        <Loader2 size={32} className="text-primary-500 animate-spin" />
      </div>
    );
  }

  if (status === 'notfound') {
    return (
      <div className="min-h-screen bg-dark-800 flex items-center justify-center p-4">
        <div className="bg-dark-700 rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-gray-500/10 flex items-center justify-center mx-auto">
            <AlertCircle size={32} className="text-gray-400" />
          </div>
          <p className="text-white font-medium">{ru ? `@${username} не найден` : `@${username} not found`}</p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="mt-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm transition-colors"
          >
            {ru ? 'На главную' : 'Go home'}
          </button>
        </div>
      </div>
    );
  }

  // Group landing — different shape, simpler card.
  if (group) {
    const memberCount = group.membersCount;
    const isChannel = group.type === 'CHANNEL';
    const inviteUrl = group.inviteCode ? `/invite/${group.inviteCode}` : null;
    const goToInvite = () => {
      if (inviteUrl) navigate(inviteUrl, { replace: true });
    };
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-primary-900/20 flex items-center justify-center p-4">
        <div className="bg-dark-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/5">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-primary-500 flex items-center justify-center">
              {group.avatarUrl ? (
                <img src={group.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Users size={40} className="text-white" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                {group.name}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-300 font-bold uppercase">
                  {isChannel ? (ru ? 'Канал' : 'Channel') : (ru ? 'Группа' : 'Group')}
                </span>
              </h1>
              <p className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
                <Users size={11} />
                {memberCount} {ru
                  ? memberCount === 1 ? 'участник' : memberCount < 5 ? 'участника' : 'участников'
                  : memberCount === 1 ? 'member' : 'members'}
              </p>
            </div>
            {group.description && (
              <p className="text-sm text-gray-300 px-2">{group.description}</p>
            )}
            <p className="text-[11px] text-gray-500">
              {ru ? 'Создана' : 'Created'} {new Date(group.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="mt-5 space-y-2">
            {inviteUrl ? (
              <button
                onClick={goToInvite}
                className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink size={16} />
                {ru ? 'Присоединиться' : 'Join group'}
              </button>
            ) : (
              <div className="w-full py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm text-center">
                {ru ? '🔒 Закрытая — нужно приглашение от участника' : '🔒 Private — invite required'}
              </div>
            )}
            <button
              onClick={() => navigate('/', { replace: true })}
              className="w-full py-2 text-xs text-gray-400 hover:text-white transition-colors"
            >
              {ru ? 'На главную' : 'Go home'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const displayName = profile.displayName || profile.username;
  const isBot = profile.isBot;

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-primary-900/20 flex items-center justify-center p-4">
      <div className="bg-dark-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/5">
        {/* Avatar */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-primary-500 flex items-center justify-center">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <GenerativeAvatar seed={profile.id} size={96} />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center justify-center gap-1.5"
              style={profile.nickColor ? { color: profile.nickColor } : undefined}>
              {displayName}
              <PulsarBadge level={profile.verificationLevel} size={16} role={profile.role} />
              {isBot && (
                <span className="ml-1 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-300">
                  BOT
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-400 font-mono">@{profile.username}</p>
          </div>
          {profile.bio && (
            <p className="text-sm text-gray-300 leading-relaxed px-2 whitespace-pre-wrap">{profile.bio}</p>
          )}
        </div>

        {/* CTA */}
        <div className="mt-6 space-y-2">
          {isAuthenticated ? (
            <button
              onClick={openChat}
              disabled={status === 'opening'}
              className="w-full py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {status === 'opening'
                ? <Loader2 size={16} className="animate-spin" />
                : isBot ? <Bot size={16} /> : <MessageCircle size={16} />}
              {isBot
                ? (ru ? 'Открыть бота' : 'Open bot')
                : (ru ? 'Написать сообщение' : 'Send message')}
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  sessionStorage.setItem('pendingInvite', `/${profile.username}`);
                  navigate('/login');
                }}
                className="w-full py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isBot ? <Bot size={16} /> : <MessageCircle size={16} />}
                {ru ? 'Открыть в Pulsar' : 'Open in Pulsar'}
              </button>
              <p className="text-[11px] text-center text-gray-500 flex items-center justify-center gap-1">
                <ShieldCheck size={11} />
                {ru ? 'Войдите или зарегистрируйтесь — это бесплатно' : 'Log in or sign up — it\'s free'}
              </p>
            </>
          )}
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-400 text-center">{error}</p>
        )}

        <p className="mt-4 text-[10px] text-gray-600 text-center">
          {ru ? 'Поделились через Pulsar' : 'Shared via Pulsar'} · pulsar-chat.fun
        </p>
      </div>
    </div>
  );
}
