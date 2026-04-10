#!/usr/bin/env python3
"""Deploy moderation system."""
import sys, os, paramiko
from scp import SCPClient
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST, USER, PASS = '72.56.5.167', 'root', 'jjn#uqiaXQWCe8'
REMOTE = '/home/pulsar/app'
LOCAL = os.path.dirname(os.path.abspath(__file__))

SERVER_FILES = [
    'apps/server/src/db/schema.prisma',
    'apps/server/src/app.ts',
    'apps/server/src/modules/moderation/moderation.service.ts',
    'apps/server/src/modules/moderation/moderation.routes.ts',
    'packages/shared/src/types/socket-events.ts',
]

WEB_FILES = [
    'apps/web/src/components/chat/MessageBubble.tsx',
    'apps/web/src/components/chat/ReportModal.tsx',
    'apps/web/src/components/chat/ReportCard.tsx',
    'apps/web/src/hooks/useSocket.ts',
    'apps/web/src/i18n/en.ts',
    'apps/web/src/i18n/ru.ts',
]

def run(ssh, cmd, timeout=120):
    print(f'$ {cmd[:90]}...' if len(cmd) > 90 else f'$ {cmd}')
    _, out, err = ssh.exec_command(cmd, timeout=timeout)
    o = out.read().decode('utf-8', errors='replace')
    e = err.read().decode('utf-8', errors='replace')
    if o: print(o, end='')
    if e: print(e, end='', file=sys.stderr)

for attempt in range(1, 4):
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(HOST, username=USER, password=PASS, timeout=20)
        print('Connected.')
        break
    except Exception as e:
        print(f'Attempt {attempt} failed: {e}')
        if attempt == 3: raise
        import time; time.sleep(5)

with SCPClient(ssh.get_transport()) as scp:
    for f in SERVER_FILES + WEB_FILES:
        local = os.path.join(LOCAL, f.replace('/', os.sep))
        remote = f'{REMOTE}/{f}'
        run(ssh, f'mkdir -p $(dirname {remote})')
        print(f'Uploading {f}...')
        scp.put(local, remote)

# Применяем миграцию схемы через db push
print('\nApplying DB schema changes...')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d pulsar -c "SELECT 1" 2>&1')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml run --rm server sh -c "cd apps/server && npx prisma db push --schema=src/db/schema.prisma --accept-data-loss" 2>&1', timeout=120)

print('\nRebuilding server...')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml build server 2>&1 | tail -8')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml up -d server 2>&1')

print('\nRebuilding web...')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml build web 2>&1 | tail -5')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml up -d web 2>&1')

print('\nDone!')
ssh.close()
