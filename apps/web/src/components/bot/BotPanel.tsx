import { useState, useEffect } from 'react';
import { X, Plus, Bot, Copy, RefreshCw, Trash2, Check, Globe, ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { useBotStore, type Bot, type BotCommand } from '../../store/botStore';
import { GenerativeAvatar } from '../ui/GenerativeAvatar';
import toast from 'react-hot-toast';

interface BotPanelProps {
  onClose: () => void;
}

type View = 'list' | 'detail' | 'create';

export function BotPanel({ onClose }: BotPanelProps) {
  const { bots, isLoading, fetchBots, createBot, updateBot, regenerateToken, deleteBot } = useBotStore();
  const [view, setView] = useState<View>('list');
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit form
  const [editName, setEditName] = useState('');
  const [editWebhook, setEditWebhook] = useState('');
  const [editCommands, setEditCommands] = useState<BotCommand[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchBots(); }, [fetchBots]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { bot, token: t } = await createBot(newName.trim());
      setToken(t);
      setShowToken(true);
      setSelectedBot(bot);
      setEditName(bot.displayName || '');
      setEditWebhook(bot.webhookUrl || '');
      setEditCommands(bot.commands || []);
      setView('detail');
      setNewName('');
      toast.success('Бот создан!');
    } catch {
      toast.error('Ошибка при создании бота');
    } finally {
      setCreating(false);
    }
  };

  const openDetail = (bot: Bot) => {
    setSelectedBot(bot);
    setEditName(bot.displayName || '');
    setEditWebhook(bot.webhookUrl || '');
    setEditCommands(bot.commands || []);
    setToken(null);
    setShowToken(false);
    setView('detail');
  };

  const handleSave = async () => {
    if (!selectedBot) return;
    setSaving(true);
    try {
      await updateBot(selectedBot.id, {
        name: editName,
        webhookUrl: editWebhook,
        commands: editCommands,
      });
      toast.success('Изменения сохранены');
    } catch {
      toast.error('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenToken = async () => {
    if (!selectedBot) return;
    try {
      const t = await regenerateToken(selectedBot.id);
      setToken(t);
      setShowToken(true);
      toast.success('Токен перевыпущен');
    } catch {
      toast.error('Ошибка');
    }
  };

  const handleDelete = async () => {
    if (!selectedBot) return;
    if (!confirm(`Удалить бота @${selectedBot.username}? Это действие необратимо.`)) return;
    try {
      await deleteBot(selectedBot.id);
      setView('list');
      toast.success('Бот удалён');
    } catch {
      toast.error('Ошибка при удалении');
    }
  };

  const copyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    toast.success('Токен скопирован');
  };

  const addCommand = () => {
    setEditCommands([...editCommands, { command: '', description: '' }]);
  };

  const updateCommand = (i: number, field: 'command' | 'description', val: string) => {
    setEditCommands(editCommands.map((c, idx) => idx === i ? { ...c, [field]: val } : c));
  };

  const removeCommand = (i: number) => {
    setEditCommands(editCommands.filter((_, idx) => idx !== i));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          {view !== 'list' && (
            <button onClick={() => { setView('list'); setToken(null); }} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
              <ChevronLeft size={18} className="text-gray-400" />
            </button>
          )}
          <Bot size={20} className="text-primary-400" />
          <h2 className="text-base font-semibold flex-1">
            {view === 'list' ? 'Мои боты' : view === 'create' ? 'Создать бота' : `@${selectedBot?.username}`}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* List view */}
          {view === 'list' && (
            <div className="p-4 space-y-2">
              <button
                onClick={() => setView('create')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-white/20 hover:border-primary-500/50 hover:bg-primary-500/5 transition-all text-sm text-gray-400 hover:text-primary-400"
              >
                <Plus size={16} />
                Создать нового бота
              </button>

              {isLoading && (
                <div className="text-center py-8 text-gray-500 text-sm">Загрузка...</div>
              )}

              {!isLoading && bots.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  У вас ещё нет ботов.<br />
                  Или напишите <span className="text-primary-400">@pulsarbot</span> в поиске.
                </div>
              )}

              {bots.map((bot) => (
                <button
                  key={bot.id}
                  onClick={() => openDetail(bot)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                    {bot.avatarUrl
                      ? <img src={bot.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : <GenerativeAvatar seed={bot.userId} size={40} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{bot.displayName || bot.username}</p>
                    <p className="text-xs text-gray-400">@{bot.username}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${bot.webhookUrl ? 'bg-green-400' : 'bg-gray-600'}`} title={bot.webhookUrl ? 'Вебхук активен' : 'Без вебхука'} />
                </button>
              ))}
            </div>
          )}

          {/* Create view */}
          {view === 'create' && (
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-400">
                Введите название бота. Username будет создан автоматически с суффиксом <code className="text-primary-400">_pls</code>.
              </p>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Название бота</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Например: Crypto Helper"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-500/60 focus:ring-1 focus:ring-primary-500/30"
                  autoFocus
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
              >
                {creating ? 'Создаём...' : 'Создать бота'}
              </button>
            </div>
          )}

          {/* Detail view */}
          {view === 'detail' && selectedBot && (
            <div className="p-5 space-y-5">
              {/* Token */}
              {token && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  <p className="text-xs text-yellow-400 font-semibold mb-2">🔑 Токен API (показывается один раз)</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs break-all text-yellow-300 font-mono">
                      {showToken ? token : '••••••••:••••••••••••••••••••••••••'}
                    </code>
                    <button onClick={() => setShowToken(v => !v)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0">
                      {showToken ? <EyeOff size={14} className="text-gray-400" /> : <Eye size={14} className="text-gray-400" />}
                    </button>
                    <button onClick={copyToken} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0">
                      <Copy size={14} className="text-gray-400" />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">Сохраните токен — он больше не будет показан!</p>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Название</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-500/60"
                />
              </div>

              {/* Webhook */}
              <div>
                <label className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <Globe size={11} />
                  Webhook URL
                </label>
                <input
                  type="url"
                  value={editWebhook}
                  onChange={(e) => setEditWebhook(e.target.value)}
                  placeholder="https://your-server.com/webhook"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary-500/60 font-mono text-xs"
                />
              </div>

              {/* Commands */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-400">Команды бота</label>
                  <button onClick={addCommand} className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
                    <Plus size={12} /> Добавить
                  </button>
                </div>
                <div className="space-y-2">
                  {editCommands.map((cmd, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm shrink-0">/</span>
                      <input
                        type="text"
                        value={cmd.command}
                        onChange={(e) => updateCommand(i, 'command', e.target.value.replace(/[^a-z0-9_]/g, ''))}
                        placeholder="command"
                        className="w-28 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary-500/60 font-mono"
                      />
                      <input
                        type="text"
                        value={cmd.description}
                        onChange={(e) => updateCommand(i, 'description', e.target.value)}
                        placeholder="Описание"
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary-500/60"
                      />
                      <button onClick={() => removeCommand(i)} className="p-1 text-gray-500 hover:text-red-400 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {editCommands.length === 0 && (
                    <p className="text-xs text-gray-600">Команды не добавлены</p>
                  )}
                </div>
              </div>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Check size={15} />
                {saving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>

              {/* Danger zone */}
              <div className="border border-white/10 rounded-xl p-4 space-y-3">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Опасная зона</p>
                <button
                  onClick={handleRegenToken}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-yellow-400 hover:bg-yellow-500/10 border border-yellow-500/20 transition-colors"
                >
                  <RefreshCw size={14} />
                  Перевыпустить токен
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors"
                >
                  <Trash2 size={14} />
                  Удалить бота
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
