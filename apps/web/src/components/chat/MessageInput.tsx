import { useState, useRef } from 'react';
import { Send, Paperclip, Smile } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { getSocket } from '../../hooks/useSocket';
import { useI18n } from '../../i18n';
import { signMessage } from '../../crypto/messageSigner';

interface MessageInputProps {
  chatId: string;
}

export function MessageInput({ chatId }: MessageInputProps) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { signMessage: walletSignMessage, publicKey } = useWallet();

  const handleSend = async () => {
    const content = text.trim();
    if (!content) return;

    const socket = getSocket();
    if (socket?.connected) {
      // Sign message with Solana wallet if available
      const signed = await signMessage(
        chatId,
        content,
        walletSignMessage ?? undefined,
        publicKey?.toBase58(),
      );

      socket.emit('message:send', {
        chatId,
        content,
        type: 'TEXT',
        ...(signed && { signature: signed.signature, signerWallet: signed.signerWallet }),
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

        <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500 text-gray-400 shrink-0">
          <Smile size={20} />
        </button>

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
