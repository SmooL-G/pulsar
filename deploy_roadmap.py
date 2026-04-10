#!/usr/bin/env python3
"""Deploy updated roadmap i18n + RoadmapPage to VPS."""
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
    'apps/web/src/pages/RoadmapPage.tsx',
]

def run(ssh, cmd):
    print(f'$ {cmd}')
    _, stdout, stderr = ssh.exec_command(cmd)
    for line in stdout:
        print(line, end='')
    for line in stderr:
        print(line, end='', file=sys.stderr)
    return stdout.channel.recv_exit_status()

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS)
print('Connected.')

with SCPClient(ssh.get_transport()) as scp:
    for f in FILES:
        local = os.path.join(LOCAL_BASE, f.replace('/', os.sep))
        remote = f'{REMOTE_BASE}/{f}'
        # ensure remote dir exists
        run(ssh, f'mkdir -p $(dirname {remote})')
        print(f'Uploading {f} ...')
        scp.put(local, remote)

print('\nRebuilding web container...')
run(ssh, f'cd {REMOTE_BASE} && docker compose -f docker-compose.prod.yml build web 2>&1')
run(ssh, f'cd {REMOTE_BASE} && docker compose -f docker-compose.prod.yml up -d web 2>&1')
print('\nDone!')
ssh.close()
