#!/usr/bin/env python3
import os, re, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

additions = {
    'de': {'roadmap.f.signToggle': 'Wallet-Signatur umschalten'},
    'es': {'roadmap.f.signToggle': 'Alternancia de firma de billetera'},
    'fr': {'roadmap.f.signToggle': 'Bascule de signature du portefeuille'},
    'ja': {'roadmap.f.signToggle': 'ウォレット署名トグル'},
    'ko': {'roadmap.f.signToggle': '지갑 서명 토글'},
    'pt': {'roadmap.f.signToggle': 'Alternância de assinatura de carteira'},
    'tr': {'roadmap.f.signToggle': 'Cüzdan imza geçişi'},
    'uk': {'roadmap.f.signToggle': 'Перемикач підпису гаманця'},
    'zh': {'roadmap.f.signToggle': '钱包签名开关'},
}

base = r'D:\Project\pulsar\apps\web\src\i18n'
for lang, keys in additions.items():
    filepath = os.path.join(base, f'{lang}.ts')
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    new_lines = []
    for k, v in keys.items():
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
