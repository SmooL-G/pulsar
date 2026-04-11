import { useState, useRef, useCallback } from 'react';
import { Send, Paperclip, Smile, Lock, LockOpen, MessageCircle } from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';
import { useWallet } from '@solana/wallet-adapter-react';
import { getSocket } from '../../hooks/useSocket';
import { useI18n } from '../../i18n';
import { signMessage } from '../../crypto/messageSigner';
import { encryptMessage } from '../../crypto/e2eEncrypt';

interface MessageInputProps {
  chatId: string;
  chatType?: 'DIRECT' | 'GROUP' | 'CHANNEL';
  recipientUserId?: string;
}

// Настройка E2E шифрования — localStorage
function getE2EEnabled(): boolean {
  return localStorage.getItem('pulsar_e2e_enabled') !== 'false';
}
function setE2EEnabled(v: boolean) {
  localStorage.setItem('pulsar_e2e_enabled', v ? 'true' : 'false');
}

export function MessageInput({ chatId, chatType, recipientUserId }: MessageInputProps) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [e2eOn, setE2eOn] = useState(getE2EEnabled);
  const [commentsOn, setCommentsOn] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { signMessage: walletSignMessage, publicKey } = useWallet();

  const toggleE2E = useCallback(() => {
    setE2eOn((prev) => {
      const next = !prev;
      setE2EEnabled(next);
      return next;
    });
  }, []);

  const handleSend = async () => {
    const content = text.trim();
    if (!content) return;

    const socket = getSocket();
    if (socket?.connected) {
      // Подпись сообщения кошельком Solana
      const signed = await signMessage(
        chatId,
        content,
        walletSignMessage ?? undefined,
        publicKey?.toBase58(),
      );

      // E2E шифрование только для DM и если включено
      let encryptedContent: string | undefined;
      if (e2eOn && chatType === 'DIRECT' && recipientUserId) {
        const encrypted = await encryptMessage(content, recipientUserId);
        if (encrypted) encryptedContent = encrypted;
      }

      socket.emit('message:send', {
        chatId,
        content: encryptedContent ? undefined : content,
        type: 'TEXT',
        ...(signed && { signature: signed.signature, signerWallet: signed.signerWallet }),
        ...(encryptedContent && { encryptedContent }),
        ...(chatType === 'CHANNEL' && commentsOn && { commentsEnabled: true }),
      });
    }

    setText('');
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
    setText(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;

    // Typing indicator
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('typing:start', { chatId });
    }
  };

  return (
    <div className="px-4 py-3 border-t border-gray-200 dark:border-dark-500 bg-white dark:bg-dark-700 shrink-0">
      {chatType === 'DIRECT' && (
        <button
          onClick={toggleE2E}
          className={`flex items-center gap-1 mb-1 ml-1 transition-colors ${
            e2eOn ? 'text-green-500' : 'text-gray-500'
          }`}
          title={e2eOn ? t('chat.e2eEncrypted') : t('chat.e2eDisabled')}
        >
          {e2eOn ? <Lock size={10} /> : <LockOpen size={10} />}
          <span className="text-[10px]">{e2eOn ? t('chat.e2eEncrypted') : t('chat.e2eDisabled')}</span>
        </button>
      )}
      {chatType === 'CHANNEL' && (
        <button
          onClick={() => setCommentsOn((v) => !v)}
          className={`flex items-center gap-1 mb-1 ml-1 transition-colors ${
            commentsOn ? 'text-primary-500' : 'text-gray-500'
          }`}
        >
          <MessageCircle size={10} />
          <span className="text-[10px]">{commentsOn ? 'Comments enabled' : 'Comments disabled'}</span>
        </button>
      )}
      <div className="flex items-end gap-2">
        <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500 text-gray-400 shrink-0">
          <Paperclip size={20} />
        </button>

        <div className="flex-1 relative">
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

        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="p-2.5 rounded-full bg-primary-500 hover:bg-primary-600 text-white
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
