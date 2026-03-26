import React, { useState, useEffect, useRef } from 'react';
import type { Message } from '@pulsar/shared';
import { format } from 'date-fns';
import { Users, Trash2, Copy, Forward, CheckSquare, X, ExternalLink, Check, CheckCheck, Gift, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import { getSocket } from '../../hooks/useSocket';
import { api } from '../../services/api';
import { useChatStore } from '../../store/chatStore';
import { PulsarBadge } from '../ui/PulsarBadge';
import { ProfileBadgeIcon } from '../ui/ProfileBadgeIcon';
import { useMessageStore } from '../../store/messageStore';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
}

export function MessageBubble({ message, isOwn, showAvatar }: MessageBubbleProps) {
  const { t } = useI18n();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showForward, setShowForward] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [selected, setSelected] = useState(false);
  const [deleteSubmenu, setDeleteSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const currentUser = useAuthStore((s) => s.user);
  const isStaff = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';

  // Close context menu on click outside — must be before early returns
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setDeleteSubmenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  if (message.isDeleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
        <div className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-dark-600 text-gray-400 italic text-sm">
          {t('chat.messageDeleted')}
        </div>
      </div>
    );
  }

  if (message.type === 'SYSTEM') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-dark-600 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const time = format(new Date(message.createdAt), 'HH:mm');

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setContextMenu({ x, y });
  };

  const handleDeleteForAll = () => {
    setContextMenu(null);
    setDeleteSubmenu(false);
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('message:delete', { messageId: message.id });
    }
  };

  const handleDeleteForMe = () => {
    setContextMenu(null);
    setDeleteSubmenu(false);
    useMessageStore.getState().hideMessage(message.chatId, message.id);
  };

  const handleCopy = () => {
    setContextMenu(null);
    if (message.content) {
      navigator.clipboard.writeText(message.content).catch(() => {
        // Fallback for HTTP
        const ta = document.createElement('textarea');
        ta.value = message.content!;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      });
    }
  };

  const handleSelect = () => {
    setContextMenu(null);
    setSelected(!selected);
  };

  const handleForward = () => {
    setContextMenu(null);
    setShowForward(true);
  };

  return (
    <>
      <div
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mt-2' : 'mt-0.5'} ${selected ? 'bg-primary-500/10 rounded-lg' : ''}`}
        onContextMenu={handleContextMenu}
      >
        {/* Avatar for other users */}
        {!isOwn && showAvatar && (
          <div className="w-8 h-8 rounded-full bg-primary-400 flex items-center justify-center text-white text-xs font-medium mr-2 mt-auto shrink-0">
            {message.sender?.username?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        {!isOwn && !showAvatar && <div className="w-8 mr-2 shrink-0" />}

        <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
          {/* Sender name */}
          {!isOwn && showAvatar && (
            <p
              className="text-xs font-medium text-primary-500 mb-0.5 ml-1 flex items-center gap-1 cursor-pointer hover:underline"
              onContextMenu={(e) => {
                if (isStaff && message.sender) {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowReward(true);
                }
              }}
            >
              {message.sender?.displayName || message.sender?.username}
              <PulsarBadge level={(message.sender as any)?.verificationLevel || 0} size={12} />
              <ProfileBadgeIcon badge={(message.sender as any)?.profileBadge} size={12} />
            </p>
          )}

          {/* Bubble */}
          <div
            className={`
              px-3 py-2 rounded-2xl text-sm leading-relaxed inline-block
              ${isOwn
                ? 'bg-primary-500 text-white rounded-br-md'
                : 'bg-gray-100 dark:bg-dark-600 text-gray-900 dark:text-gray-100 rounded-bl-md'}
            `}
          >
            {/* File attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mb-1">
                {message.attachments.map((file) => (
                  <div
                    key={file.id}
                    className={`text-xs ${isOwn ? 'text-blue-100' : 'text-blue-500'} underline cursor-pointer`}
                  >
                    📎 {file.fileName}
                  </div>
                ))}
              </div>
            )}

            {message.content && <MessageContent content={message.content} isOwn={isOwn} metadata={message.metadata} />}

            {/* Time, edited & status indicator */}
            <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              {message.isEdited && (
                <span className={`text-[10px] ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                  {t('chat.edited')}
                </span>
              )}
              <span className={`text-[10px] ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                {time}
              </span>
              {isOwn && <MessageStatusIcon status={message.status} />}
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl py-1.5 min-w-[180px] animate-fade-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {message.content && (
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-dark-600 transition-colors"
            >
              <Copy size={16} className="text-gray-400" />
              {t('chat.copy')}
            </button>
          )}
          <button
            onClick={handleForward}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-dark-600 transition-colors"
          >
            <Forward size={16} className="text-gray-400" />
            {t('chat.forward')}
          </button>
          <button
            onClick={handleSelect}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-dark-600 transition-colors"
          >
            <CheckSquare size={16} className="text-gray-400" />
            {t('chat.select')}
          </button>
          {isStaff && !isOwn && message.sender && (
            <>
              <div className="h-px bg-dark-500 mx-2 my-1" />
              <button
                onClick={() => { setContextMenu(null); setShowReward(true); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-amber-400 hover:bg-dark-600 transition-colors"
              >
                <Gift size={16} />
                {t('admin.giveReward')}
              </button>
            </>
          )}
          <div className="h-px bg-dark-500 mx-2 my-1" />
          {!deleteSubmenu ? (
            <button
              onClick={() => setDeleteSubmenu(true)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-dark-600 transition-colors"
            >
              <Trash2 size={16} />
              {t('common.delete')}
            </button>
          ) : (
            <div className="animate-fade-in">
              <button
                onClick={handleDeleteForMe}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-dark-600 transition-colors"
              >
                <Trash2 size={16} />
                {t('chat.deleteForMe')}
              </button>
              {isOwn && (
                <button
                  onClick={handleDeleteForAll}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-dark-600 transition-colors"
                >
                  <Trash2 size={16} className="text-red-500" />
                  {t('chat.deleteForAll')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Forward Modal */}
      {showForward && (
        <ForwardModal
          message={message}
          onClose={() => setShowForward(false)}
        />
      )}

      {/* Reward Modal */}
      {showReward && message.sender && (
        <RewardModal
          userId={(message.sender as any).id || message.senderId}
          username={message.sender.displayName || message.sender.username || ''}
          onClose={() => setShowReward(false)}
        />
      )}
    </>
  );
}

// Reward modal for admins
function RewardModal({ userId, username, onClose }: { userId: string; username: string; onClose: () => void }) {
  const { t } = useI18n();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const presets = [100, 500, 1000, 5000, 10000];

  const handleReward = async () => {
    const numAmount = parseInt(amount);
    if (!numAmount || numAmount <= 0) return;

    setLoading(true);
    try {
      await api.post('/admin/reward', {
        userId,
        amount: numAmount,
        description: description || `Reward for @${username}`,
      });
      setSuccess(true);
      toast.success(`+${numAmount.toLocaleString()} PLS → @${username}`);
      setTimeout(onClose, 1500);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-dark-700 rounded-2xl w-full max-w-sm mx-4 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500">
          <h3 className="font-semibold flex items-center gap-2">
            <Gift size={18} className="text-amber-400" />
            {t('admin.giveReward')}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
                <Gift size={28} className="text-amber-400" />
              </div>
              <p className="font-bold text-lg text-amber-400">+{parseInt(amount).toLocaleString()} PLS</p>
              <p className="text-sm text-gray-400 mt-1">→ @{username}</p>
            </div>
          ) : (
            <>
              <div className="bg-dark-600 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
                  {username[0]?.toUpperCase() || '?'}
                </div>
                <span className="text-sm font-medium flex items-center gap-1">@{username}</span>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">{t('admin.rewardAmount')}</label>
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 bg-dark-600 rounded-lg text-lg font-mono border-none outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {presets.map((p) => (
                  <button
                    key={p}
                    onClick={() => setAmount(p.toString())}
                    className="px-3 py-1.5 text-xs font-medium bg-dark-600 hover:bg-dark-500 rounded-lg transition-colors text-amber-400"
                  >
                    {p.toLocaleString()} PLS
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">{t('admin.rewardReason')}</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('admin.rewardReasonPlaceholder')}
                  className="w-full px-4 py-2.5 bg-dark-600 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                onClick={handleReward}
                disabled={!amount || parseInt(amount) <= 0 || loading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-black rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {t('admin.sendReward')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Forward modal with friends grid
function ForwardModal({ message, onClose }: { message: Message; onClose: () => void }) {
  const { t } = useI18n();
  const { chats } = useChatStore();
  const [friends, setFriends] = useState<any[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get('/friends').then(({ data }) => {
      setFriends(data.friends || []);
    }).catch(() => {});
  }, []);

  // Build list: friends + recent DM contacts (deduplicated)
  const recentDMs = chats
    .filter((c) => c.type === 'DIRECT' && (c as any).otherUser)
    .map((c) => (c as any).otherUser);

  const allContacts = new Map<string, any>();
  for (const f of friends) {
    allContacts.set(f.id, f);
  }
  for (const u of recentDMs) {
    if (!allContacts.has(u.id)) {
      allContacts.set(u.id, u);
    }
  }
  const contactList = Array.from(allContacts.values());

  const forwardTo = async (userId: string) => {
    if (sent.has(userId)) return;
    try {
      // Get or create DM
      const { data } = await api.post('/chats/direct', { targetUserId: userId });
      const chatId = data.chat.id;
      const socket = getSocket();
      if (socket?.connected) {
        const senderName = message.sender?.displayName || message.sender?.username || '';
        const content = `⤴ ${t('chat.forwarded')} ${senderName ? `(${senderName})` : ''}\n${message.content || ''}`;
        socket.emit('message:send', { chatId, content, type: 'TEXT' });
      }
      setSent((prev) => new Set(prev).add(userId));
    } catch {
      // silently fail
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-dark-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500">
          <h3 className="text-white font-semibold">{t('chat.forwardTo')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Message preview */}
        <div className="px-5 py-3 border-b border-dark-500">
          <div className="bg-dark-600 rounded-lg px-3 py-2 text-sm text-gray-300 line-clamp-2">
            {message.content || t('chat.file')}
          </div>
        </div>

        {/* Friends grid */}
        <div className="p-4 max-h-[400px] overflow-y-auto">
          {contactList.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">{t('friends.noFriends')}</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {contactList.map((user) => {
                const isSent = sent.has(user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => forwardTo(user.id)}
                    disabled={isSent}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-colors ${
                      isSent
                        ? 'bg-green-500/10 border border-green-500/30'
                        : 'bg-dark-600 hover:bg-dark-500 border border-transparent'
                    }`}
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
                        ) : (
                          (user.displayName || user.username)?.[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      {user.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-dark-600" />
                      )}
                    </div>
                    <span className="text-xs text-gray-300 truncate w-full text-center flex items-center justify-center gap-0.5">
                      {user.displayName || user.username}
                      <PulsarBadge level={user.verificationLevel || 0} size={10} />
                    </span>
                    {isSent && (
                      <span className="text-[10px] text-green-400 font-medium">{t('friends.sent')}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Message status checkmarks
function MessageStatusIcon({ status }: { status?: string }) {
  if (status === 'read') {
    return <CheckCheck size={14} className="text-green-400" />;
  }
  if (status === 'delivered') {
    return <CheckCheck size={14} className="text-blue-200" />;
  }
  // sent or undefined
  return <Check size={14} className="text-blue-200" />;
}

const INVITE_REGEX = /((https?:\/\/[^\s]+)?\/invite\/([a-zA-Z0-9_-]+))/;
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;

function MessageContent({ content, isOwn, metadata }: { content: string; isOwn: boolean; metadata?: any }) {
  const { t } = useI18n();
  const linkPreview = metadata?.linkPreview as { title?: string; description?: string; image?: string; siteName?: string; url?: string } | undefined;

  // Check for invite link first
  const inviteMatch = content.match(INVITE_REGEX);
  if (inviteMatch) {
    const inviteUrl = inviteMatch[1];
    const inviteCode = inviteMatch[3];
    const textBefore = content.slice(0, content.indexOf(inviteUrl)).trim();
    const textAfter = content.slice(content.indexOf(inviteUrl) + inviteUrl.length).trim();
    const fullUrl = inviteUrl.startsWith('http') ? inviteUrl : `${window.location.origin}/invite/${inviteCode}`;

    return (
      <div className="space-y-2">
        {textBefore && <p className="whitespace-pre-wrap break-words">{renderTextWithLinks(textBefore, isOwn)}</p>}
        <a
          href={fullUrl}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors no-underline ${
            isOwn
              ? 'bg-white/15 hover:bg-white/25 text-white'
              : 'bg-primary-500/10 hover:bg-primary-500/20 text-primary-400'
          }`}
        >
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            isOwn ? 'bg-white/20' : 'bg-primary-500/20'
          }`}>
            <Users size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">{t('invite.joinGroup')}</p>
            <p className={`text-[10px] truncate ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
              {inviteCode}
            </p>
          </div>
          <div className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 ${
            isOwn ? 'bg-white/20 text-white' : 'bg-primary-500 text-white'
          }`}>
            {t('invite.join')}
          </div>
        </a>
        {textAfter && <p className="whitespace-pre-wrap break-words">{renderTextWithLinks(textAfter, isOwn)}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap break-words">{renderTextWithLinks(content, isOwn)}</p>
      {linkPreview && <LinkPreviewCard preview={linkPreview} isOwn={isOwn} />}
    </div>
  );
}

// Render text with clickable links
function renderTextWithLinks(text: string, isOwn: boolean): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  const regex = new RegExp(URL_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[1];
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline break-all ${isOwn ? 'text-blue-200 hover:text-white' : 'text-primary-500 hover:text-primary-400'}`}
      >
        {url}
      </a>
    );
    lastIndex = match.index + url.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

// Link preview card
function LinkPreviewCard({ preview, isOwn }: { preview: { title?: string; description?: string; image?: string; siteName?: string; url?: string }; isOwn: boolean }) {
  const domain = preview.url ? new URL(preview.url).hostname.replace('www.', '') : '';

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-xl overflow-hidden no-underline transition-colors ${
        isOwn
          ? 'bg-white/10 hover:bg-white/20'
          : 'bg-dark-500/50 hover:bg-dark-500/80'
      }`}
    >
      {preview.image && (
        <div className="w-full h-32 overflow-hidden">
          <img
            src={preview.image}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <div className="px-3 py-2">
        {preview.siteName && (
          <p className={`text-[10px] font-medium mb-0.5 ${isOwn ? 'text-blue-200' : 'text-primary-400'}`}>
            {preview.siteName}
          </p>
        )}
        {!preview.siteName && domain && (
          <p className={`text-[10px] font-medium mb-0.5 flex items-center gap-1 ${isOwn ? 'text-blue-200' : 'text-primary-400'}`}>
            <ExternalLink size={10} />
            {domain}
          </p>
        )}
        {preview.title && (
          <p className={`text-xs font-semibold line-clamp-2 ${isOwn ? 'text-white' : 'text-gray-200'}`}>
            {preview.title}
          </p>
        )}
        {preview.description && (
          <p className={`text-[11px] mt-0.5 line-clamp-2 ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}
