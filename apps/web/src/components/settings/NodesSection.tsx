import { useEffect, useState } from 'react';
import { Cpu, Loader2, Plus, RefreshCw, Trash2, Copy, Check, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';

interface NodeRow {
  id: string;
  endpoint: string | null;
  label: string | null;
  status: 'ACTIVE' | 'STALE' | 'BANNED';
  registeredAt: string;
  lastSeenAt: string;
  totalUptimeMinutes: number;
  totalBytesRelayed: string;
  totalRewardsPaid: string;
}

interface Config {
  enabled: boolean;
  baseRatePerHour: string;
  bandwidthBonusPerGB: string;
  peerBonusPerPeer: string;
  maxDailyPayout: string;
  minUptimeHours: number;
  proofIntervalSeconds: number;
  freezeHours: number;
}

export function NodesSection() {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);

  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [pendingRewards, setPendingRewards] = useState('0');
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [revealedToken, setRevealedToken] = useState<{ id: string; token: string } | null>(null);

  const reload = async () => {
    // Load independently so an error in /nodes/my doesn't blank the
    // panel by silently dropping the config result.
    try {
      const { data: cfg } = await api.get('/nodes/config');
      setConfig(cfg);
    } catch (err) {
      console.error('[nodes] /config failed:', err);
    }
    try {
      const { data: list } = await api.get('/nodes/my');
      setNodes(list.nodes ?? []);
      setPendingRewards(list.pendingRewards ?? '0');
    } catch (err) {
      console.error('[nodes] /my failed:', err);
      setNodes([]);
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const fmtPls = (v: string) => BigInt(v).toLocaleString(ru ? 'ru-RU' : 'en-US');
  const fmtBytes = (b: string) => {
    const n = BigInt(b);
    if (n < 1_000_000n) return `${n / 1000n} KB`;
    if (n < 1_000_000_000n) return `${n / 1_000_000n} MB`;
    return `${(Number(n) / 1e9).toFixed(2)} GB`;
  };
  const fmtUptime = (mins: number) => {
    if (mins < 60) return `${mins} ${tx('мин', 'min')}`;
    if (mins < 60 * 24) return `${Math.floor(mins / 60)} ${tx('ч', 'h')}`;
    return `${Math.floor(mins / (60 * 24))} ${tx('д', 'd')}`;
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-gray-400" /></div>;
  if (!config) return null;

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-cyan-500/15 via-cyan-500/5 to-primary-500/10 border border-cyan-500/30 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Cpu size={20} className="text-cyan-400" />
          <h3 className="text-lg font-bold">{tx('Релей-ноды', 'Relay nodes')}</h3>
          {!config.enabled && (
            <span className="ml-auto text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400">
              {tx('Отключено', 'Disabled')}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {tx(
            'Запустите свою ноду — помогайте другим пользователям общаться напрямую и получайте PLS за работу.',
            'Run your own node — help others connect P2P and earn PLS for the uptime.',
          )}
        </p>
      </div>

      {/* Reward formula */}
      <div className="bg-gray-50 dark:bg-dark-600/40 border border-gray-200 dark:border-dark-500 rounded-xl p-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <p>• {tx(
          `${fmtPls(config.baseRatePerHour)} PLS / час онлайна`,
          `${fmtPls(config.baseRatePerHour)} PLS / hour online`,
        )}</p>
        <p>• {tx(
          `${fmtPls(config.bandwidthBonusPerGB)} PLS / GB переданного трафика`,
          `${fmtPls(config.bandwidthBonusPerGB)} PLS / GB relayed`,
        )}</p>
        <p>• {tx(
          `${fmtPls(config.peerBonusPerPeer)} PLS за каждого уникального peer'а`,
          `${fmtPls(config.peerBonusPerPeer)} PLS per unique peer served`,
        )}</p>
        <p>• {tx(
          `Максимум ${fmtPls(config.maxDailyPayout)} PLS / нода / сутки`,
          `Max ${fmtPls(config.maxDailyPayout)} PLS / node / day`,
        )}</p>
        <p>• {tx(
          `Первая выплата — после ${config.minUptimeHours}ч непрерывного uptime`,
          `First payout — after ${config.minUptimeHours}h of continuous uptime`,
        )}</p>
        <p>• {tx(
          `Новые награды заморожены ${config.freezeHours}ч на балансе перед зачислением (анти-фрод)`,
          `New rewards are frozen for ${config.freezeHours}h before crediting (anti-fraud)`,
        )}</p>
      </div>

      {/* Pending rewards (frozen) */}
      {BigInt(pendingRewards) > 0n && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-400 font-semibold">
              {tx('Ждут разморозки', 'Pending release')}
            </p>
            <p className="text-[10px] text-gray-500">
              {tx(`Зачислятся в кошелёк через ${config.freezeHours}ч после начисления`, `Credited to wallet ${config.freezeHours}h after earning`)}
            </p>
          </div>
          <p className="font-mono font-bold text-amber-400">
            {fmtPls(pendingRewards)} PLS
          </p>
        </div>
      )}

      {/* Newly-revealed token after registration */}
      {revealedToken && (
        <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
          <p className="text-xs font-bold text-amber-400">
            🔑 {tx('Сохрани токен — больше его не покажу', 'Save this token — won\'t show again')}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] font-mono text-amber-300 bg-dark-700/50 rounded p-2 break-all">{revealedToken.token}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(revealedToken.token); toast.success(tx('Скопировано', 'Copied')); }}
              className="p-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black"
            >
              <Copy size={14} />
            </button>
          </div>
          <p className="text-[10px] text-amber-300/80">
            {tx(
              `Используй для запуска CLI-runner'а: PULSAR_NODE_ID=${revealedToken.id} PULSAR_NODE_TOKEN=<этот токен>`,
              `Use it with the CLI runner: PULSAR_NODE_ID=${revealedToken.id} PULSAR_NODE_TOKEN=<this token>`,
            )}
          </p>
          <button
            onClick={() => setRevealedToken(null)}
            className="text-[11px] text-gray-400 hover:text-gray-200"
          >
            {tx('Я скопировал, скрыть', 'Got it, hide')}
          </button>
        </div>
      )}

      {/* Register */}
      {config.enabled && (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-medium"
        >
          <Plus size={16} />
          {tx('Зарегистрировать ноду', 'Register a node')}
        </button>
      )}

      {/* My nodes */}
      {nodes.length > 0 ? (
        <div className="space-y-2">
          {nodes.map((n) => (
            <NodeCard
              key={n.id}
              node={n}
              ru={ru}
              fmtPls={fmtPls}
              fmtBytes={fmtBytes}
              fmtUptime={fmtUptime}
              onChanged={reload}
              onTokenRevealed={(token) => setRevealedToken({ id: n.id, token })}
            />
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-gray-500 py-6">
          {tx('У тебя пока нет нод. Зарегистрируй первую — получай PLS за uptime.', 'No nodes yet. Register one and start earning PLS.')}
        </p>
      )}

      {showCreate && (
        <CreateNodeModal
          onClose={() => setShowCreate(false)}
          onCreated={(id, token) => {
            setShowCreate(false);
            setRevealedToken({ id, token });
            reload();
          }}
        />
      )}
    </div>
  );
}

function NodeCard({ node, ru, fmtPls, fmtBytes, fmtUptime, onChanged, onTokenRevealed }: {
  node: NodeRow;
  ru: boolean;
  fmtPls: (v: string) => string;
  fmtBytes: (b: string) => string;
  fmtUptime: (m: number) => string;
  onChanged: () => void;
  onTokenRevealed: (token: string) => void;
}) {
  const tx = (r: string, e: string) => (ru ? r : e);
  const [busy, setBusy] = useState(false);
  const last = new Date(node.lastSeenAt);
  const ageMs = Date.now() - last.getTime();
  const ageStr = ageMs < 60_000 ? tx('только что', 'just now')
    : ageMs < 3600_000 ? `${Math.floor(ageMs / 60_000)}${tx('м', 'm')}`
    : ageMs < 24 * 3600_000 ? `${Math.floor(ageMs / 3600_000)}${tx('ч', 'h')}`
    : `${Math.floor(ageMs / (24 * 3600_000))}${tx('д', 'd')}`;

  const statusColor =
    node.status === 'ACTIVE' ? 'text-emerald-500'
    : node.status === 'STALE' ? 'text-amber-400'
    : 'text-rose-500';

  const rotate = async () => {
    if (!confirm(tx('Сгенерировать новый токен? Старый перестанет работать.', 'Generate new token? Old one will stop working.'))) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/nodes/${node.id}/rotate-token`);
      onTokenRevealed(data.token);
      toast.success(tx('Токен обновлён', 'Token rotated'));
    } catch { toast.error(tx('Ошибка', 'Error')); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm(tx('Удалить ноду? Все proof\'ы и история останутся, но новая регистрация не поможет.', 'Delete node? Proofs stay but you can\'t resume.'))) return;
    setBusy(true);
    try {
      await api.delete(`/nodes/${node.id}`);
      toast.success(tx('Удалено', 'Deleted'));
      onChanged();
    } catch { toast.error(tx('Ошибка', 'Error')); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-dark-500 bg-white/40 dark:bg-dark-700/40 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Zap size={14} className={statusColor} fill="currentColor" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {node.label || tx('Без имени', 'Unnamed')}
          </p>
          {node.endpoint && (
            <p className="text-[11px] font-mono text-gray-500 truncate">{node.endpoint}</p>
          )}
        </div>
        <span className={`text-[10px] uppercase font-bold ${statusColor}`}>{node.status}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-gray-50 dark:bg-dark-600/40 rounded p-2">
          <p className="text-[10px] text-gray-500">{tx('Uptime', 'Uptime')}</p>
          <p className="font-mono text-cyan-400">{fmtUptime(node.totalUptimeMinutes)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-dark-600/40 rounded p-2">
          <p className="text-[10px] text-gray-500">{tx('Передано', 'Relayed')}</p>
          <p className="font-mono text-cyan-400">{fmtBytes(node.totalBytesRelayed)}</p>
        </div>
        <div className="bg-gray-50 dark:bg-dark-600/40 rounded p-2">
          <p className="text-[10px] text-gray-500">{tx('Заработано', 'Earned')}</p>
          <p className="font-mono text-amber-400">{fmtPls(node.totalRewardsPaid)} PLS</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1">
        <span>{tx('Активность:', 'Last seen:')} {ageStr}</span>
        <div className="flex gap-1">
          <button onClick={rotate} disabled={busy} className="p-1.5 rounded hover:bg-amber-500/20 text-amber-500" title={tx('Новый токен', 'Rotate token')}>
            <RefreshCw size={12} />
          </button>
          <button onClick={remove} disabled={busy} className="p-1.5 rounded hover:bg-rose-500/20 text-rose-500" title={tx('Удалить', 'Delete')}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateNodeModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string, token: string) => void }) {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);
  const [label, setLabel] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.post('/nodes/register', { label: label.trim() || undefined, endpoint: endpoint.trim() || undefined });
      onCreated(data.id, data.token);
    } catch (err: any) {
      toast.error(err.response?.data?.message || tx('Ошибка', 'Error'));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Cpu size={18} className="text-cyan-500" />
          <h3 className="font-semibold">{tx('Новая нода', 'New node')}</h3>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">{tx('Имя (только для тебя)', 'Label (just for you)')}</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={64}
            placeholder={tx('Домашний сервер', 'Home server')}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-dark-600 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            {tx('Публичный endpoint (необязательно)', 'Public endpoint (optional)')}
          </label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="wss://my-node.example.com/ws"
            className="w-full px-3 py-2 bg-gray-100 dark:bg-dark-600 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
          />
          <p className="text-[10px] text-gray-500 mt-1">
            {tx('Если есть — нода попадёт в публичный список. Иначе работает приватно.', 'If set, node joins the public discovery list. Otherwise stays private.')}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-gray-200 dark:bg-dark-500 text-gray-700 dark:text-gray-300">
            {tx('Отмена', 'Cancel')}
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {tx('Зарегистрировать', 'Register')}
          </button>
        </div>
      </div>
    </div>
  );
}
