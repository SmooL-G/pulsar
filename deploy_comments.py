#!/usr/bin/env python3
"""Deploy per-post comments feature."""
import sys, os, paramiko
from scp import SCPClient
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST, USER, PASS = '72.56.5.167', 'root', 'jjn#uqiaXQWCe8'
REMOTE = '/home/pulsar/app'
LOCAL = os.path.dirname(os.path.abspath(__file__))

FILES = [
    'apps/server/src/db/schema.prisma',
    'apps/server/src/socket/handlers/messageHandler.ts',
    'packages/shared/src/types/message.ts',
    'apps/web/src/store/messageStore.ts',
    'apps/web/src/components/chat/MessageInput.tsx',
    'apps/web/src/components/chat/MessageBubble.tsx',
    'apps/web/src/components/chat/MessageList.tsx',
]

def run(ssh, cmd):
    print(f'$ {cmd[:80]}...' if len(cmd) > 80 else f'$ {cmd}')
    _, out, err = ssh.exec_command(cmd)
    o = out.read().decode('utf-8', errors='replace')
    e = err.read().decode('utf-8', errors='replace')
    if o: print(o, end='')
    if e: print(e, end='', file=sys.stderr)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)
print('Connected.')

with SCPClient(ssh.get_transport()) as scp:
    for f in FILES:
        local = os.path.join(LOCAL, f.replace('/', os.sep))
        remote = f'{REMOTE}/{f}'
        run(ssh, f'mkdir -p $(dirname {remote})')
        print(f'Uploading {f}...')
        scp.put(local, remote)

# SQL migration
print('\nAdding allow_comments to messages...')
run(ssh, 'cd /home/pulsar/app && docker compose -f docker-compose.prod.yml exec -T postgres '
    'sh -c \'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '
    '"ALTER TABLE messages ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT false;"\'')

print('\nRebuilding server...')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml build server 2>&1 | tail -5')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml up -d server 2>&1')

print('\nRebuilding web...')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml build web 2>&1 | tail -5')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml up -d web 2>&1')

print('\nDone!')
ssh.close()
