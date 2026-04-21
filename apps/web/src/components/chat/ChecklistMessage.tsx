import { useState } from 'react';
import type { Message } from '@pulsar/shared';
import { Check, ListChecks } from 'lucide-react';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../store/authStore';

interface ChecklistItem {
  id: string;
  text: string;
}

interface ChecklistMessageProps {
  message: Message;
  isOwn: boolean;
}

export function ChecklistMessage({ message, isOwn }: ChecklistMessageProps) {
  const { t } = useI18n();
  const currentUser = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState<string | null>(null);

  const checklist = (message.metadata as any)?.checklist as
    | { title?: string; items: ChecklistItem[] }
    | undefined;
  const checks = (message as any).checklistChecks as
    | { itemId: string; userIds: string[] }[]
    | undefined;

  if (!checklist || !Array.isArray(checklist.items)) return null;

  const checkMap = new Map<string, Set<string>>();
  (checks || []).forEach((c) => checkMap.set(c.itemId, new Set(c.userIds)));

  const doneCount = checklist.items.filter((it) => (checkMap.get(it.id)?.size || 0) > 0).length;
  const total = checklist.items.length;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const toggle = async (itemId: string) => {
    if (busy) return;
    setBusy(itemId);
    try {
      await api.post(`/messages/${message.id}/checklist-toggle`, { itemId });
    } catch { /* silent; server broadcast will correct state */ }
    setBusy(null);
  };

  return (
    <div
      className={`rounded-2xl px-3 py-3 max-w-sm w-full ${
        isOwn
          ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white'
          : 'bg-dark-600 text-gray-100'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
        <ListChecks size={16} className={isOwn ? 'text-blue-100' : 'text-primary-400'} />
        <span className="text-sm font-semibold truncate flex-1">
          {checklist.title || t('checklist.defaultTitle')}
        </span>
        <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
          isOwn ? 'bg-white/10 text-blue-100' : 'bg-white/5 text-gray-400'
        }`}>
          {doneCount}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className={`w-full h-1 rounded-full overflow-hidden mb-3 ${isOwn ? 'bg-white/10' : 'bg-white/5'}`}>
        <div
          className={`h-full transition-all duration-500 ${isOwn ? 'bg-white/60' : 'bg-primary-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Items */}
      <ul className="space-y-1.5">
        {checklist.items.map((it) => {
          const usersWhoChecked = checkMap.get(it.id) || new Set<string>();
          const iChecked = currentUser ? usersWhoChecked.has(currentUser.id) : false;
          const isDone = usersWhoChecked.size > 0;
          return (
            <li key={it.id}>
              <button
                onClick={() => toggle(it.id)}
                disabled={busy === it.id}
                className={`w-full flex items-start gap-2 text-left px-1 py-1 rounded-lg transition-colors ${
                  isOwn ? 'hover:bg-white/10' : 'hover:bg-white/5'
                } ${busy === it.id ? 'opacity-60' : ''}`}
              >
                <span
                  className={`shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    iChecked
                      ? isOwn
                        ? 'bg-white border-white'
                        : 'bg-primary-500 border-primary-500'
                      : isOwn
                        ? 'border-white/50'
                        : 'border-gray-500'
                  }`}
                >
                  {iChecked && <Check size={12} className={isOwn ? 'text-primary-600' : 'text-white'} />}
                </span>
                <span
                  className={`text-sm leading-snug flex-1 ${
                    isDone ? 'line-through opacity-70' : ''
                  }`}
                >
                  {it.text}
                </span>
                {usersWhoChecked.size > 0 && !iChecked && (
                  <span className={`text-[10px] shrink-0 mt-1 px-1.5 py-0.5 rounded-full ${
                    isOwn ? 'bg-white/15 text-blue-100' : 'bg-white/10 text-gray-400'
                  }`}>
                    {usersWhoChecked.size}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
