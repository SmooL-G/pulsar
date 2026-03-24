import { useState, useEffect, useRef } from 'react';
import type { Message } from '@pulsar/shared';
import { format } from 'date-fns';
import { Users, Trash2, Copy, Forward, CheckSquare, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { getSocket } from '../../hooks/useSocket';
import { api } from '../../services/api';
import { useChatStore } from '../../store/chatStore';
import { useMessageStore } from '../../store/messageStore';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
}

export function MessageBubble({ message, isOwn, showAvatar }: MessageBubbleProps) {
  const { t } = useI18n();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showForward, setShowForward] = useState(false);
  const [selected, setSelected] = useState(false);
  const [deleteSubmenu, setDeleteSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
            <p className="text-xs font-medium text-primary-500 mb-0.5 ml-1">
              {message.sender?.displayName || message.sender?.username}
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

            {message.content && <MessageContent content={message.content} isOwn={isOwn} />}

            {/* Time & edited indicator */}
            <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              {message.isEdited && (
                <span className={`text-[10px] ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                  {t('chat.edited')}
                </span>
              )}
              <span className={`text-[10px] ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                {time}
              </span>
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
    </>
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
                    <span className="text-xs text-gray-300 truncate w-full text-center">
                      {user.displayName || user.username}
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

const INVITE_REGEX = /((https?:\/\/[^\s]+)?\/invite\/([a-zA-Z0-9_-]+))/;

function MessageContent({ content, isOwn }: { content: string; isOwn: boolean }) {
  const { t } = useI18n();
  const match = content.match(INVITE_REGEX);

  if (!match) {
    return <p className="whitespace-pre-wrap break-words">{content}</p>;
  }

  const inviteUrl = match[1];
  const inviteCode = match[3];
  const textBefore = content.slice(0, content.indexOf(inviteUrl)).trim();
  const textAfter = content.slice(content.indexOf(inviteUrl) + inviteUrl.length).trim();

  // Build full URL
  const fullUrl = inviteUrl.startsWith('http') ? inviteUrl : `${window.location.origin}/invite/${inviteCode}`;

  return (
    <div className="space-y-2">
      {textBefore && <p className="whitespace-pre-wrap break-words">{textBefore}</p>}
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
      {textAfter && <p className="whitespace-pre-wrap break-words">{textAfter}</p>}
    </div>
  );
}
