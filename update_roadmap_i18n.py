#!/usr/bin/env python3
import os, re, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

additions = {
    'en': {
        'roadmap.f.groupChannelAvatars': 'Group & channel avatar upload',
        'roadmap.f.floatingInput':       'Floating message input UI',
        'roadmap.f.authUX':              'Auth UX (password strength, username check, show/hide)',
        'roadmap.f.https':               'HTTPS + custom domain (pulsar-chat.net)',
        'roadmap.f.walletLogin':         'Solana wallet login (Phantom / Solflare)',
        'roadmap.f.walletLink':          'External wallet linking',
    },
    'ru': {
        'roadmap.f.groupChannelAvatars': 'Аватарки для групп и каналов',
        'roadmap.f.floatingInput':       'Плавающее поле ввода сообщений',
        'roadmap.f.authUX':              'UX авторизации (сила пароля, проверка username, показ пароля)',
        'roadmap.f.https':               'HTTPS + свой домен (pulsar-chat.net)',
        'roadmap.f.walletLogin':         'Вход через Solana кошелёк (Phantom / Solflare)',
        'roadmap.f.walletLink':          'Привязка внешнего кошелька',
    },
    'de': {
        'roadmap.f.groupChannelAvatars': 'Avatar-Upload fur Gruppen & Kanale',
        'roadmap.f.floatingInput':       'Schwebendes Nachrichteneingabefeld',
        'roadmap.f.authUX':              'Auth-UX (Passwortsicherheit, Benutzernamen-Check)',
        'roadmap.f.https':               'HTTPS + eigene Domain (pulsar-chat.net)',
        'roadmap.f.walletLogin':         'Solana-Wallet-Login (Phantom / Solflare)',
        'roadmap.f.walletLink':          'Externes Wallet verknupfen',
    },
    'es': {
        'roadmap.f.groupChannelAvatars': 'Subida de avatares para grupos y canales',
        'roadmap.f.floatingInput':       'Campo de entrada flotante',
        'roadmap.f.authUX':              'UX de autenticacion (fortaleza de contrasena, verificacion de usuario)',
        'roadmap.f.https':               'HTTPS + dominio propio (pulsar-chat.net)',
        'roadmap.f.walletLogin':         'Inicio de sesion con wallet Solana (Phantom / Solflare)',
        'roadmap.f.walletLink':          'Vinculacion de wallet externa',
    },
    'fr': {
        'roadmap.f.groupChannelAvatars': 'Upload d\'avatar pour groupes et canaux',
        'roadmap.f.floatingInput':       'Champ de saisie flottant',
        'roadmap.f.authUX':              'UX d\'authentification (force du mot de passe, verification pseudo)',
        'roadmap.f.https':               'HTTPS + domaine personnalise (pulsar-chat.net)',
        'roadmap.f.walletLogin':         'Connexion via wallet Solana (Phantom / Solflare)',
        'roadmap.f.walletLink':          'Liaison de portefeuille externe',
    },
    'ja': {
        'roadmap.f.groupChannelAvatars': 'グループ・チャンネルのアバターアップロード',
        'roadmap.f.floatingInput':       'フローティングメッセージ入力UI',
        'roadmap.f.authUX':              '認証UX改善（パスワード強度・ユーザー名確認）',
        'roadmap.f.https':               'HTTPS + カスタムドメイン (pulsar-chat.net)',
        'roadmap.f.walletLogin':         'Solanaウォレットログイン (Phantom / Solflare)',
        'roadmap.f.walletLink':          '外部ウォレット連携',
    },
    'ko': {
        'roadmap.f.groupChannelAvatars': '그룹 및 채널 아바타 업로드',
        'roadmap.f.floatingInput':       '플로팅 메시지 입력 UI',
        'roadmap.f.authUX':              '인증 UX 개선 (비밀번호 강도, 사용자명 확인)',
        'roadmap.f.https':               'HTTPS + 커스텀 도메인 (pulsar-chat.net)',
        'roadmap.f.walletLogin':         'Solana 지갑 로그인 (Phantom / Solflare)',
        'roadmap.f.walletLink':          '외부 지갑 연결',
    },
    'pt': {
        'roadmap.f.groupChannelAvatars': 'Upload de avatar para grupos e canais',
        'roadmap.f.floatingInput':       'Campo de entrada flutuante',
        'roadmap.f.authUX':              'UX de autenticacao (forca da senha, verificacao de usuario)',
        'roadmap.f.https':               'HTTPS + dominio proprio (pulsar-chat.net)',
        'roadmap.f.walletLogin':         'Login com carteira Solana (Phantom / Solflare)',
        'roadmap.f.walletLink':          'Vinculacao de carteira externa',
    },
    'tr': {
        'roadmap.f.groupChannelAvatars': 'Grup ve kanal avatar yuklemesi',
        'roadmap.f.floatingInput':       'Yuzen mesaj giris alani',
        'roadmap.f.authUX':              'Kimlik dogrulama UX (sifre gucu, kullanici adi kontrolu)',
        'roadmap.f.https':               'HTTPS + ozel alan adi (pulsar-chat.net)',
        'roadmap.f.walletLogin':         'Solana cuzdani ile giris (Phantom / Solflare)',
        'roadmap.f.walletLink':          'Harici cuzdan baglama',
    },
    'uk': {
        'roadmap.f.groupChannelAvatars': 'Завантаження аватарів для груп і каналів',
        'roadmap.f.floatingInput':       'Плаваюче поле введення повідомлень',
        'roadmap.f.authUX':              'UX авторизації (сила пароля, перевірка username)',
        'roadmap.f.https':               'HTTPS + власний домен (pulsar-chat.net)',
        'roadmap.f.walletLogin':         'Вхід через Solana гаманець (Phantom / Solflare)',
        'roadmap.f.walletLink':          "Прив'язка зовнішнього гаманця",
    },
    'zh': {
        'roadmap.f.groupChannelAvatars': '群组和频道头像上传',
        'roadmap.f.floatingInput':       '悬浮消息输入框',
        'roadmap.f.authUX':              '认证UX优化（密码强度、用户名检查）',
        'roadmap.f.https':               'HTTPS + 自定义域名 (pulsar-chat.net)',
        'roadmap.f.walletLogin':         'Solana钱包登录 (Phantom / Solflare)',
        'roadmap.f.walletLink':          '绑定外部钱包',
    },
}

base = r'D:\Project\pulsar\apps\web\src\i18n'
for lang, keys in additions.items():
    filepath = os.path.join(base, f'{lang}.ts')
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    new_lines = [f"  '{k}': '{v.replace(chr(39), chr(92)+chr(39))}',""" for k, v in keys.items()]
    insert = '\n'.join(new_lines)
    content = content.rstrip()
    if content.endswith('};'):
        content = content[:-2].rstrip() + ',\n' + insert + '\n};\n'
    content = re.sub(r',,', ',', content)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Updated {lang}.ts')
print('Done!')
