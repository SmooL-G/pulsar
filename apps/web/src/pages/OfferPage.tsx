import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';

export function OfferPage() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();

  return (
    <div className="min-h-screen bg-dark-800 text-gray-200">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/login')}
            className="p-2 rounded-lg hover:bg-dark-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{t('legal.offerTitle')}</h1>
            <p className="text-sm text-gray-400">{t('privacy.lastUpdated')}: 04.04.2026</p>
          </div>
        </div>
        {locale === 'ru' ? <OfferRu /> : <OfferEn />}
      </div>
    </div>
  );
}

function OfferRu() {
  return (
    <div className="prose prose-invert prose-sm max-w-none space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-white">1. Предмет оферты</h2>
        <p>Настоящая Публичная оферта (далее — «Оферта») является официальным предложением платформы Pulsar (далее — «Оператор») заключить договор на оказание информационно-технических услуг по предоставлению доступа к платформе и связанным сервисам (далее — «Услуги»).</p>
        <p>Акцептом Оферты является факт регистрации на Платформе. С момента регистрации договор считается заключённым.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">2. Состав услуг</h2>
        <p>Оператор предоставляет следующие услуги:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Доступ к защищённому мессенджеру с E2E-шифрованием</li>
          <li>Личные и групповые чаты, каналы</li>
          <li>Хранение и передача файлов</li>
          <li>Внутренний кошелёк с балансом PLS</li>
          <li>Интеграция с Solana-кошельком пользователя</li>
          <li>NFT-аватары и верификация</li>
          <li>Административные инструменты для владельцев групп/каналов</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">3. Внутренняя валюта PLS</h2>
        <p>3.1. PLS — это внутренние бонусные единицы Платформы. PLS не является платёжным средством, ценной бумагой или цифровым финансовым активом в соответствии с действующим законодательством.</p>
        <p>3.2. PLS начисляются за активность на Платформе и могут передаваться между пользователями внутри Платформы.</p>
        <p>3.3. При переводе PLS между пользователями 2% от суммы сжигается (burn) в целях поддержания экономики Платформы.</p>
        <p>3.4. PLS не подлежат обмену на реальные денежные средства или криптовалюту через механизмы Платформы.</p>
        <p>3.5. Оператор вправе изменить условия начисления, использования и курс PLS, уведомив пользователей за 7 дней.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">4. Стоимость услуг</h2>
        <p>Базовый доступ к Платформе предоставляется бесплатно. Отдельные premium-функции могут предоставляться за PLS или иное вознаграждение, о чём пользователь будет уведомлён заблаговременно.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">5. Права и обязанности сторон</h2>
        <h3 className="text-sm font-medium text-gray-300 mt-3">5.1. Оператор обязуется:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Обеспечивать доступность Платформы (целевой uptime 99%)</li>
          <li>Хранить данные в соответствии с Политикой конфиденциальности</li>
          <li>Уведомлять о существенных изменениях условий</li>
        </ul>
        <h3 className="text-sm font-medium text-gray-300 mt-3">5.2. Пользователь обязуется:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Соблюдать Пользовательское соглашение и настоящую Оферту</li>
          <li>Не нарушать права других пользователей и третьих лиц</li>
          <li>Использовать Платформу только в законных целях</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">6. Ответственность</h2>
        <p>Оператор не несёт ответственности за убытки, возникшие вследствие технических сбоев, действий третьих лиц, форс-мажора, а также за контент, публикуемый пользователями.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">7. Срок действия</h2>
        <p>Договор действует с момента акцепта Оферты и до удаления аккаунта пользователем либо его блокировки Оператором в соответствии с Пользовательским соглашением.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">8. Контакты Оператора</h2>
        <p>По вопросам исполнения Оферты: <span className="text-primary-400">legal@pulsar-chat.fun</span></p>
      </section>
    </div>
  );
}

function OfferEn() {
  return (
    <div className="prose prose-invert prose-sm max-w-none space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-white">1. Subject of the Offer</h2>
        <p>This Public Offer ("Offer") is the official proposal by the Pulsar platform ("Operator") to enter into an agreement for information and technical services providing access to the platform and related services ("Services").</p>
        <p>Acceptance of the Offer is the act of registration on the Platform. Upon registration, the agreement is considered concluded.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">2. Services Included</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access to a secure messenger with E2E encryption</li>
          <li>Direct and group chats, channels</li>
          <li>File storage and transfer</li>
          <li>Internal wallet with PLS balance</li>
          <li>Integration with the user's Solana wallet</li>
          <li>NFT avatars and verification</li>
          <li>Administrative tools for group/channel owners</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">3. PLS Internal Currency</h2>
        <p>3.1. PLS are internal bonus units of the Platform. PLS is not a means of payment, security, or digital financial asset under applicable law.</p>
        <p>3.2. PLS are accrued for platform activity and may be transferred between users within the Platform.</p>
        <p>3.3. When transferring PLS between users, 2% of the amount is burned to support the Platform's economy.</p>
        <p>3.4. PLS cannot be exchanged for real money or cryptocurrency through Platform mechanisms.</p>
        <p>3.5. The Operator may change PLS accrual, usage conditions, and rates with 7 days notice to users.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">4. Service Pricing</h2>
        <p>Basic access to the Platform is free. Certain premium features may be provided for PLS or other consideration, of which the user will be notified in advance.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">5. Rights and Obligations</h2>
        <h3 className="text-sm font-medium text-gray-300 mt-3">5.1. The Operator undertakes to:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Ensure Platform availability (target uptime 99%)</li>
          <li>Store data in accordance with the Privacy Policy</li>
          <li>Notify users of material changes to terms</li>
        </ul>
        <h3 className="text-sm font-medium text-gray-300 mt-3">5.2. The User undertakes to:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Comply with the User Agreement and this Offer</li>
          <li>Not violate the rights of other users or third parties</li>
          <li>Use the Platform only for lawful purposes</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">6. Liability</h2>
        <p>The Operator is not liable for losses caused by technical failures, third-party actions, force majeure, or content published by users.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">7. Term</h2>
        <p>The agreement is valid from the moment of Offer acceptance until account deletion by the user or blocking by the Operator in accordance with the User Agreement.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">8. Operator Contacts</h2>
        <p>For Offer inquiries: <span className="text-primary-400">legal@pulsar-chat.fun</span></p>
      </section>
    </div>
  );
}
