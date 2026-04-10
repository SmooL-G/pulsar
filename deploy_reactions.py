#!/usr/bin/env python3
"""Deploy emoji reactions feature."""
import sys, os, paramiko
from scp import SCPClient
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST, USER, PASS = '72.56.5.167', 'root', 'jjn#uqiaXQWCe8'
REMOTE = '/home/pulsar/app'
LOCAL = os.path.dirname(os.path.abspath(__file__))

WEB_FILES = [
    'apps/web/src/components/chat/MessageBubble.tsx',
    'apps/web/src/components/chat/ReactionsBar.tsx',
    'apps/web/src/store/messageStore.ts',
    'apps/web/src/hooks/useSocket.ts',
]

SERVER_FILES = [
    'apps/server/src/modules/message/message.routes.ts',
    'packages/shared/src/types/socket-events.ts',
    'packages/shared/src/types/message.ts',
]

def run(ssh, cmd, timeout=180):
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
    for f in WEB_FILES + SERVER_FILES:
        local = os.path.join(LOCAL, f.replace('/', os.sep))
        remote = f'{REMOTE}/{f}'
        run(ssh, f'mkdir -p $(dirname {remote})')
        print(f'Uploading {f}...')
        scp.put(local, remote)

print('\nRebuilding server...')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml build server 2>&1 | tail -8', timeout=600)
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml up -d server 2>&1')

print('\nRebuilding web...')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml build web 2>&1 | tail -5', timeout=600)
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml up -d web 2>&1')

print('\nDone!')
ssh.close()
