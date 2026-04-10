#!/usr/bin/env python3
import os, re, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

additions = {
    'en': {
        'info.mediaPhotos': 'Photos',
        'info.mediaFiles': 'Files',
        'info.noMedia': 'No photos yet',
        'info.noFiles': 'No files yet',
        'info.loadMore': 'Load more',
    },
    'ru': {
        'info.mediaPhotos': 'Фото',
        'info.mediaFiles': 'Файлы',
        'info.noMedia': 'Фото пока нет',
        'info.noFiles': 'Файлов пока нет',
        'info.loadMore': 'Загрузить ещё',
    },
    'de': {
        'info.mediaPhotos': 'Fotos',
        'info.mediaFiles': 'Dateien',
        'info.noMedia': 'Noch keine Fotos',
        'info.noFiles': 'Noch keine Dateien',
        'info.loadMore': 'Mehr laden',
    },
    'es': {
        'info.mediaPhotos': 'Fotos',
        'info.mediaFiles': 'Archivos',
        'info.noMedia': 'Sin fotos aún',
        'info.noFiles': 'Sin archivos aún',
        'info.loadMore': 'Cargar más',
    },
    'fr': {
        'info.mediaPhotos': 'Photos',
        'info.mediaFiles': 'Fichiers',
        'info.noMedia': "Pas encore de photos",
        'info.noFiles': "Pas encore de fichiers",
        'info.loadMore': 'Charger plus',
    },
    'ja': {
        'info.mediaPhotos': '写真',
        'info.mediaFiles': 'ファイル',
        'info.noMedia': 'まだ写真がありません',
        'info.noFiles': 'まだファイルがありません',
        'info.loadMore': 'もっと読み込む',
    },
    'ko': {
        'info.mediaPhotos': '사진',
        'info.mediaFiles': '파일',
        'info.noMedia': '아직 사진이 없습니다',
        'info.noFiles': '아직 파일이 없습니다',
        'info.loadMore': '더 불러오기',
    },
    'pt': {
        'info.mediaPhotos': 'Fotos',
        'info.mediaFiles': 'Arquivos',
        'info.noMedia': 'Sem fotos ainda',
        'info.noFiles': 'Sem arquivos ainda',
        'info.loadMore': 'Carregar mais',
    },
    'tr': {
        'info.mediaPhotos': 'Fotoğraflar',
        'info.mediaFiles': 'Dosyalar',
        'info.noMedia': 'Henüz fotoğraf yok',
        'info.noFiles': 'Henüz dosya yok',
        'info.loadMore': 'Daha fazla yükle',
    },
    'uk': {
        'info.mediaPhotos': 'Фото',
        'info.mediaFiles': 'Файли',
        'info.noMedia': 'Фото поки немає',
        'info.noFiles': 'Файлів поки немає',
        'info.loadMore': 'Завантажити ще',
    },
    'zh': {
        'info.mediaPhotos': '照片',
        'info.mediaFiles': '文件',
        'info.noMedia': '暂无照片',
        'info.noFiles': '暂无文件',
        'info.loadMore': '加载更多',
    },
}

base = r'D:\Project\pulsar\apps\web\src\i18n'
for lang, keys in additions.items():
    filepath = os.path.join(base, f'{lang}.ts')
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    new_lines = []
    for k, v in keys.items():
        if v is None:
            continue  # skip placeholders
        # Use double quotes for values with apostrophes
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
