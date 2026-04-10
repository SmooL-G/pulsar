import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Send, Webhook, Shield, Keyboard, MessageSquare, Users, Trash2, Copy, Check } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';

function generateStars(count: number) {
  const stars: { x: number; y: number; size: number; delay: number; opacity: number }[] = [];
  let seed = 77;
  for (let i = 0; i < count; i++) {
    seed = (seed * 16807 + 5) % 2147483647;
    const x = (seed % 1000) / 10;
    seed = (seed * 16807 + 5) % 2147483647;
    const y = (seed % 1000) / 10;
    seed = (seed * 16807 + 5) % 2147483647;
    const size = 1 + (seed % 3);
    seed = (seed * 16807 + 5) % 2147483647;
    const delay = (seed % 5000) / 1000;
    seed = (seed * 16807 + 5) % 2147483647;
    const opacity = 0.2 + (seed % 60) / 100;
    stars.push({ x, y, size, delay, opacity });
  }
  return stars;
}

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-black/40 border border-white/10 rounded-xl p-4 text-xs leading-relaxed overflow-x-auto font-mono text-gray-300">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/5 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}

function Section({ icon, title, id, children }: { icon: React.ReactNode; title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary-500/15 flex items-center justify-center text-primary-400 shrink-0">{icon}</div>
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <div className="space-y-4 text-sm text-gray-300 leading-relaxed">{children}</div>
    </section>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const color = method === 'GET' ? 'text-green-400 bg-green-500/15' : 'text-blue-400 bg-blue-500/15';
  return (
    <div className="flex items-start gap-3 py-2">
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${color} shrink-0 mt-0.5`}>{method}</span>
      <div>
        <code className="text-xs font-mono text-white">{path}</code>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

const NAV = [
  { id: 'start', label: 'Начало работы' },
  { id: 'auth', label: 'Авторизация' },
  { id: 'messages', label: 'Сообщения' },
  { id: 'buttons', label: 'Inline-кнопки' },
  { id: 'updates', label: 'Получение обновлений' },
  { id: 'webhook', label: 'Вебхуки' },
  { id: 'moderation', label: 'Модерация' },
  { id: 'commands', label: 'Команды' },
  { id: 'endpoints', label: 'Все эндпоинты' },
  { id: 'examples', label: 'Примеры' },
];

export function DevelopersPage() {
  const navigate = useNavigate();
  const stars = useMemo(() => generateStars(80), []);
  const [activeSection, setActiveSection] = useState('start');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveSection(e.target.id);
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );
    for (const { id } of NAV) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const BASE_URL = window.location.origin + '/api/v1';

  return (
    <div className="min-h-screen bg-dark-800 text-white relative overflow-x-hidden">
      {/* Stars */}
      <div className="fixed inset-0 pointer-events-none">
        {stars.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white animate-pulse"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, opacity: s.opacity, animationDelay: `${s.delay}s`, animationDuration: '3s' }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-dark-800/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Bot size={22} className="text-primary-400" />
            <h1 className="text-lg font-bold">Pulsar Bot API</h1>
          </div>
          <span className="text-xs bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded-full font-medium">v1</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 flex gap-8 relative">
        {/* Sidebar nav */}
        <nav className="hidden lg:block w-48 shrink-0 sticky top-24 self-start">
          <div className="space-y-1">
            {NAV.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className={`block text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  activeSection === id ? 'bg-primary-500/15 text-primary-400 font-medium' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        {/* Content */}
        <main className="flex-1 min-w-0 space-y-12">

          <Section icon={<Bot size={18} />} title="Начало работы" id="start">
            <p>Pulsar Bot API позволяет создавать ботов, которые могут отправлять сообщения, модерировать группы и взаимодействовать с пользователями через inline-кнопки.</p>

            <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-primary-400 mb-2">Быстрый старт</p>
              <ol className="text-xs text-gray-300 space-y-1.5 list-decimal list-inside">
                <li>Найдите <code className="text-primary-400">@pulsarbot</code> в поиске и откройте DM</li>
                <li>Напишите <code className="text-primary-400">/newbot</code> и следуйте инструкциям</li>
                <li>Сохраните полученный токен — он понадобится для всех запросов</li>
                <li>Добавьте бота в группу через панель участников</li>
              </ol>
            </div>

            <p>Base URL для всех запросов:</p>
            <CodeBlock code={`${BASE_URL}/bot/`} />
          </Section>

          <Section icon={<Shield size={18} />} title="Авторизация" id="auth">
            <p>Все запросы к Bot API требуют токен в заголовке <code className="text-primary-400">Authorization</code>:</p>
            <CodeBlock code={`Authorization: Bot <ваш_токен>`} />

            <p>Токен выглядит так: <code className="text-gray-400">a1b2c3d4:AbCdEfGhIjKlMnOpQrStUvWx</code></p>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
              <p className="text-xs text-yellow-400">Никогда не передавайте токен третьим лицам и не публикуйте в коде. Если токен скомпрометирован — перевыпустите его через <code>/token @username</code> в чате с @pulsarbot.</p>
            </div>
          </Section>

          <Section icon={<Send size={18} />} title="Отправка сообщений" id="messages">
            <p>Отправить текстовое сообщение:</p>
            <CodeBlock language="bash" code={`curl -X POST ${BASE_URL}/bot/sendMessage \\
  -H "Authorization: Bot <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "chatId": "uuid-чата",
    "text": "Привет от бота!",
    "replyToId": null
  }'`} />

            <p><strong>Параметры:</strong></p>
            <div className="bg-white/5 rounded-xl p-4 space-y-2">
              <div className="flex gap-3 text-xs"><code className="text-primary-400 w-24 shrink-0">chatId</code><span className="text-gray-400">string — ID чата (обязательный)</span></div>
              <div className="flex gap-3 text-xs"><code className="text-primary-400 w-24 shrink-0">text</code><span className="text-gray-400">string — текст сообщения (обязательный)</span></div>
              <div className="flex gap-3 text-xs"><code className="text-primary-400 w-24 shrink-0">replyToId</code><span className="text-gray-400">string? — ID сообщения для ответа</span></div>
              <div className="flex gap-3 text-xs"><code className="text-primary-400 w-24 shrink-0">buttons</code><span className="text-gray-400">Button[][]? — inline-кнопки (см. ниже)</span></div>
            </div>
          </Section>

          <Section icon={<Keyboard size={18} />} title="Inline-кнопки" id="buttons">
            <p>Добавьте интерактивные кнопки к сообщению. Кнопки организованы в ряды (массив массивов):</p>
            <CodeBlock code={`curl -X POST ${BASE_URL}/bot/sendMessage \\
  -H "Authorization: Bot <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "chatId": "uuid-чата",
    "text": "Выберите действие:",
    "buttons": [
      [
        {"text": "Да", "callbackData": "vote_yes"},
        {"text": "Нет", "callbackData": "vote_no"}
      ],
      [
        {"text": "Подробнее", "callbackData": "info"}
      ]
    ]
  }'`} />

            <p>Когда пользователь нажимает кнопку, бот получает <code className="text-primary-400">callback_query</code> update:</p>
            <CodeBlock language="json" code={`{
  "type": "callback_query",
  "callbackQuery": {
    "id": "msg123:1712345678",
    "from": { "id": "user-uuid" },
    "message": { "id": "msg-uuid", "chatId": "chat-uuid" },
    "data": "vote_yes"
  }
}`} />
          </Section>

          <Section icon={<MessageSquare size={18} />} title="Получение обновлений" id="updates">
            <p>Long-polling — простой способ получать обновления. Запрос блокируется до появления новых событий или истечения таймаута:</p>
            <CodeBlock code={`curl "${BASE_URL}/bot/updates?offset=0&timeout=30&limit=100" \\
  -H "Authorization: Bot <token>"`} />

            <p><strong>Параметры:</strong></p>
            <div className="bg-white/5 rounded-xl p-4 space-y-2">
              <div className="flex gap-3 text-xs"><code className="text-primary-400 w-24 shrink-0">offset</code><span className="text-gray-400">number — ID последнего обработанного update + 1</span></div>
              <div className="flex gap-3 text-xs"><code className="text-primary-400 w-24 shrink-0">timeout</code><span className="text-gray-400">number — время ожидания в секундах (макс. 60)</span></div>
              <div className="flex gap-3 text-xs"><code className="text-primary-400 w-24 shrink-0">limit</code><span className="text-gray-400">number — максимум обновлений (макс. 100)</span></div>
            </div>

            <p><strong>Типы обновлений:</strong></p>
            <div className="bg-white/5 rounded-xl p-4 space-y-2">
              <div className="flex gap-3 text-xs"><code className="text-green-400 w-32 shrink-0">message</code><span className="text-gray-400">Новое сообщение в чате бота</span></div>
              <div className="flex gap-3 text-xs"><code className="text-green-400 w-32 shrink-0">command</code><span className="text-gray-400">Сообщение начинающееся с /</span></div>
              <div className="flex gap-3 text-xs"><code className="text-green-400 w-32 shrink-0">callback_query</code><span className="text-gray-400">Нажатие inline-кнопки</span></div>
            </div>

            <CodeBlock language="json" code={`// Пример ответа
{
  "ok": true,
  "result": [
    {
      "id": "42",
      "botId": "uuid",
      "type": "message",
      "payload": {
        "type": "message",
        "message": {
          "id": "msg-uuid",
          "chatId": "chat-uuid",
          "from": { "id": "user-uuid", "username": "john", "displayName": "John" },
          "text": "/start",
          "date": "2026-04-09T12:00:00.000Z",
          "replyToId": null
        }
      }
    }
  ]
}`} />
          </Section>

          <Section icon={<Webhook size={18} />} title="Вебхуки" id="webhook">
            <p>Альтернатива long-polling — настройте вебхук, и Pulsar будет POST'ить обновления на ваш сервер:</p>
            <CodeBlock code={`curl -X POST ${BASE_URL}/bot/setWebhook \\
  -H "Authorization: Bot <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-server.com/webhook",
    "secret": "my_secret_key"
  }'`} />

            <p><strong>Заголовки запроса к вашему серверу:</strong></p>
            <div className="bg-white/5 rounded-xl p-4 space-y-2">
              <div className="flex gap-3 text-xs"><code className="text-primary-400 shrink-0">Content-Type</code><span className="text-gray-400">application/json</span></div>
              <div className="flex gap-3 text-xs"><code className="text-primary-400 shrink-0">X-Pulsar-Bot-Id</code><span className="text-gray-400">ID вашего бота</span></div>
              <div className="flex gap-3 text-xs"><code className="text-primary-400 shrink-0">X-Pulsar-Signature</code><span className="text-gray-400">sha256=HMAC подпись (если задан secret)</span></div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-xs text-gray-400">Pulsar повторяет неудачную доставку до 4 раз с exponential backoff (10с → 30с → 90с → 270с). URL должен быть HTTPS.</p>
            </div>

            <p>Чтобы удалить вебхук:</p>
            <CodeBlock code={`curl -X POST ${BASE_URL}/bot/setWebhook \\
  -H "Authorization: Bot <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"url": null}'`} />
          </Section>

          <Section icon={<Shield size={18} />} title="Модерация" id="moderation">
            <p>Боты с ролью <code className="text-primary-400">MODERATOR</code> и выше могут модерировать чат:</p>

            <p><strong>Удалить сообщение:</strong></p>
            <CodeBlock code={`curl -X POST ${BASE_URL}/bot/deleteMessage \\
  -H "Authorization: Bot <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"chatId": "...", "messageId": "..."}'`} />

            <p><strong>Кикнуть пользователя:</strong></p>
            <CodeBlock code={`curl -X POST ${BASE_URL}/bot/kickMember \\
  -H "Authorization: Bot <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"chatId": "...", "userId": "..."}'`} />

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-xs text-gray-400">Бот может модерировать только участников с ролью ниже своей. Чтобы дать боту права модератора, измените его роль в панели участников группы.</p>
            </div>
          </Section>

          <Section icon={<Bot size={18} />} title="Команды бота" id="commands">
            <p>Зарегистрируйте команды, и пользователи увидят их в меню бота:</p>
            <CodeBlock code={`curl -X POST ${BASE_URL}/bot/setCommands \\
  -H "Authorization: Bot <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "commands": [
      {"command": "start", "description": "Запустить бота"},
      {"command": "help", "description": "Показать справку"},
      {"command": "price", "description": "Курс криптовалюты"},
      {"command": "settings", "description": "Настройки"}
    ]
  }'`} />

            <p>Или через @pulsarbot:</p>
            <CodeBlock code={`/setcommands @mybot_pls
/start - Запустить бота
/help - Показать справку`} />
          </Section>

          <Section icon={<MessageSquare size={18} />} title="Все эндпоинты" id="endpoints">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 divide-y divide-white/5">
              <Endpoint method="GET" path="/bot/me" desc="Информация о боте" />
              <Endpoint method="POST" path="/bot/sendMessage" desc="Отправить сообщение (+ inline-кнопки)" />
              <Endpoint method="GET" path="/bot/updates" desc="Long-polling обновлений" />
              <Endpoint method="POST" path="/bot/setWebhook" desc="Установить/удалить вебхук" />
              <Endpoint method="GET" path="/bot/getChats" desc="Список чатов бота" />
              <Endpoint method="POST" path="/bot/setCommands" desc="Установить команды бота" />
              <Endpoint method="POST" path="/bot/leaveChat" desc="Покинуть чат" />
              <Endpoint method="POST" path="/bot/deleteMessage" desc="Удалить сообщение (модерация)" />
              <Endpoint method="POST" path="/bot/kickMember" desc="Кикнуть участника (модерация)" />
              <Endpoint method="POST" path="/bot/answerCallback" desc="Ответить на callback_query" />
            </div>
          </Section>

          <Section icon={<Users size={18} />} title="Примеры" id="examples">
            <p><strong>Python — простой эхо-бот:</strong></p>
            <CodeBlock language="python" code={`import requests, time

TOKEN = "ваш_токен"
BASE = "${BASE_URL}/bot"
HEADERS = {"Authorization": f"Bot {TOKEN}", "Content-Type": "application/json"}

offset = 0
while True:
    r = requests.get(f"{BASE}/updates", headers=HEADERS,
                     params={"offset": offset, "timeout": 30})
    updates = r.json().get("result", [])

    for u in updates:
        offset = int(u["id"]) + 1
        msg = u.get("payload", {}).get("message")
        if not msg or not msg.get("text"):
            continue

        # Эхо: отправляем текст обратно
        requests.post(f"{BASE}/sendMessage", headers=HEADERS, json={
            "chatId": msg["chatId"],
            "text": f"Вы сказали: {msg['text']}",
            "replyToId": msg["id"]
        })`} />

            <p><strong>Node.js — бот с inline-кнопками:</strong></p>
            <CodeBlock language="javascript" code={`const TOKEN = "ваш_токен";
const BASE = "${BASE_URL}/bot";
const headers = { Authorization: \`Bot \${TOKEN}\`, "Content-Type": "application/json" };

let offset = 0;

async function poll() {
  while (true) {
    const res = await fetch(\`\${BASE}/updates?offset=\${offset}&timeout=30\`, { headers });
    const { result = [] } = await res.json();

    for (const u of result) {
      offset = Number(u.id) + 1;

      if (u.payload.type === "message" && u.payload.message?.text === "/start") {
        await fetch(\`\${BASE}/sendMessage\`, {
          method: "POST", headers,
          body: JSON.stringify({
            chatId: u.payload.message.chatId,
            text: "Привет! Выберите действие:",
            buttons: [
              [{ text: "Курсы", callbackData: "prices" }, { text: "Помощь", callbackData: "help" }]
            ]
          })
        });
      }

      if (u.payload.type === "callback_query") {
        const data = u.payload.callbackQuery.data;
        const chatId = u.payload.callbackQuery.message.chatId;
        await fetch(\`\${BASE}/sendMessage\`, {
          method: "POST", headers,
          body: JSON.stringify({ chatId, text: \`Вы нажали: \${data}\` })
        });
      }
    }
  }
}

poll();`} />
          </Section>

        </main>
      </div>
    </div>
  );
}
