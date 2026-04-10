#!/usr/bin/env python3
import os, sys, re
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

additions = {
    'en': {
        'auth.walletLogin': 'Continue with Solana Wallet',
        'auth.walletConnecting': 'Connecting...',
        'auth.walletAuthFailed': 'Wallet authentication failed',
        'auth.orEmail': 'or with email',
        'auth.usernameAvailable': 'Available',
        'auth.usernameTaken': 'Already taken',
        'auth.usernameInvalid': 'Only letters, numbers, _ and -',
        'auth.usernameChecking': 'Checking...',
        'auth.passwordWeak': 'Weak',
        'auth.passwordFair': 'Fair',
        'auth.passwordGood': 'Good',
        'auth.passwordStrong': 'Strong',
        'auth.passwordVeryStrong': 'Very strong',
    },
    'ru': {
        'auth.walletLogin': 'Войти через Solana Кошелёк',
        'auth.walletConnecting': 'Подключение...',
        'auth.walletAuthFailed': 'Ошибка авторизации кошелька',
        'auth.orEmail': 'или через email',
        'auth.usernameAvailable': 'Доступно',
        'auth.usernameTaken': 'Уже занято',
        'auth.usernameInvalid': 'Только буквы, цифры, _ и -',
        'auth.usernameChecking': 'Проверка...',
        'auth.passwordWeak': 'Слабый',
        'auth.passwordFair': 'Средний',
        'auth.passwordGood': 'Хороший',
        'auth.passwordStrong': 'Надёжный',
        'auth.passwordVeryStrong': 'Очень надёжный',
    },
    'de': {
        'auth.walletLogin': 'Mit Solana Wallet fortfahren',
        'auth.walletConnecting': 'Verbinden...',
        'auth.walletAuthFailed': 'Wallet-Authentifizierung fehlgeschlagen',
        'auth.orEmail': 'oder per E-Mail',
        'auth.usernameAvailable': 'Verfügbar',
        'auth.usernameTaken': 'Bereits vergeben',
        'auth.usernameInvalid': 'Nur Buchstaben, Zahlen, _ und -',
        'auth.usernameChecking': 'Wird geprüft...',
        'auth.passwordWeak': 'Schwach',
        'auth.passwordFair': 'Mittel',
        'auth.passwordGood': 'Gut',
        'auth.passwordStrong': 'Stark',
        'auth.passwordVeryStrong': 'Sehr stark',
    },
    'es': {
        'auth.walletLogin': 'Continuar con Solana Wallet',
        'auth.walletConnecting': 'Conectando...',
        'auth.walletAuthFailed': 'Error de autenticacion de wallet',
        'auth.orEmail': 'o con correo electronico',
        'auth.usernameAvailable': 'Disponible',
        'auth.usernameTaken': 'Ya en uso',
        'auth.usernameInvalid': 'Solo letras, numeros, _ y -',
        'auth.usernameChecking': 'Verificando...',
        'auth.passwordWeak': 'Debil',
        'auth.passwordFair': 'Regular',
        'auth.passwordGood': 'Buena',
        'auth.passwordStrong': 'Fuerte',
        'auth.passwordVeryStrong': 'Muy fuerte',
    },
    'fr': {
        'auth.walletLogin': 'Continuer avec Solana Wallet',
        'auth.walletConnecting': 'Connexion...',
        'auth.walletAuthFailed': "Echec de l'authentification du portefeuille",
        'auth.orEmail': 'ou par e-mail',
        'auth.usernameAvailable': 'Disponible',
        'auth.usernameTaken': 'Deja pris',
        'auth.usernameInvalid': 'Lettres, chiffres, _ et - uniquement',
        'auth.usernameChecking': 'Verification...',
        'auth.passwordWeak': 'Faible',
        'auth.passwordFair': 'Moyen',
        'auth.passwordGood': 'Bon',
        'auth.passwordStrong': 'Fort',
        'auth.passwordVeryStrong': 'Tres fort',
    },
    'ja': {
        'auth.walletLogin': 'Solanaウォレットで続ける',
        'auth.walletConnecting': '接続中...',
        'auth.walletAuthFailed': 'ウォレット認証に失敗しました',
        'auth.orEmail': 'またはメールで',
        'auth.usernameAvailable': '使用可能',
        'auth.usernameTaken': '使用済み',
        'auth.usernameInvalid': '文字、数字、_、-のみ使用可能',
        'auth.usernameChecking': '確認中...',
        'auth.passwordWeak': '弱い',
        'auth.passwordFair': '普通',
        'auth.passwordGood': '良い',
        'auth.passwordStrong': '強い',
        'auth.passwordVeryStrong': '非常に強い',
    },
    'ko': {
        'auth.walletLogin': 'Solana 지갑으로 계속하기',
        'auth.walletConnecting': '연결 중...',
        'auth.walletAuthFailed': '지갑 인증 실패',
        'auth.orEmail': '또는 이메일로',
        'auth.usernameAvailable': '사용 가능',
        'auth.usernameTaken': '이미 사용 중',
        'auth.usernameInvalid': '문자, 숫자, _, - 만 사용 가능',
        'auth.usernameChecking': '확인 중...',
        'auth.passwordWeak': '약함',
        'auth.passwordFair': '보통',
        'auth.passwordGood': '좋음',
        'auth.passwordStrong': '강함',
        'auth.passwordVeryStrong': '매우 강함',
    },
    'pt': {
        'auth.walletLogin': 'Continuar com Solana Wallet',
        'auth.walletConnecting': 'Conectando...',
        'auth.walletAuthFailed': 'Falha na autenticacao da carteira',
        'auth.orEmail': 'ou com e-mail',
        'auth.usernameAvailable': 'Disponivel',
        'auth.usernameTaken': 'Ja em uso',
        'auth.usernameInvalid': 'Apenas letras, numeros, _ e -',
        'auth.usernameChecking': 'Verificando...',
        'auth.passwordWeak': 'Fraca',
        'auth.passwordFair': 'Razoavel',
        'auth.passwordGood': 'Boa',
        'auth.passwordStrong': 'Forte',
        'auth.passwordVeryStrong': 'Muito forte',
    },
    'tr': {
        'auth.walletLogin': 'Solana Wallet ile devam et',
        'auth.walletConnecting': 'Baglaniyor...',
        'auth.walletAuthFailed': 'Cuzdан kimlik dogrulamasi basarisiz',
        'auth.orEmail': 'veya e-posta ile',
        'auth.usernameAvailable': 'Kullanilabilir',
        'auth.usernameTaken': 'Zaten alinmis',
        'auth.usernameInvalid': 'Sadece harf, rakam, _ ve -',
        'auth.usernameChecking': 'Kontrol ediliyor...',
        'auth.passwordWeak': 'Zayif',
        'auth.passwordFair': 'Orta',
        'auth.passwordGood': 'Iyi',
        'auth.passwordStrong': 'Guclu',
        'auth.passwordVeryStrong': 'Cok guclu',
    },
    'uk': {
        'auth.walletLogin': 'Увійти через Solana Гаманець',
        'auth.walletConnecting': "Підключення...",
        'auth.walletAuthFailed': 'Помилка автентифікації гаманця',
        'auth.orEmail': 'або через email',
        'auth.usernameAvailable': 'Доступно',
        'auth.usernameTaken': 'Вже зайнято',
        'auth.usernameInvalid': 'Тільки букви, цифри, _ та -',
        'auth.usernameChecking': 'Перевірка...',
        'auth.passwordWeak': 'Слабкий',
        'auth.passwordFair': 'Середній',
        'auth.passwordGood': 'Хороший',
        'auth.passwordStrong': 'Надійний',
        'auth.passwordVeryStrong': 'Дуже надійний',
    },
    'zh': {
        'auth.walletLogin': '使用Solana钱包继续',
        'auth.walletConnecting': '连接中...',
        'auth.walletAuthFailed': '钱包认证失败',
        'auth.orEmail': '或使用邮箱',
        'auth.usernameAvailable': '可用',
        'auth.usernameTaken': '已被使用',
        'auth.usernameInvalid': '仅限字母、数字、_ 和 -',
        'auth.usernameChecking': '检查中...',
        'auth.passwordWeak': '弱',
        'auth.passwordFair': '一般',
        'auth.passwordGood': '良好',
        'auth.passwordStrong': '强',
        'auth.passwordVeryStrong': '非常强',
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

    # Fix any double commas
    content = re.sub(r',,', ',', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Updated {lang}.ts')

print('All done!')
