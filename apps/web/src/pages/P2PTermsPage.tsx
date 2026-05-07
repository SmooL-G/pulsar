import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useI18n } from '../i18n';

export function P2PTermsPage() {
  const { locale } = useI18n();
  const ru = locale === 'ru';

  return (
    <div className="bg-dark-900 text-white min-h-screen">
      <div className="border-b border-dark-600 bg-dark-800/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/p2p" className="p-1.5 rounded-lg hover:bg-dark-600 text-gray-400">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-400" />
            {ru ? 'P2P-биржа · Условия использования' : 'P2P Exchange · Terms of Use'}
          </h1>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-4 py-8 prose prose-invert prose-sm max-w-none">
        {ru ? <RuTerms /> : <EnTerms />}
      </article>
    </div>
  );
}

function RuTerms() {
  return (
    <>
      <p className="text-xs text-gray-500">Последнее обновление: 7 мая 2026 г.</p>

      <h2>1. Что такое P2P-биржа Pulsar</h2>
      <p>
        P2P-биржа Pulsar (далее — «Сервис») — это <strong>информационная площадка для встречи покупателей и продавцов</strong> внутреннего токена платформы PLS. Pulsar выступает исключительно техническим посредником: предоставляет интерфейс для размещения объявлений, эскроу для PLS-токенов, систему статусов сделок и базовый арбитраж в случае явных нарушений.
      </p>
      <p>
        <strong>Pulsar не является банком, обменником, брокером или финансовой организацией.</strong> Сервис не принимает, не хранит и не переводит фиатные средства между пользователями. Все расчёты в фиате (рубли, доллары, евро, гривны и т.д.) производятся пользователями <strong>напрямую между собой</strong>, по своему усмотрению, через выбранные ими банки и платёжные системы.
      </p>

      <h2>2. Юридический статус</h2>
      <p>
        Внутренний токен PLS не является ценной бумагой, средством платежа, фиатной валютой или денежным эквивалентом. Это внутренние очки/баллы платформы, которые могут использоваться для функций внутри Pulsar (подписки, NFT, голосования и т.д.).
      </p>
      <p>
        Используя Сервис, пользователь подтверждает, что он:
      </p>
      <ul>
        <li>достиг совершеннолетия в своей юрисдикции;</li>
        <li>имеет право проводить сделки с цифровыми активами в стране проживания;</li>
        <li>не находится в стране/регионе, где такие операции запрещены законом или санкциями;</li>
        <li>не использует Сервис для отмывания денег, финансирования терроризма, обхода санкций или иной незаконной деятельности.</li>
      </ul>

      <h2>3. Ответственность пользователя</h2>
      <p>
        Пользователь самостоятельно и в полной мере несёт ответственность за:
      </p>
      <ul>
        <li><strong>Налоговые обязательства</strong> в своей юрисдикции (декларирование доходов, уплата налогов).</li>
        <li><strong>Соблюдение валютного и банковского законодательства</strong> своей страны.</li>
        <li><strong>Проверку контрагента</strong> перед сделкой: репутация, история, реквизиты.</li>
        <li><strong>Безопасность собственных платёжных данных</strong>: пароли, коды подтверждения, QR-коды.</li>
        <li><strong>Подтверждение получения средств</strong> до релиза PLS из эскроу.</li>
        <li>Любые споры и убытки, возникшие в результате выбора недобросовестного контрагента.</li>
      </ul>

      <h2>4. Ответственность платформы</h2>
      <p>
        Pulsar оказывает Сервис «как есть» (as-is) без каких-либо гарантий. В частности, Pulsar:
      </p>
      <ul>
        <li><strong>не гарантирует</strong> добросовестность пользователей и подлинность их объявлений;</li>
        <li><strong>не возмещает</strong> убытки, возникшие из-за мошенничества контрагента, ошибок ввода реквизитов, банковских блокировок;</li>
        <li><strong>не несёт ответственности</strong> за приостановку, ограничение или блокировку счетов пользователей со стороны банков или платёжных систем;</li>
        <li><strong>не консультирует</strong> по вопросам инвестиций, налогов, права;</li>
        <li>оставляет за собой право <strong>заморозить эскроу-PLS</strong> или приостановить сделку при подозрении на мошенничество, нарушение настоящих Условий или применимого законодательства;</li>
        <li>может ограничить доступ к Сервису для пользователей с уровнем верификации ниже требуемого.</li>
      </ul>
      <p>
        В случае спора между сторонами сделки Pulsar по своему усмотрению может выступить посредником: запросить доказательства (выписки, скриншоты), и при явном нарушении одной из сторон — освободить эскроу в пользу пострадавшей. Решение администрации окончательно и не обжалуется внутри платформы.
      </p>

      <h2>5. Налоги и отчётность</h2>
      <p>
        Pulsar не выступает налоговым агентом и не предоставляет налоговую отчётность пользователям. Каждый пользователь самостоятельно учитывает доходы и расходы по сделкам, отражает их в декларациях и уплачивает применимые налоги.
      </p>

      <h2>6. Запрещённые активности</h2>
      <p>
        Категорически запрещается использовать Сервис для:
      </p>
      <ul>
        <li>отмывания денег, полученных преступным путём;</li>
        <li>финансирования терроризма или экстремистской деятельности;</li>
        <li>обхода международных или национальных санкций;</li>
        <li>оплаты товаров/услуг, оборот которых ограничен или запрещён;</li>
        <li>массового вывода средств от лиц, не являющихся реальными владельцами;</li>
        <li>любой деятельности, нарушающей законодательство страны пользователя или место расположения серверов Pulsar.</li>
      </ul>
      <p>
        В случае выявления подобных операций Pulsar вправе заблокировать пользователя, заморозить все его балансы и передать информацию в компетентные органы.
      </p>

      <h2>7. Изменения условий</h2>
      <p>
        Pulsar вправе в одностороннем порядке изменять настоящие Условия. Текущая редакция всегда доступна по адресу <code>/p2p/terms</code>. Продолжая использовать Сервис после внесения изменений, пользователь принимает новую редакцию.
      </p>

      <h2>8. Контакты</h2>
      <p>
        По вопросам, связанным с работой Сервиса или спорами по сделкам, обращайтесь к официальному боту Pulsar в чате платформы или на email поддержки.
      </p>

      <hr className="my-8 border-dark-600" />
      <p className="text-xs text-gray-500">
        Используя P2P-биржу, вы подтверждаете, что прочитали и согласились с настоящими Условиями.
      </p>
    </>
  );
}

function EnTerms() {
  return (
    <>
      <p className="text-xs text-gray-500">Last updated: May 7, 2026.</p>

      <h2>1. What the Pulsar P2P Exchange is</h2>
      <p>
        The Pulsar P2P Exchange (the «Service») is an <strong>information venue</strong> that lets users post offers and find each other to trade the platform's internal PLS token. Pulsar acts strictly as a technical intermediary: it provides the listing UI, the PLS escrow, the trade-status state machine, and basic arbitration in cases of obvious abuse.
      </p>
      <p>
        <strong>Pulsar is not a bank, exchanger, broker, or financial institution.</strong> The Service does not receive, hold, or transfer any fiat funds between users. All fiat settlements (rubles, dollars, euros, hryvnias, etc.) happen <strong>directly between the participants</strong>, at their own discretion, through banks and payment systems of their own choosing.
      </p>

      <h2>2. Legal status</h2>
      <p>
        The PLS token is not a security, legal tender, fiat currency, or monetary equivalent. It is internal platform points usable for in-app features (subscriptions, NFTs, governance, etc).
      </p>
      <p>
        By using the Service, the user confirms that they:
      </p>
      <ul>
        <li>have reached the age of majority in their jurisdiction;</li>
        <li>are legally permitted to transact with digital assets in their country of residence;</li>
        <li>are not located in a country or region where such transactions are prohibited by law or sanctions;</li>
        <li>do not use the Service for money laundering, financing terrorism, sanctions evasion, or any other unlawful activity.</li>
      </ul>

      <h2>3. User responsibility</h2>
      <p>The user is solely responsible for:</p>
      <ul>
        <li><strong>Tax obligations</strong> in their jurisdiction (income reporting, tax payment).</li>
        <li><strong>Compliance with currency and banking regulations</strong> of their country.</li>
        <li><strong>Counterparty due diligence</strong> before transacting: reputation, history, banking details.</li>
        <li><strong>Safeguarding their own payment credentials</strong>: passwords, OTPs, QR codes.</li>
        <li><strong>Confirming receipt of fiat funds</strong> before releasing PLS from escrow.</li>
        <li>Any disputes or losses arising from a poor counterparty choice.</li>
      </ul>

      <h2>4. Platform responsibility</h2>
      <p>The Service is provided <strong>«as-is»</strong> without warranties of any kind. Pulsar:</p>
      <ul>
        <li>does <strong>not guarantee</strong> the good faith of users or the authenticity of their offers;</li>
        <li>does <strong>not reimburse</strong> losses arising from counterparty fraud, mistyped banking details, or bank-side blocks;</li>
        <li>is <strong>not responsible</strong> for any suspension, restriction, or freeze of user accounts by banks or payment systems;</li>
        <li>does <strong>not provide</strong> investment, tax, or legal advice;</li>
        <li>reserves the right to <strong>freeze the PLS escrow</strong> or pause a trade upon suspicion of fraud or violation of these Terms or applicable law;</li>
        <li>may restrict access to the Service for users below the required verification level.</li>
      </ul>
      <p>
        In a dispute, Pulsar may at its discretion act as a mediator, request evidence (statements, screenshots), and where one side is clearly at fault, release the escrow in favour of the wronged party. The administration's decision is final and not subject to further appeal within the platform.
      </p>

      <h2>5. Taxes and reporting</h2>
      <p>
        Pulsar is not a withholding agent and does not issue tax forms. Each user is responsible for tracking their own gains and losses, reflecting them in the appropriate filings, and paying any applicable taxes.
      </p>

      <h2>6. Prohibited use</h2>
      <p>The Service must not be used to:</p>
      <ul>
        <li>launder proceeds of crime;</li>
        <li>finance terrorism or extremist activity;</li>
        <li>evade international or national sanctions;</li>
        <li>pay for goods or services whose trade is restricted or banned;</li>
        <li>cash out balances on behalf of others under false pretenses;</li>
        <li>conduct any activity violating the laws of the user's country or of the jurisdictions where Pulsar operates infrastructure.</li>
      </ul>
      <p>
        Where such activity is detected, Pulsar may suspend the user, freeze their balances, and disclose information to competent authorities.
      </p>

      <h2>7. Changes to these Terms</h2>
      <p>
        Pulsar may amend these Terms unilaterally. The current version is always available at <code>/p2p/terms</code>. Continued use of the Service after changes are posted constitutes acceptance of the new version.
      </p>

      <h2>8. Contact</h2>
      <p>
        For questions about the Service or trade disputes, contact the official Pulsar bot inside the platform chat or the support email.
      </p>

      <hr className="my-8 border-dark-600" />
      <p className="text-xs text-gray-500">
        By using the P2P Exchange, you acknowledge that you have read and accepted these Terms.
      </p>
    </>
  );
}
