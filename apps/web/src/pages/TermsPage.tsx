import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';

export function TermsPage() {
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
            <h1 className="text-2xl font-bold text-white">{t('legal.termsTitle')}</h1>
            <p className="text-sm text-gray-400">{t('privacy.lastUpdated')}: 04.04.2026</p>
          </div>
        </div>
        {locale === 'ru' ? <TermsRu /> : <TermsEn />}
      </div>
    </div>
  );
}

function TermsRu() {
  return (
    <div className="prose prose-invert prose-sm max-w-none space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-white">1. Общие положения</h2>
        <p>Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует отношения между платформой Pulsar («Платформа», «мы») и пользователем («Вы») при использовании сервиса обмена сообщениями, доступного по адресу pulsar.chat и связанных приложений.</p>
        <p>Регистрируясь на Платформе, Вы подтверждаете, что ознакомились с настоящим Соглашением, понимаете его условия и принимаете их в полном объёме.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">2. Условия использования</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Вы должны быть не моложе 16 лет (13 лет для резидентов США)</li>
          <li>Регистрация одного аккаунта на одного пользователя</li>
          <li>Вы несёте ответственность за сохранность своих учётных данных</li>
          <li>Использование Платформы допускается только в законных целях</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">3. Запрещённые действия</h2>
        <p>При использовании Платформы запрещается:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Распространение незаконного, вредоносного, оскорбительного контента</li>
          <li>Спам, фишинг, мошенничество любого рода</li>
          <li>Нарушение прав интеллектуальной собственности третьих лиц</li>
          <li>Попытки взлома, DDoS-атаки, реверс-инжиниринг платформы</li>
          <li>Использование автоматизированных средств без разрешения (боты, скрейперы)</li>
          <li>Создание аккаунтов для обхода блокировок</li>
          <li>Распространение вредоносного ПО</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">4. Контент пользователей</h2>
        <p>Вы сохраняете все права на публикуемый вами контент. Размещая контент, Вы предоставляете Платформе неисключительную лицензию на его хранение и отображение в рамках работы сервиса. Мы вправе удалять контент, нарушающий настоящее Соглашение, без предварительного уведомления.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">5. Внутренняя валюта PLS</h2>
        <p>PLS — внутренняя валюта Платформы. PLS не является финансовым инструментом, ценной бумагой или криптовалютой в юридическом смысле. Операции с PLS регулируются Публичной офертой. Платформа вправе изменять условия начисления и использования PLS с уведомлением пользователей за 7 дней.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">6. Блокировка аккаунта</h2>
        <p>Мы вправе приостановить или заблокировать аккаунт при нарушении настоящего Соглашения, действующего законодательства или по требованию компетентных органов. При блокировке по нашей инициативе мы уведомим Вас по email (кроме случаев, когда уведомление запрещено законом).</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">7. Ограничение ответственности</h2>
        <p>Платформа предоставляется «как есть». Мы не несём ответственности за прямые или косвенные убытки, возникшие в результате использования или невозможности использования Платформы, за исключением случаев, предусмотренных законодательством.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">8. Изменение соглашения</h2>
        <p>Мы можем обновлять Соглашение. О существенных изменениях уведомляем за 7 дней через Платформу или email. Продолжение использования после вступления изменений в силу означает согласие с новой редакцией.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">9. Применимое право</h2>
        <p>Настоящее Соглашение регулируется законодательством страны регистрации Платформы. Споры решаются в претензионном порядке, при недостижении согласия — в суде по месту нахождения Платформы.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">10. Контакты</h2>
        <p>По вопросам Соглашения: <span className="text-primary-400">legal@pulsar.chat</span></p>
      </section>
    </div>
  );
}

function TermsEn() {
  return (
    <div className="prose prose-invert prose-sm max-w-none space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-white">1. General Provisions</h2>
        <p>This User Agreement ("Agreement") governs the relationship between the Pulsar platform ("Platform", "we") and the user ("you") when using the messaging service available at pulsar.chat and related applications.</p>
        <p>By registering on the Platform, you confirm that you have read this Agreement, understand its terms and accept them in full.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">2. Terms of Use</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>You must be at least 16 years old (13 for US residents)</li>
          <li>One account per user</li>
          <li>You are responsible for maintaining the security of your credentials</li>
          <li>Use of the Platform is permitted for lawful purposes only</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">3. Prohibited Actions</h2>
        <p>When using the Platform, the following are prohibited:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Distributing illegal, harmful, or offensive content</li>
          <li>Spam, phishing, or fraud of any kind</li>
          <li>Infringement of third-party intellectual property rights</li>
          <li>Hacking attempts, DDoS attacks, or reverse engineering the platform</li>
          <li>Using automated tools without permission (bots, scrapers)</li>
          <li>Creating accounts to circumvent bans</li>
          <li>Distributing malware</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">4. User Content</h2>
        <p>You retain all rights to the content you post. By posting content, you grant the Platform a non-exclusive license to store and display it as part of the service. We may remove content that violates this Agreement without prior notice.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">5. PLS Internal Currency</h2>
        <p>PLS is the Platform's internal currency. PLS is not a financial instrument, security, or cryptocurrency in the legal sense. PLS transactions are governed by the Public Offer. The Platform may change PLS terms with 7 days notice to users.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">6. Account Suspension</h2>
        <p>We may suspend or block an account for violations of this Agreement, applicable law, or at the request of competent authorities. When blocking at our initiative, we will notify you by email (unless prohibited by law).</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">7. Limitation of Liability</h2>
        <p>The Platform is provided "as is." We are not liable for direct or indirect damages arising from use or inability to use the Platform, except as required by law.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">8. Agreement Changes</h2>
        <p>We may update the Agreement. Material changes are notified 7 days in advance via the Platform or email. Continued use after changes take effect constitutes acceptance of the new version.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">9. Governing Law</h2>
        <p>This Agreement is governed by the laws of the Platform's country of registration. Disputes are resolved through pre-trial claim procedures, and if unresolved, in court at the Platform's location.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">10. Contact</h2>
        <p>For Agreement inquiries: <span className="text-primary-400">legal@pulsar.chat</span></p>
      </section>
    </div>
  );
}
