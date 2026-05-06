import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Paperclip, Smile, Lock, LockOpen, MessageCircle, ShieldCheck, ShieldOff, Gem, X, FileIcon, ImageIcon, ListChecks, BarChart3, Mic, Trash2, Clock } from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';
import { BotChatBar } from './BotChatBar';
import { ChecklistComposer } from './ChecklistComposer';
import { PollComposer } from './PollComposer';
import { useVoiceRecorder, extensionForMime } from '../../hooks/useVoiceRecorder';
import { MentionPicker } from './MentionPicker';
import { ScheduleModal } from './ScheduleModal';
import { useWallet } from '@solana/wallet-adapter-react';
import { getSocket } from '../../hooks/useSocket';
import { useMessageStore } from '../../store/messageStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';
import toast from 'react-hot-toast';
import { signMessage } from '../../crypto/messageSigner';
import { encryptMessage } from '../../crypto/e2eEncrypt';
import { sendDmMessage } from '../../p2p/MessageTransport';
import { maxFileSizeFor } from '@pulsar/shared';

interface MessageInputProps {
  chatId: string;
  chatType?: 'DIRECT' | 'GROUP' | 'CHANNEL' | 'SAVED';
  recipientUserId?: string;
  recipientIsBot?: boolean;
}

// Настройка E2E шифрования — localStorage.
// Default ON: privacy-by-default. Earlier versions defaulted to OFF
// because the API was unstable; that's no longer true. Returning true
// when the key is unset means new users + anyone who never touched
// the toggle automatically get E2E. Users who explicitly disabled
// stay disabled (we honour the literal 'false' string).
function getE2EEnabled(): boolean {
  const v = localStorage.getItem('pulsar_e2e_enabled');
  if (v === null) return true;
  return v === 'true';
}
function setE2EEnabled(v: boolean) {
  localStorage.setItem('pulsar_e2e_enabled', v ? 'true' : 'false');
}
function getSignEnabled(): boolean {
  return localStorage.getItem('pulsar_sign_enabled') === 'true';
}
function setSignEnabled(v: boolean) {
  localStorage.setItem('pulsar_sign_enabled', v ? 'true' : 'false');
}

export function MessageInput({ chatId, chatType, recipientUserId, recipientIsBot }: MessageInputProps) {
  const { t, locale } = useI18n();
  const [text, setText] = useState('');
  const [e2eOn, setE2eOn] = useState(getE2EEnabled);
  const [signOn, setSignOn] = useState(getSignEnabled);
  const [commentsOn, setCommentsOn] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSuperChat, setShowSuperChat] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; preview?: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const voice = useVoiceRecorder();
  // Mention autocomplete state — populated when the user is mid-typing an `@`.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const [superChatAmount, setSuperChatAmount] = useState(0);
  const [superChatSending, setSuperChatSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { signMessage: walletSignMessage, publicKey } = useWallet();

  const toggleE2E = useCallback(() => {
    setE2eOn((prev) => {
      const next = !prev;
      setE2EEnabled(next);
      return next;
    });
  }, []);

  const toggleSign = useCallback(() => {
    setSignOn((prev) => {
      const next = !prev;
      setSignEnabled(next);
      return next;
    });
  }, []);

  // Close attach menu on outside click.
  useEffect(() => {
    if (!showAttachMenu) return;
    const handler = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAttachMenu]);

  // Helper for any path that wants to push a File into the pending list.
  const addFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    // Per-tier upload cap. Mirrors server-side getFileSizeLimit().
    const u = useAuthStore.getState().user as any;
    const cap = maxFileSizeFor({
      verificationLevel: u?.verificationLevel ?? 0,
      isPremium: !!u?.isPremium,
      role: u?.role,
    });
    const tooBig = files.filter((f) => f.size > cap);
    const ok = files.filter((f) => f.size <= cap);
    if (tooBig.length > 0) {
      const capMB = Math.floor(cap / (1024 * 1024));
      const upgradeHint =
        cap < 100 * 1024 * 1024
          ? (locale === 'ru'
              ? ` Подними Verification Level (Settings → Кошелёк) — на L3 лимит 100MB.`
              : ' Bump Verification Level (Settings → Wallet) — L3 raises the cap to 100MB.')
          : '';
      toast.error(
        (locale === 'ru'
          ? `Файл слишком большой (макс ${capMB}MB).`
          : `File too large (max ${capMB}MB).`) + upgradeHint,
        { duration: 6000 },
      );
    }
    if (ok.length === 0) return;
    setPendingFiles((prev) => [
      ...prev,
      ...ok.map((file) => ({
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      })),
    ]);
  }, [locale]);

  // Drag & drop anywhere on the page → add files to pending. ChatArea owns
  // the visual hint overlay; here we just listen for the custom event it fires.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ files: File[]; chatId: string }>).detail;
      if (detail?.chatId !== chatId) return;
      addFiles(detail.files);
    };
    window.addEventListener('pulsar:files-drop', handler);
    return () => window.removeEventListener('pulsar:files-drop', handler);
  }, [chatId, addFiles]);

  // Paste handler — Ctrl+V with an image in the clipboard attaches it.
  // Skipped while typing in another input (e.g. modal forms) by checking
  // the event target.
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Only act when focus is on our textarea or nothing in particular.
      if (target && target !== textareaRef.current && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const it of Array.from(items)) {
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        addFiles(files);
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [addFiles]);

  // Replace the in-progress @word at the caret with the picked username.
  const insertMention = (username: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const before = text.slice(0, caret);
    const wordStart = Math.max(before.lastIndexOf(' '), before.lastIndexOf('\n')) + 1;
    const inserted = `@${username} `;
    const newText = text.slice(0, wordStart) + inserted + text.slice(caret);
    setText(newText);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = wordStart + inserted.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleSchedule = async (sendAt: Date) => {
    const content = text.trim();
    if (!content && pendingFiles.length === 0) {
      toast.error(t('schedule.emptyMessage'));
      return;
    }

    setUploading(true);
    try {
      // Upload pending files now (so the worker doesn't have to deal with files later).
      let attachments: { fileName: string; fileSize: number; mimeType: string; url: string }[] = [];
      for (const pf of pendingFiles) {
        const formData = new FormData();
        formData.append('file', pf.file);
        const { data } = await api.post('/upload/file', formData);
        attachments.push({
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          url: data.url,
        });
      }
      const msgType = attachments.length > 0
        ? (attachments[0].mimeType.startsWith('image/') ? 'IMAGE' : 'FILE')
        : 'TEXT';

      await api.post('/messages/scheduled', {
        chatId,
        content: content || null,
        type: msgType,
        sendAt: sendAt.toISOString(),
        ...(attachments.length > 0 && { attachments }),
      });

      setText('');
      setPendingFiles([]);
      const ta = textareaRef.current;
      if (ta) { ta.style.height = 'auto'; }

      const when = sendAt.toLocaleString();
      toast.success(`${t('schedule.scheduledFor')} ${when}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('schedule.failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleStartVoice = async () => {
    const ok = await voice.start();
    if (!ok) {
      if (voice.permissionError === 'DENIED') {
        toast.error(t('voice.permissionDenied'));
      } else if (voice.permissionError === 'UNSUPPORTED') {
        toast.error(t('voice.unsupported'));
      } else {
        toast.error(t('voice.recordFailed'));
      }
    }
  };

  const handleSendVoice = async () => {
    const blob = await voice.stop();
    if (!blob || blob.size < 800) {
      // Less than ~100ms of silence; almost certainly an accidental tap.
      return;
    }
    const socket = getSocket();
    if (!socket?.connected) return;

    setUploading(true);
    try {
      const ext = extensionForMime(blob.type);
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/upload/file', formData);

      socket.emit('message:send', {
        chatId,
        content: null,
        type: 'VOICE',
        attachments: [{
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          url: data.url,
        }],
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('voice.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content && pendingFiles.length === 0) return;

    const socket = getSocket();
    if (socket?.connected) {
      // Upload pending files first
      let attachments: { fileName: string; fileSize: number; mimeType: string; url: string }[] = [];
      if (pendingFiles.length > 0) {
        setUploading(true);
        try {
          for (const pf of pendingFiles) {
            const formData = new FormData();
            formData.append('file', pf.file);
            const { data } = await api.post('/upload/file', formData);
            attachments.push({
              fileName: data.fileName,
              fileSize: data.fileSize,
              mimeType: data.mimeType,
              url: data.url,
            });
          }
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'Upload failed');
          setUploading(false);
          return;
        }
        setUploading(false);
      }

      // Подпись сообщения кошельком Solana (только если включена и собеседник не бот)
      const signed = signOn && !recipientIsBot ? await signMessage(
        chatId,
        content || 'file',
        walletSignMessage ?? undefined,
        publicKey?.toBase58(),
      ) : null;

      // E2E шифрование только для DM и если включено
      let encryptedContent: string | undefined;
      if (e2eOn && chatType === 'DIRECT' && !recipientIsBot && recipientUserId && content) {
        const encrypted = await encryptMessage(content, recipientUserId);
        if (encrypted) encryptedContent = encrypted;
      }

      const msgType = attachments.length > 0 ? (attachments[0].mimeType.startsWith('image/') ? 'IMAGE' : 'FILE') : 'TEXT';

      const socketPayload = {
        chatId,
        content: encryptedContent ? undefined : (content || undefined),
        type: msgType,
        ...(signed && { signature: signed.signature, signerWallet: signed.signerWallet }),
        ...(encryptedContent && { encryptedContent }),
        ...(chatType === 'CHANNEL' && commentsOn && { commentsEnabled: true }),
        ...(attachments.length > 0 && { attachments }),
      };

      // Try P2P first for direct chats with real users; falls back to socket
      // automatically. Group/channel/bot sends always take the socket path.
      const currentUser = useAuthStore.getState().user;
      if (chatType === 'DIRECT' && !recipientIsBot && recipientUserId && currentUser) {
        const p2pPayload = {
          // Real UUID so the receiver doesn't see our `pending-*` placeholder.
          id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? crypto.randomUUID() : `p2p-${Date.now()}-${Math.random()}`,
          chatId,
          senderId: currentUser.id,
          content: encryptedContent ? null : (content || null),
          type: msgType as any,
          replyToId: null,
          isEdited: false,
          isDeleted: false,
          metadata: null,
          signature: signed?.signature ?? null,
          signerWallet: signed?.signerWallet ?? null,
          encryptedContent: encryptedContent ?? null,
          encryptionType: encryptedContent ? 'nacl-box' : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sender: {
            id: currentUser.id,
            username: currentUser.username,
            displayName: currentUser.displayName,
            avatarUrl: currentUser.avatarUrl,
          },
          attachments: attachments.map((a, i) => ({
            id: `p2p-att-${i}`, fileName: a.fileName, fileSize: a.fileSize, mimeType: a.mimeType, url: a.url,
          })),
          status: 'sent' as const,
        };
        const result = sendDmMessage({ chatId, socketPayload, p2pPayload: p2pPayload as any });
        if (result.transport === 'p2p') {
          // P2P delivered. Also drop the message into our own list so we
          // can render it immediately — the optimistic pending row added
          // below will then be skipped via the early return.
          useMessageStore.getState().addMessage(p2pPayload as any);
          setText('');
          setPendingFiles([]);
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
          return;
        }
      } else {
        socket.emit('message:send', socketPayload);
      }

      // Optimistic render — show message immediately without waiting for server broadcast
      if (currentUser) {
        useMessageStore.getState().addMessage({
          id: `pending-${Date.now()}`,
          chatId,
          senderId: currentUser.id,
          content: encryptedContent ? undefined : (content || undefined),
          type: msgType,
          replyToId: null,
          isEdited: false,
          isDeleted: false,
          metadata: null,
          signature: null,
          signerWallet: null,
          encryptedContent: encryptedContent || null,
          encryptionType: encryptedContent ? 'nacl-box' : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sender: {
            id: currentUser.id,
            username: currentUser.username,
            displayName: currentUser.displayName,
            avatarUrl: currentUser.avatarUrl,
          },
          attachments: attachments.map((a, i) => ({
            id: `pending-att-${i}`,
            fileName: a.fileName,
            fileSize: a.fileSize,
            mimeType: a.mimeType,
            url: a.url,
          })),
          status: 'sending',
        } as any);
      }
    }

    setText('');
    setPendingFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;

    // Mention detection: look at the word the caret is in. If it starts
    // with `@` and we are not in a DM with a single bot, open the picker.
    const caret = textarea.selectionStart;
    const before = value.slice(0, caret);
    const wordStart = Math.max(before.lastIndexOf(' '), before.lastIndexOf('\n')) + 1;
    const word = before.slice(wordStart);
    if (
      word.startsWith('@') &&
      !recipientIsBot &&
      chatType !== 'SAVED' &&
      /^@[a-zA-Z0-9_]{0,32}$/.test(word)
    ) {
      setMentionQuery(word.slice(1).toLowerCase());
    } else {
      setMentionQuery(null);
    }

    // Typing indicator
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('typing:start', { chatId });
    }
  };

  const handleBotCommand = (command: string) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('message:send', { chatId, content: command, type: 'TEXT' });
    }
  };

  return (
    <div className="px-3 sm:px-4 py-3 pb-3-safe shrink-0">
     <BotChatBar chatId={chatId} onCommandSelect={handleBotCommand} />
     <div className="bg-white dark:bg-dark-600 rounded-2xl shadow-xl shadow-black/15 dark:shadow-black/40 border border-gray-200/60 dark:border-dark-500/60 px-3 py-2">
      {chatType === 'DIRECT' && !recipientIsBot && (
        <div className="flex items-center gap-3 mb-1 ml-1">
          <button
            onClick={toggleE2E}
            className={`flex items-center gap-1 transition-colors ${
              e2eOn ? 'text-green-500' : 'text-gray-500'
            }`}
            title={e2eOn ? t('chat.e2eEncrypted') : t('chat.e2eDisabled')}
          >
            {e2eOn ? <Lock size={10} /> : <LockOpen size={10} />}
            <span className="text-[10px]">{e2eOn ? t('chat.e2eEncrypted') : t('chat.e2eDisabled')}</span>
          </button>
          <button
            onClick={toggleSign}
            className={`flex items-center gap-1 transition-colors ${
              signOn ? 'text-green-500' : 'text-gray-500'
            }`}
            title={signOn ? t('chat.signEnabled') : t('chat.signDisabled')}
          >
            {signOn ? <ShieldCheck size={10} /> : <ShieldOff size={10} />}
            <span className="text-[10px]">{signOn ? t('chat.signEnabled') : t('chat.signDisabled')}</span>
          </button>
        </div>
      )}
      {chatType === 'CHANNEL' && (
        <button
          onClick={() => setCommentsOn((v) => !v)}
          className={`flex items-center gap-1 mb-1 ml-1 transition-colors ${
            commentsOn ? 'text-primary-500' : 'text-gray-500'
          }`}
        >
          <MessageCircle size={10} />
          <span className="text-[10px]">{commentsOn ? t('chat.commentsEnabled') : t('chat.commentsDisabled')}</span>
        </button>
      )}
      {/* File previews */}
      {pendingFiles.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {pendingFiles.map((pf, i) => (
            <div key={i} className="relative group">
              {pf.preview ? (
                <img src={pf.preview} alt="" className="w-16 h-16 rounded-lg object-cover border border-dark-500" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-dark-600 border border-dark-500 flex flex-col items-center justify-center">
                  <FileIcon size={18} className="text-gray-400" />
                  <span className="text-[8px] text-gray-500 mt-0.5 truncate max-w-14 px-1">{pf.file.name.split('.').pop()}</span>
                </div>
              )}
              <button
                onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={10} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recording overlay replaces the normal input row. */}
      {voice.recording ? (
        <div className="flex items-center gap-3 py-2 px-2">
          <button
            onClick={() => voice.cancel()}
            title={t('voice.cancel')}
            className="p-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white shrink-0 transition-colors"
          >
            <Trash2 size={18} />
          </button>
          <div className="flex-1 flex items-center gap-2 bg-gray-100 dark:bg-dark-600 rounded-full px-4 py-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-sm text-gray-700 dark:text-gray-200 font-mono tabular-nums">
              {Math.floor(voice.duration / 60)}:{String(voice.duration % 60).padStart(2, '0')}
            </span>
            <div className="flex-1 flex items-center justify-end gap-[2px] h-5 overflow-hidden">
              {voice.levels.slice(-24).map((lvl, i) => (
                <span
                  key={i}
                  className="w-[2px] bg-red-500 rounded-full"
                  style={{ height: `${Math.max(10, lvl * 100)}%` }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleSendVoice}
            disabled={uploading}
            title={t('voice.send')}
            className="p-2.5 rounded-full bg-primary-500 hover:bg-primary-600 text-white
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      ) : (
      <div className="flex items-end gap-2">
        <div className="relative shrink-0" ref={attachMenuRef}>
          <button
            onClick={() => setShowAttachMenu((v) => !v)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500 text-gray-400"
          >
            <Paperclip size={20} />
          </button>
          {showAttachMenu && (
            <div className="absolute bottom-full left-0 mb-2 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl py-1.5 min-w-[180px] z-40 animate-fade-in">
              <button
                onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-dark-600 transition-colors"
              >
                <Paperclip size={16} className="text-gray-400" />
                {t('chat.attachFile')}
              </button>
              {chatType !== 'SAVED' && !recipientIsBot && (
                <button
                  onClick={() => { setShowAttachMenu(false); setShowChecklist(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-dark-600 transition-colors"
                >
                  <ListChecks size={16} className="text-primary-400" />
                  {t('checklist.menuItem')}
                </button>
              )}
              {chatType !== 'SAVED' && !recipientIsBot && (
                <button
                  onClick={() => { setShowAttachMenu(false); setShowPoll(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-dark-600 transition-colors"
                >
                  <BarChart3 size={16} className="text-primary-400" />
                  {t('poll.menuItem')}
                </button>
              )}
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            const newFiles = files.map((file) => ({
              file,
              preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
            }));
            setPendingFiles((prev) => [...prev, ...newFiles]);
            e.target.value = '';
          }}
          className="hidden"
        />

        <div className="flex-1 relative">
          {mentionQuery !== null && (
            <MentionPicker
              query={mentionQuery}
              chatId={chatId}
              onPick={insertMention}
              onClose={() => setMentionQuery(null)}
            />
          )}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.writeMessage')}
            rows={1}
            className="w-full resize-none px-4 py-2.5 rounded-2xl bg-gray-100 dark:bg-dark-600
              border-none outline-none focus:ring-2 focus:ring-primary-500
              text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400
              max-h-36 scrollbar-hidden"
          />
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setShowEmoji((v) => !v)}
            className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500 transition-colors ${showEmoji ? 'text-primary-500' : 'text-gray-400'}`}
          >
            <Smile size={20} />
          </button>
          {showEmoji && (
            <EmojiPicker
              onSelect={(emoji) => {
                setText((prev) => prev + emoji);
                textareaRef.current?.focus();
              }}
              onClose={() => setShowEmoji(false)}
            />
          )}
        </div>

        {/* SuperChat button (groups & channels only) */}
        {(chatType === 'GROUP' || chatType === 'CHANNEL') && (
          <button
            onClick={() => setShowSuperChat((v) => !v)}
            className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500 transition-colors shrink-0 ${showSuperChat ? 'text-amber-400' : 'text-gray-400'}`}
            title="SuperChat"
          >
            <Gem size={20} />
          </button>
        )}

        {text.trim() || pendingFiles.length > 0 ? (
          <>
            <button
              onClick={() => setShowSchedule(true)}
              disabled={uploading}
              title={t('schedule.title')}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500 text-gray-400 shrink-0
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Clock size={18} />
            </button>
            <button
              onClick={handleSend}
              disabled={uploading}
              className="p-2.5 rounded-full bg-primary-500 hover:bg-primary-600 text-white
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Send size={18} />
            </button>
          </>
        ) : (
          <button
            onClick={handleStartVoice}
            disabled={uploading}
            title={t('voice.record')}
            className="p-2.5 rounded-full bg-primary-500 hover:bg-primary-600 text-white
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Mic size={18} />
          </button>
        )}
      </div>
      )}

      {/* Schedule modal */}
      {showSchedule && (
        <ScheduleModal
          onClose={() => setShowSchedule(false)}
          onSchedule={handleSchedule}
        />
      )}

      {/* Checklist composer */}
      {showChecklist && (
        <ChecklistComposer
          onClose={() => setShowChecklist(false)}
          onSend={(data) => {
            const socket = getSocket();
            if (!socket?.connected) return;
            socket.emit('message:send', {
              chatId,
              type: 'CHECKLIST',
              content: null,
              metadata: { checklist: data },
            });
          }}
        />
      )}

      {/* Poll composer */}
      {showPoll && (
        <PollComposer
          onClose={() => setShowPoll(false)}
          onSend={(data) => {
            const socket = getSocket();
            if (!socket?.connected) return;
            socket.emit('message:send', {
              chatId,
              type: 'POLL',
              content: null,
              metadata: { poll: data },
            });
          }}
        />
      )}

      {/* SuperChat panel */}
      {showSuperChat && (
        <div className="mt-2 p-3 bg-dark-600 rounded-xl animate-fade-in">
          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Gem size={12} className="text-amber-400" /> SuperChat — donate PLS</p>
          <div className="flex gap-2 mb-2">
            {[100, 500, 1000, 5000, 25000].map((amt) => (
              <button
                key={amt}
                onClick={() => setSuperChatAmount(amt)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  superChatAmount === amt
                    ? amt >= 25000 ? 'bg-red-500 text-white'
                    : amt >= 5000 ? 'bg-yellow-500 text-black'
                    : amt >= 1000 ? 'bg-green-500 text-white'
                    : 'bg-blue-500 text-white'
                    : 'bg-dark-500 text-gray-300 hover:bg-dark-400'
                }`}
              >
                {amt >= 1000 ? `${amt / 1000}K` : amt} PLS
              </button>
            ))}
          </div>
          <button
            onClick={async () => {
              if (!superChatAmount || !text.trim()) return;
              setSuperChatSending(true);
              try {
                await api.post('/superchat/send', {
                  chatId,
                  content: text.trim(),
                  amount: String(superChatAmount),
                });
                setText('');
                setSuperChatAmount(0);
                setShowSuperChat(false);
                toast.success(`SuperChat sent! -${superChatAmount} PLS`);
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'SuperChat failed');
              } finally {
                setSuperChatSending(false);
              }
            }}
            disabled={!superChatAmount || !text.trim() || superChatSending}
            className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-sm font-bold disabled:opacity-50 transition-colors"
          >
            {superChatSending ? '...' : `Send SuperChat (${superChatAmount} PLS)`}
          </button>
        </div>
      )}
     </div>
    </div>
  );
}
