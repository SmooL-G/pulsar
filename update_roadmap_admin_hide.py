#!/usr/bin/env python3
import os, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

replacements = {
    'de': {
        "Adminbereich": "Plattform-Kontrollzentrum",
        "Benutzerverwaltung": "Community-Tools",
        "Inhaltsmoderation": "Inhaltssicherheit",
        "KI-Inhaltsmoderation": "KI-Sicherheitsfilter",
    },
    'es': {
        "Panel de administración": "Centro de control de plataforma",
        "Gestión de usuarios": "Herramientas comunitarias",
        "Moderación de contenido": "Seguridad de contenido",
        "Moderación con IA": "Filtros de seguridad IA",
    },
    'fr': {
        "Tableau de bord admin": "Centre de contrôle plateforme",
        "Gestion des utilisateurs": "Outils communautaires",
        "Modération de contenu": "Sécurité du contenu",
        "Modération IA": "Filtres de sécurité IA",
    },
    'ja': {
        "管理ダッシュボード": "プラットフォーム管理センター",
        "ユーザー管理": "コミュニティツール",
        "コンテンツモデレーション": "コンテンツセーフティ",
        "AIコンテンツモデレーション": "AIセーフティフィルター",
    },
    'ko': {
        "관리자 대시보드": "플랫폼 관리 센터",
        "사용자 관리": "커뮤니티 도구",
        "콘텐츠 관리": "콘텐츠 안전",
        "AI 콘텐츠 관리": "AI 안전 필터",
    },
    'pt': {
        "Painel admin": "Central de controle",
        "Gerenciamento de usuários": "Ferramentas comunitárias",
        "Moderação de conteúdo": "Segurança de conteúdo",
        "Moderação por IA": "Filtros de segurança IA",
    },
    'tr': {
        "Yönetici paneli": "Platform kontrol merkezi",
        "Kullanıcı yönetimi": "Topluluk araçları",
        "İçerik moderasyonu": "İçerik güvenliği",
        "AI içerik moderasyonu": "AI güvenlik filtreleri",
    },
    'uk': {
        "Адмін-дашборд": "Центр управління платформою",
        "Управління користувачами": "Інструменти спільноти",
        "Модерація контенту": "Безпека контенту",
        "AI-модерація контенту": "AI-фільтри безпеки",
    },
    'zh': {
        "管理后台": "平台控制中心",
        "用户管理": "社区工具",
        "内容审核": "内容安全",
        "AI内容审核": "AI安全过滤器",
    },
}

base = r'D:\Project\pulsar\apps\web\src\i18n'
for lang, reps in replacements.items():
    filepath = os.path.join(base, f'{lang}.ts')
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    for old, new in reps.items():
        content = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Updated {lang}.ts')

# Also update aiModeration in en and ru
for lang, old, new in [
    ('en', "'roadmap.f.aiModeration': 'AI Content Moderation'", "'roadmap.f.aiModeration': 'AI Safety Filters'"),
    ('ru', "'roadmap.f.aiModeration': 'AI-модерация'", "'roadmap.f.aiModeration': 'AI-фильтры безопасности'"),
]:
    filepath = os.path.join(base, f'{lang}.ts')
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Updated aiModeration in {lang}.ts')

print('Done!')
