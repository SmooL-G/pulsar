import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';

export function PrivacyPage() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();

  return (
    <div className="bg-dark-800 text-gray-200" style={{ height: '100dvh', overflowY: 'auto' }}>
      <div className="max-w-3xl mx-auto px-4 pt-3-safe pb-safe py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/info')}
            className="p-2 rounded-lg hover:bg-dark-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('privacy.title')}</h1>
            <p className="text-sm text-gray-400">{t('privacy.lastUpdated')}: 24.03.2026</p>
          </div>
        </div>

        {locale === 'ru' ? <PrivacyContentRu /> : <PrivacyContentEn />}
      </div>
    </div>
  );
}

function PrivacyContentRu() {
  return (
    <div className="prose prose-invert prose-sm max-w-none space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-white">1. Введение</h2>
        <p>
          Pulsar («мы», «наш», «платформа») — это крипто-мессенджер, использующий технологию блокчейна Solana.
          Настоящая Политика конфиденциальности описывает, как мы собираем, используем, храним и защищаем
          вашу персональную информацию в соответствии с международным законодательством о защите данных,
          включая GDPR (ЕС), CCPA (Калифорния, США), Федеральный закон №152-ФЗ «О персональных данных» (РФ)
          и другие применимые нормативные акты.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">2. Какие данные мы собираем</h2>
        <h3 className="text-sm font-medium text-gray-300 mt-3">2.1. Данные, предоставляемые вами:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Адрес электронной почты (при регистрации по email)</li>
          <li>Имя пользователя (username)</li>
          <li>Отображаемое имя и биография (опционально)</li>
          <li>Аватар (опционально)</li>
          <li>Публичный адрес Solana-кошелька</li>
        </ul>
        <h3 className="text-sm font-medium text-gray-300 mt-3">2.2. Данные, собираемые автоматически:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>IP-адрес и данные об устройстве</li>
          <li>Время подключения и активности</li>
          <li>Статус онлайн/оффлайн</li>
          <li>Метаданные сообщений (время отправки, статус доставки)</li>
        </ul>
        <h3 className="text-sm font-medium text-gray-300 mt-3">2.3. Данные, которые мы НЕ собираем:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Приватные ключи внешних кошельков (мы никогда не имеем к ним доступа)</li>
          <li>Пароли в открытом виде (хранятся только хеши bcrypt)</li>
          <li>Данные банковских карт</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">3. Как мы используем данные</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Обеспечение функционирования чат-платформы</li>
          <li>Аутентификация и авторизация пользователей</li>
          <li>Доставка и хранение сообщений</li>
          <li>Отображение профилей и статусов онлайн</li>
          <li>Обеспечение безопасности и предотвращение злоупотреблений</li>
          <li>Улучшение качества сервиса</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">4. Хранение и защита данных</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Данные хранятся на защищённых серверах с шифрованием</li>
          <li>Пароли хешируются с использованием bcrypt</li>
          <li>Приватные ключи автоматически созданных кошельков шифруются AES-256-GCM</li>
          <li>Сессии защищены JWT-токенами с ограниченным временем жизни</li>
          <li>Соединения защищены SSL/TLS</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">5. Передача данных третьим лицам</h2>
        <p>
          Мы не продаём, не сдаём в аренду и не передаём вашу персональную информацию третьим лицам,
          за исключением следующих случаев:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>С вашего явного согласия</li>
          <li>По требованию компетентных органов в соответствии с действующим законодательством</li>
          <li>Для защиты наших прав, безопасности или имущества</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">6. Ваши права (GDPR, CCPA, ФЗ-152)</h2>
        <p>Вы имеете право:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Доступ</strong> — запросить копию ваших персональных данных</li>
          <li><strong>Исправление</strong> — обновить или исправить неточные данные</li>
          <li><strong>Удаление</strong> — запросить удаление вашего аккаунта и данных («право на забвение»)</li>
          <li><strong>Ограничение</strong> — ограничить обработку ваших данных</li>
          <li><strong>Переносимость</strong> — получить данные в машиночитаемом формате</li>
          <li><strong>Отзыв согласия</strong> — отозвать согласие на обработку данных в любое время</li>
          <li><strong>Отказ от продажи данных</strong> — мы не продаём персональные данные (CCPA)</li>
        </ul>
        <p className="mt-2">
          Для реализации своих прав свяжитесь с нами по адресу: <span className="text-primary-400">privacy@pulsar.chat</span>
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">7. Блокчейн-данные</h2>
        <p>
          Публичные адреса Solana-кошельков по своей природе являются общедоступными в блокчейне.
          Мы не несём ответственности за информацию, доступную через публичные блокчейн-эксплореры.
          Транзакции, совершённые через блокчейн, являются необратимыми и публичными.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">8. Файлы cookie и аналогичные технологии</h2>
        <p>
          Мы используем localStorage и sessionStorage для хранения сессионных токенов и настроек
          интерфейса (язык, тема). Мы не используем аналитические или рекламные cookie.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">9. Возрастные ограничения</h2>
        <p>
          Наш сервис не предназначен для лиц младше 16 лет (13 лет для резидентов США в соответствии с COPPA).
          Мы не собираем сознательно данные несовершеннолетних.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">10. Срок хранения данных</h2>
        <p>
          Мы храним персональные данные до тех пор, пока ваш аккаунт активен или пока они необходимы
          для предоставления услуг. При удалении аккаунта данные удаляются в течение 30 дней,
          за исключением случаев, когда хранение требуется по закону.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">11. Изменения в политике</h2>
        <p>
          Мы можем обновлять данную Политику конфиденциальности. О существенных изменениях мы уведомим
          вас через платформу или по электронной почте. Продолжение использования сервиса после
          публикации изменений означает ваше согласие с обновлённой политикой.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">12. Контакты</h2>
        <p>
          По вопросам конфиденциальности и защиты данных: <span className="text-primary-400">privacy@pulsar.chat</span>
        </p>
      </section>
    </div>
  );
}

function PrivacyContentEn() {
  return (
    <div className="prose prose-invert prose-sm max-w-none space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-white">1. Introduction</h2>
        <p>
          Pulsar ("we", "our", "platform") is a crypto-native messaging platform built on Solana blockchain technology.
          This Privacy Policy describes how we collect, use, store, and protect your personal information in compliance
          with international data protection laws, including GDPR (EU), CCPA (California, USA), Federal Law No. 152-FZ
          "On Personal Data" (Russia), and other applicable regulations.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">2. Data We Collect</h2>
        <h3 className="text-sm font-medium text-gray-300 mt-3">2.1. Data you provide:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Email address (when registering via email)</li>
          <li>Username</li>
          <li>Display name and bio (optional)</li>
          <li>Avatar (optional)</li>
          <li>Public Solana wallet address</li>
        </ul>
        <h3 className="text-sm font-medium text-gray-300 mt-3">2.2. Data collected automatically:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>IP address and device information</li>
          <li>Connection and activity timestamps</li>
          <li>Online/offline status</li>
          <li>Message metadata (send time, delivery status)</li>
        </ul>
        <h3 className="text-sm font-medium text-gray-300 mt-3">2.3. Data we do NOT collect:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Private keys of external wallets (we never have access to them)</li>
          <li>Plaintext passwords (only bcrypt hashes are stored)</li>
          <li>Credit card information</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">3. How We Use Data</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Operating the chat platform</li>
          <li>User authentication and authorization</li>
          <li>Message delivery and storage</li>
          <li>Displaying profiles and online statuses</li>
          <li>Ensuring security and preventing abuse</li>
          <li>Improving service quality</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">4. Data Storage and Security</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Data is stored on encrypted, secured servers</li>
          <li>Passwords are hashed using bcrypt</li>
          <li>Auto-generated wallet private keys are encrypted with AES-256-GCM</li>
          <li>Sessions are protected with time-limited JWT tokens</li>
          <li>Connections are secured via SSL/TLS</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">5. Third-Party Data Sharing</h2>
        <p>
          We do not sell, rent, or share your personal information with third parties,
          except in the following circumstances:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>With your explicit consent</li>
          <li>When required by law enforcement or regulatory authorities</li>
          <li>To protect our rights, safety, or property</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">6. Your Rights (GDPR, CCPA, FZ-152)</h2>
        <p>You have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Access</strong> — request a copy of your personal data</li>
          <li><strong>Rectification</strong> — update or correct inaccurate data</li>
          <li><strong>Erasure</strong> — request deletion of your account and data ("right to be forgotten")</li>
          <li><strong>Restriction</strong> — restrict the processing of your data</li>
          <li><strong>Portability</strong> — receive your data in a machine-readable format</li>
          <li><strong>Withdraw consent</strong> — withdraw consent for data processing at any time</li>
          <li><strong>Opt-out of data sale</strong> — we do not sell personal data (CCPA)</li>
        </ul>
        <p className="mt-2">
          To exercise your rights, contact us at: <span className="text-primary-400">privacy@pulsar.chat</span>
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">7. Blockchain Data</h2>
        <p>
          Public Solana wallet addresses are inherently public on the blockchain.
          We are not responsible for information accessible through public blockchain explorers.
          Blockchain transactions are irreversible and public by nature.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">8. Cookies and Similar Technologies</h2>
        <p>
          We use localStorage and sessionStorage to store session tokens and interface settings
          (language, theme). We do not use analytics or advertising cookies.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">9. Age Restrictions</h2>
        <p>
          Our service is not intended for individuals under the age of 16 (13 for US residents under COPPA).
          We do not knowingly collect data from minors.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">10. Data Retention</h2>
        <p>
          We retain personal data as long as your account is active or as needed to provide services.
          Upon account deletion, data is removed within 30 days, except where retention is required by law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">11. Policy Changes</h2>
        <p>
          We may update this Privacy Policy. We will notify you of significant changes through the
          platform or via email. Continued use of the service after changes are published constitutes
          your acceptance of the updated policy.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">12. Contact</h2>
        <p>
          For privacy and data protection inquiries: <span className="text-primary-400">privacy@pulsar.chat</span>
        </p>
      </section>
    </div>
  );
}
