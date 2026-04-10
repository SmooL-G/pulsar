#!/usr/bin/env python3
"""Deploy channel feature to VPS."""
import sys
import os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import paramiko
from scp import SCPClient

HOST = '72.56.5.167'
USER = 'root'
PASS = 'jjn#uqiaXQWCe8'
REMOTE_BASE = '/home/pulsar/app'

LOCAL_BASE = os.path.dirname(os.path.abspath(__file__))

FILES = [
    # Backend
    'apps/server/src/db/schema.prisma',
    'apps/server/src/app.ts',
    'apps/server/src/modules/chat/chat.routes.ts',
    'apps/server/src/modules/channel/channel.routes.ts',
    'apps/server/src/socket/handlers/messageHandler.ts',
    # Shared types
    'packages/shared/src/types/chat.ts',
    # Frontend
    'apps/web/src/components/chat/NewChatModal.tsx',
    'apps/web/src/components/chat/MessageInput.tsx',
    'apps/web/src/components/chat/ChatListItem.tsx',
    'apps/web/src/components/layout/ChatArea.tsx',
    'apps/web/src/components/layout/InfoPanel.tsx',
    'apps/web/src/pages/RoadmapPage.tsx',
    # i18n
    'apps/web/src/i18n/en.ts',
    'apps/web/src/i18n/ru.ts',
    'apps/web/src/i18n/de.ts',
    'apps/web/src/i18n/es.ts',
    'apps/web/src/i18n/fr.ts',
    'apps/web/src/i18n/ja.ts',
    'apps/web/src/i18n/ko.ts',
    'apps/web/src/i18n/pt.ts',
    'apps/web/src/i18n/tr.ts',
    'apps/web/src/i18n/uk.ts',
    'apps/web/src/i18n/zh.ts',
]

def run(ssh, cmd):
    print(f'$ {cmd}')
    _, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out: print(out, end='')
    if err: print(err, end='', file=sys.stderr)
    return stdout.channel.recv_exit_status()

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)
print('Connected.')

with SCPClient(ssh.get_transport()) as scp:
    for f in FILES:
        local = os.path.join(LOCAL_BASE, f.replace('/', os.sep))
        remote = f'{REMOTE_BASE}/{f}'
        run(ssh, f'mkdir -p $(dirname {remote})')
        print(f'Uploading {f} ...')
        scp.put(local, remote)

# Add allow_comments column to DB
print('\nAdding allow_comments column to DB...')
sql = "ALTER TABLE chats ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT false;"
run(ssh, f'cd {REMOTE_BASE} && docker compose -f docker-compose.prod.yml exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "{sql}"')

print('\nRebuilding server container...')
run(ssh, f'cd {REMOTE_BASE} && docker compose -f docker-compose.prod.yml build server 2>&1')
run(ssh, f'cd {REMOTE_BASE} && docker compose -f docker-compose.prod.yml up -d server 2>&1')

print('\nRebuilding web container...')
run(ssh, f'cd {REMOTE_BASE} && docker compose -f docker-compose.prod.yml build web 2>&1')
run(ssh, f'cd {REMOTE_BASE} && docker compose -f docker-compose.prod.yml up -d web 2>&1')

print('\nDone!')
ssh.close()
