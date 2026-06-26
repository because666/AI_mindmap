import paramiko
import os
import sys
import hashlib

HOST = '43.139.43.112'
USERNAME = 'root'
PASSWORD = '123456789Luo'
REMOTE_DIR = '/www/wwwroot/AI_mindmap/client/dist'

FILES = [
    'client/dist/favicon.png',
    'client/dist/apple-touch-icon.png',
    'client/dist/logo.png',
    'client/dist/index.html',
]


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def upload(local_path, remote_path):
    transport = paramiko.Transport((HOST, 22))
    transport.connect(username=USERNAME, password=PASSWORD)
    sftp = paramiko.SFTPClient.from_transport(transport)
    sftp.put(local_path, remote_path)
    sftp.close()
    transport.close()


def main():
    for local_path in FILES:
        filename = os.path.basename(local_path)
        remote_path = f'{REMOTE_DIR}/{filename}'
        local_hash = sha256_file(local_path)
        print(f'Uploading {filename} ({local_hash[:16]}...)...')
        upload(local_path, remote_path)
        print(f'Uploaded to {remote_path}')
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(HOST, username=USERNAME, password=PASSWORD, timeout=30)
        stdin, stdout, stderr = client.exec_command(f'sha256sum {remote_path}')
        remote_output = stdout.read().decode('utf-8', errors='replace').strip()
        client.close()
        remote_hash = remote_output.split()[0] if remote_output else ''
        if remote_hash == local_hash:
            print(f'Hash verified: {remote_hash[:16]}...')
        else:
            print(f'Hash mismatch! local={local_hash} remote={remote_hash}', file=sys.stderr)
            sys.exit(1)


if __name__ == '__main__':
    main()
