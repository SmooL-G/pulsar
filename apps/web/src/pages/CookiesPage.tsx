import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';

export function CookiesPage() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();

  return (
    <div className="bg-dark-800 text-gray-200" style={{ height: '100dvh', overflowY: 'auto' }}>
      <div className="max-w-3xl mx-auto px-4 pt-3-safe pb-safe py-8">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/info')}
            className="p-2 rounded-lg hover:bg-dark-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('legal.cookiesTitle')}</h1>
            <p className="text-sm text-gray-400">{t('privacy.lastUpdated')}: 04.04.2026</p>
          </div>
        </div>
        {locale === 'ru' ? <CookiesRu /> : <CookiesEn />}
      </div>
    </div>
  );
}

function CookiesRu() {
  return (
    <div className="prose prose-invert prose-sm max-w-none space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-white">1. Что такое Cookie и аналогичные технологии</h2>
        <p>Cookie — это небольшие текстовые файлы, сохраняемые браузером на вашем устройстве. Аналогичные технологии включают localStorage и sessionStorage — механизмы хранения данных в браузере без отправки на сервер.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">2. Какие технологии мы используем</h2>
        <p>Pulsar использует исключительно функциональные технологии хранения данных:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>localStorage</strong> — для хранения JWT-токена сессии, выбранного языка интерфейса, настроек темы, предпочтений E2E-шифрования</li>
          <li><strong>sessionStorage</strong> — для временного хранения данных в рамках одной сессии браузера (например, отложенных ссылок приглашения)</li>
        </ul>
        <p>Мы <strong>не используем</strong>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Аналитические cookie (Google Analytics и аналоги)</li>
          <li>Рекламные и таргетинговые cookie</li>
          <li>Cookie социальных сетей</li>
          <li>Сторонние трекеры</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">3. Цели использования</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Поддержание активной сессии (вход без повторной авторизации)</li>
          <li>Запоминание выбранного языка интерфейса</li>
          <li>Запоминание выбранной темы оформления</li>
          <li>Сохранение настроек E2E-шифрования</li>
        </ul>
        <p>Все перечисленные цели относятся к категории «строго необходимых» и не требуют отдельного согласия по GDPR (Recital 47, Art. 6(1)(f)) и российскому законодательству.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">4. Срок хранения</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>JWT-токен: до истечения срока действия (обычно 7 дней) или до выхода из системы</li>
          <li>Настройки языка и темы: до очистки localStorage браузера</li>
          <li>SessionStorage данные: до закрытия вкладки/браузера</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">5. Управление данными</h2>
        <p>Вы можете удалить все сохранённые данные в любое время через настройки вашего браузера (раздел «Данные сайтов» или «localStorage»). Обратите внимание, что удаление данных сессии приведёт к автоматическому выходу из аккаунта.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">6. Изменения политики</h2>
        <p>При существенном изменении используемых технологий хранения мы обновим данную политику и уведомим пользователей.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">7. Контакты</h2>
        <p>По вопросам: <span className="text-primary-400">privacy@pulsar.chat</span></p>
      </section>
    </div>
  );
}

function CookiesEn() {
  return (
    <div className="prose prose-invert prose-sm max-w-none space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-white">1. What Are Cookies and Similar Technologies</h2>
        <p>Cookies are small text files saved by your browser on your device. Similar technologies include localStorage and sessionStorage — browser-based data storage mechanisms that don't send data to the server.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">2. Technologies We Use</h2>
        <p>Pulsar uses exclusively functional data storage technologies:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>localStorage</strong> — for storing JWT session tokens, selected interface language, theme settings, E2E encryption preferences</li>
          <li><strong>sessionStorage</strong> — for temporary storage within a browser session (e.g., pending invite links)</li>
        </ul>
        <p>We do <strong>not</strong> use:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Analytics cookies (Google Analytics and similar)</li>
          <li>Advertising or targeting cookies</li>
          <li>Social media cookies</li>
          <li>Third-party trackers</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">3. Purpose of Use</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Maintaining an active session (staying logged in)</li>
          <li>Remembering your selected interface language</li>
          <li>Remembering your selected theme</li>
          <li>Saving E2E encryption settings</li>
        </ul>
        <p>All these purposes are "strictly necessary" and do not require separate consent under GDPR (Recital 47, Art. 6(1)(f)).</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">4. Retention Period</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>JWT token: until expiry (typically 7 days) or logout</li>
          <li>Language and theme settings: until localStorage is cleared</li>
          <li>SessionStorage data: until the tab/browser is closed</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">5. Managing Your Data</h2>
        <p>You can delete all stored data at any time via your browser settings ("Site Data" or "localStorage" section). Note that deleting session data will log you out automatically.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">6. Policy Changes</h2>
        <p>If we materially change our storage technologies, we will update this policy and notify users.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">7. Contact</h2>
        <p>For inquiries: <span className="text-primary-400">privacy@pulsar.chat</span></p>
      </section>
    </div>
  );
}
