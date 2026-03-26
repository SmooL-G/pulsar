import React, { useEffect, useState } from 'react';
import { X, Users, Bell, Shield, Copy, Check, Trash2, Share2, MessageCircle, Calendar, Wallet, AtSign, UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { api } from '../../services/api';
import { PulsarBadge } from '../ui/PulsarBadge';

interface InfoPanelProps {
  onClose: () => void;
}

export function InfoPanel({ onClose }: InfoPanelProps) {
  const { t } = useI18n();
  const { activeChat, setActiveChat, fetchChats, chats } = useChatStore();
  const user = useAuthStore((s) => s.user);
  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [shareSearch, setShareSearch] = useState('');
  const [sharedTo, setSharedTo] = useState<Set<string>>(new Set());
  const [friendStatus, setFriendStatus] = useState<'none' | 'friends' | 'pending' | 'loading'>('loading');
  const [friendRequestId, setFriendRequestId] = useState<string | null>(null);

  const isGroup = activeChat?.type === 'GROUP';
  const otherUserId = !isGroup ? (activeChat as any)?.otherUser?.id : null;

  // Check friend status for DM contacts
  useEffect(() => {
    if (!otherUserId) return;
    setFriendStatus('loading');
    Promise.all([
      api.get('/friends').catch(() => ({ data: { friends: [] } })),
      api.get('/friends/requests').catch(() => ({ data: { outgoing: [] } })),
    ]).then(([friendsRes, reqRes]) => {
      const friends: any[] = friendsRes.data.friends || [];
      const outgoing: any[] = reqRes.data.outgoing || [];
      if (friends.some((f: any) => f.id === otherUserId)) {
        setFriendStatus('friends');
      } else {
        const outReq = outgoing.find((r: any) => r.user.id === otherUserId);
        if (outReq) {
          setFriendStatus('pending');
          setFriendRequestId(outReq.id);
        } else {
          setFriendStatus('none');
        }
      }
    });
  }, [otherUserId]);

  const sendFriendRequest = async () => {
    if (!otherUserId) return;
    setFriendStatus('loading');
    try {
      const { data } = await api.post('/friends/request', { targetUserId: otherUserId });
      setFriendStatus(data.autoAccepted ? 'friends' : 'pending');
      if (data.friendship?.id) setFriendRequestId(data.friendship.id);
    } catch {
      setFriendStatus('none');
    }
  };

  const cancelFriendRequest = async () => {
    if (!friendRequestId) return;
    setFriendStatus('loading');
    try {
      await api.delete(`/friends/${friendRequestId}`);
      setFriendStatus('none');
      setFriendRequestId(null);
    } catch {
      setFriendStatus('pending');
    }
  };

  useEffect(() => {
    if (!isGroup || !activeChat?.id) return;
    api.get(`/groups/${activeChat.id}/members`).then(({ data }) => {
      setMembers(data.members || []);
    }).catch(() => {});
  }, [isGroup, activeChat?.id]);

  if (!activeChat) return null;

  const inviteLink = activeChat.inviteCode
    ? `${window.location.origin}/invite/${activeChat.inviteCode}`
    : '';

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      // Fallback for non-HTTPS
      const textarea = document.createElement('textarea');
      textarea.value = inviteLink;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openSharePanel = async () => {
    setShowShare(true);
    try {
      const { data } = await api.get('/friends');
      setFriends(data.friends || []);
    } catch {}
  };

  const shareToUser = async (userId: string) => {
    if (!inviteLink) return;
    try {
      // Send invite link as a DM
      const { data } = await api.post('/chats/direct', { targetUserId: userId });
      const chat = data.chat || data;
      const { getSocket } = await import('../../hooks/useSocket');
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('message:send', {
          chatId: chat.id,
          content: `${t('info.inviteToGroup')} "${activeChat.name}"\n${inviteLink}`,
          type: 'TEXT',
        });
      }
      setSharedTo((prev) => new Set(prev).add(userId));
    } catch {}
  };

  const isOwner = isGroup && activeChat.ownerId === user?.id;

  const handleDeleteGroup = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    try {
      await api.delete(`/groups/${activeChat.id}`);
      setActiveChat(null);
      fetchChats();
      onClose();
    } catch {}
  };

  // Recent DM chats for share panel
  const recentDMs = chats
    .filter((c) => c.type === 'DIRECT' && (c as any).otherUser)
    .slice(0, 5)
    .map((c) => (c as any).otherUser);

  // Merge friends + recent, deduplicate
  const shareList = (() => {
    const map = new Map<string, any>();
    // Friends first
    friends.forEach((f: any) => map.set(f.id, { ...f, source: 'friend' }));
    // Then recent DMs
    recentDMs.forEach((u: any) => {
      if (!map.has(u.id)) map.set(u.id, { ...u, source: 'recent' });
    });
    const query = shareSearch.toLowerCase();
    if (!query) return Array.from(map.values());
    return Array.from(map.values()).filter(
      (u) =>
        (u.displayName || '').toLowerCase().includes(query) ||
        u.username.toLowerCase().includes(query)
    );
  })();

  return (
    <div className="flex flex-col h-full bg-white dark:bg-dark-700">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-500">
        <h3 className="font-semibold">
          {isGroup ? t('info.groupInfo') : t('info.contactInfo')}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* DM: show other user's profile */}
        {!isGroup && (activeChat as any).otherUser ? (() => {
          const other = (activeChat as any).otherUser;
          const memberSince = other.createdAt
            ? new Date(other.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
            : '';
          return (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-primary-500 flex items-center justify-center text-white text-2xl font-bold mb-3 overflow-hidden relative">
                  {other.avatarUrl ? (
                    <img src={other.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (other.displayName || other.username)?.[0]?.toUpperCase() || '?'
                  )}
                  {other.isOnline && (
                    <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-dark-700" />
                  )}
                </div>
                <h4 className="font-semibold text-lg flex items-center gap-1.5">
                  {other.displayName || other.username}
                  <PulsarBadge level={other.verificationLevel || 0} size={16} />
                </h4>
                <p className="text-sm text-gray-400">@{other.username}</p>
                {other.bio && (
                  <p className="text-sm text-gray-300 mt-2 px-2">{other.bio}</p>
                )}
              </div>

              {/* Add friend button */}
              {friendStatus === 'none' && (
                <button
                  onClick={sendFriendRequest}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors bg-primary-500/10 hover:bg-primary-500/20 text-primary-500"
                >
                  <UserPlus size={16} /> {t('friends.add')}
                </button>
              )}
              {friendStatus === 'pending' && (
                <button
                  onClick={cancelFriendRequest}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors bg-amber-500/10 hover:bg-red-500/10 text-amber-400 hover:text-red-400"
                >
                  <X size={16} /> {t('chat.cancel')}
                </button>
              )}
              {friendStatus === 'loading' && (
                <div className="flex items-center justify-center py-2.5">
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                </div>
              )}
              {friendStatus === 'friends' && (
                <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-green-500/10 text-green-400">
                  <UserCheck size={16} /> {t('friends.already')}
                </div>
              )}

              <div className="space-y-1">
                <InfoAction icon={<AtSign size={18} />} label={t('auth.username')} value={`@${other.username}`} />
                {other.isOnline ? (
                  <InfoAction icon={<div className="w-2.5 h-2.5 rounded-full bg-green-500 ml-1" />} label={t('chat.status')} value={t('chat.online')} />
                ) : other.lastSeenAt ? (
                  <InfoAction icon={<Calendar size={18} />} label={t('chat.lastSeen')} value={new Date(other.lastSeenAt).toLocaleDateString()} />
                ) : null}
                {other.walletAddress && (
                  <InfoAction icon={<Wallet size={18} />} label="Wallet" value={`${other.walletAddress.slice(0, 4)}...${other.walletAddress.slice(-4)}`} />
                )}
                <InfoAction icon={<Bell size={18} />} label={t('info.notifications')} value={t('info.on')} />
                <InfoAction icon={<Shield size={18} />} label={t('info.encryption')} value={t('info.planned')} />
              </div>
            </div>
          );
        })() : (
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-primary-500 flex items-center justify-center text-white text-2xl font-bold mb-3">
              {(activeChat.name || '?')[0]?.toUpperCase()}
            </div>
            <h4 className="font-semibold text-lg">{activeChat.name || t('chat.directMessage')}</h4>
            {activeChat.description && (
              <p className="text-sm text-gray-400 mt-1">{activeChat.description}</p>
            )}
          </div>
        )}

        {/* Invite link */}
        {isGroup && activeChat.inviteCode && (
          <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-3 space-y-2">
            <p className="text-xs text-gray-400">{t('info.inviteLink')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-primary-400 bg-dark-700/50 rounded-lg px-3 py-2 truncate">
                {inviteLink}
              </code>
              <button
                onClick={copyInviteLink}
                className="p-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors shrink-0"
                title={t('info.copy')}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <button
                onClick={openSharePanel}
                className="p-2 rounded-lg bg-dark-500 hover:bg-dark-400 text-white transition-colors shrink-0"
                title={t('info.share')}
              >
                <Share2 size={16} />
              </button>
            </div>

            {/* Copied toast */}
            {copied && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg animate-fade-in">
                <Check size={14} className="text-green-400" />
                <span className="text-xs text-green-400 font-medium">{t('info.copied')}</span>
              </div>
            )}

            {/* Share panel */}
            {showShare && (
              <div className="bg-dark-700/50 rounded-xl p-3 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400 font-medium">{t('info.shareWith')}</p>
                  <button onClick={() => setShowShare(false)} className="p-0.5 rounded hover:bg-dark-500 text-gray-500">
                    <X size={14} />
                  </button>
                </div>
                {(friends.length > 0 || recentDMs.length > 0) && (
                  <input
                    type="text"
                    value={shareSearch}
                    onChange={(e) => setShareSearch(e.target.value)}
                    placeholder={t('chat.findUser')}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-dark-600 border-none outline-none text-gray-100 placeholder:text-gray-500"
                  />
                )}
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {shareList.map((u: any) => (
                    <div key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-dark-600 transition-colors">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-medium">
                          {(u.displayName || u.username)?.[0]?.toUpperCase() || '?'}
                        </div>
                        {u.isOnline && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-dark-700" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate flex items-center gap-0.5">
                          {u.displayName || u.username}
                          <PulsarBadge level={u.verificationLevel || 0} size={11} />
                        </p>
                      </div>
                      {sharedTo.has(u.id) ? (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <Check size={12} />
                          {t('friends.sent')}
                        </span>
                      ) : (
                        <button
                          onClick={() => shareToUser(u.id)}
                          className="p-1 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors"
                        >
                          <MessageCircle size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {shareList.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-3">{t('friends.noFriends')}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-1">
          {isGroup && (
            <InfoAction icon={<Users size={18} />} label={t('info.members')} value={`${members.length}`} />
          )}
          <InfoAction icon={<Bell size={18} />} label={t('info.notifications')} value={t('info.on')} />
          <InfoAction icon={<Shield size={18} />} label={t('info.encryption')} value={t('info.planned')} />
        </div>

        {/* Members list */}
        {isGroup && members.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              {t('info.members')} ({members.length})
            </h5>
            <div className="space-y-1">
              {members.map((m: any) => (
                <div key={m.user.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-600">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
                      {(m.user.displayName || m.user.username)?.[0]?.toUpperCase() || '?'}
                    </div>
                    {m.user.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-dark-700" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1">
                      {m.user.displayName || m.user.username}
                      <PulsarBadge level={m.user.verificationLevel || 0} size={13} />
                    </p>
                    {m.role !== 'MEMBER' && (
                      <p className="text-xs text-primary-400">{m.role.toLowerCase()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete group */}
        {isOwner && (
          <button
            onClick={handleDeleteGroup}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              confirmDelete
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-red-500/10 hover:bg-red-500/20 text-red-500'
            }`}
          >
            <Trash2 size={16} />
            {confirmDelete ? t('chat.confirmDelete') : t('chat.deleteGroup')}
          </button>
        )}

        <div>
          <h5 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
            {t('info.sharedMedia')}
          </h5>
          <div className="grid grid-cols-3 gap-1">
            <div className="aspect-square bg-gray-100 dark:bg-dark-600 rounded" />
            <div className="aspect-square bg-gray-100 dark:bg-dark-600 rounded" />
            <div className="aspect-square bg-gray-100 dark:bg-dark-600 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoAction({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-600 cursor-pointer">
      <span className="text-gray-400">{icon}</span>
      <span className="flex-1 text-sm">{label}</span>
      <span className="text-sm text-gray-400">{value}</span>
    </div>
  );
}
