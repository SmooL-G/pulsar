import { useEffect, useState } from 'react';
import { X, Search, UserPlus, UserCheck, UserX, Clock, Users, MessageCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useChatStore } from '../../store/chatStore';
import { useI18n } from '../../i18n';
import { PulsarBadge } from '../ui/PulsarBadge';
import { GenerativeAvatar } from '../ui/GenerativeAvatar';

interface FriendsPanelProps {
  onClose: () => void;
}

type Tab = 'friends' | 'requests' | 'add';

interface Friend {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isOnline: boolean;
  friendshipId: string;
}

interface FriendRequest {
  id: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    isOnline: boolean;
  };
  createdAt: string;
}

export function FriendsPanel({ onClose }: FriendsPanelProps) {
  const { t } = useI18n();
  const { setActiveChat, addChat } = useChatStore();
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFriends();
    loadRequests();
  }, []);

  const loadFriends = async () => {
    try {
      const { data } = await api.get('/friends');
      setFriends(data.friends || []);
    } catch {}
  };

  const loadRequests = async () => {
    try {
      const { data } = await api.get('/friends/requests');
      setIncoming(data.incoming || []);
      setOutgoing(data.outgoing || []);
    } catch {}
  };

  const searchUsers = async (query: string) => {
    setSearch(query);
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      const { data } = await api.get(`/users?search=${encodeURIComponent(query)}`);
      setSearchResults(data.users || data || []);
    } catch { setSearchResults([]); }
  };

  const sendRequest = async (targetUserId: string) => {
    try {
      const { data } = await api.post('/friends/request', { targetUserId });
      setSentIds((prev) => new Set(prev).add(targetUserId));
      if (data.autoAccepted) {
        loadFriends();
        loadRequests();
      }
    } catch {}
  };

  const acceptRequest = async (id: string) => {
    try {
      await api.post(`/friends/${id}/accept`);
      loadFriends();
      loadRequests();
    } catch {}
  };

  const declineRequest = async (id: string) => {
    try {
      await api.post(`/friends/${id}/decline`);
      loadRequests();
    } catch {}
  };

  const removeFriend = async (friendshipId: string) => {
    try {
      await api.delete(`/friends/${friendshipId}`);
      setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
    } catch {}
  };

  const startDM = async (userId: string) => {
    setLoading(true);
    try {
      const { data } = await api.post('/chats/direct', { targetUserId: userId });
      const chat = data.chat || data;
      addChat(chat);
      setActiveChat(chat);
      onClose();
    } catch {}
    setLoading(false);
  };

  const friendIds = new Set(friends.map((f) => f.id));
  const outgoingIds = new Set(outgoing.map((r) => r.user.id));

  const onlineFriends = friends.filter((f) => f.isOnline);
  const offlineFriends = friends.filter((f) => !f.isOnline);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-500 shrink-0">
          <h3 className="font-semibold flex items-center gap-2">
            <Users size={18} />
            {t('friends.title')}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 mx-2 mt-2 bg-gray-100 dark:bg-dark-600 rounded-lg shrink-0">
          <TabButton active={tab === 'friends'} onClick={() => setTab('friends')}>
            <Users size={14} />
            {t('friends.list')}
          </TabButton>
          <TabButton active={tab === 'requests'} onClick={() => setTab('requests')} badge={incoming.length}>
            <Clock size={14} />
            {t('friends.requests')}
          </TabButton>
          <TabButton active={tab === 'add'} onClick={() => setTab('add')}>
            <UserPlus size={14} />
            {t('friends.add')}
          </TabButton>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Friends list */}
          {tab === 'friends' && (
            <>
              {friends.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <Users size={40} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">{t('friends.noFriends')}</p>
                  <button
                    onClick={() => setTab('add')}
                    className="mt-2 text-sm text-primary-500 hover:text-primary-400"
                  >
                    {t('friends.addFirst')}
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {onlineFriends.length > 0 && (
                    <p className="text-xs text-gray-500 px-2 py-1 uppercase font-medium">
                      {t('friends.online')} — {onlineFriends.length}
                    </p>
                  )}
                  {onlineFriends.map((f) => (
                    <FriendItem
                      key={f.id}
                      user={f}
                      onMessage={() => startDM(f.id)}
                      onRemove={() => removeFriend(f.friendshipId)}
                      loading={loading}
                      t={t}
                    />
                  ))}
                  {offlineFriends.length > 0 && (
                    <p className="text-xs text-gray-500 px-2 py-1 uppercase font-medium mt-3">
                      {t('friends.offline')} — {offlineFriends.length}
                    </p>
                  )}
                  {offlineFriends.map((f) => (
                    <FriendItem
                      key={f.id}
                      user={f}
                      onMessage={() => startDM(f.id)}
                      onRemove={() => removeFriend(f.friendshipId)}
                      loading={loading}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Requests */}
          {tab === 'requests' && (
            <div className="space-y-4">
              {incoming.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 px-2 py-1 uppercase font-medium">{t('friends.incoming')}</p>
                  <div className="space-y-1">
                    {incoming.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-600">
                        <UserAvatar user={r.user} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate flex items-center gap-1">{r.user.displayName || r.user.username}<PulsarBadge level={(r.user as any).verificationLevel || 0} size={12} /></p>
                          <p className="text-xs text-gray-400">@{r.user.username}</p>
                        </div>
                        <button onClick={() => acceptRequest(r.id)} className="p-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white" title={t('friends.accept')}>
                          <UserCheck size={16} />
                        </button>
                        <button onClick={() => declineRequest(r.id)} className="p-1.5 rounded-lg bg-dark-500 hover:bg-dark-400 text-gray-300" title={t('friends.decline')}>
                          <UserX size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {outgoing.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 px-2 py-1 uppercase font-medium">{t('friends.outgoing')}</p>
                  <div className="space-y-1">
                    {outgoing.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-600">
                        <UserAvatar user={r.user} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate flex items-center gap-1">{r.user.displayName || r.user.username}<PulsarBadge level={(r.user as any).verificationLevel || 0} size={12} /></p>
                          <p className="text-xs text-gray-400">@{r.user.username}</p>
                        </div>
                        <span className="text-xs text-gray-500 px-2 py-1 bg-dark-600 rounded-full">{t('friends.pending')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {incoming.length === 0 && outgoing.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  <p className="text-sm">{t('friends.noRequests')}</p>
                </div>
              )}
            </div>
          )}

          {/* Add friend */}
          {tab === 'add' && (
            <>
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('chat.findUser')}
                  value={search}
                  onChange={(e) => searchUsers(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg bg-gray-100 dark:bg-dark-600 border-none outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                {searchResults.map((user) => {
                  const isFriend = friendIds.has(user.id);
                  const isPending = outgoingIds.has(user.id) || sentIds.has(user.id);
                  return (
                    <div key={user.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-600">
                      <UserAvatar user={user} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate flex items-center gap-1">{user.displayName || user.username}<PulsarBadge level={(user as any).verificationLevel || 0} size={12} /></p>
                        <p className="text-xs text-gray-400 font-mono">
                          {user.walletAddress?.slice(0, 6)}...{user.walletAddress?.slice(-4)}
                        </p>
                      </div>
                      {isFriend ? (
                        <span className="text-xs text-green-400 px-2 py-1 bg-green-500/10 rounded-full">{t('friends.already')}</span>
                      ) : isPending ? (
                        <span className="text-xs text-yellow-400 px-2 py-1 bg-yellow-500/10 rounded-full">{t('friends.sent')}</span>
                      ) : (
                        <button
                          onClick={() => sendRequest(user.id)}
                          className="p-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white"
                        >
                          <UserPlus size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {search.length >= 2 && searchResults.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-4">{t('common.unknown')}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children, badge }: { active: boolean; onClick: () => void; children: React.ReactNode; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors relative
        ${active ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
    >
      {children}
      {badge && badge > 0 ? (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function UserAvatar({ user }: { user: { id?: string; displayName?: string | null; username: string; avatarUrl?: string | null; isOnline?: boolean } }) {
  return (
    <div className="relative">
      <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium overflow-hidden">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <GenerativeAvatar seed={user.id || user.username} size={40} />
        )}
      </div>
      {user.isOnline && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-dark-700" />
      )}
    </div>
  );
}

function FriendItem({ user, onMessage, onRemove, loading, t }: {
  user: Friend;
  onMessage: () => void;
  onRemove: () => void;
  loading: boolean;
  t: (key: string) => string;
}) {
  const [showRemove, setShowRemove] = useState(false);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-600 group">
      <UserAvatar user={user} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate flex items-center gap-1">{user.displayName || user.username}<PulsarBadge level={(user as any).verificationLevel || 0} size={12} /></p>
        <p className="text-xs text-gray-400">@{user.username}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onMessage}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-dark-500 text-gray-400 hover:text-white transition-colors"
          title={t('friends.message')}
        >
          <MessageCircle size={16} />
        </button>
        {showRemove ? (
          <button
            onClick={() => { onRemove(); setShowRemove(false); }}
            className="p-1.5 rounded-lg bg-red-500 text-white text-xs"
          >
            <UserX size={16} />
          </button>
        ) : (
          <button
            onClick={() => { setShowRemove(true); setTimeout(() => setShowRemove(false), 3000); }}
            className="p-1.5 rounded-lg hover:bg-dark-500 text-gray-400 hover:text-red-400 transition-colors"
            title={t('friends.remove')}
          >
            <UserX size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
