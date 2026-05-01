import { ArrowLeft, Home } from 'lucide-react';
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
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">{t('legal.termsTitle')}</h1>
            <p className="text-sm text-gray-400">{t('privacy.lastUpdated')}: 01.05.2026</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500/15 border border-primary-500/30 text-primary-400 hover:bg-primary-500/25 text-xs font-medium transition-colors"
          >
            <Home size={12} />
            Pulsar
          </button>
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
        <p>Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует отношения между платформой Pulsar («Платформа», «мы») и пользователем («Вы») при использовании сервиса обмена сообщениями, доступного по адресу pulsar-chat.fun и связанных приложений (мобильных, десктоп-нод).</p>
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
        <h2 className="text-lg font-semibold text-white">5. Внутренняя валюта PLS — риски и оговорки</h2>
        <p>PLS — это внутренний расчётный токен Платформы. PLS <strong>не является</strong> ценной бумагой, валютой, электронным средством платежа, инвестиционным или финансовым инструментом по законодательству РФ, ЕС, США, Великобритании и большинства других юрисдикций.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Покупка PLS — это покупка цифрового внутриплатформенного актива, а не инвестиция</li>
          <li>Курс PLS формируется Платформой и может изменяться. Возврат за пополнение возможен в течение 14 дней при условии, что PLS не был израсходован</li>
          <li>PLS не подлежит обмену на фиатные деньги вне Платформы и не имеет хождения вне неё</li>
          <li>Награды за активность, ноды и стейкинг — это <strong>программы лояльности</strong>, а не доходные продукты. Платформа вправе изменять или прекращать их с уведомлением за 7 дней</li>
          <li>Информация о PLS не является инвестиционной рекомендацией</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">6. Solana-кошелёк и блокчейн-операции</h2>
        <p>Платформа предоставляет интеграцию с блокчейном Solana (devnet/mainnet). Вы понимаете и принимаете, что:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Транзакции в блокчейне необратимы — мы не можем их отменить или вернуть SOL</li>
          <li>Хранение приватных ключей внешнего кошелька — Ваша ответственность. Потеря ключей = потеря средств</li>
          <li>Обращение криптовалют в Вашей юрисдикции может требовать декларирования или быть ограничено</li>
          <li>Налоговые обязательства от операций с SOL/PLS — на Вашей стороне</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">7. Запуск ноды (mining) — юридические оговорки</h2>
        <p>Программа поддержки сети («майнинг»), описанная на странице <span className="text-primary-400">/mining</span>, доступна верифицированным пользователям. Принимая участие, Вы подтверждаете:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Запуск ноды в Вашей стране не противоречит местному законодательству о криптомайнинге, передаче трафика и хостинге</li>
          <li>Вы оплачиваете электроэнергию и интернет самостоятельно</li>
          <li>Награды в PLS могут быть налогооблагаемыми в Вашей юрисдикции — отчётность за вами</li>
          <li>Платформа не несёт ответственности за блокировку Вашего интернет-провайдера или иные последствия запуска ноды</li>
          <li>Мы вправе отключить ноду без выплат при нарушении правил программы (фрод, фейковая статистика)</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">8. Шифрование и приватность сообщений</h2>
        <p>Личные сообщения шифруются end-to-end (E2E) с использованием алгоритма NaCl-box (X25519 + XSalsa20-Poly1305). Платформа <strong>не имеет технической возможности</strong> читать содержимое таких сообщений. Это не является обходом обязательств по сотрудничеству с правоохранительными органами:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>По требованию суда мы можем предоставить метаданные (время отправки, между кем, IP) и шифротекст — но не открытый текст</li>
          <li>В групповых чатах и каналах E2E пока не применяется — содержимое доступно нам в рамках работы сервиса</li>
          <li>Использование Платформы для незаконной деятельности запрещено независимо от наличия шифрования</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">9. Географические ограничения и санкции</h2>
        <p>Использование Платформы запрещено лицам, находящимся в странах под международными санкциями (на момент публикации — Северная Корея, Иран, Сирия, Куба, оккупированные территории Украины), а также лицам и организациям, включённым в санкционные списки ООН, ЕС, OFAC (США) или РФ.</p>
        <p>В некоторых странах (например, КНР, ОАЭ) использование E2E-мессенджеров и/или операций с криптовалютой может быть ограничено законом. Ответственность за соответствие местному законодательству — на пользователе.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">10. Возрастные ограничения</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Общий минимальный возраст: <strong>16 лет</strong> (соответствует GDPR ст. 8)</li>
          <li>США (COPPA): <strong>13 лет</strong> с согласия родителей</li>
          <li>Великобритания (Online Safety Act): <strong>13 лет</strong></li>
          <li>Республика Корея, Япония: <strong>14 лет</strong></li>
          <li>РФ (152-ФЗ): рекомендуется <strong>14+</strong></li>
        </ul>
        <p className="mt-2">Несовершеннолетние пользователи не могут участвовать в программах с реальными деньгами (YooKassa-пополнения, Premium за рубли).</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">11. AML / KYC при пополнении за фиат</h2>
        <p>Пополнения PLS за рубли проводятся через YooKassa (ООО НКО «ЮMoney», лицензия Банка России). Платежи проходят встроенную KYC-проверку платёжной системы. Платформа не хранит данные банковских карт. Подозрительные операции (структурирование, несоответствие источнику средств) могут быть приостановлены до проверки.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">12. Боты, API и автоматизация</h2>
        <p>Платформа предоставляет Bot API (документация на <span className="text-primary-400">/developers</span>). Использование автоматизации ограничено выпущенным разработчиком ботом или авторизованным API-клиентом. Запрещено: скрейпинг данных пользователей, массовые рассылки без согласия (спам), создание ботов для обхода ограничений.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">13. Блокировка аккаунта</h2>
        <p>Мы вправе приостановить или заблокировать аккаунт при нарушении настоящего Соглашения, действующего законодательства или по требованию компетентных органов. При блокировке по нашей инициативе мы уведомим Вас по email (кроме случаев, когда уведомление запрещено законом). При неактивности аккаунта более 12 месяцев он может быть деактивирован.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">14. Ограничение ответственности</h2>
        <p>Платформа предоставляется «как есть» и «по доступности». Мы не гарантируем непрерывной работы, отсутствия ошибок, сохранности кэшированного контента, и не несём ответственности за прямые или косвенные убытки (включая упущенную выгоду от программ майнинга/стейкинга), за исключением случаев, прямо предусмотренных законодательством применимой юрисдикции.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">15. Изменение соглашения</h2>
        <p>Мы можем обновлять Соглашение. О существенных изменениях (касающихся прав пользователей, цен, программ наград) уведомляем за <strong>7 дней</strong> через баннер в Платформе или email. Продолжение использования после вступления изменений в силу означает согласие с новой редакцией. Если Вы не согласны — Вы вправе удалить аккаунт без штрафов.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">16. Применимое право и разрешение споров</h2>
        <p>Настоящее Соглашение регулируется законодательством страны регистрации оператора Платформы. Споры решаются в претензионном порядке (срок ответа — 30 дней), при недостижении согласия — в компетентном суде по месту нахождения оператора. Для пользователей-резидентов ЕС применимы положения GDPR и Регламента Brussels I о юрисдикции потребительских споров.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">17. Контакты</h2>
        <p>Юридические вопросы: <span className="text-primary-400">legal@pulsar-chat.fun</span></p>
        <p>Защита данных (DPO): <span className="text-primary-400">privacy@pulsar-chat.fun</span></p>
        <p>Жалобы и сообщения о нарушениях: <span className="text-primary-400">abuse@pulsar-chat.fun</span></p>
      </section>
    </div>
  );
}

function TermsEn() {
  return (
    <div className="prose prose-invert prose-sm max-w-none space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-white">1. General Provisions</h2>
        <p>This User Agreement ("Agreement") governs the relationship between the Pulsar platform ("Platform", "we") and the user ("you") when using the messaging service available at pulsar-chat.fun and related applications (mobile, desktop nodes).</p>
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
        <h2 className="text-lg font-semibold text-white">5. PLS Internal Currency — Risks & Disclaimers</h2>
        <p>PLS is the Platform's internal accounting token. PLS is <strong>not</strong> a security, currency, electronic means of payment, investment or financial instrument under the laws of the EU, US, UK, Russia, or most other jurisdictions.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Buying PLS is a purchase of a digital in-platform asset, not an investment</li>
          <li>The Platform sets the PLS rate and may adjust it. Refunds for top-ups are available within 14 days provided PLS hasn't been spent</li>
          <li>PLS cannot be exchanged for fiat outside the Platform and has no circulation outside it</li>
          <li>Activity, node and staking rewards are <strong>loyalty programs</strong>, not yield products. The Platform may modify or end them with 7 days notice</li>
          <li>Information about PLS is not investment advice</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">6. Solana Wallet & On-Chain Operations</h2>
        <p>The Platform integrates with the Solana blockchain (devnet/mainnet). You understand and accept that:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Blockchain transactions are irreversible — we cannot cancel them or refund SOL</li>
          <li>Storing your external wallet's private keys is your responsibility. Lost keys = lost funds</li>
          <li>Crypto holdings in your jurisdiction may require disclosure or be restricted</li>
          <li>Tax obligations from SOL/PLS operations are on your side</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">7. Running a Node (Mining) — Legal Disclaimer</h2>
        <p>The network-support program ("mining") described at <span className="text-primary-400">/mining</span> is available to verified users. By participating you confirm:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Running a node in your country does not violate local laws on crypto mining, traffic relaying, and hosting</li>
          <li>You pay for your own electricity and bandwidth</li>
          <li>PLS rewards may be taxable in your jurisdiction — reporting is on you</li>
          <li>The Platform is not liable for ISP blocks or other consequences of running a node</li>
          <li>We may shut down a node without payout for program violations (fraud, fake stats)</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">8. Encryption & Message Privacy</h2>
        <p>Direct messages are end-to-end (E2E) encrypted using NaCl-box (X25519 + XSalsa20-Poly1305). The Platform <strong>has no technical means</strong> to read the content of such messages. This does not bypass our cooperation obligations with law enforcement:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Upon court order we can provide metadata (timestamps, parties, IP) and ciphertext — but not plaintext</li>
          <li>Group chats and channels are not E2E yet — content is accessible to us as part of operating the service</li>
          <li>Use of the Platform for illegal activity is prohibited regardless of encryption</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">9. Geographic Restrictions & Sanctions</h2>
        <p>Use of the Platform is prohibited for persons located in countries under international sanctions (at the time of publication — North Korea, Iran, Syria, Cuba, occupied territories of Ukraine), and for persons or entities listed on UN, EU, OFAC (US) or RF sanctions lists.</p>
        <p>In some countries (e.g. PRC, UAE) the use of E2E messengers and/or crypto operations may be restricted by law. Compliance with local law is the user's responsibility.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">10. Age Restrictions</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>General minimum age: <strong>16 years</strong> (per GDPR Art. 8)</li>
          <li>USA (COPPA): <strong>13 years</strong> with parental consent</li>
          <li>UK (Online Safety Act): <strong>13 years</strong></li>
          <li>South Korea, Japan: <strong>14 years</strong></li>
          <li>Russia (152-FZ): recommended <strong>14+</strong></li>
        </ul>
        <p className="mt-2">Minors cannot participate in real-money programs (YooKassa top-ups, Premium for fiat).</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">11. AML / KYC for Fiat Top-ups</h2>
        <p>PLS top-ups for rubles flow through YooKassa (LLC NCO YooMoney, Bank of Russia license). Payments pass the payment processor's built-in KYC checks. The Platform does not store card data. Suspicious operations (structuring, source-of-funds mismatch) may be paused pending review.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">12. Bots, API & Automation</h2>
        <p>The Platform exposes a Bot API (docs at <span className="text-primary-400">/developers</span>). Automated use is limited to bots created by the developer or authorized API clients. Prohibited: scraping user data, mass unsolicited messaging (spam), bots that bypass restrictions.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">13. Account Suspension</h2>
        <p>We may suspend or block an account for violations of this Agreement, applicable law, or at the request of competent authorities. When blocking at our initiative, we will notify you by email (unless prohibited by law). Accounts inactive for more than 12 months may be deactivated.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">14. Limitation of Liability</h2>
        <p>The Platform is provided "as is" and "as available." We do not warrant uninterrupted operation, absence of errors, persistence of cached content, and we are not liable for direct or indirect damages (including lost earnings from mining/staking programs), except as required by the laws of the applicable jurisdiction.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">15. Agreement Changes</h2>
        <p>We may update the Agreement. Material changes (affecting user rights, prices, reward programs) are notified <strong>7 days</strong> in advance via in-app banner or email. Continued use after changes take effect constitutes acceptance. If you disagree — you may delete your account without penalty.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">16. Governing Law & Dispute Resolution</h2>
        <p>This Agreement is governed by the laws of the Platform operator's country of registration. Disputes are resolved through pre-trial claim procedures (30-day response window); if unresolved, in the competent court at the operator's location. For EU-resident users, GDPR and Brussels I Regulation provisions on consumer-dispute jurisdiction apply.</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">17. Contact</h2>
        <p>Legal: <span className="text-primary-400">legal@pulsar-chat.fun</span></p>
        <p>Data Protection (DPO): <span className="text-primary-400">privacy@pulsar-chat.fun</span></p>
        <p>Abuse reports: <span className="text-primary-400">abuse@pulsar-chat.fun</span></p>
      </section>
    </div>
  );
}
