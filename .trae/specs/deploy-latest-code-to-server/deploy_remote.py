import os
import sys
import time
from typing import Tuple

import paramiko
from dotenv import load_dotenv


load_dotenv('.env.deploy')

PROJECT_DIR = '/www/wwwroot/AI_mindmap'
DEPLOY_DIR = '/tmp/deploy-artifacts'


def get_deploy_config() -> Tuple[str, str, str | None, str | None]:
    """
    从环境变量读取部署配置。

    入参：无
    出参：Tuple[str, str, str | None, str | None]，依次为 (host, user, key_path, password)
    异常：当缺少必要配置时抛出 ValueError
    注意事项：配置来源为 .env.deploy 文件及当前进程环境变量；密码仅作为私钥不可用时的回退方案
    """
    host = os.getenv('DEPLOY_HOST')
    user = os.getenv('DEPLOY_USER')
    key_path = os.getenv('DEPLOY_SSH_KEY_PATH')
    password = os.getenv('DEPLOY_PASSWORD')

    if not host:
        raise ValueError('缺少必要的环境变量 DEPLOY_HOST，请在 .env.deploy 中配置')
    if not user:
        raise ValueError('缺少必要的环境变量 DEPLOY_USER，请在 .env.deploy 中配置')
    if not key_path and not password:
        raise ValueError('缺少认证信息，请在 .env.deploy 中配置 DEPLOY_SSH_KEY_PATH 或 DEPLOY_PASSWORD')

    return host, user, key_path, password


def get_connect_kwargs() -> dict[str, str | int]:
    """
    构造 paramiko.SSHClient.connect 所需的认证参数字典。

    入参：无
    出参：dict[str, str | int]，包含 hostname、username、timeout 及 key_filename 或 password
    异常：当缺少必要配置时抛出 ValueError
    注意事项：优先使用私钥认证；私钥不可用时回退到密码认证；函数不会泄露密码明文
    """
    host, user, key_path, password = get_deploy_config()
    kwargs: dict[str, str | int] = {
        'hostname': host,
        'username': user,
        'timeout': 30,
    }
    if key_path:
        kwargs['key_filename'] = key_path
    elif password:
        kwargs['password'] = password
    return kwargs


def ssh_exec(cmd: str, timeout: int = 60) -> Tuple[int, str, str]:
    """
    通过 SSH 在远程服务器执行命令。

    入参：
        cmd：str，要在远程服务器执行的 shell 命令
        timeout：int，命令执行超时时间（秒），默认 60
    出参：Tuple[int, str, str]，依次为 (exit_code, stdout, stderr)
    异常：认证信息缺失时抛出 ValueError；连接或执行异常时抛出 paramiko 异常
    注意事项：函数内部创建并关闭 SSH 连接，不保留长连接
    """
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(**get_connect_kwargs())
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        exit_code = stdout.channel.recv_exit_status()
    finally:
        client.close()
    return exit_code, out, err


def backup_and_extract() -> Tuple[int, str, str]:
    """
    在远程服务器备份当前项目并解压新的部署产物。

    入参：无
    出参：Tuple[int, str, str]，依次为 (exit_code, stdout, stderr)
    异常：SSH 执行失败或命令返回非零退出码时返回对应结果，不主动抛出异常
    注意事项：会生成带时间戳的备份目录；SERVER、ADMIN SERVER、CLIENT DIST 分别处理
    """
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


def install_deps() -> Tuple[int, str, str]:
    """
    在远程服务器为服务端及后台管理端安装生产依赖。

    入参：无
    出参：Tuple[int, str, str]，依次为 (exit_code, stdout, stderr)
    异常：SSH 执行失败或命令返回非零退出码时返回对应结果，不主动抛出异常
    注意事项：仅在 server 与 admin/server 目录执行 npm install --production
    """
    cmd = f"""
set -e
cd {PROJECT_DIR}/server
npm install --production

cd {PROJECT_DIR}/admin/server
npm install --production

echo "INSTALL_OK"
"""
    return ssh_exec(cmd, timeout=300)


def restart_services() -> Tuple[int, str, str]:
    """
    在远程服务器重启 PM2 托管的服务。

    入参：无
    出参：Tuple[int, str, str]，依次为 (exit_code, stdout, stderr)
    异常：SSH 执行失败或命令返回非零退出码时返回对应结果，不主动抛出异常
    注意事项：会重启 deepmindmap-server 与 deepmindmap-admin 并保存 PM2 进程列表
    """
    cmd = """
set -e
pm2 restart deepmindmap-server deepmindmap-admin
pm2 save
pm2 list
echo "RESTART_OK"
"""
    return ssh_exec(cmd, timeout=120)


def main(action: str) -> None:
    """
    根据传入动作执行对应的远程部署步骤。

    入参：
        action：str，操作类型，可选 backup_extract、install、restart
    出参：无
    异常：未知动作或命令失败时调用 sys.exit 退出；认证信息缺失时抛出 ValueError
    注意事项：函数会设置标准输出与标准错误为 UTF-8 编码；失败时会将 stderr 打印到控制台
    """
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
