import React, { useEffect, useState } from 'react';
import { X, Users, Bell, BellOff, Shield, Copy, Check, Trash2, Share2, MessageCircle, Calendar, Wallet, AtSign, UserPlus, UserCheck, Loader2, ExternalLink, ChevronDown, UserMinus, Image, FileText } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { api } from '../../services/api';
import { PulsarBadge } from '../ui/PulsarBadge';
import { ProfileBadgeTag } from '../ui/ProfileBadgeIcon';
import { NftAvatarBorder } from '../ui/NftAvatarBorder';
import { GenerativeAvatar } from '../ui/GenerativeAvatar';

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
  const [muted, setMuted] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null);

  const isGroup = activeChat?.type === 'GROUP';

  // Init muted state from activeChat
  useEffect(() => {
    setMuted(!!(activeChat as any)?.muted);
  }, [activeChat?.id]);

  const toggleMute = async () => {
    if (!activeChat) return;
    const newMuted = !muted;
    setMuted(newMuted);
    try {
      await api.patch(`/chats/${activeChat.id}/mute`, { muted: newMuted });
    } catch {
      setMuted(!newMuted);
    }
  };
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

  const ROLE_HIERARCHY: Record<string, number> = { MEMBER: 0, AUTHOR: 1, MODERATOR: 2, ADMIN: 3, OWNER: 4 };
  const ROLE_LABELS: Record<string, string> = { OWNER: 'Admin', ADMIN: 'Admin', MODERATOR: t('group.moderator'), AUTHOR: t('group.author'), MEMBER: t('group.user') };
  const myMembership = members.find((m: any) => m.user.id === user?.id);
  const myLevel = ROLE_HIERARCHY[myMembership?.role] ?? 0;

  const changeRole = async (targetUserId: string, role: string) => {
    if (!activeChat) return;
    try {
      await api.patch(`/groups/${activeChat.id}/members/${targetUserId}/role`, { role });
      setMembers((prev) => prev.map((m: any) =>
        m.user.id === targetUserId ? { ...m, role } : m
      ));
      setSelectedMember(null);
    } catch {}
  };

  const kickMember = async (targetUserId: string) => {
    if (!activeChat) return;
    try {
      await api.delete(`/groups/${activeChat.id}/members/${targetUserId}`);
      setMembers((prev) => prev.filter((m: any) => m.user.id !== targetUserId));
      setSelectedMember(null);
    } catch {}
  };

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
                <div className="relative mb-3">
                  <NftAvatarBorder isNft={!!other.nftAvatarMint} size={80}>
                  <button
                    onClick={() => other.avatarUrl && setPreviewAvatar(other.avatarUrl)}
                    className="w-20 h-20 rounded-full bg-primary-500 flex items-center justify-center text-white text-2xl font-bold overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary-400 transition-all"
                  >
                    {other.avatarUrl ? (
                      <img src={other.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <GenerativeAvatar seed={other.id} size={80} />
                    )}
                  </button>
                  </NftAvatarBorder>
                  {other.isOnline && (
                    <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-white dark:border-dark-700" />
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
                {other.profileBadge && (
                  <div className="mt-2">
                    <ProfileBadgeTag badge={other.profileBadge} />
                  </div>
                )}
                {/* Social links */}
                {other.socialLinks && Object.keys(other.socialLinks).some((k: string) => (other.socialLinks as any)[k]) && (
                  <div className="flex items-center gap-2 mt-3">
                    {([
                      { key: 'telegram', icon: '✈️', prefix: 'https://t.me/' },
                      { key: 'twitter', icon: '𝕏', prefix: 'https://x.com/' },
                      { key: 'youtube', icon: '▶️', prefix: '' },
                      { key: 'instagram', icon: '📷', prefix: 'https://instagram.com/' },
                      { key: 'github', icon: '🐙', prefix: 'https://github.com/' },
                      { key: 'website', icon: '🌐', prefix: '' },
                    ] as const).map(({ key, icon, prefix }) => {
                      const val = (other.socialLinks as any)?.[key];
                      if (!val) return null;
                      const href = val.startsWith('http') ? val : (prefix ? `${prefix}${val.replace('@', '')}` : val);
                      return (
                        <a
                          key={key}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-dark-600 hover:bg-gray-200 dark:hover:bg-dark-500 transition-colors text-sm"
                          title={key}
                        >
                          {icon}
                        </a>
                      );
                    })}
                  </div>
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
                {other.isOnline ? (
                  <InfoAction icon={<div className="w-2.5 h-2.5 rounded-full bg-green-500 ml-1" />} label={t('chat.status')} value={t('chat.online')} />
                ) : other.lastSeenAt ? (
                  <InfoAction icon={<Calendar size={18} />} label={t('chat.lastSeen')} value={new Date(other.lastSeenAt).toLocaleDateString()} />
                ) : null}
                {other.walletAddress && !other.isBot && (
                  <InfoAction icon={<Wallet size={18} />} label="Wallet" value={`${other.walletAddress.slice(0, 4)}...${other.walletAddress.slice(-4)}`} />
                )}
                <div onClick={toggleMute} className="cursor-pointer">
                  <InfoAction
                    icon={muted ? <BellOff size={18} /> : <Bell size={18} />}
                    label={t('info.notifications')}
                    value={muted ? t('info.off') : t('info.on')}
                  />
                </div>
                {/* Шифрование актуально только для DM с людьми; боты не E2E. */}
                {!other.isBot && (
                  <InfoAction icon={<Shield size={18} />} label={t('info.encryption')} value={t('info.planned')} />
                )}
              </div>
            </div>
          );
        })() : (
          <div className="flex flex-col items-center text-center">
            <button
              onClick={() => (activeChat as any).avatarUrl && setPreviewAvatar((activeChat as any).avatarUrl)}
              className="w-20 h-20 rounded-full bg-primary-500 flex items-center justify-center text-white text-2xl font-bold mb-3 overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary-400 transition-all"
            >
              {(activeChat as any).avatarUrl ? (
                <img src={(activeChat as any).avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <GenerativeAvatar seed={activeChat.id} size={80} />
              )}
            </button>
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
                        <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-medium overflow-hidden">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <GenerativeAvatar seed={u.id} size={32} />
                          )}
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

        {isGroup && (
          <div className="space-y-1">
            <InfoAction icon={<Users size={18} />} label={t('info.members')} value={`${members.length}`} />
            <div onClick={toggleMute} className="cursor-pointer">
              <InfoAction
                icon={muted ? <BellOff size={18} /> : <Bell size={18} />}
                label={t('info.notifications')}
                value={muted ? t('info.off') : t('info.on')}
              />
            </div>
            <InfoAction icon={<Shield size={18} />} label={t('info.encryption')} value={t('info.planned')} />
          </div>
        )}

        {/* Members list */}
        {isGroup && members.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              {t('info.members')} ({members.length})
            </h5>
            <div className="space-y-1">
              {members.map((m: any) => {
                const targetLevel = ROLE_HIERARCHY[m.role] ?? 0;
                const canManage = myLevel >= 3 && targetLevel < myLevel && m.user.id !== user?.id;
                const canKick = myLevel >= 2 && targetLevel < myLevel && m.user.id !== user?.id;
                const isSelected = selectedMember === m.user.id;

                return (
                  <div key={m.user.id} className="relative">
                    <div
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-600 ${(canManage || canKick) ? 'cursor-pointer' : ''}`}
                      onClick={() => (canManage || canKick) && setSelectedMember(isSelected ? null : m.user.id)}
                    >
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium overflow-hidden">
                          {m.user.avatarUrl ? (
                            <img src={m.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <GenerativeAvatar seed={m.user.id} size={36} />
                          )}
                        </div>
                        {m.user.isOnline && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-dark-700" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate flex items-center gap-1">
                          {m.user.displayName || m.user.username}
                          <PulsarBadge level={m.user.verificationLevel || 0} size={13} />
                        </p>
                        {m.role !== 'MEMBER' && (
                          <p className="text-xs text-primary-400">
                            {ROLE_LABELS[m.role] || m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                          </p>
                        )}
                      </div>
                      {(canManage || canKick) && (
                        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isSelected ? 'rotate-180' : ''}`} />
                      )}
                    </div>

                    {/* Role management dropdown */}
                    {isSelected && (
                      <div className="ml-12 mr-3 mb-1 p-2 bg-gray-50 dark:bg-dark-600 rounded-xl space-y-1 animate-fade-in">
                        {canManage && (
                          <>
                            <p className="text-[10px] text-gray-400 font-medium px-2 mb-1">{t('group.changeRole')}</p>
                            {(['ADMIN', 'MODERATOR', 'AUTHOR', 'MEMBER'] as const)
                              .filter((r) => ROLE_HIERARCHY[r] < myLevel)
                              .map((role) => (
                                <button
                                  key={role}
                                  onClick={(e) => { e.stopPropagation(); changeRole(m.user.id, role); }}
                                  className={`w-full text-left px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-between ${
                                    m.role === role
                                      ? 'bg-primary-500/10 text-primary-400 font-medium'
                                      : 'hover:bg-gray-100 dark:hover:bg-dark-500 text-gray-600 dark:text-gray-300'
                                  }`}
                                >
                                  <span>{ROLE_LABELS[role] || role.charAt(0) + role.slice(1).toLowerCase()}</span>
                                  {m.role === role && <Check size={12} />}
                                </button>
                              ))}
                          </>
                        )}
                        {canKick && (
                          <button
                            onClick={(e) => { e.stopPropagation(); kickMember(m.user.id); }}
                            className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1.5 mt-1"
                          >
                            <UserMinus size={12} /> {t('group.kick')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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

        <SharedMediaPanel chatId={activeChat.id} />
      </div>

      {/* Avatar preview modal */}
      {previewAvatar && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] cursor-pointer"
          onClick={() => setPreviewAvatar(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] animate-fade-in">
            <img
              src={previewAvatar}
              alt=""
              className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain"
            />
            <button
              onClick={(e) => { e.stopPropagation(); setPreviewAvatar(null); }}
              className="absolute -top-3 -right-3 w-8 h-8 bg-dark-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
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

// Shared Media & Documents panel
function SharedMediaPanel({ chatId }: { chatId: string }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'media' | 'documents'>('media');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/messages/shared/${chatId}?type=${tab === 'media' ? 'media' : 'documents'}`)
      .then((res) => setItems(res.data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [chatId, tab]);

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-3 bg-gray-100 dark:bg-dark-600 rounded-lg p-1">
        <button
          onClick={() => setTab('media')}
          className={`flex-1 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
            tab === 'media' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Image size={12} />
          {t('info.media')}
        </button>
        <button
          onClick={() => setTab('documents')}
          className={`flex-1 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
            tab === 'documents' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <FileText size={12} />
          {t('info.documents')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={18} className="animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-4">{t('info.noMedia')}</p>
      ) : tab === 'media' ? (
        <div className="grid grid-cols-3 gap-1">
          {items.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="aspect-square bg-gray-100 dark:bg-dark-600 rounded overflow-hidden hover:opacity-80 transition-opacity"
            >
              {item.mimeType?.startsWith('image/') ? (
                <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <Image size={20} />
                </div>
              )}
            </a>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => {
            const sizeStr = item.fileSize < 1024 * 1024
              ? `${(item.fileSize / 1024).toFixed(0)} KB`
              : `${(item.fileSize / 1024 / 1024).toFixed(1)} MB`;
            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors no-underline"
              >
                <FileText size={16} className="text-blue-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-200 truncate">{item.fileName}</p>
                  <p className="text-[10px] text-gray-500">{sizeStr} · {item.sender}</p>
                </div>
                <ExternalLink size={12} className="text-gray-500 shrink-0" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
