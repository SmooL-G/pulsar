import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Music, Mic, Wand2, Sparkles, Clock, CreditCard, Gift } from 'lucide-react';

export function MusicBotInstructionsPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-dark-900 text-gray-200" style={{ height: '100dvh', overflowY: 'auto' }}>
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(168,85,247,0.08) 0%, transparent 60%)',
      }} />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-8 pt-3-safe pb-safe py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={15} />
            Назад
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500/15 border border-primary-500/30 text-primary-400 hover:bg-primary-500/25 text-xs font-medium transition-colors"
          >
            <Home size={12} />
            Pulsar
          </button>
        </div>

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 mb-4">
            <Music size={32} className="text-purple-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Инструкция: <span className="text-purple-400">@music_pls</span>
          </h1>
          <p className="text-gray-400 text-base max-w-xl mx-auto">
            Создавайте уникальные песни и инструменталы с помощью искусственного интеллекта прямо в Pulsar.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-12">
          {[
            {
              icon: <Music size={20} />, color: 'purple',
              title: 'Шаг 1. Откройте бота',
              desc: 'Найдите в поиске @music_pls и нажмите /start. Бот покажет главное меню.',
            },
            {
              icon: <Wand2 size={20} />, color: 'pink',
              title: 'Шаг 2. Выберите формат',
              desc: '«🎵 Создать песню» — с вокалом и текстом. «🎼 Инструментал» — без вокала. «🎉 По событию» — готовые шаблоны (свадьба, день рождения и др.)',
            },
            {
              icon: <Sparkles size={20} />, color: 'blue',
              title: 'Шаг 3. Жанр и голос',
              desc: '14 жанров: Pop, Rock, Jazz, Classical, Electronic, Hip-Hop, Country и др. Голос: мужской, женский или любой.',
            },
            {
              icon: <Mic size={20} />, color: 'emerald',
              title: 'Шаг 4. Опишите песню',
              desc: 'Например: «про любовь к собаке Боне, лирично и весело». Чем точнее описание — тем лучше результат. Текст генерируется бесплатно (Claude AI).',
            },
            {
              icon: <Clock size={20} />, color: 'amber',
              title: 'Шаг 5. Подтверждение',
              desc: 'Получите текст. Если не нравится — «🔄 Другой текст». Если ок — «✅ Создать музыку». Списывается 1 токен.',
            },
            {
              icon: <Music size={20} />, color: 'green',
              title: 'Шаг 6. Получите трек',
              desc: 'Через 3-5 минут придёт MP3 с встроенным плеером. Можно прослушать в чате или скачать.',
            },
          ].map((step, i) => (
            <div
              key={i}
              className={`flex gap-4 p-5 rounded-2xl bg-gradient-to-br from-${step.color}-500/5 to-transparent border border-${step.color}-500/20`}
            >
              <div className={`shrink-0 w-12 h-12 rounded-xl bg-${step.color}-500/20 border border-${step.color}-500/30 flex items-center justify-center text-${step.color}-400`}>
                {step.icon}
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={20} className="text-amber-400" />
            <h2 className="text-xl font-bold text-white">Цены и токены</h2>
          </div>
          <p className="text-sm text-gray-300 mb-4">
            <strong>1 токен = 1 готовая песня = 450₽.</strong> Текст и предпросмотр всегда бесплатны.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {[
              { qty: 1, price: 450 },
              { qty: 2, price: 900 },
              { qty: 3, price: 1350 },
              { qty: 4, price: 1800 },
              { qty: 5, price: 2250 },
              { qty: 10, price: 3600, badge: '-20%' },
            ].map((p) => (
              <div key={p.qty} className={`p-3 rounded-xl border ${
                p.badge ? 'bg-amber-500/15 border-amber-500/40' : 'bg-white/5 border-white/10'
              }`}>
                <p className="text-white font-semibold">{p.qty} 🎵</p>
                <p className="text-xs text-gray-400">{p.price}₽{p.badge && ` ${p.badge}`}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-4">Оплата через YooKassa: банковская карта, СБП. После оплаты токены приходят моментально (нажмите «✅ Я оплатил» в боте).</p>
        </div>

        {/* Promo */}
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Gift size={20} className="text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Промо-коды</h2>
          </div>
          <p className="text-sm text-gray-300 mb-2">
            В боте нажмите кнопку <strong>«🎁 Промо-код»</strong> и введите код. Если код активный — токены начислятся моментально.
          </p>
          <p className="text-xs text-gray-500">Промо-коды публикуем в нашем канале и партнёрских аккаунтах.</p>
        </div>

        {/* FAQ */}
        <div className="space-y-3 mb-12">
          <h2 className="text-xl font-bold text-white mb-4">Частые вопросы</h2>
          {[
            {
              q: 'Сколько идёт генерация?',
              a: 'Текст — 5–15 секунд. Музыка — обычно 2–4 минуты, изредка до 10. Бот пришлёт MP3 как только трек будет готов.',
            },
            {
              q: 'Что если бот завис или обновился?',
              a: 'Бот сохраняет позицию очереди. После короткого рестарта (< 5 мин) ничего не теряется. После долгого — пришлёт уведомление и попросит нажать /start заново.',
            },
            {
              q: 'Песня не понравилась — деньги вернут?',
              a: 'AI-генерация недетерминированная: каждый раз результат разный. Возврата нет, но можно сразу сделать ещё одну попытку с другим описанием. За одну плату приходит обычно 2 трека на выбор.',
            },
            {
              q: 'Можно использовать треки в коммерческих целях?',
              a: 'Можно для личного использования и публикаций в соцсетях. Для коммерческого распространения уточняйте — связь через legal@pulsar-chat.fun.',
            },
          ].map((f, i) => (
            <details key={i} className="group rounded-xl bg-white/5 border border-white/10 overflow-hidden">
              <summary className="cursor-pointer p-4 font-medium text-white flex items-center justify-between hover:bg-white/5">
                {f.q}
                <span className="text-gray-500 group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <div className="px-4 pb-4 text-sm text-gray-400 leading-relaxed">{f.a}</div>
            </details>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-600 pb-8">
          <p>Поддержка: <a href="mailto:support@pulsar-chat.fun" className="text-purple-400 hover:underline">support@pulsar-chat.fun</a></p>
          <p className="mt-1">
            <a href="/bots/music/privacy" className="text-purple-400 hover:underline">Политика конфиденциальности</a>
          </p>
        </div>
      </div>
    </div>
  );
}
