import { useState } from 'react';
import type { Message } from '@pulsar/shared';
import { Check, BarChart3 } from 'lucide-react';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../store/authStore';

interface PollOption {
  id: string;
  text: string;
}

interface PollMessageProps {
  message: Message;
  isOwn: boolean;
}

export function PollMessage({ message, isOwn }: PollMessageProps) {
  const { t } = useI18n();
  const currentUser = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState<string | null>(null);

  const poll = (message.metadata as any)?.poll as
    | { question: string; options: PollOption[]; allowMultiple?: boolean }
    | undefined;
  const votes = (message as any).pollVotes as { optionId: string; userIds: string[] }[] | undefined;

  if (!poll || !Array.isArray(poll.options)) return null;

  const voteMap = new Map<string, Set<string>>();
  (votes || []).forEach((v) => voteMap.set(v.optionId, new Set(v.userIds)));

  // Unique voters across all options (for single-choice it equals option winners sum;
  // for multi it's often less because one user votes multiple times).
  const allVoterIds = new Set<string>();
  (votes || []).forEach((v) => v.userIds.forEach((uid) => allVoterIds.add(uid)));
  const totalVoters = allVoterIds.size;
  const userVoted = currentUser ? allVoterIds.has(currentUser.id) : false;

  const pickOption = async (optionId: string) => {
    if (busy) return;
    setBusy(optionId);
    try {
      await api.post(`/messages/${message.id}/poll-vote`, { optionId });
    } catch { /* silent; broadcast corrects state */ }
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
        <BarChart3 size={16} className={isOwn ? 'text-blue-100' : 'text-primary-400'} />
        <span className="text-sm font-semibold flex-1 leading-snug">{poll.question}</span>
      </div>

      {/* Subtitle: mode + voter count */}
      <p className={`text-[11px] mb-3 ${isOwn ? 'text-blue-100/80' : 'text-gray-400'}`}>
        {poll.allowMultiple ? t('poll.multipleChoice') : t('poll.singleChoice')}
        {' · '}
        {totalVoters === 0 ? t('poll.noVotes') : `${totalVoters} ${t('poll.votesCount')}`}
      </p>

      {/* Options */}
      <ul className="space-y-1.5">
        {poll.options.map((op) => {
          const voters = voteMap.get(op.id) || new Set<string>();
          const iPicked = currentUser ? voters.has(currentUser.id) : false;
          const percent = totalVoters > 0 ? Math.round((voters.size / totalVoters) * 100) : 0;
          return (
            <li key={op.id}>
              <button
                onClick={() => pickOption(op.id)}
                disabled={busy === op.id}
                className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors relative overflow-hidden ${
                  isOwn ? 'hover:bg-white/10' : 'hover:bg-white/5'
                } ${busy === op.id ? 'opacity-60' : ''}`}
              >
                {/* Progress fill (only visible once user has voted) */}
                {userVoted && (
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                      iPicked
                        ? isOwn ? 'bg-white/25' : 'bg-primary-500/30'
                        : isOwn ? 'bg-white/10' : 'bg-white/5'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                )}
                <div className="relative flex items-center gap-2">
                  <span
                    className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      iPicked
                        ? isOwn
                          ? 'bg-white border-white'
                          : 'bg-primary-500 border-primary-500'
                        : isOwn
                          ? 'border-white/50'
                          : 'border-gray-500'
                    }`}
                  >
                    {iPicked && <Check size={12} className={isOwn ? 'text-primary-600' : 'text-white'} />}
                  </span>
                  <span className="text-sm leading-snug flex-1">{op.text}</span>
                  {userVoted && (
                    <span className={`text-[11px] font-mono shrink-0 ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
                      {percent}%
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
