#!/usr/bin/env python3
import os, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

additions = {
    'en': {
        'legal.termsTitle': 'Terms of Service',
        'legal.offerTitle': 'Public Offer',
        'legal.cookiesTitle': 'Cookie Policy',
        'legal.terms': 'Terms of Service',
        'legal.offer': 'Public Offer',
        'legal.privacy': 'Privacy Policy',
        'legal.cookies': 'Cookie Policy',
        'legal.consentText': 'I agree with the',
        'legal.consentDataText': 'and consent to the processing of my personal data.',
        'legal.consentMarketing': 'I agree to receive promotional emails and platform updates (optional).',
        'legal.consentRequired': 'Please accept the terms to continue.',
        'roadmap.f.legalDocs': 'Legal docs (Terms, Offer, Cookies)',
        'roadmap.f.consentFlow': 'Registration consent flow',
    },
    'ru': {
        'legal.termsTitle': 'Пользовательское соглашение',
        'legal.offerTitle': 'Публичная оферта',
        'legal.cookiesTitle': 'Политика Cookie',
        'legal.terms': 'Пользовательским соглашением',
        'legal.offer': 'Публичной офертой',
        'legal.privacy': 'Политикой конфиденциальности',
        'legal.cookies': 'Политикой Cookie',
        'legal.consentText': 'Я соглашаюсь с',
        'legal.consentDataText': 'и даю согласие на обработку персональных данных.',
        'legal.consentMarketing': 'Я согласен(на) на получение рекламных рассылок и обновлений платформы (необязательно).',
        'legal.consentRequired': 'Необходимо принять условия для продолжения.',
        'roadmap.f.legalDocs': 'Правовые документы (Оферта, Соглашение, Cookie)',
        'roadmap.f.consentFlow': 'Согласие при регистрации',
    },
    'de': {
        'legal.termsTitle': 'Nutzungsbedingungen',
        'legal.offerTitle': 'Oeffentliches Angebot',
        'legal.cookiesTitle': 'Cookie-Richtlinie',
        'legal.terms': 'Nutzungsbedingungen',
        'legal.offer': 'Oeffentlichem Angebot',
        'legal.privacy': 'Datenschutzrichtlinie',
        'legal.cookies': 'Cookie-Richtlinie',
        'legal.consentText': 'Ich stimme zu mit',
        'legal.consentDataText': 'und stimme der Verarbeitung meiner personenbezogenen Daten zu.',
        'legal.consentMarketing': 'Ich stimme dem Erhalt von Werbe-E-Mails und Plattform-Updates zu (optional).',
        'legal.consentRequired': 'Bitte akzeptieren Sie die Bedingungen, um fortzufahren.',
        'roadmap.f.legalDocs': 'Rechtsdokumente (AGB, Angebot, Cookies)',
        'roadmap.f.consentFlow': 'Einwilligungsablauf bei der Registrierung',
    },
    'es': {
        'legal.termsTitle': 'Terminos de servicio',
        'legal.offerTitle': 'Oferta publica',
        'legal.cookiesTitle': 'Politica de cookies',
        'legal.terms': 'Terminos de servicio',
        'legal.offer': 'Oferta publica',
        'legal.privacy': 'Politica de privacidad',
        'legal.cookies': 'Politica de cookies',
        'legal.consentText': 'Acepto',
        'legal.consentDataText': 'y doy mi consentimiento para el procesamiento de mis datos personales.',
        'legal.consentMarketing': 'Acepto recibir correos promocionales y actualizaciones de la plataforma (opcional).',
        'legal.consentRequired': 'Por favor, acepta los terminos para continuar.',
        'roadmap.f.legalDocs': 'Documentos legales (Terminos, Oferta, Cookies)',
        'roadmap.f.consentFlow': 'Flujo de consentimiento en el registro',
    },
    'fr': {
        'legal.termsTitle': "Conditions d'utilisation",
        'legal.offerTitle': 'Offre publique',
        'legal.cookiesTitle': 'Politique des cookies',
        'legal.terms': "Conditions d'utilisation",
        'legal.offer': "l'Offre publique",
        'legal.privacy': 'la Politique de confidentialite',
        'legal.cookies': 'la Politique des cookies',
        'legal.consentText': "J'accepte",
        'legal.consentDataText': 'et consens au traitement de mes donnees personnelles.',
        'legal.consentMarketing': "J'accepte de recevoir des e-mails promotionnels et des mises a jour de la plateforme (facultatif).",
        'legal.consentRequired': 'Veuillez accepter les conditions pour continuer.',
        'roadmap.f.legalDocs': 'Documents legaux (CGU, Offre, Cookies)',
        'roadmap.f.consentFlow': "Flux de consentement a l'inscription",
    },
    'ja': {
        'legal.termsTitle': '利用規約',
        'legal.offerTitle': '公開オファー',
        'legal.cookiesTitle': 'Cookieポリシー',
        'legal.terms': '利用規約',
        'legal.offer': '公開オファー',
        'legal.privacy': 'プライバシーポリシー',
        'legal.cookies': 'Cookieポリシー',
        'legal.consentText': '私は以下に同意します：',
        'legal.consentDataText': '、および個人データの処理に同意します。',
        'legal.consentMarketing': 'プロモーションメールとプラットフォームの更新情報の受信に同意します（任意）。',
        'legal.consentRequired': '続行するには規約に同意してください。',
        'roadmap.f.legalDocs': '法的文書（規約、オファー、Cookie）',
        'roadmap.f.consentFlow': '登録時の同意フロー',
    },
    'ko': {
        'legal.termsTitle': '이용약관',
        'legal.offerTitle': '공개 오퍼',
        'legal.cookiesTitle': '쿠키 정책',
        'legal.terms': '이용약관',
        'legal.offer': '공개 오퍼',
        'legal.privacy': '개인정보 처리방침',
        'legal.cookies': '쿠키 정책',
        'legal.consentText': '다음에 동의합니다:',
        'legal.consentDataText': '및 개인 데이터 처리에 동의합니다.',
        'legal.consentMarketing': '프로모션 이메일 및 플랫폼 업데이트 수신에 동의합니다 (선택사항).',
        'legal.consentRequired': '계속하려면 약관에 동의해 주세요.',
        'roadmap.f.legalDocs': '법적 문서 (약관, 오퍼, 쿠키)',
        'roadmap.f.consentFlow': '회원가입 동의 플로우',
    },
    'pt': {
        'legal.termsTitle': 'Termos de Servico',
        'legal.offerTitle': 'Oferta Publica',
        'legal.cookiesTitle': 'Politica de Cookies',
        'legal.terms': 'Termos de Servico',
        'legal.offer': 'Oferta Publica',
        'legal.privacy': 'Politica de Privacidade',
        'legal.cookies': 'Politica de Cookies',
        'legal.consentText': 'Concordo com',
        'legal.consentDataText': 'e consinto com o processamento dos meus dados pessoais.',
        'legal.consentMarketing': 'Concordo em receber e-mails promocionais e atualizacoes da plataforma (opcional).',
        'legal.consentRequired': 'Por favor, aceite os termos para continuar.',
        'roadmap.f.legalDocs': 'Documentos legais (Termos, Oferta, Cookies)',
        'roadmap.f.consentFlow': 'Fluxo de consentimento no registro',
    },
    'tr': {
        'legal.termsTitle': 'Kullanim Kosullari',
        'legal.offerTitle': 'Kamu Teklifi',
        'legal.cookiesTitle': 'Cerez Politikasi',
        'legal.terms': 'Kullanim Kosullari',
        'legal.offer': 'Kamu Teklifi',
        'legal.privacy': 'Gizlilik Politikasi',
        'legal.cookies': 'Cerez Politikasi',
        'legal.consentText': 'Sunlari kabul ediyorum:',
        'legal.consentDataText': 've kisisel verilerimin islenmesine onay veriyorum.',
        'legal.consentMarketing': 'Tanitim e-postalari ve platform guncellemeleri almayi kabul ediyorum (istege bagli).',
        'legal.consentRequired': 'Devam etmek icin kosullari kabul etmeniz gerekmektedir.',
        'roadmap.f.legalDocs': 'Yasal belgeler (Kosullar, Teklif, Cerezler)',
        'roadmap.f.consentFlow': 'Kayit onay akisi',
    },
    'uk': {
        'legal.termsTitle': 'Угода користувача',
        'legal.offerTitle': 'Публічна оферта',
        'legal.cookiesTitle': 'Політика Cookie',
        'legal.terms': 'Угодою користувача',
        'legal.offer': 'Публічною офертою',
        'legal.privacy': 'Політикою конфіденційності',
        'legal.cookies': 'Політикою Cookie',
        'legal.consentText': 'Я погоджуюсь з',
        'legal.consentDataText': 'та даю згоду на обробку персональних даних.',
        'legal.consentMarketing': 'Я погоджуюсь на отримання рекламних розсилок та оновлень платформи (необовязково).',
        'legal.consentRequired': 'Необхідно прийняти умови для продовження.',
        'roadmap.f.legalDocs': 'Правові документи (Оферта, Угода, Cookie)',
        'roadmap.f.consentFlow': 'Згода при реєстрації',
    },
    'zh': {
        'legal.termsTitle': '服务条款',
        'legal.offerTitle': '公开要约',
        'legal.cookiesTitle': 'Cookie政策',
        'legal.terms': '服务条款',
        'legal.offer': '公开要约',
        'legal.privacy': '隐私政策',
        'legal.cookies': 'Cookie政策',
        'legal.consentText': '我同意',
        'legal.consentDataText': '并同意处理我的个人数据。',
        'legal.consentMarketing': '我同意接收促销邮件和平台更新（可选）。',
        'legal.consentRequired': '请接受条款以继续。',
        'roadmap.f.legalDocs': '法律文件（条款、要约、Cookie）',
        'roadmap.f.consentFlow': '注册同意流程',
    },
}

base = r'D:\Project\pulsar\apps\web\src\i18n'
for lang, keys in additions.items():
    filepath = os.path.join(base, f'{lang}.ts')
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_lines = []
    for k, v in keys.items():
        v_escaped = v.replace("'", "\\'")
        new_lines.append(f"  '{k}': '{v_escaped}',")

    insert = '\n'.join(new_lines)
    content = content.rstrip()
    if content.endswith('};'):
        content = content[:-2].rstrip() + ',\n' + insert + '\n};\n'

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Updated {lang}.ts')

print('All done!')
