import argparse
import datetime
import json
import os
import shlex
import subprocess
import sys
import time
from typing import Dict, List, Tuple, Optional

import paramiko
from dotenv import load_dotenv


# 必需的环境变量列表
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

# 默认上传文件映射（本地相对路径，远程绝对路径；None 表示按项目目录自动推导）
DEFAULT_FILES_TO_UPLOAD: List[Tuple[str, Optional[str]]] = [
    # 非线性对话体验 - 服务端
    ("server/src/config/prompts.ts", None),
    ("server/src/routes/nodes.ts", None),
    ("server/src/routes/conversations.ts", None),
    ("server/src/services/conversationService.ts", None),
    # 非线性对话体验 - 客户端
    ("client/src/services/api.ts", None),
    ("client/src/stores/chatStore.ts", None),
    ("client/src/utils/extensionDirections.ts", None),
    ("client/src/components/Canvas/CanvasPage.tsx", None),
    ("client/src/components/Chat/ChatPanel.tsx", None),
    ("client/src/components/Chat/MindMapThumbnail.tsx", None),
    # i18n
    ("client/src/locales/canvas/en.json", None),
    ("client/src/locales/canvas/zh.json", None),
    ("client/src/locales/chat/en.json", None),
    ("client/src/locales/chat/zh.json", None),
]


def log_step(step_number: int, message: str) -> None:
    """打印带编号的部署步骤日志。

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


def get_timestamp() -> str:
    """生成当前本地时间戳字符串。

    Returns:
        格式为 YYYYMMDD-HHMMSS 的时间戳字符串。
    """
    return datetime.datetime.now().strftime("%Y%m%d-%H%M%S")


def run_local_command(command: List[str], description: str) -> str:
    """在本地执行命令并返回标准输出。

    Args:
        command: 要执行的命令及参数列表。
        description: 命令用途描述，用于错误提示。

    Returns:
        命令执行后的标准输出字符串（已去除首尾空白）。

    Raises:
        RuntimeError: 当命令返回非零退出码时抛出。
    """
    print(f">>> 本地执行: {' '.join(command)}")
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8")
    if result.returncode != 0:
        raise RuntimeError(
            f"{description} 失败，退出码 {result.returncode}，错误：{result.stderr.strip()}"
        )
    return result.stdout.strip()


def ensure_git_backup(timestamp: str) -> None:
    """检查 Git 工作区，必要时自动提交，并创建部署备份标签。

    若工作区不干净，则自动执行 `git add -A && git commit`；
    无论工作区是否干净，都会创建名为 `deploy-backup-<timestamp>` 的标签。

    Args:
        timestamp: 部署时间戳，用于标签名称。

    Raises:
        RuntimeError: 当 Git 命令执行失败时抛出。
    """
    status_output = run_local_command(["git", "status", "--porcelain"], "检查 Git 工作区状态")
    if status_output:
        print("检测到工作区存在未提交变更，正在自动提交...")
        run_local_command(["git", "add", "-A"], "添加本地变更")
        run_local_command(
            ["git", "commit", "-m", "chore(deploy): 部署前自动备份"],
            "提交本地变更",
        )
    else:
        print("Git 工作区已干净。")

    tag_name = f"deploy-backup-{timestamp}"
    run_local_command(["git", "tag", tag_name], "创建部署备份标签")
    print(f"已创建 Git 备份标签: {tag_name}")


def resolve_default_file_list(project_dir: str) -> List[Tuple[str, str]]:
    """将默认文件映射中的远程路径补充为绝对路径。

    Args:
        project_dir: 服务器上的项目目录绝对路径。

    Returns:
        本地相对路径与远程绝对路径的映射列表。
    """
    return [
        (local_rel, remote_abs if remote_abs else f"{project_dir}/{local_rel}")
        for local_rel, remote_abs in DEFAULT_FILES_TO_UPLOAD
    ]


def build_file_list(config: Dict[str, str]) -> List[Tuple[str, str]]:
    """构建本次部署需要上传的文件列表。

    优先读取环境变量 DEPLOY_FILE_LIST（JSON 数组），格式示例：
    [
      {"local": "server/src/index.ts", "remote": "/www/wwwroot/AI_mindmap/server/src/index.ts"}
    ]
    若未设置该环境变量，则使用默认文件列表。

    Args:
        config: 部署配置字典。

    Returns:
        本地相对路径与远程绝对路径的映射列表。

    Raises:
        ValueError: 当 DEPLOY_FILE_LIST 格式不正确时抛出。
    """
    raw_file_list = os.getenv("DEPLOY_FILE_LIST")
    if not raw_file_list:
        return resolve_default_file_list(config["DEPLOY_PROJECT_DIR"])

    try:
        mappings = json.loads(raw_file_list)
    except json.JSONDecodeError as exc:
        raise ValueError("DEPLOY_FILE_LIST 不是有效的 JSON 字符串") from exc

    if not isinstance(mappings, list):
        raise ValueError("DEPLOY_FILE_LIST 必须是 JSON 数组")

    file_list: List[Tuple[str, str]] = []
    for item in mappings:
        if not isinstance(item, dict) or "local" not in item or "remote" not in item:
            raise ValueError("DEPLOY_FILE_LIST 数组元素必须包含 local 和 remote 字段")
        local_rel = str(item["local"])
        remote_abs = str(item["remote"])
        if not local_rel or not remote_abs:
            raise ValueError("DEPLOY_FILE_LIST 中的 local 和 remote 字段不能为空字符串")
        file_list.append((local_rel, remote_abs))

    return file_list


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


def backup_server(ssh: paramiko.SSHClient, config: Dict[str, str], timestamp: str) -> None:
    """在服务器上备份关键目录。

    分别备份 server/、admin/server/、client/dist/ 为对应名称的 .bak-<timestamp> 目录。
    若源目录不存在，则跳过该目录并输出提示。

    Args:
        ssh: 已连接的 SSH 客户端。
        config: 部署配置字典。
        timestamp: 备份时间戳，用于目录后缀。

    Raises:
        RuntimeError: 当备份命令执行失败且 raise_on_error 生效时抛出。
    """
    project_dir = config["DEPLOY_PROJECT_DIR"]
    backup_pairs: List[Tuple[str, str]] = [
        (f"{project_dir}/server", f"{project_dir}/server.bak-{timestamp}"),
        (f"{project_dir}/admin/server", f"{project_dir}/admin/server.bak-{timestamp}"),
        (f"{project_dir}/client/dist", f"{project_dir}/client/dist.bak-{timestamp}"),
    ]

    for src_dir, dst_dir in backup_pairs:
        command = (
            f"if [ -d {shlex.quote(src_dir)} ]; then "
            f"cp -a {shlex.quote(src_dir)} {shlex.quote(dst_dir)}; "
            f"else echo '跳过不存在的目录: {src_dir}'; fi"
        )
        run_ssh_command(ssh, command, timeout=300)


def upload_files(
    ssh: paramiko.SSHClient,
    file_list: List[Tuple[str, str]],
    project_root: str,
) -> None:
    """通过 SFTP 上传文件到远程服务器。

    Args:
        ssh: 已连接的 SSH 客户端。
        file_list: 本地相对路径与远程绝对路径的映射列表。
        project_root: 本地项目根目录。

    Raises:
        FileNotFoundError: 当本地文件不存在时抛出。
        RuntimeError: 当创建远程目录失败时抛出。
    """
    sftp = ssh.open_sftp()
    try:
        for local_rel, remote_path in file_list:
            local_path = os.path.normpath(os.path.join(project_root, local_rel))
            if not os.path.isfile(local_path):
                raise FileNotFoundError(f"本地文件不存在: {local_path}")

            remote_dir = os.path.dirname(remote_path)
            run_ssh_command(ssh, f"mkdir -p {shlex.quote(remote_dir)}", timeout=60)

            print(f"上传: {local_rel} -> {remote_path}")
            sftp.put(local_path, remote_path)
    finally:
        sftp.close()

    print(f"\n共上传 {len(file_list)} 个文件")


def build_and_restart(ssh: paramiko.SSHClient, config: Dict[str, str]) -> None:
    """在服务器上执行构建并重启 PM2 服务。

    Args:
        ssh: 已连接的 SSH 客户端。
        config: 部署配置字典。

    Raises:
        RuntimeError: 当任意构建或重启命令返回非零退出码时抛出。
    """
    project_dir = config["DEPLOY_PROJECT_DIR"]
    steps: List[Tuple[str, str]] = [
        ("构建主服务端", f"cd {shlex.quote(project_dir + '/server')} && npm run build"),
        ("构建 Admin 服务端", f"cd {shlex.quote(project_dir + '/admin/server')} && npm run build"),
        ("构建主前端", f"cd {shlex.quote(project_dir + '/client')} && npm run build"),
        ("构建 Admin 前端", f"cd {shlex.quote(project_dir + '/admin/client')} && npm run build"),
        (f"重启 {config['DEPLOY_PM2_SERVER']}", f"pm2 restart {shlex.quote(config['DEPLOY_PM2_SERVER'])}"),
        (f"重启 {config['DEPLOY_PM2_ADMIN']}", f"pm2 restart {shlex.quote(config['DEPLOY_PM2_ADMIN'])}"),
    ]

    for description, command in steps:
        print(f"\n{description}...")
        run_ssh_command(ssh, command, timeout=300)


def health_check(ssh: paramiko.SSHClient, config: Dict[str, str]) -> None:
    """使用 curl 检查主服务端和 Admin 服务端的健康状态。

    重启后等待 5 秒，再分别请求配置中的健康检查 URL，要求必须返回 HTTP 200。

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
        exit_code, out, err = run_ssh_command(ssh, command, timeout=60, raise_on_error=False)
        status_code = out.strip()
        print(f"{name} 健康检查 URL: {url}，HTTP 状态码: {status_code}")

        if status_code != "200":
            raise RuntimeError(f"{name} 健康检查失败，HTTP 状态码: {status_code}")

    print("健康检查通过")


def print_deployment_plan(config: Dict[str, str]) -> None:
    """干运行模式下打印计划执行的部署步骤，不修改任何状态。

    Args:
        config: 部署配置字典。
    """
    timestamp = get_timestamp()
    project_dir = config["DEPLOY_PROJECT_DIR"]

    print("\n========== 部署计划（干运行，不执行） ==========")
    print(f"目标服务器: {config['DEPLOY_USER']}@{config['DEPLOY_HOST']}")
    print(f"项目目录: {project_dir}")
    print(f"备份时间戳: {timestamp}")

    file_list = build_file_list(config)
    print(f"\n待上传文件（{len(file_list)} 个）：")
    for local_rel, remote_path in file_list:
        print(f"  - {local_rel} -> {remote_path}")

    print("\n服务器端备份目录：")
    print(f"  - {project_dir}/server -> {project_dir}/server.bak-{timestamp}")
    print(f"  - {project_dir}/admin/server -> {project_dir}/admin/server.bak-{timestamp}")
    print(f"  - {project_dir}/client/dist -> {project_dir}/client/dist.bak-{timestamp}")

    print("\n构建与重启命令：")
    print(f"  - cd {project_dir}/server && npm run build")
    print(f"  - cd {project_dir}/admin/server && npm run build")
    print(f"  - cd {project_dir}/client && npm run build")
    print(f"  - cd {project_dir}/admin/client && npm run build")
    print(f"  - pm2 restart {config['DEPLOY_PM2_SERVER']}")
    print(f"  - pm2 restart {config['DEPLOY_PM2_ADMIN']}")

    print("\n健康检查 URL：")
    print(f"  - {config['DEPLOY_HEALTH_URL_SERVER']}")
    print(f"  - {config['DEPLOY_HEALTH_URL_ADMIN']}")
    print("===============================================")


def main() -> int:
    """部署脚本主入口。

    Returns:
        程序退出码：0 表示成功，1 表示失败。
    """
    parser = argparse.ArgumentParser(description="远程部署脚本")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="仅验证配置并打印待执行步骤，不执行实际部署",
    )
    args = parser.parse_args()

    log_step(1, "加载部署配置")
    config = load_configuration()

    if args.dry_run:
        print_deployment_plan(config)
        return 0

    timestamp = get_timestamp()
    ssh: Optional[paramiko.SSHClient] = None

    try:
        log_step(2, "本地 Git 备份")
        ensure_git_backup(timestamp)

        log_step(3, "连接远程服务器")
        ssh = connect_ssh(config)

        log_step(4, "服务器端备份")
        backup_server(ssh, config, timestamp)

        log_step(5, "构建上传文件列表")
        file_list = build_file_list(config)
        print(f"待上传文件数量: {len(file_list)}")

        log_step(6, "上传文件到服务器")
        upload_files(ssh, file_list, get_project_root())

        log_step(7, "构建并重启服务")
        build_and_restart(ssh, config)

        log_step(8, "健康检查")
        health_check(ssh, config)

        print("\n部署完成！")
        return 0
    except Exception as exc:
        print(f"\n错误: {exc}")
        print(f"\n部署失败。如需回滚服务器，请运行：python rollback_remote.py {timestamp}")
        return 1
    finally:
        if ssh is not None:
            ssh.close()
            print("SSH 连接已关闭")


if __name__ == "__main__":
    sys.exit(main())
