import os
import sys
from typing import Tuple

import paramiko
from dotenv import load_dotenv


load_dotenv('.env.deploy')


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


def run(cmd: str) -> Tuple[str, str]:
    """
    通过 SSH 在远程服务器执行探测命令。

    入参：
        cmd：str，要在远程服务器执行的 shell 命令
    出参：Tuple[str, str]，依次为 (stdout, stderr)
    异常：认证信息缺失时抛出 ValueError；连接或执行异常时抛出 paramiko 异常
    注意事项：函数内部创建并关闭 SSH 连接，不保留长连接；密码不会被打印到控制台
    """
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(**get_connect_kwargs())
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
    finally:
        client.close()
    return out, err


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'pwd'
    out, err = run(cmd)
    print(out)
    if err:
        print('STDERR:', err, file=sys.stderr)
