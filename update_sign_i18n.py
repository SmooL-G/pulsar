#!/usr/bin/env python3
import os, re, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

additions = {
    'de': {'chat.signEnabled': 'Signatur an', 'chat.signDisabled': 'Signatur aus'},
    'es': {'chat.signEnabled': 'Firmado', 'chat.signDisabled': 'Sin firma'},
    'fr': {'chat.signEnabled': 'Signature activée', 'chat.signDisabled': 'Signature désactivée'},
    'ja': {'chat.signEnabled': '署名あり', 'chat.signDisabled': '署名なし'},
    'ko': {'chat.signEnabled': '서명 켜짐', 'chat.signDisabled': '서명 꺼짐'},
    'pt': {'chat.signEnabled': 'Assinatura ativada', 'chat.signDisabled': 'Assinatura desativada'},
    'tr': {'chat.signEnabled': 'İmza açık', 'chat.signDisabled': 'İmza kapalı'},
    'uk': {'chat.signEnabled': 'Підпис увімк', 'chat.signDisabled': 'Підпис вимк'},
    'zh': {'chat.signEnabled': '签名开启', 'chat.signDisabled': '签名关闭'},
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
