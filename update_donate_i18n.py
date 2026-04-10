#!/usr/bin/env python3
import os, re, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

additions = {
    'en': {
        'donate.title': 'Support Pulsar',
        'donate.subtitle': 'Help us grow, add new features and keep the servers running. Every donation matters!',
        'donate.address': 'Wallet address',
        'donate.copy': 'Copy address',
        'donate.copied': 'Address copied!',
        'donate.scanQr': 'Scan QR code with your wallet app',
        'donate.boostyDesc': 'Support with a card payment (RU/CIS)',
        'donate.support': 'Support',
        'donate.thanks': 'Thank you for supporting the development of Pulsar',
        'donate.link': 'Support',
    },
    'ru': {
        'donate.title': 'Поддержать Pulsar',
        'donate.subtitle': 'Помоги нам развиваться, добавлять новые функции и оплачивать серверы. Каждый донат важен!',
        'donate.address': 'Адрес кошелька',
        'donate.copy': 'Скопировать адрес',
        'donate.copied': 'Адрес скопирован!',
        'donate.scanQr': 'Отсканируй QR-код в приложении кошелька',
        'donate.boostyDesc': 'Поддержать картой (RU/СНГ)',
        'donate.support': 'Поддержать',
        'donate.thanks': 'Спасибо за поддержку развития Pulsar',
        'donate.link': 'Поддержать',
    },
    'de': {
        'donate.title': 'Pulsar unterstuetzen',
        'donate.subtitle': 'Hilf uns zu wachsen, neue Funktionen hinzuzufuegen und die Server am Laufen zu halten.',
        'donate.address': 'Wallet-Adresse',
        'donate.copy': 'Adresse kopieren',
        'donate.copied': 'Adresse kopiert!',
        'donate.scanQr': 'QR-Code mit deiner Wallet-App scannen',
        'donate.boostyDesc': 'Mit Karte unterstuetzen',
        'donate.support': 'Unterstuetzen',
        'donate.thanks': 'Danke fuer die Unterstuetzung der Pulsar-Entwicklung',
        'donate.link': 'Spenden',
    },
    'es': {
        'donate.title': 'Apoyar Pulsar',
        'donate.subtitle': 'Ayudanos a crecer, anadir nuevas funciones y mantener los servidores en marcha.',
        'donate.address': 'Direccion de billetera',
        'donate.copy': 'Copiar direccion',
        'donate.copied': 'Direccion copiada!',
        'donate.scanQr': 'Escanea el codigo QR con tu app de billetera',
        'donate.boostyDesc': 'Apoyar con tarjeta',
        'donate.support': 'Apoyar',
        'donate.thanks': 'Gracias por apoyar el desarrollo de Pulsar',
        'donate.link': 'Donar',
    },
    'fr': {
        'donate.title': 'Soutenir Pulsar',
        'donate.subtitle': "Aidez-nous a grandir, ajouter de nouvelles fonctionnalites et garder les serveurs en ligne.",
        'donate.address': 'Adresse du portefeuille',
        'donate.copy': "Copier l'adresse",
        'donate.copied': 'Adresse copiee !',
        'donate.scanQr': 'Scannez le QR code avec votre application',
        'donate.boostyDesc': 'Soutenir par carte',
        'donate.support': 'Soutenir',
        'donate.thanks': 'Merci de soutenir le developpement de Pulsar',
        'donate.link': 'Donner',
    },
    'ja': {
        'donate.title': 'Pulsarを支援',
        'donate.subtitle': '成長、新機能の追加、サーバー維持にご協力ください。',
        'donate.address': 'ウォレットアドレス',
        'donate.copy': 'アドレスをコピー',
        'donate.copied': 'コピーしました！',
        'donate.scanQr': 'ウォレットアプリでQRコードをスキャン',
        'donate.boostyDesc': 'カードで支援',
        'donate.support': '支援する',
        'donate.thanks': 'Pulsarの開発を支援していただきありがとうございます',
        'donate.link': '支援',
    },
    'ko': {
        'donate.title': 'Pulsar 후원',
        'donate.subtitle': '성장, 새 기능 추가, 서버 유지를 위해 도와주세요.',
        'donate.address': '지갑 주소',
        'donate.copy': '주소 복사',
        'donate.copied': '주소가 복사되었습니다!',
        'donate.scanQr': '지갑 앱으로 QR 코드 스캔',
        'donate.boostyDesc': '카드로 후원',
        'donate.support': '후원하기',
        'donate.thanks': 'Pulsar 개발을 지원해 주셔서 감사합니다',
        'donate.link': '후원',
    },
    'pt': {
        'donate.title': 'Apoiar Pulsar',
        'donate.subtitle': 'Ajude-nos a crescer, adicionar novos recursos e manter os servidores funcionando.',
        'donate.address': 'Endereco da carteira',
        'donate.copy': 'Copiar endereco',
        'donate.copied': 'Endereco copiado!',
        'donate.scanQr': 'Escaneie o QR code com seu aplicativo de carteira',
        'donate.boostyDesc': 'Apoiar com cartao',
        'donate.support': 'Apoiar',
        'donate.thanks': 'Obrigado por apoiar o desenvolvimento do Pulsar',
        'donate.link': 'Doar',
    },
    'tr': {
        'donate.title': "Pulsar'i Destekle",
        'donate.subtitle': "Buyumemize, yeni ozellikler eklememize ve sunuculari calistir tutmamiza yardim et.",
        'donate.address': 'Cuzdan adresi',
        'donate.copy': 'Adresi kopyala',
        'donate.copied': 'Adres kopyalandi!',
        'donate.scanQr': 'Cuzdan uygulamanizla QR kodu tarayin',
        'donate.boostyDesc': 'Kartla destek ol',
        'donate.support': 'Destek ol',
        'donate.thanks': "Pulsar'in gelisimine destek verdiginiz icin tesekkurler",
        'donate.link': 'Bagis',
    },
    'uk': {
        'donate.title': 'Підтримати Pulsar',
        'donate.subtitle': 'Допоможи нам розвиватися, додавати нові функції та оплачувати сервери.',
        'donate.address': 'Адреса гаманця',
        'donate.copy': 'Скопіювати адресу',
        'donate.copied': 'Адресу скопійовано!',
        'donate.scanQr': 'Відскануй QR-код у додатку гаманця',
        'donate.boostyDesc': 'Підтримати карткою',
        'donate.support': 'Підтримати',
        'donate.thanks': 'Дякуємо за підтримку розвитку Pulsar',
        'donate.link': 'Підтримати',
    },
    'zh': {
        'donate.title': '支持 Pulsar',
        'donate.subtitle': '帮助我们成长、添加新功能并保持服务器运行。每一笔捐款都很重要！',
        'donate.address': '钱包地址',
        'donate.copy': '复制地址',
        'donate.copied': '地址已复制！',
        'donate.scanQr': '使用钱包应用扫描二维码',
        'donate.boostyDesc': '用卡片支持',
        'donate.support': '支持',
        'donate.thanks': '感谢您支持 Pulsar 的开发',
        'donate.link': '捐款',
    },
}

base = r'D:\Project\pulsar\apps\web\src\i18n'
for lang, keys in additions.items():
    filepath = os.path.join(base, f'{lang}.ts')
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    new_lines = []
    for k, v in keys.items():
        if "'" in v:
            new_lines.append(f'  \'{k}\': "{v}",')
        else:
            new_lines.append(f"  '{k}': '{v}',")
    insert = '\n'.join(new_lines)
    content = content.rstrip()
    if content.endswith('};'):
        content = content[:-2].rstrip() + ',\n' + insert + '\n};\n'
    content = re.sub(r',,', ',', content)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Updated {lang}.ts')
print('Done!')
