#!/usr/bin/env python3
import os, re, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

additions = {
    'de': {'chat.pin': 'Nachricht anheften', 'chat.unpin': 'Lösen', 'chat.pinnedMessage': 'Angeheftete Nachricht'},
    'es': {'chat.pin': 'Fijar mensaje', 'chat.unpin': 'Desfijar', 'chat.pinnedMessage': 'Mensaje fijado'},
    'fr': {'chat.pin': 'Épingler', 'chat.unpin': 'Désépingler', 'chat.pinnedMessage': 'Message épinglé'},
    'ja': {'chat.pin': 'ピン留め', 'chat.unpin': '解除', 'chat.pinnedMessage': 'ピン留めメッセージ'},
    'ko': {'chat.pin': '메시지 고정', 'chat.unpin': '고정 해제', 'chat.pinnedMessage': '고정된 메시지'},
    'pt': {'chat.pin': 'Fixar mensagem', 'chat.unpin': 'Desafixar', 'chat.pinnedMessage': 'Mensagem fixada'},
    'tr': {'chat.pin': 'Mesajı sabitle', 'chat.unpin': 'Sabitlemeyi kaldır', 'chat.pinnedMessage': 'Sabitlenmiş mesaj'},
    'uk': {'chat.pin': 'Закріпити', 'chat.unpin': 'Відкріпити', 'chat.pinnedMessage': 'Закріплене повідомлення'},
    'zh': {'chat.pin': '固定消息', 'chat.unpin': '取消固定', 'chat.pinnedMessage': '已固定的消息'},
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
