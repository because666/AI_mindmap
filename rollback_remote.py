from __future__ import annotations

import argparse
import os
import shlex
import sys
import time
from typing import Dict, List, Optional, Tuple

import paramiko
from dotenv import load_dotenv


# 回滚脚本必需的环境变量列表
REQUIRED_ENV_VARS: List[str] = [
    "DEPLOY_HOST",
    "DEPLOY_USER",
    "DEPLOY_SSH_KEY_PATH",
    "DEPLOY_PROJECT_DIR",
    "DEPLOY_PM2_SERVER",
    "DEPLOY_PM2_ADMIN",
    "DEPLOY_HEALTH_URL_SERVER",
    "DEPLOY_HEALTH_URL_ADMIN",
]


class _RollbackArgs(argparse.Namespace):
    """命令行参数命名空间类型定义。"""

    timestamp: Optional[str]
    latest: bool


def log_step(step_number: int, message: str) -> None:
    """打印带编号的回滚步骤日志。

    Args:
        step_number: 步骤编号。
        message: 步骤说明。
    """
    print(f"\n【步骤 {step_number}】{message}")


def get_project_root() -> str:
    """获取项目根目录（即本脚本所在目录）。

    Returns:
        项目根目录的绝对路径。
    """
    return os.path.dirname(os.path.abspath(__file__))


def load_configuration() -> Dict[str, str]:
    """从 .env.deploy 加载部署配置并校验必需环境变量。

    Returns:
        包含所有必需环境变量的字典。

    Raises:
        SystemExit: 当配置文件不存在或必需环境变量缺失时，退出程序。
    """
    env_path = os.path.join(get_project_root(), ".env.deploy")
    if not os.path.isfile(env_path):
        print(f"错误：配置文件不存在: {env_path}")
        sys.exit(1)

    load_dotenv(env_path)

    config: Dict[str, str] = {}
    missing_vars: List[str] = []
    for var in REQUIRED_ENV_VARS:
        value = os.getenv(var)
        if not value:
            missing_vars.append(var)
        config[var] = value or ""

    if missing_vars:
        print("错误：以下环境变量未在 .env.deploy 中设置或为空：")
        for var in missing_vars:
            print(f"  - {var}")
        sys.exit(1)

    return config


def print_help_and_exit() -> None:
    """打印中文帮助信息并退出程序。"""
    print("用法: python rollback_remote.py [timestamp | --latest]")
    print("")
    print("参数说明：")
    print("  timestamp   备份时间戳，例如 20240101-120000")
    print("  --latest    使用服务器上最新的备份目录进行回滚")
    print("  -h, --help  显示此帮助信息并退出")
    print("")
    print("示例：")
    print("  python rollback_remote.py 20240101-120000")
    print("  python rollback_remote.py --latest")
    print("  python rollback_remote.py")
    sys.exit(0)


def parse_arguments() -> _RollbackArgs:
    """解析命令行参数。

    Returns:
        包含 timestamp 和 latest 属性的命令行参数对象。
    """
    parser = argparse.ArgumentParser(description="远程回滚脚本", add_help=False)
    parser.add_argument(
        "-h",
        "--help",
        action="store_true",
        help="显示此帮助信息并退出",
    )
    parser.add_argument(
        "timestamp",
        nargs="?",
        help="备份时间戳，例如 20240101-120000",
    )
    parser.add_argument(
        "--latest",
        action="store_true",
        help="使用服务器上最新的备份目录进行回滚",
    )
    args = parser.parse_args(namespace=_RollbackArgs())
    if args.help:
        print_help_and_exit()
    return args


def connect_ssh(config: Dict[str, str]) -> paramiko.SSHClient:
    """使用 SSH 私钥连接远程服务器。

    仅支持私钥认证；若私钥文件不存在则抛出异常。
    禁止使用密码登录，同时禁用 ssh-agent 与自动查找其他密钥。

    Args:
        config: 部署配置字典，需包含 DEPLOY_HOST、DEPLOY_USER、DEPLOY_SSH_KEY_PATH。

    Returns:
        已连接的 paramiko SSH 客户端实例。

    Raises:
        FileNotFoundError: 当 SSH 私钥文件不存在时抛出。
        paramiko.SSHException: 当 SSH 连接或认证失败时抛出。
    """
    key_path = config["DEPLOY_SSH_KEY_PATH"]
    if not os.path.isfile(key_path):
        raise FileNotFoundError(f"SSH 私钥不存在: {key_path}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        hostname=config["DEPLOY_HOST"],
        username=config["DEPLOY_USER"],
        key_filename=key_path,
        timeout=15,
        look_for_keys=False,
        allow_agent=False,
    )
    print(f"SSH 连接成功: {config['DEPLOY_USER']}@{config['DEPLOY_HOST']}")
    return ssh


def run_ssh_command(
    ssh: paramiko.SSHClient,
    command: str,
    timeout: int = 300,
    raise_on_error: bool = True,
) -> Tuple[int, str, str]:
    """在远程服务器上执行命令。

    Args:
        ssh: 已连接的 SSH 客户端。
        command: 要执行的远程命令字符串。
        timeout: 命令执行超时时间（秒），默认 300 秒。
        raise_on_error: 当命令退出码非零时是否抛出异常，默认 True。

    Returns:
        三元组 (退出码, 标准输出内容, 标准错误内容)。

    Raises:
        RuntimeError: 当 raise_on_error 为 True 且命令返回非零退出码时抛出。
    """
    print(f"\n>>> 远程执行: {command}")
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")

    if out:
        print(out[-2000:] if len(out) > 2000 else out)
    if err:
        print(f"[STDERR] {err[-1000:] if len(err) > 1000 else err}")
    print(f"<<< 退出码: {exit_code}")

    if raise_on_error and exit_code != 0:
        raise RuntimeError(f"远程命令执行失败: {command}，退出码: {exit_code}")

    return exit_code, out, err


def get_backup_paths(project_dir: str, timestamp: str) -> Tuple[str, str, str]:
    """根据项目目录和时间戳构造三个备份目录的远程绝对路径。

    Args:
        project_dir: 服务器上的项目目录绝对路径。
        timestamp: 备份时间戳。

    Returns:
        三元组 (server 备份路径, admin/server 备份路径, client/dist 备份路径)。
    """
    server_bak = f"{project_dir}/server.bak-{timestamp}"
    admin_bak = f"{project_dir}/admin/server.bak-{timestamp}"
    client_bak = f"{project_dir}/client/dist.bak-{timestamp}"
    return server_bak, admin_bak, client_bak


def _backup_exists(ssh: paramiko.SSHClient, project_dir: str, timestamp: str) -> bool:
    """检查指定时间戳的三个备份目录是否均存在。

    Args:
        ssh: 已连接的 SSH 客户端。
        project_dir: 服务器上的项目目录绝对路径。
        timestamp: 备份时间戳。

    Returns:
        三个备份目录均存在时返回 True，否则返回 False。
    """
    server_bak, admin_bak, client_bak = get_backup_paths(project_dir, timestamp)
    command = (
        f"test -d {shlex.quote(server_bak)} && "
        f"test -d {shlex.quote(admin_bak)} && "
        f"test -d {shlex.quote(client_bak)} && echo ok || echo missing"
    )
    _, out, _ = run_ssh_command(ssh, command, timeout=60, raise_on_error=False)
    return out.strip() == "ok"


def find_latest_backup(ssh: paramiko.SSHClient, project_dir: str) -> str:
    """查找服务器上最新的完整备份时间戳。

    以 server.bak-* 目录为候选，按时间戳字符串降序查找，要求对应的
    admin/server.bak-* 与 client/dist.bak-* 同时存在。

    Args:
        ssh: 已连接的 SSH 客户端。
        project_dir: 服务器上的项目目录绝对路径。

    Returns:
        最新完整备份的时间戳字符串。

    Raises:
        RuntimeError: 当未找到任何完整备份时抛出。
    """
    command = f"ls -1d {shlex.quote(project_dir + '/server.bak-*')} 2>/dev/null"
    exit_code, out, _ = run_ssh_command(ssh, command, timeout=60, raise_on_error=False)
    if exit_code != 0 or not out.strip():
        raise RuntimeError("未在服务器上找到任何 server.bak-* 备份目录")

    prefix = "server.bak-"
    candidates: List[str] = []
    for line in out.strip().splitlines():
        basename = line.rstrip("/").split("/")[-1]
        if basename.startswith(prefix):
            candidates.append(basename[len(prefix):])

    # 时间戳格式为 YYYYMMDD-HHMMSS，字符串降序即时间降序
    candidates.sort(reverse=True)

    for timestamp in candidates:
        if _backup_exists(ssh, project_dir, timestamp):
            return timestamp

    raise RuntimeError("未找到 server、admin/server、client/dist 均存在的完整备份")


def validate_backup_exists(
    ssh: paramiko.SSHClient,
    project_dir: str,
    timestamp: str,
) -> None:
    """校验用户指定的时间戳备份是否完整存在。

    Args:
        ssh: 已连接的 SSH 客户端。
        project_dir: 服务器上的项目目录绝对路径。
        timestamp: 备份时间戳。

    Raises:
        RuntimeError: 当任一备份目录不存在时抛出。
    """
    if not _backup_exists(ssh, project_dir, timestamp):
        server_bak, admin_bak, client_bak = get_backup_paths(project_dir, timestamp)
        raise RuntimeError(
            f"指定时间戳的备份目录不完整或不存在：\n"
            f"  - {server_bak}\n"
            f"  - {admin_bak}\n"
            f"  - {client_bak}"
        )


def stop_pm2_processes(ssh: paramiko.SSHClient, config: Dict[str, str]) -> None:
    """停止服务器上的 PM2 主服务端和 Admin 服务端进程。

    Args:
        ssh: 已连接的 SSH 客户端。
        config: 部署配置字典。

    Raises:
        RuntimeError: 当任意 PM2 停止命令返回非零退出码时抛出。
    """
    names: List[str] = [
        config["DEPLOY_PM2_SERVER"],
        config["DEPLOY_PM2_ADMIN"],
    ]
    for name in names:
        run_ssh_command(ssh, f"pm2 stop {shlex.quote(name)}", timeout=60)


def restore_backup(ssh: paramiko.SSHClient, project_dir: str, timestamp: str) -> None:
    """使用 cp -a 将备份目录还原到原位置。

    为避免备份目录被复制到原目录内部形成嵌套，先删除原目录再整体复制。

    Args:
        ssh: 已连接的 SSH 客户端。
        project_dir: 服务器上的项目目录绝对路径。
        timestamp: 备份时间戳。

    Raises:
        RuntimeError: 当任意还原命令返回非零退出码时抛出。
    """
    server_bak, admin_bak, client_bak = get_backup_paths(project_dir, timestamp)
    restore_pairs: List[Tuple[str, str]] = [
        (server_bak, f"{project_dir}/server"),
        (admin_bak, f"{project_dir}/admin/server"),
        (client_bak, f"{project_dir}/client/dist"),
    ]

    for src_dir, dst_dir in restore_pairs:
        command = (
            f"rm -rf {shlex.quote(dst_dir)} && "
            f"cp -a {shlex.quote(src_dir)} {shlex.quote(dst_dir)}"
        )
        run_ssh_command(ssh, command, timeout=300)


def start_pm2_processes(ssh: paramiko.SSHClient, config: Dict[str, str]) -> None:
    """启动服务器上的 PM2 主服务端和 Admin 服务端进程。

    Args:
        ssh: 已连接的 SSH 客户端。
        config: 部署配置字典。

    Raises:
        RuntimeError: 当任意 PM2 启动命令返回非零退出码时抛出。
    """
    names: List[str] = [
        config["DEPLOY_PM2_SERVER"],
        config["DEPLOY_PM2_ADMIN"],
    ]
    for name in names:
        run_ssh_command(ssh, f"pm2 restart {shlex.quote(name)}", timeout=60)


def health_check(ssh: paramiko.SSHClient, config: Dict[str, str]) -> None:
    """使用 curl 检查主服务端和 Admin 服务端的健康状态。

    启动后等待 5 秒，再分别请求配置中的健康检查 URL，要求必须返回 HTTP 200。

    Args:
        ssh: 已连接的 SSH 客户端。
        config: 部署配置字典。

    Raises:
        RuntimeError: 当任意健康检查未返回 HTTP 200 时抛出。
    """
    print("等待 5 秒后执行健康检查...")
    time.sleep(5)

    health_targets: List[Tuple[str, str]] = [
        ("主服务端", config["DEPLOY_HEALTH_URL_SERVER"]),
        ("Admin 服务端", config["DEPLOY_HEALTH_URL_ADMIN"]),
    ]

    for name, url in health_targets:
        command = f"curl -s -o /dev/null -w '%{{http_code}}' {shlex.quote(url)}"
        exit_code, out, _ = run_ssh_command(ssh, command, timeout=60, raise_on_error=False)
        status_code = out.strip()
        print(f"{name} 健康检查 URL: {url}，HTTP 状态码: {status_code}")

        if status_code != "200":
            raise RuntimeError(f"{name} 健康检查失败，HTTP 状态码: {status_code}")

    print("健康检查通过")


def main() -> int:
    """回滚脚本主入口。

    Returns:
        程序退出码：0 表示成功，1 表示失败。
    """
    args = parse_arguments()

    log_step(1, "加载回滚配置")
    config = load_configuration()

    ssh: Optional[paramiko.SSHClient] = None
    try:
        log_step(2, "连接远程服务器")
        ssh = connect_ssh(config)

        if args.timestamp:
            timestamp: str = args.timestamp
            log_step(3, f"校验指定备份: {timestamp}")
            validate_backup_exists(ssh, config["DEPLOY_PROJECT_DIR"], timestamp)
        else:
            log_step(3, "查找服务器上最新备份")
            timestamp = find_latest_backup(ssh, config["DEPLOY_PROJECT_DIR"])
            print(f"找到最新备份时间戳: {timestamp}")

        log_step(4, "停止 PM2 进程")
        stop_pm2_processes(ssh, config)

        log_step(5, "使用 cp -a 还原备份目录")
        restore_backup(ssh, config["DEPLOY_PROJECT_DIR"], timestamp)

        log_step(6, "启动 PM2 进程")
        start_pm2_processes(ssh, config)

        log_step(7, "执行健康检查")
        health_check(ssh, config)

        print("\n回滚完成")
        return 0
    except Exception as exc:
        print(f"\n错误: {exc}")
        return 1
    finally:
        if ssh is not None:
            ssh.close()
            print("SSH 连接已关闭")


if __name__ == "__main__":
    sys.exit(main())
