import hashlib
import os
import sys
from typing import Tuple

import paramiko
from dotenv import load_dotenv


load_dotenv('.env.deploy')

REMOTE_DIR = '/tmp/deploy-artifacts'


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


def sha256_file(path: str) -> str:
    """
    计算本地文件的 SHA256 摘要。

    入参：
        path：str，本地文件路径
    出参：str，文件内容的 SHA256 十六进制字符串
    异常：文件不存在或读取失败时抛出 OSError
    注意事项：使用 8192 字节分块读取，避免大文件占用过多内存
    """
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def upload(local_path: str, remote_path: str) -> None:
    """
    通过 SFTP 上传本地文件到远程服务器。

    入参：
        local_path：str，本地文件路径
        remote_path：str，远程目标路径
    出参：无
    异常：认证信息缺失时抛出 ValueError；文件不存在或 SFTP 操作失败时抛出相应异常
    注意事项：优先使用私钥认证；上传完成后不校验哈希，由调用方负责校验
    """
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(**get_connect_kwargs())
        with client.open_sftp() as sftp:
            sftp.put(local_path, remote_path)
    finally:
        client.close()


def ensure_remote_dir() -> None:
    """
    在远程服务器上确保部署目录存在。

    入参：无
    出参：无
    异常：认证信息缺失时抛出 ValueError；SSH 连接或命令执行失败时抛出 paramiko 异常
    注意事项：使用 mkdir -p 创建目录，不会覆盖已有目录
    """
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(**get_connect_kwargs())
        client.exec_command(f'mkdir -p {REMOTE_DIR}')
    finally:
        client.close()


def main() -> None:
    """
    批量上传部署产物到远程服务器并校验文件哈希。

    入参：通过 sys.argv 接收本地文件路径列表，为空时使用默认产物列表
    出参：无
    异常：上传失败或哈希校验失败时调用 sys.exit(1)；认证信息缺失时抛出 ValueError
    注意事项：默认产物路径为 deploy-artifacts 下的三个 tar.gz 文件；密码不会被打印到控制台
    """
    files = sys.argv[1:] if len(sys.argv) > 1 else []
    if not files:
        files = [
            'deploy-artifacts/server-deploy.tar.gz',
            'deploy-artifacts/admin-server-deploy.tar.gz',
            'deploy-artifacts/client-dist.tar.gz',
        ]

    ensure_remote_dir()
    for local_path in files:
        filename = os.path.basename(local_path)
        remote_path = f'{REMOTE_DIR}/{filename}'
        local_hash = sha256_file(local_path)
        print(f'Uploading {filename} ({local_hash[:16]}...)...')
        upload(local_path, remote_path)
        print(f'Uploaded to {remote_path}')
        # 校验远程文件哈希
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(**get_connect_kwargs())
            stdin, stdout, stderr = client.exec_command(f'sha256sum {remote_path}')
            remote_output = stdout.read().decode('utf-8', errors='replace').strip()
        finally:
            client.close()
        remote_hash = remote_output.split()[0] if remote_output else ''
        if remote_hash == local_hash:
            print(f'Hash verified: {remote_hash[:16]}...')
        else:
            print(f'Hash mismatch! local={local_hash} remote={remote_hash}', file=sys.stderr)
            sys.exit(1)


if __name__ == '__main__':
    main()
