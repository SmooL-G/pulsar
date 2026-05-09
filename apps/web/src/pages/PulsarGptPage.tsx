import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Send, Loader2, Image as ImageIcon, Film, Video, MessageSquare,
  Settings as SettingsIcon, Sparkles, Download, Wand2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { useI18n } from '../i18n';

type Tab = 'chat' | 'image' | 'animate' | 'video' | 'settings';

interface ChatMsg { role: 'user' | 'assistant'; content: string; tokens?: number; pricePls?: string }
interface AsyncRequest {
  id: string; type: string; model: string; prompt: string | null;
  inputUrl: string | null; outputUrl: string | null;
  pricePls: string | null; status: 'PENDING' | 'DONE' | 'FAILED';
  errorMessage: string | null;
}

export function PulsarGptPage() {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);
  const [tab, setTab] = useState<Tab>('chat');

  return (
    <div className="bg-dark-900 text-white" style={{ height: '100dvh', overflowY: 'auto' }}>
      <div className="border-b border-dark-600 bg-dark-800/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-1.5 rounded-lg hover:bg-dark-600 text-gray-400">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Sparkles size={18} className="text-primary-400" />
            Pulsar GPT
          </h1>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold">
            BETA
          </span>
        </div>
        <div className="max-w-3xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {([
            { id: 'chat', icon: MessageSquare, label: tx('Чат', 'Chat') },
            { id: 'image', icon: ImageIcon, label: tx('Картинка', 'Image') },
            { id: 'animate', icon: Film, label: tx('Оживить', 'Animate') },
            { id: 'video', icon: Video, label: tx('Видео', 'Video') },
            { id: 'settings', icon: SettingsIcon, label: tx('Настройки', 'Settings') },
          ] as const).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id ? 'border-primary-500 text-white' : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {tab === 'chat' && <ChatTab ru={ru} />}
        {tab === 'image' && <GenerateTab type="image" title={tx('Создать изображение', 'Generate image')} ru={ru} />}
        {tab === 'animate' && <AnimateTab ru={ru} />}
        {tab === 'video' && <GenerateTab type="video" title={tx('Видео из текста', 'Text-to-video')} ru={ru} />}
        {tab === 'settings' && <SettingsTab ru={ru} />}
      </div>
    </div>
  );
}

// ─── Chat tab ──────────────────────────────────────────────

function ChatTab({ ru }: { ru: boolean }) {
  const tx = (r: string, e: string) => (ru ? r : e);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    const content = input.trim();
    if (!content || busy) return;
    const userMsg: ChatMsg = { role: 'user', content };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setBusy(true);
    try {
      const { data } = await api.post('/pulsar-gpt/chat', {
        messages: [...messages.filter((m) => m.role).map((m) => ({ role: m.role, content: m.content })), { role: 'user', content }],
      });
      setMessages((m) => [...m, { role: 'assistant', content: data.text, tokens: data.tokens, pricePls: data.pricePls }]);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? tx('Ошибка', 'Error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-dark-500 bg-dark-700/40 overflow-hidden">
      <div ref={listRef} className="min-h-[400px] max-h-[60vh] overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-sm text-gray-500 py-12">
            <Sparkles size={28} className="mx-auto mb-2 text-primary-400/60" />
            {tx('Спроси что-нибудь — модель ответит', 'Ask anything — the model will reply')}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
              m.role === 'user' ? 'bg-primary-500/30 text-primary-50' : 'bg-dark-600 text-gray-100'
            }`}>
              {m.content}
              {m.role === 'assistant' && (m.tokens || m.pricePls) && (
                <div className="mt-1 text-[10px] text-gray-500">
                  {m.tokens} {tx('токенов', 'tokens')}
                  {m.pricePls && m.pricePls !== '0' && <> · {m.pricePls} PLS</>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 p-3 border-t border-dark-500/50 bg-dark-800/60">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder={tx('Напиши сообщение…', 'Type a message…')}
          className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-primary-500 focus:outline-none resize-none"
        />
        <button
          onClick={send}
          disabled={!input.trim() || busy}
          className="p-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg disabled:opacity-40"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}

// ─── Generate tab (image / video) ──────────────────────────

function GenerateTab({ type, title, ru }: { type: 'image' | 'video'; title: string; ru: boolean }) {
  const tx = (r: string, e: string) => (ru ? r : e);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<AsyncRequest | null>(null);

  const submit = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/pulsar-gpt/${type}`, { prompt });
      // Start polling immediately
      pollUntilDone(data.requestId, setActive, ru);
      setPrompt('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? tx('Ошибка', 'Error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dark-500 bg-dark-700/40 p-4 space-y-3">
        <h2 className="text-sm font-medium text-gray-300">{title}</h2>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder={type === 'image'
            ? tx('Описание картинки: кот в шляпе на луне, акварель', 'Image prompt: cat in a hat on the moon, watercolor')
            : tx('Описание видео: дрон летит над горным пейзажем закатом, 5 сек', 'Video prompt: drone flying over mountains at sunset, 5 sec')}
          className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-primary-500 focus:outline-none resize-none"
        />
        <button
          onClick={submit}
          disabled={!prompt.trim() || busy}
          className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {tx('Создать', 'Generate')}
        </button>
      </div>

      {active && <ResultCard request={active} ru={ru} />}
    </div>
  );
}

// ─── Animate tab ───────────────────────────────────────────

function AnimateTab({ ru }: { ru: boolean }) {
  const tx = (r: string, e: string) => (ru ? r : e);
  const [imageUrl, setImageUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<AsyncRequest | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setBusy(true);
    try {
      const { data } = await api.post('/upload/file', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImageUrl(data.url);
      toast.success(tx('Картинка загружена', 'Image uploaded'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? tx('Загрузка не удалась', 'Upload failed'));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!imageUrl || busy) return;
    setBusy(true);
    try {
      const { data } = await api.post('/pulsar-gpt/animate', { imageUrl, prompt: prompt || undefined });
      pollUntilDone(data.requestId, setActive, ru);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? tx('Ошибка', 'Error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dark-500 bg-dark-700/40 p-4 space-y-3">
        <h2 className="text-sm font-medium text-gray-300">{tx('Оживить картинку', 'Animate an image')}</h2>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="w-full py-3 bg-dark-600 hover:bg-dark-500 border border-dashed border-dark-400 rounded-lg text-sm text-gray-300 flex items-center justify-center gap-2"
        >
          <ImageIcon size={16} />
          {imageUrl ? tx('✓ Картинка загружена. Поменять', '✓ Image uploaded. Replace') : tx('Загрузить картинку', 'Upload image')}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} />
        {imageUrl && (
          <img src={imageUrl} alt="preview" className="w-full max-h-48 object-contain rounded-lg" />
        )}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          placeholder={tx('Описание движения (необязательно): волосы развеваются от ветра', 'Motion prompt (optional): hair blowing in the wind')}
          className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-primary-500 focus:outline-none resize-none"
        />
        <button
          onClick={submit}
          disabled={!imageUrl || busy}
          className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
          {tx('Оживить', 'Animate')}
        </button>
      </div>
      {active && <ResultCard request={active} ru={ru} />}
    </div>
  );
}

// ─── Result card (shows in-progress + final) ────────────────

function ResultCard({ request, ru }: { request: AsyncRequest; ru: boolean }) {
  const tx = (r: string, e: string) => (ru ? r : e);
  const isVideo = request.type === 'VIDEO' || request.type === 'ANIMATE';

  return (
    <div className="rounded-2xl border border-dark-500 bg-dark-700/40 p-4 space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">
          {request.model} · {request.pricePls && request.pricePls !== '0' ? `${request.pricePls} PLS` : tx('бесплатно (admin)', 'free (admin)')}
        </span>
        <StatusPill status={request.status} ru={ru} />
      </div>
      {request.status === 'PENDING' && (
        <div className="py-12 flex flex-col items-center gap-2 text-gray-400">
          <Loader2 size={24} className="animate-spin text-primary-400" />
          <p className="text-xs">{tx('Генерация… обычно 30-90 секунд', 'Generating… usually 30-90 seconds')}</p>
        </div>
      )}
      {request.status === 'FAILED' && (
        <div className="py-6 text-center text-sm text-rose-400">
          {request.errorMessage || tx('Не получилось — деньги вернулись', 'Failed — refunded')}
        </div>
      )}
      {request.status === 'DONE' && request.outputUrl && (
        <>
          {isVideo ? (
            <video src={request.outputUrl} controls className="w-full rounded-lg max-h-[60vh]" />
          ) : (
            <img src={request.outputUrl} alt="" className="w-full rounded-lg max-h-[60vh] object-contain" />
          )}
          <div className="flex gap-2">
            <a
              href={request.outputUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-dark-600 hover:bg-dark-500 rounded-lg text-xs"
            >
              <Download size={12} />
              {tx('Скачать', 'Download')}
            </a>
            {request.type === 'IMAGE' && (
              <button
                onClick={() => toast(tx('Открой вкладку «Оживить» и загрузи эту картинку', 'Open Animate tab and upload this image'))}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-lg text-xs"
              >
                <Wand2 size={12} />
                {tx('Оживить?', 'Animate?')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatusPill({ status, ru }: { status: AsyncRequest['status']; ru: boolean }) {
  const tx = (r: string, e: string) => (ru ? r : e);
  if (status === 'PENDING') return <span className="text-amber-400">{tx('генерируется', 'generating')}</span>;
  if (status === 'DONE') return <span className="text-emerald-400">{tx('готово', 'done')}</span>;
  return <span className="text-rose-400">{tx('ошибка', 'failed')}</span>;
}

async function pollUntilDone(
  requestId: string,
  setter: (r: AsyncRequest) => void,
  ru: boolean,
) {
  // Quick local pending state so the UI updates instantly.
  setter({
    id: requestId, type: '', model: '', prompt: '', inputUrl: null,
    outputUrl: null, pricePls: null, status: 'PENDING', errorMessage: null,
  });
  const start = Date.now();
  const TIMEOUT_MS = 16 * 60_000; // give worker its 15-min auto-fail + buffer
  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const { data } = await api.get(`/pulsar-gpt/requests/${requestId}`);
      setter(data.request);
      if (data.request.status !== 'PENDING') return;
    } catch {
      /* transient — keep polling */
    }
  }
}

// ─── Settings tab ──────────────────────────────────────────

function SettingsTab({ ru }: { ru: boolean }) {
  const tx = (r: string, e: string) => (ru ? r : e);
  const [models, setModels] = useState<any | null>(null);
  const [settings, setSettings] = useState<any | null>(null);
  const [adminBalance, setAdminBalance] = useState<number | null>(null);

  useEffect(() => {
    api.get('/pulsar-gpt/models').then(({ data }) => setModels(data));
    api.get('/pulsar-gpt/settings').then(({ data }) => setSettings(data.settings));
    api.get('/pulsar-gpt/admin/balance').then(({ data }) => setAdminBalance(data.credits)).catch(() => {});
  }, []);

  const update = async (patch: any) => {
    try {
      const { data } = await api.patch('/pulsar-gpt/settings', patch);
      setSettings(data.settings);
      toast.success(tx('Сохранено', 'Saved'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? tx('Ошибка', 'Error'));
    }
  };

  if (!models || !settings) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-gray-500" /></div>;
  }

  return (
    <div className="space-y-4">
      {adminBalance !== null && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          <span className="text-amber-300 font-bold">⚙ Admin:</span>{' '}
          <span className="text-gray-300">KIE balance: <span className="tabular-nums font-mono">{adminBalance}</span> credits</span>
        </div>
      )}

      <ModelPicker
        label={tx('Модель чата', 'Chat model')}
        current={settings.chatModel}
        options={models.chat.map((m: any) => ({ id: m.id, hint: `${m.usdPer1MIn}/${m.usdPer1MOut} $/1M tok` }))}
        onPick={(id) => update({ chatModel: id })}
      />
      <ModelPicker
        label={tx('Модель картинок', 'Image model')}
        current={settings.imageModel}
        options={models.image.map((m: any) => ({ id: m.id, hint: `~${m.plsEstimate} PLS` }))}
        onPick={(id) => update({ imageModel: id })}
      />
      <ModelPicker
        label={tx('Модель оживления', 'Animate model')}
        current={settings.animateModel}
        options={models.animate.map((m: any) => ({ id: m.id, hint: `~${m.plsEstimate} PLS` }))}
        onPick={(id) => update({ animateModel: id })}
      />
      <ModelPicker
        label={tx('Модель видео', 'Video model')}
        current={settings.videoModel}
        options={models.video.map((m: any) => ({ id: m.id, hint: `~${m.plsEstimate} PLS` }))}
        onPick={(id) => update({ videoModel: id })}
      />
    </div>
  );
}

function ModelPicker({
  label, current, options, onPick,
}: { label: string; current: string; options: { id: string; hint: string }[]; onPick: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-dark-500 bg-dark-700/40 p-3">
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      <div className="space-y-1">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              current === o.id ? 'bg-primary-500/20 text-primary-200 border border-primary-500/30' : 'hover:bg-dark-600 text-gray-300'
            }`}
          >
            <span className="font-mono truncate">{o.id}</span>
            <span className="text-gray-500 shrink-0">{o.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
