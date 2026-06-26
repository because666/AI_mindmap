import paramiko
import sys
import time

HOST = '43.139.43.112'
USER = 'root'
KEY_PATH = r'D:\study1\DeepMindMap\v2\.secrets\deploy_key'
PROJECT_DIR = '/www/wwwroot/AI_mindmap'
DEPLOY_DIR = '/tmp/deploy-artifacts'


def main() -> None:
    """
    仅部署客户端 dist 到线上服务器。

    入参：无
    出参：无
    异常：SSH 连接或命令执行失败时退出程序
    注意事项：会备份原 client/dist，解压新的构建产物，不重启服务端进程
    """
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

    timestamp = time.strftime('%Y%m%d-%H%M%S')
    cmd = f"""
set -e
cd {PROJECT_DIR}
cp -a client/dist client/dist.bak-{timestamp}
rm -rf client/dist/*
tar -xzf {DEPLOY_DIR}/client-dist.tar.gz -C client/dist
echo "DEPLOY_CLIENT_OK"
"""

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(HOST, username=USER, key_filename=KEY_PATH, timeout=30)
        stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        code = stdout.channel.recv_exit_status()
    finally:
        client.close()

    print(out)
    if err:
        print('STDERR:', err, file=sys.stderr)
    if code != 0:
        print(f'Command failed with exit code {code}', file=sys.stderr)
        sys.exit(code)
    print('OK')


if __name__ == '__main__':
    main()
