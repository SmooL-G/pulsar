#!/usr/bin/env python3
import os, re, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

additions = {
    'en': {'chat.offline': 'offline'},
    'ru': {'chat.offline': 'не в сети'},
    'de': {'chat.offline': 'offline'},
    'es': {'chat.offline': 'desconectado'},
    'fr': {'chat.offline': 'hors ligne'},
    'ja': {'chat.offline': 'オフライン'},
    'ko': {'chat.offline': '오프라인'},
    'pt': {'chat.offline': 'offline'},
    'tr': {'chat.offline': 'cevrimdisi'},
    'uk': {'chat.offline': 'не в мережі'},
    'zh': {'chat.offline': '离线'},
}

base = r'D:\Project\pulsar\apps\web\src\i18n'
for lang, keys in additions.items():
    filepath = os.path.join(base, f'{lang}.ts')
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    new_lines = [f"  '{k}': '{v}'," for k, v in keys.items()]
    insert = '\n'.join(new_lines)
    content = content.rstrip()
    if content.endswith('};'):
        content = content[:-2].rstrip() + ',\n' + insert + '\n};\n'
    content = re.sub(r',,', ',', content)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Updated {lang}.ts')
print('Done!')
