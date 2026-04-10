#!/usr/bin/env python3
"""Deploy E2E encryption fix (explicit userId in key lookup)."""
import sys, os, paramiko
from scp import SCPClient
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST, USER, PASS = '72.56.5.167', 'root', 'jjn#uqiaXQWCe8'
REMOTE = '/home/pulsar/app'
LOCAL = os.path.dirname(os.path.abspath(__file__))

FILES = [
    'apps/web/src/crypto/keyManager.ts',
    'apps/web/src/crypto/e2eEncrypt.ts',
    'apps/web/src/components/chat/MessageBubble.tsx',
    'apps/web/src/components/chat/MessageInput.tsx',
]

def run(ssh, cmd):
    print(f'$ {cmd[:80]}...' if len(cmd) > 80 else f'$ {cmd}')
    _, out, err = ssh.exec_command(cmd)
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
        if attempt == 3:
            raise
        import time; time.sleep(5)

with SCPClient(ssh.get_transport()) as scp:
    for f in FILES:
        local = os.path.join(LOCAL, f.replace('/', os.sep))
        remote = f'{REMOTE}/{f}'
        run(ssh, f'mkdir -p $(dirname {remote})')
        print(f'Uploading {f}...')
        scp.put(local, remote)

print('\nRebuilding web...')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml build web 2>&1 | tail -5')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml up -d web 2>&1')

print('\nDone!')
ssh.close()
