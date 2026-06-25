import paramiko
import sys
import time

HOST = '43.139.43.112'
USERNAME = 'root'
PASSWORD = '123456789Luo'
PROJECT_DIR = '/www/wwwroot/AI_mindmap'
DEPLOY_DIR = '/tmp/deploy-artifacts'


def ssh_exec(cmd, timeout=60):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USERNAME, password=PASSWORD, timeout=30)
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    exit_code = stdout.channel.recv_exit_status()
    client.close()
    return exit_code, out, err


def backup_and_extract():
    timestamp = time.strftime('%Y%m%d-%H%M%S')
    cmd = f"""
set -e
cd {PROJECT_DIR}
BACKUP_SUFFIX="{timestamp}"

# Backup
cp -a server server.bak-$BACKUP_SUFFIX
cp -a admin/server admin/server.bak-$BACKUP_SUFFIX
cp -a client/dist client/dist.bak-$BACKUP_SUFFIX

# Extract server
cd {PROJECT_DIR}/server
tar -xzf {DEPLOY_DIR}/server-deploy.tar.gz

# Extract admin server
cd {PROJECT_DIR}/admin/server
tar -xzf {DEPLOY_DIR}/admin-server-deploy.tar.gz

# Extract client dist
rm -rf {PROJECT_DIR}/client/dist/*
tar -xzf {DEPLOY_DIR}/client-dist.tar.gz -C {PROJECT_DIR}/client/dist

echo "BACKUP_AND_EXTRACT_OK"
"""
    return ssh_exec(cmd, timeout=120)


def install_deps():
    cmd = f"""
set -e
cd {PROJECT_DIR}/server
npm install --production

cd {PROJECT_DIR}/admin/server
npm install --production

echo "INSTALL_OK"
"""
    return ssh_exec(cmd, timeout=300)


def restart_services():
    cmd = """
set -e
pm2 restart deepmindmap-server deepmindmap-admin
pm2 save
pm2 list
echo "RESTART_OK"
"""
    return ssh_exec(cmd, timeout=120)


def main(action):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    if action == 'backup_extract':
        print('Backing up and extracting...')
        code, out, err = backup_and_extract()
    elif action == 'install':
        print('Installing dependencies...')
        code, out, err = install_deps()
    elif action == 'restart':
        print('Restarting services...')
        code, out, err = restart_services()
    else:
        print(f'Unknown action: {action}')
        sys.exit(1)

    print(out)
    if err:
        print('STDERR:', err, file=sys.stderr)
    if code != 0:
        print(f'Command failed with exit code {code}', file=sys.stderr)
        sys.exit(code)
    print('OK')


if __name__ == '__main__':
    main(sys.argv[1])
