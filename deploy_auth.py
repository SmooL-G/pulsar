#!/usr/bin/env python3
"""Deploy enhanced auth (wallet login, password strength, username check)."""
import sys, os, paramiko
from scp import SCPClient
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST, USER, PASS = '72.56.5.167', 'root', 'jjn#uqiaXQWCe8'
REMOTE = '/home/pulsar/app'
LOCAL = os.path.dirname(os.path.abspath(__file__))

FILES = [
    # Backend
    'apps/server/src/modules/auth/auth.routes.ts',
    # Frontend
    'apps/web/src/pages/LoginPage.tsx',
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

print('\nRebuilding server...')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml build server 2>&1 | tail -5')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml up -d server 2>&1')

print('\nRebuilding web...')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml build web 2>&1 | tail -5')
run(ssh, f'cd {REMOTE} && docker compose -f docker-compose.prod.yml up -d web 2>&1')

print('\nDone!')
ssh.close()
