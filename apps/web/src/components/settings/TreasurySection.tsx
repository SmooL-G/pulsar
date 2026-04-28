import { useEffect, useMemo, useState } from 'react';
import { Vote, Loader2, Plus, ThumbsUp, ThumbsDown, Clock, Award, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../store/authStore';

interface Author {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  nickColor: string | null;
}

interface Proposal {
  id: string;
  title: string;
  description: string;
  status: 'ACTIVE' | 'PASSED' | 'FAILED' | 'NO_QUORUM';
  deposit: string;
  yesPower: string;
  noPower: string;
  voterCount: number;
  quorum: number;
  startedAt: string;
  endsAt: string;
  resolvedAt: string | null;
  author: Author | null;
  myChoice: 'yes' | 'no' | null;
}

interface Config {
  enabled: boolean;
  deposit: string;
  minBalance: string;
  minVerificationLevel: number;
  votingPeriodDays: number;
  quorum: number;
  voteReward: string;
  titleMin: number;
  titleMax: number;
  descriptionMin: number;
  descriptionMax: number;
}

export function TreasurySection() {
  const { locale } = useI18n();
  const { user } = useAuthStore();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);

  const [config, setConfig] = useState<Config | null>(null);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const reload = async () => {
    try {
      const [{ data: cfg }, { data: list }] = await Promise.all([
        api.get('/treasury/config'),
        api.get('/treasury/proposals'),
      ]);
      setConfig(cfg);
      setProposals(list.proposals);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const fmtPls = (v: string) => BigInt(v).toLocaleString(ru ? 'ru-RU' : 'en-US');
  const balance = BigInt((user as any)?.plsBalance || '0');

  const active = useMemo(
    () => (proposals ?? []).filter((p) => p.status === 'ACTIVE'),
    [proposals],
  );
  const past = useMemo(
    () => (proposals ?? []).filter((p) => p.status !== 'ACTIVE'),
    [proposals],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }
  if (!config) return null;

  const minToCreate = BigInt(config.deposit) + BigInt(config.minBalance);
  const canCreate = balance >= minToCreate
    && ((user as any)?.verificationLevel || 0) >= config.minVerificationLevel
    && config.enabled;

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-500/15 via-violet-500/5 to-primary-500/10 border border-violet-500/30 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Vote size={20} className="text-violet-400" />
          <h3 className="text-lg font-bold">{tx('Голосования сообщества', 'Community votes')}</h3>
          {!config.enabled && (
            <span className="ml-auto text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400">
              {tx('Отключено', 'Disabled')}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {tx(
            'Любое решение по проекту — через голос сообщества. Залог 1 000 PLS, квадратичный голос (√баланс).',
            'Any decision goes through a community vote. 1 000 PLS deposit, quadratic voting (√balance).',
          )}
        </p>
      </div>

      {/* Rules */}
      <div className="bg-gray-50 dark:bg-dark-600/40 border border-gray-200 dark:border-dark-500 rounded-xl p-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <p>• {tx(
          `Залог ${fmtPls(config.deposit)} PLS — возвращается, если набран кворум (${config.quorum}+ голосов).`,
          `Deposit ${fmtPls(config.deposit)} PLS — refunded if quorum reached (${config.quorum}+ votes).`,
        )}</p>
        <p>• {tx(
          `Голос — это √(твой баланс). 10 000 PLS = 100 силы, 1 000 000 PLS = 1 000 силы.`,
          `Vote weight = √(balance). 10 000 PLS = 100 power, 1 000 000 PLS = 1 000 power.`,
        )}</p>
        <p>• {tx(
          `Каждому голосующему — ${fmtPls(config.voteReward)} PLS. Голосование длится ${config.votingPeriodDays} дн.`,
          `Each voter receives ${fmtPls(config.voteReward)} PLS. Voting period: ${config.votingPeriodDays} days.`,
        )}</p>
        <p>• {tx(
          `Без кворума — залог сжигается (защита от спама).`,
          `If quorum is not reached, deposit is burned (anti-spam).`,
        )}</p>
      </div>

      {/* Create button */}
      {config.enabled && (
        <button
          onClick={() => setShowCreate(true)}
          disabled={!canCreate}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors ${
            canCreate
              ? 'bg-violet-500 hover:bg-violet-600 text-white'
              : 'bg-gray-200 dark:bg-dark-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Plus size={16} />
          {tx('Создать предложение', 'Create proposal')}
        </button>
      )}
      {config.enabled && !canCreate && (
        <p className="text-xs text-gray-500 text-center">
          {(((user as any)?.verificationLevel || 0) < config.minVerificationLevel)
            ? tx(`Нужна верификация Level ${config.minVerificationLevel}+`, `Verification Level ${config.minVerificationLevel}+ required`)
            : tx(
              `Нужно ${fmtPls(minToCreate.toString())} PLS на балансе (${fmtPls(balance.toString())} есть)`,
              `Need ${fmtPls(minToCreate.toString())} PLS on balance (you have ${fmtPls(balance.toString())})`,
            )}
        </p>
      )}

      {/* Active proposals */}
      {active.length > 0 && (
        <div>
          <p className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-2">
            {tx('Активные', 'Active')} ({active.length})
          </p>
          <div className="space-y-2">
            {active.map((p) => (
              <ProposalCard key={p.id} proposal={p} onVote={reload} ru={ru} />
            ))}
          </div>
        </div>
      )}

      {active.length === 0 && (
        <div className="text-center py-6 text-sm text-gray-500">
          {tx('Сейчас нет активных голосований', 'No active votes right now')}
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <p className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-2">
            {tx('Завершённые', 'Past')}
          </p>
          <div className="space-y-2">
            {past.slice(0, 20).map((p) => (
              <ProposalCard key={p.id} proposal={p} onVote={reload} ru={ru} />
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <CreateProposalModal
          config={config}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function ProposalCard({ proposal, onVote, ru }: { proposal: Proposal; onVote: () => void; ru: boolean }) {
  const tx = (r: string, e: string) => (ru ? r : e);
  const [voting, setVoting] = useState<'yes' | 'no' | null>(null);
  const yes = BigInt(proposal.yesPower);
  const no = BigInt(proposal.noPower);
  const total = yes + no;
  const yesPct = total > 0n ? Number((yes * 1000n) / total) / 10 : 0;
  const noPct = total > 0n ? 100 - yesPct : 0;
  const quorumPct = Math.min(100, (proposal.voterCount / proposal.quorum) * 100);

  const status = proposal.status;
  const closed = status !== 'ACTIVE';

  const cast = async (choice: 'yes' | 'no') => {
    setVoting(choice);
    try {
      await api.post(`/treasury/proposals/${proposal.id}/vote`, { choice });
      toast.success(tx('Голос принят, +5 PLS', 'Vote accepted, +5 PLS'));
      onVote();
    } catch (err: any) {
      const code = err.response?.data?.error;
      const msg =
        code === 'ALREADY_VOTED' ? tx('Уже голосовали', 'Already voted') :
        code === 'INSUFFICIENT_FUNDS' ? tx('Нужно 100+ PLS на балансе', 'Need 100+ PLS on balance') :
        code === 'SELF_VOTE' ? tx('Нельзя голосовать за своё предложение', 'Cannot vote on your own') :
        code === 'CLOSED' ? tx('Голосование закрыто', 'Voting closed') :
        err.response?.data?.message || tx('Ошибка', 'Error');
      toast.error(msg);
    } finally {
      setVoting(null);
    }
  };

  const endsAt = new Date(proposal.endsAt);
  const remainingMs = endsAt.getTime() - Date.now();
  const remaining =
    remainingMs <= 0 ? null
    : remainingMs > 24 * 3600 * 1000 ? `${Math.floor(remainingMs / (24 * 3600 * 1000))}${tx('д','d')}`
    : remainingMs > 3600 * 1000 ? `${Math.floor(remainingMs / (3600 * 1000))}${tx('ч','h')}`
    : `${Math.max(1, Math.floor(remainingMs / 60000))}${tx('м','m')}`;

  const statusBadge = closed ? (
    status === 'PASSED' ? (
      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
        {tx('Принято', 'Passed')}
      </span>
    ) : status === 'FAILED' ? (
      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500">
        {tx('Отклонено', 'Failed')}
      </span>
    ) : (
      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-500">
        {tx('Без кворума', 'No quorum')}
      </span>
    )
  ) : (
    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-500 inline-flex items-center gap-1">
      <Clock size={10} /> {remaining ?? tx('закрытие…', 'closing…')}
    </span>
  );

  return (
    <div className="rounded-xl border border-gray-200 dark:border-dark-500 bg-white/40 dark:bg-dark-700/40 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <h4 className="font-semibold text-sm flex-1 leading-snug">{proposal.title}</h4>
        {statusBadge}
      </div>
      {proposal.author && (
        <p className="text-[11px] text-gray-500">
          {tx('Автор', 'Author')}{' '}
          <span className="font-mono" style={proposal.author.nickColor ? { color: proposal.author.nickColor } : undefined}>
            @{proposal.author.username}
          </span>
        </p>
      )}
      <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{proposal.description}</p>

      {/* yes/no bar */}
      {total > 0n ? (
        <div>
          <div className="h-2 rounded-full bg-rose-500/20 overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${yesPct}%` }} />
          </div>
          <div className="flex justify-between text-[11px] mt-1 text-gray-500">
            <span className="text-emerald-500 font-medium">{tx('За', 'Yes')} {yesPct.toFixed(1)}% ({yes.toString()})</span>
            <span className="text-rose-500 font-medium">{tx('Против', 'No')} {noPct.toFixed(1)}% ({no.toString()})</span>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-gray-500">{tx('Голосов пока нет', 'No votes yet')}</p>
      )}

      {/* quorum */}
      <div>
        <div className="h-1 rounded-full bg-gray-200 dark:bg-dark-500 overflow-hidden">
          <div className="h-full bg-violet-500" style={{ width: `${quorumPct}%` }} />
        </div>
        <p className="text-[10px] text-gray-500 mt-1">
          {tx('Кворум', 'Quorum')}: {proposal.voterCount}/{proposal.quorum}
        </p>
      </div>

      {/* actions */}
      {!closed && (
        proposal.myChoice ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 pt-1">
            <Award size={12} />
            {tx('Вы проголосовали:', 'You voted:')}{' '}
            <span className={proposal.myChoice === 'yes' ? 'text-emerald-500 font-medium' : 'text-rose-500 font-medium'}>
              {proposal.myChoice === 'yes' ? tx('За', 'Yes') : tx('Против', 'No')}
            </span>
          </div>
        ) : (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => cast('yes')}
              disabled={voting !== null}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 transition-colors disabled:opacity-50"
            >
              {voting === 'yes' ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />}
              {tx('За', 'Yes')}
            </button>
            <button
              onClick={() => cast('no')}
              disabled={voting !== null}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 transition-colors disabled:opacity-50"
            >
              {voting === 'no' ? <Loader2 size={12} className="animate-spin" /> : <ThumbsDown size={12} />}
              {tx('Против', 'No')}
            </button>
          </div>
        )
      )}
    </div>
  );
}

function CreateProposalModal({
  config, onClose, onCreated,
}: {
  config: Config;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.post('/treasury/proposals', { title: title.trim(), description: description.trim() });
      toast.success(tx('Предложение создано', 'Proposal created'));
      onCreated();
    } catch (err: any) {
      const code = err.response?.data?.error;
      const msg =
        code === 'INSUFFICIENT_FUNDS' ? tx('Недостаточно PLS', 'Not enough PLS') :
        code === 'NOT_VERIFIED' ? tx(`Нужна верификация Level ${config.minVerificationLevel}+`, `Verification Level ${config.minVerificationLevel}+ required`) :
        code === 'TITLE_LENGTH' ? tx(`Заголовок ${config.titleMin}-${config.titleMax} символов`, `Title ${config.titleMin}-${config.titleMax} chars`) :
        code === 'DESCRIPTION_LENGTH' ? tx(`Описание ${config.descriptionMin}-${config.descriptionMax} символов`, `Description ${config.descriptionMin}-${config.descriptionMax} chars`) :
        err.response?.data?.message || tx('Ошибка', 'Error');
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const titleOk = title.trim().length >= config.titleMin && title.trim().length <= config.titleMax;
  const descOk = description.trim().length >= config.descriptionMin && description.trim().length <= config.descriptionMax;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-500">
          <div className="flex items-center gap-2">
            <Vote size={18} className="text-violet-500" />
            <h3 className="font-semibold">{tx('Новое предложение', 'New proposal')}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-300">
            {tx(
              `С тебя спишется ${BigInt(config.deposit).toLocaleString('ru-RU')} PLS залога. Если наберёшь ${config.quorum}+ голосов — залог вернётся. Если нет — сгорит.`,
              `${BigInt(config.deposit).toLocaleString('en-US')} PLS will be locked as deposit. Reach ${config.quorum}+ voters and it returns. Otherwise it burns.`,
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {tx('Заголовок', 'Title')} ({title.trim().length}/{config.titleMax})
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={config.titleMax}
              placeholder={tx('Например: добавить тёмную фиолетовую тему', 'e.g. add a dark purple theme')}
              className="w-full px-3 py-2 bg-gray-100 dark:bg-dark-600 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {tx('Описание', 'Description')} ({description.trim().length}/{config.descriptionMax})
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={config.descriptionMax}
              rows={6}
              placeholder={tx('Опиши идею, зачем это нужно, что это даст пользователям…', 'Explain the idea, why it matters, what it gives users…')}
              className="w-full px-3 py-2 bg-gray-100 dark:bg-dark-600 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>

          <button
            onClick={submit}
            disabled={busy || !titleOk || !descOk}
            className="w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {tx(`Опубликовать (-${BigInt(config.deposit).toLocaleString('ru-RU')} PLS)`, `Publish (-${BigInt(config.deposit).toLocaleString('en-US')} PLS)`)}
          </button>
        </div>
      </div>
    </div>
  );
}
