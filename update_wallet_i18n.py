#!/usr/bin/env python3
import os, re, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

additions = {
    'en': {'auth.walletSign': 'Sign & Login', 'auth.walletDisconnect': 'Disconnect wallet'},
    'ru': {'auth.walletSign': 'Подписать и войти', 'auth.walletDisconnect': 'Отключить кошелёк'},
    'de': {'auth.walletSign': 'Signieren & Anmelden', 'auth.walletDisconnect': 'Wallet trennen'},
    'es': {'auth.walletSign': 'Firmar e ingresar', 'auth.walletDisconnect': 'Desconectar wallet'},
    'fr': {'auth.walletSign': 'Signer et se connecter', 'auth.walletDisconnect': 'Deconnecter le portefeuille'},
    'ja': {'auth.walletSign': '署名してログイン', 'auth.walletDisconnect': 'ウォレットを切断'},
    'ko': {'auth.walletSign': '서명 및 로그인', 'auth.walletDisconnect': '지갑 연결 해제'},
    'pt': {'auth.walletSign': 'Assinar e entrar', 'auth.walletDisconnect': 'Desconectar carteira'},
    'tr': {'auth.walletSign': 'Imzala ve giris yap', 'auth.walletDisconnect': 'Cuzdani bagla'},
    'uk': {'auth.walletSign': 'Підписати та увійти', 'auth.walletDisconnect': 'Відключити гаманець'},
    'zh': {'auth.walletSign': '签名并登录', 'auth.walletDisconnect': '断开钱包'},
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
