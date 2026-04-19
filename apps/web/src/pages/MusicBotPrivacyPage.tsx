import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Shield } from 'lucide-react';

export function MusicBotPrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-dark-900 text-gray-200" style={{ height: '100dvh', overflowY: 'auto' }}>
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-8 pt-3-safe pb-safe py-8">
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

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500/15 border border-primary-500/30 mb-4">
            <Shield size={32} className="text-primary-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Политика конфиденциальности</h1>
          <p className="text-sm text-gray-500">
            Бот <span className="text-primary-400">@music_pls</span> · обновлено 19.04.2026
          </p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Кто мы</h2>
            <p className="text-gray-400">
              «Pulsar Music Bot» (далее — Бот) — сервис генерации музыки в мессенджере Pulsar (pulsar-chat.fun).
              Оператор: команда Pulsar. Контакт: <a href="mailto:legal@pulsar-chat.fun" className="text-primary-400 hover:underline">legal@pulsar-chat.fun</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Какие данные мы собираем</h2>
            <ul className="list-disc list-inside text-gray-400 space-y-1">
              <li>Идентификатор вашего пользователя в Pulsar (UUID) — для учёта баланса токенов и истории генераций</li>
              <li>Идентификатор чата с Ботом — чтобы доставлять сообщения</li>
              <li>Текст вашего описания песни и сгенерированный текст — обрабатываются нейросетями (Claude, Suno) и хранятся локально на нашем сервере для предотвращения повторной оплаты</li>
              <li>История платежей через YooKassa (ID транзакции, сумма, статус) — требуется по 54-ФЗ</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Как мы используем данные</h2>
            <ul className="list-disc list-inside text-gray-400 space-y-1">
              <li>Создание песен по вашему запросу</li>
              <li>Учёт баланса токенов и обработка покупок</li>
              <li>Доставка готовых треков и системных сообщений</li>
              <li>Анализ ошибок и улучшение качества (агрегированно, без идентификации)</li>
            </ul>
            <p className="text-gray-400 mt-2">
              Мы <strong>не продаём</strong> ваши данные третьим лицам и не используем их для рекламы.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Передача данных третьим лицам</h2>
            <ul className="list-disc list-inside text-gray-400 space-y-1">
              <li><strong>Anthropic (Claude API)</strong> — отправляется ваш промпт и жанровый шаблон для генерации текста песни. Anthropic не сохраняет данные дольше 30 дней (по их политике).</li>
              <li><strong>KIE.AI / Suno</strong> — отправляется текст песни и жанровый стиль для генерации аудио. Хранение определяется политикой KIE.AI.</li>
              <li><strong>YooKassa (ООО «НКО ЮМани»)</strong> — обработка платежей. Передаём только сумму и описание заказа.</li>
              <li><strong>Cloudflare R2</strong> — хранение MP3 файлов треков (до 30 дней).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Сроки хранения</h2>
            <ul className="list-disc list-inside text-gray-400 space-y-1">
              <li>Баланс токенов и история заказов — пока существует ваш аккаунт</li>
              <li>Готовые MP3 треки — 30 дней с момента генерации</li>
              <li>Тексты генераций — храним для предотвращения дублирования, удаляем по запросу</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Ваши права</h2>
            <p className="text-gray-400">Вы вправе:</p>
            <ul className="list-disc list-inside text-gray-400 space-y-1">
              <li>Запросить копию ваших данных</li>
              <li>Запросить удаление ваших данных (кроме обязательных по 54-ФЗ)</li>
              <li>Отозвать согласие на обработку</li>
              <li>Подать жалобу в Роскомнадзор</li>
            </ul>
            <p className="text-gray-400 mt-2">
              Для реализации прав напишите на <a href="mailto:privacy@pulsar-chat.fun" className="text-primary-400 hover:underline">privacy@pulsar-chat.fun</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">7. Авторские права на сгенерированные треки</h2>
            <p className="text-gray-400">
              Сгенерированные песни могут быть использованы вами для личных целей и публикаций в соцсетях.
              Для коммерческого использования ознакомьтесь с условиями Suno (provider): <a href="https://suno.com/terms" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">suno.com/terms</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">8. Изменения политики</h2>
            <p className="text-gray-400">
              Мы можем обновлять эту политику. Существенные изменения уведомляем рассылкой через Бота. Дата последнего обновления указана в начале страницы.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">9. Контакты</h2>
            <p className="text-gray-400">
              По всем вопросам конфиденциальности и защиты данных:<br />
              📧 <a href="mailto:privacy@pulsar-chat.fun" className="text-primary-400 hover:underline">privacy@pulsar-chat.fun</a><br />
              💬 В Pulsar: <span className="text-primary-400">@SmooL-G</span>
            </p>
          </section>
        </div>

        <div className="text-center text-xs text-gray-600 mt-12 pb-8">
          <p>
            <a href="/bots/music/instructions" className="text-purple-400 hover:underline">← Инструкция по использованию</a>
          </p>
        </div>
      </div>
    </div>
  );
}
