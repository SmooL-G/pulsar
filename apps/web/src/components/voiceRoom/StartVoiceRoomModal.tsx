import { X, Mic, Users } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useVoiceRoomStore } from '../../store/voiceRoomStore';
import { joinVoiceRoom } from '../../p2p/voiceRoomController';
import { useI18n } from '../../i18n';
import { GenerativeAvatar } from '../ui/GenerativeAvatar';

/**
 * Picker for which group / channel to start (or join) a voice room
 * in. Triggered from the Sidebar header.
 */
interface StartVoiceRoomModalProps {
  onClose: () => void;
}

export function StartVoiceRoomModal({ onClose }: StartVoiceRoomModalProps) {
  const { t, locale } = useI18n();
  const ru = locale === 'ru';
  const chats = useChatStore((s) => s.chats);
  const activeRoomId = useVoiceRoomStore((s) => s.activeChatId);
  const participants = useVoiceRoomStore((s) => s.participants);

  const groups = chats.filter((c) => c.type === 'GROUP' || c.type === 'CHANNEL');

  const handlePick = async (chatId: string) => {
    await joinVoiceRoom(chatId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-500 shrink-0">
          <div className="flex items-center gap-2">
            <Mic size={18} className="text-emerald-500" />
            <h3 className="font-semibold">{ru ? 'Голосовая комната' : 'Voice room'}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500">
            <X size={18} />
          </button>
        </div>

        {activeRoomId && (
          <div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1 uppercase tracking-wider font-semibold">
              {ru ? 'Активная комната' : 'Active room'}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-200">
              {chats.find((c) => c.id === activeRoomId)?.name || '—'} • {participants.size} {ru ? 'участн.' : 'in room'}
            </p>
          </div>
        )}

        <div className="p-3 overflow-y-auto">
          <p className="text-[11px] uppercase tracking-wider text-gray-400 px-1 mb-2 font-semibold">
            {ru ? 'Выберите чат' : 'Pick a chat'}
          </p>
          {groups.length === 0 && (
            <p className="text-sm text-gray-400 italic text-center py-8">
              {ru ? 'Нет групповых чатов. Создайте группу через +.' : 'No group chats yet. Create one via +.'}
            </p>
          )}
          <ul className="space-y-1">
            {groups.map((c) => {
              const isActive = activeRoomId === c.id;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => handlePick(c.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left ${
                      isActive
                        ? 'bg-emerald-500/15 hover:bg-emerald-500/25'
                        : 'hover:bg-gray-100 dark:hover:bg-dark-600'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-gray-200 dark:bg-dark-500">
                      {(c as any).avatarUrl ? (
                        <img src={(c as any).avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <GenerativeAvatar seed={c.id} size={40} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {c.name || (ru ? 'Без названия' : 'Untitled')}
                      </p>
                      <p className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Users size={11} />
                        {(c as any).memberCount || 0}
                        {isActive && (
                          <span className="ml-2 text-emerald-500 font-semibold">
                            • {ru ? 'в эфире' : 'live'}
                          </span>
                        )}
                      </p>
                    </div>
                    <Mic
                      size={16}
                      className={isActive ? 'text-emerald-500' : 'text-gray-400'}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
