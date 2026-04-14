import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Send, Webhook, Shield, Keyboard, MessageSquare, Users, Trash2, Copy, Check, Code, BookOpen, Zap, Globe, Terminal, Lock } from 'lucide-react';
import { useState } from 'react';

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
        <span className="text-[10px] text-gray-500 uppercase font-mono bg-dark-800/80 px-2 py-0.5 rounded">{language}</span>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md bg-dark-800/80 hover:bg-dark-700 text-gray-400 hover:text-white transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <pre className="bg-dark-900 border border-dark-600 rounded-xl p-4 pt-8 text-xs overflow-x-auto text-gray-300 font-mono leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

function Section({ id, icon: Icon, title, children }: { id: string; icon: any; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
        <Icon size={22} className="text-primary-400" />
        {title}
      </h2>
      <div className="space-y-4 text-gray-300 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-500/20 text-emerald-400',
    POST: 'bg-blue-500/20 text-blue-400',
    PATCH: 'bg-amber-500/20 text-amber-400',
    DELETE: 'bg-red-500/20 text-red-400',
  };
  return (
    <div className="flex items-start gap-3 py-2 border-b border-dark-600/50 last:border-0">
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${colors[method] || 'bg-gray-700'} shrink-0 mt-0.5`}>{method}</span>
      <code className="text-xs text-primary-400 font-mono shrink-0">{path}</code>
      <span className="text-xs text-gray-400">{desc}</span>
    </div>
  );
}

export function DevelopersPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<'js' | 'py' | 'curl'>('js');

  const baseUrl = 'https://pulsar-chat.fun/api/v1';

  return (
    <div className="bg-dark-900 text-white" style={{ height: '100dvh', overflowY: 'auto' }}>
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 20% 0%, rgba(76,110,245,0.08) 0%, transparent 50%)',
      }} />

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-8 pb-16">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700/50 border border-dark-500/30 backdrop-blur-sm text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">Back</span>
        </button>

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-medium mb-4">
            <Code size={12} />
            Developer Documentation
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-3">Pulsar Bot API</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Build powerful bots for Pulsar messenger. REST API + Webhooks + Long Polling.
          </p>
        </div>

        {/* TOC */}
        <div className="bg-dark-800/50 border border-dark-500/30 rounded-2xl p-5 mb-8">
          <p className="text-xs uppercase text-gray-500 font-semibold mb-3">Table of Contents</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['quick-start', '🚀 Quick Start'],
              ['create-bot', '🤖 Create a Bot'],
              ['authentication', '🔑 Authentication'],
              ['receive', '📥 Receiving Updates'],
              ['send', '📤 Sending Messages'],
              ['buttons', '🎛️ Inline Buttons'],
              ['callbacks', '🔔 Callback Queries'],
              ['moderation', '🛡️ Moderation'],
              ['endpoints', '📚 API Reference'],
              ['examples', '💡 Full Examples'],
              ['hosting', '🌐 Where to Host'],
              ['support', '💬 Get Help'],
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`} className="text-gray-300 hover:text-primary-400 transition-colors py-1">
                {label}
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-12">
          {/* QUICK START */}
          <Section id="quick-start" icon={Zap} title="Quick Start">
            <p>Get your first bot running in 5 minutes:</p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Create a bot via <a href="/" className="text-primary-400 hover:underline">PulsarBot</a> or click the Bots button in sidebar</li>
              <li>Copy your API token from bot settings</li>
              <li>Choose: <strong>Long Polling</strong> (easy) or <strong>Webhook</strong> (production)</li>
              <li>Write code that calls Pulsar API to send/receive messages</li>
              <li>Deploy to any Node.js/Python hosting</li>
            </ol>

            <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-4 text-sm">
              <p className="text-primary-300">
                <strong>Base URL:</strong> <code className="bg-dark-800 px-2 py-0.5 rounded">{baseUrl}</code>
              </p>
            </div>
          </Section>

          {/* CREATE BOT */}
          <Section id="create-bot" icon={Bot} title="Create a Bot">
            <p>Two ways to create a bot:</p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-dark-800/50 border border-dark-500/30 rounded-xl p-4">
                <p className="font-semibold text-white mb-2">📱 Via UI</p>
                <ol className="text-xs space-y-1 list-decimal list-inside text-gray-400">
                  <li>Open Pulsar app</li>
                  <li>Click 🤖 Bot icon in sidebar</li>
                  <li>"Create Bot" → enter name</li>
                  <li>Configure avatar, bio, start message</li>
                  <li>Copy API token</li>
                </ol>
              </div>
              <div className="bg-dark-800/50 border border-dark-500/30 rounded-xl p-4">
                <p className="font-semibold text-white mb-2">💬 Via PulsarBot (chat)</p>
                <ol className="text-xs space-y-1 list-decimal list-inside text-gray-400">
                  <li>Open chat with @pulsarbot</li>
                  <li>Send <code className="bg-dark-900 px-1">/newbot</code></li>
                  <li>Enter bot name</li>
                  <li>Save the API token</li>
                </ol>
              </div>
            </div>

            <p className="text-amber-400 text-xs">⚠️ Keep your API token secret. Anyone with the token controls your bot.</p>
          </Section>

          {/* AUTH */}
          <Section id="authentication" icon={Lock} title="Authentication">
            <p>All bot API requests require <code className="bg-dark-900 px-1.5 py-0.5 rounded text-xs">Authorization: Bearer YOUR_TOKEN</code> header.</p>

            <CodeBlock language="curl" code={`curl -X GET "${baseUrl}/bot/me" \\
  -H "Authorization: Bearer YOUR_BOT_TOKEN"`} />
          </Section>

          {/* RECEIVE */}
          <Section id="receive" icon={MessageSquare} title="Receiving Updates">
            <p>Two ways to receive messages from users:</p>

            <div className="bg-dark-800/50 border border-dark-500/30 rounded-xl p-4">
              <p className="font-semibold text-white mb-2 flex items-center gap-2">
                <Terminal size={14} /> 1. Long Polling (easy, for development)
              </p>
              <p className="text-xs text-gray-400 mb-3">Periodically request new messages. No public server needed.</p>
              <CodeBlock language="js" code={`// Node.js — long polling loop
let offset = 0;

setInterval(async () => {
  const res = await fetch('${baseUrl}/bot/updates?offset=' + offset + '&timeout=30', {
    headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
  });
  const { result } = await res.json();

  for (const update of result) {
    console.log('New update:', update);
    offset = update.update_id + 1;
    // Handle update here
  }
}, 1000);`} />
            </div>

            <div className="bg-dark-800/50 border border-dark-500/30 rounded-xl p-4">
              <p className="font-semibold text-white mb-2 flex items-center gap-2">
                <Webhook size={14} /> 2. Webhook (instant, for production)
              </p>
              <p className="text-xs text-gray-400 mb-3">Pulsar sends POST requests to your URL when events happen.</p>
              <CodeBlock language="js" code={`// Set webhook
await fetch('${baseUrl}/bot/setWebhook', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_TOKEN', 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://yourbot.example.com/webhook' })
});

// Receive in your Express server
app.post('/webhook', (req, res) => {
  const update = req.body;
  console.log('Got update:', update);
  res.json({ ok: true });
});`} />
            </div>
          </Section>

          {/* SEND */}
          <Section id="send" icon={Send} title="Sending Messages">
            <CodeBlock language="js" code={`await fetch('${baseUrl}/bot/sendMessage', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    chatId: '<chat-uuid>',
    text: 'Hello from my bot!'
  })
});`} />
          </Section>

          {/* BUTTONS */}
          <Section id="buttons" icon={Keyboard} title="Inline Buttons">
            <p>Send messages with clickable buttons. Each button has text and callback data.</p>

            <CodeBlock language="js" code={`await fetch('${baseUrl}/bot/sendMessage', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_TOKEN', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chatId: '<chat-uuid>',
    text: 'Choose an option:',
    buttons: [
      [
        { text: '✅ Yes', callbackData: 'choice:yes' },
        { text: '❌ No', callbackData: 'choice:no' }
      ],
      [
        { text: 'ℹ️ More info', callbackData: 'info' }
      ]
    ]
  })
});`} />
          </Section>

          {/* CALLBACKS */}
          <Section id="callbacks" icon={Zap} title="Callback Queries">
            <p>When user clicks an inline button, you receive a <code className="bg-dark-900 px-1.5 py-0.5 rounded text-xs">callback_query</code> update:</p>

            <CodeBlock language="json" code={`{
  "update_id": 12345,
  "callback_query": {
    "id": "abc-123",
    "from": { "id": "user-uuid" },
    "message": { "id": "msg-uuid", "chat": { "id": "chat-uuid" } },
    "data": "choice:yes"
  }
}`} />

            <p>Acknowledge the click:</p>
            <CodeBlock language="js" code={`await fetch('${baseUrl}/bot/answerCallback', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_TOKEN', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    callbackQueryId: update.callback_query.id,
    text: 'Thanks for your answer!'
  })
});`} />
          </Section>

          {/* MODERATION */}
          <Section id="moderation" icon={Shield} title="Moderation Actions">
            <p>If your bot is admin in a group, it can moderate:</p>

            <CodeBlock language="js" code={`// Delete a message
await fetch('${baseUrl}/bot/deleteMessage', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_TOKEN', 'Content-Type': 'application/json' },
  body: JSON.stringify({ messageId: '<message-uuid>' })
});

// Kick a member
await fetch('${baseUrl}/bot/kickMember', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR_TOKEN', 'Content-Type': 'application/json' },
  body: JSON.stringify({ chatId: '<chat-uuid>', userId: '<user-uuid>' })
});`} />
          </Section>

          {/* API REFERENCE */}
          <Section id="endpoints" icon={BookOpen} title="API Reference">
            <p>Complete list of bot API endpoints. All require <code className="bg-dark-900 px-1.5 py-0.5 rounded text-xs">Authorization: Bearer TOKEN</code>.</p>

            <div className="bg-dark-800/50 border border-dark-500/30 rounded-xl p-4">
              <p className="font-semibold text-white mb-2">Bot Identity</p>
              <Endpoint method="GET" path="/bot/me" desc="Get bot info (id, username, displayName)" />
            </div>

            <div className="bg-dark-800/50 border border-dark-500/30 rounded-xl p-4">
              <p className="font-semibold text-white mb-2">Messages</p>
              <Endpoint method="POST" path="/bot/sendMessage" desc="Send text/buttons to chat" />
              <Endpoint method="POST" path="/bot/deleteMessage" desc="Delete a message" />
              <Endpoint method="POST" path="/bot/answerCallback" desc="Reply to button click" />
            </div>

            <div className="bg-dark-800/50 border border-dark-500/30 rounded-xl p-4">
              <p className="font-semibold text-white mb-2">Updates</p>
              <Endpoint method="GET" path="/bot/updates" desc="Long polling — get new updates" />
              <Endpoint method="POST" path="/bot/setWebhook" desc="Configure webhook URL" />
            </div>

            <div className="bg-dark-800/50 border border-dark-500/30 rounded-xl p-4">
              <p className="font-semibold text-white mb-2">Chats</p>
              <Endpoint method="GET" path="/bot/getChats" desc="List bot's chats" />
              <Endpoint method="POST" path="/bot/leaveChat" desc="Bot leaves a chat" />
              <Endpoint method="POST" path="/bot/kickMember" desc="Kick user (requires admin)" />
            </div>

            <div className="bg-dark-800/50 border border-dark-500/30 rounded-xl p-4">
              <p className="font-semibold text-white mb-2">Configuration</p>
              <Endpoint method="POST" path="/bot/setCommands" desc="Set bot commands menu" />
            </div>
          </Section>

          {/* EXAMPLES */}
          <Section id="examples" icon={Code} title="Full Examples">
            <p>Complete working bot in different languages:</p>

            <div className="flex gap-2 mb-3">
              {(['js', 'py', 'curl'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    lang === l ? 'bg-primary-500 text-white' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'
                  }`}
                >
                  {l === 'js' ? 'Node.js' : l === 'py' ? 'Python' : 'cURL'}
                </button>
              ))}
            </div>

            {lang === 'js' && (
              <CodeBlock language="js" code={`// Echo Bot — Node.js + long polling
const TOKEN = 'YOUR_BOT_TOKEN';
const API = '${baseUrl}/bot';

let offset = 0;

async function poll() {
  try {
    const res = await fetch(\`\${API}/updates?offset=\${offset}&timeout=30\`, {
      headers: { 'Authorization': \`Bearer \${TOKEN}\` }
    });
    const { result } = await res.json();

    for (const update of result || []) {
      offset = update.update_id + 1;

      if (update.message?.text) {
        await sendMessage(update.message.chat.id, \`Echo: \${update.message.text}\`);
      }
    }
  } catch (err) {
    console.error(err);
  }
  setTimeout(poll, 1000);
}

async function sendMessage(chatId, text) {
  return fetch(\`\${API}/sendMessage\`, {
    method: 'POST',
    headers: { 'Authorization': \`Bearer \${TOKEN}\`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, text })
  });
}

poll();`} />
            )}

            {lang === 'py' && (
              <CodeBlock language="py" code={`# Echo Bot — Python + long polling
import requests
import time

TOKEN = 'YOUR_BOT_TOKEN'
API = '${baseUrl}/bot'
HEADERS = {'Authorization': f'Bearer {TOKEN}'}

offset = 0

while True:
    try:
        r = requests.get(f'{API}/updates', params={'offset': offset, 'timeout': 30}, headers=HEADERS)
        for update in r.json().get('result', []):
            offset = update['update_id'] + 1
            msg = update.get('message')
            if msg and msg.get('text'):
                requests.post(f'{API}/sendMessage', json={
                    'chatId': msg['chat']['id'],
                    'text': f"Echo: {msg['text']}"
                }, headers=HEADERS)
    except Exception as e:
        print(e)
        time.sleep(5)`} />
            )}

            {lang === 'curl' && (
              <CodeBlock language="bash" code={`# Get bot info
curl "${baseUrl}/bot/me" \\
  -H "Authorization: Bearer YOUR_TOKEN"

# Send a message
curl -X POST "${baseUrl}/bot/sendMessage" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"chatId":"chat-uuid","text":"Hello!"}'

# Get updates (long poll)
curl "${baseUrl}/bot/updates?offset=0&timeout=30" \\
  -H "Authorization: Bearer YOUR_TOKEN"

# Set webhook
curl -X POST "${baseUrl}/bot/setWebhook" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://yourbot.com/webhook"}'`} />
            )}
          </Section>

          {/* HOSTING */}
          <Section id="hosting" icon={Globe} title="Where to Host Your Bot">
            <p>Free or cheap hosting options:</p>

            <div className="grid md:grid-cols-2 gap-3">
              {[
                { name: 'Vercel / Netlify', desc: 'Serverless functions for webhook bots. Free tier.', tier: 'Free' },
                { name: 'Railway / Render', desc: 'Full Node.js apps. Free tier with sleep.', tier: 'Free' },
                { name: 'Cloudflare Workers', desc: 'Fast serverless. 100K requests/day free.', tier: 'Free' },
                { name: 'GitHub Actions', desc: 'For cron-bots that run on schedule.', tier: 'Free' },
                { name: 'Replit', desc: 'Code in browser. Always-on with paid tier.', tier: 'Free/Paid' },
                { name: 'Hetzner / Timeweb VPS', desc: 'Full server. From €4/mo or 200₽/mo.', tier: 'Paid' },
              ].map((h) => (
                <div key={h.name} className="bg-dark-800/50 border border-dark-500/30 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-white text-sm">{h.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${h.tier === 'Free' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {h.tier}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{h.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* SUPPORT */}
          <Section id="support" icon={MessageSquare} title="Get Help">
            <div className="bg-gradient-to-br from-primary-500/10 to-primary-700/5 border border-primary-500/30 rounded-2xl p-6 text-center">
              <Bot size={40} className="mx-auto mb-3 text-primary-400" />
              <h3 className="text-xl font-bold text-white mb-2">Need Help?</h3>
              <p className="text-sm text-gray-400 mb-4">
                Chat with @pulsarbot for bot management commands, or join our community.
              </p>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
              >
                Open Pulsar
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
