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

# 默认需要本地上传并替换的构建产物目录（本地相对路径，远程绝对路径由 DEPLOY_PROJECT_DIR 推导）
DEFAULT_DIST_DIRS: List[Tuple[str, Optional[str]]] = [
    ("server/dist", None),
    ("client/dist", None),
    ("admin/server/dist", None),
    ("admin/client/dist", None),
]

def resolve_local_build_commands() -> List[Tuple[str, str, List[str]]]:
    """解析本次部署需要执行的本地构建命令列表。

    规则：
    1. 主服务与主前端分别执行根目录的 `npm run build:server` 与 `npm run build:client`；
       若脚本不存在则会在执行阶段报错，强制要求存在。
    2. Admin 构建优先使用 `admin/package.json` 中的 `build` 或 `build:admin` 脚本；
       否则若 `admin/server/package.json` 与 `admin/client/package.json` 均存在 `build` 脚本，
       则分别执行；若均不存在，则跳过 Admin 构建并输出提示。

    Returns:
        包含 (描述, 相对工作目录, 命令参数列表) 的列表。
    """
    root = get_project_root()
    commands: List[Tuple[str, str, List[str]]] = [
        ("主服务端", ".", ["npm", "run", "build:server"]),
        ("主客户端", ".", ["npm", "run", "build:client"]),
    ]

    admin_root = os.path.join(root, "admin")
    if os.path.isdir(admin_root):
        if npm_script_exists("build", admin_root):
            commands.append(("Admin 整体", "admin", ["npm", "run", "build"]))
        elif npm_script_exists("build:admin", admin_root):
            commands.append(("Admin 整体", "admin", ["npm", "run", "build:admin"]))
        else:
            admin_server = os.path.join(admin_root, "server")
            admin_client = os.path.join(admin_root, "client")
            has_server_build = npm_script_exists("build", admin_server)
            has_client_build = npm_script_exists("build", admin_client)

            if has_server_build:
                commands.append(("Admin 服务端", "admin/server", ["npm", "run", "build"]))
            if has_client_build:
                commands.append(("Admin 客户端", "admin/client", ["npm", "run", "build"]))

            if not has_server_build and not has_client_build:
                print("未检测到 Admin 构建脚本，跳过 Admin 构建。")
    else:
        print("未检测到 admin 目录，跳过 Admin 构建。")

    return commands


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


def run_local_command(
    command: List[str],
    description: str,
    cwd: Optional[str] = None,
) -> str:
    """在本地执行命令并返回标准输出。

    Args:
        command: 要执行的命令及参数列表。
        description: 命令用途描述，用于错误提示。
        cwd: 命令执行的工作目录，默认为项目根目录。

    Returns:
        命令执行后的标准输出字符串（已去除首尾空白）。

    Raises:
        RuntimeError: 当命令返回非零退出码时抛出。
    """
    work_dir = cwd or get_project_root()
    print(f">>> 本地执行: {' '.join(command)} (工作目录: {work_dir})")
    # Windows 上 npm/git 等命令需要 shell=True 才能正确解析 .cmd/.bat 文件
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=work_dir,
        shell=os.name == "nt",
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"{description} 失败，退出码 {result.returncode}，错误：{result.stderr.strip()}"
        )
    return result.stdout.strip()


def npm_script_exists(script_name: str, cwd: Optional[str] = None) -> bool:
    """检查指定目录的 package.json 中是否存在某个 npm 脚本。

    Args:
        script_name: npm 脚本名称。
        cwd: 要检查的目录，默认为项目根目录。

    Returns:
        若 package.json 中存在该脚本则返回 True，否则返回 False。
    """
    package_path = os.path.join(cwd or get_project_root(), "package.json")
    if not os.path.isfile(package_path):
        return False
    try:
        with open(package_path, "r", encoding="utf-8") as file:
            package = json.load(file)
    except (json.JSONDecodeError, OSError):
        return False
    return script_name in package.get("scripts", {})


def try_sync_to_remote_repo(timestamp: str) -> None:
    """部署成功后非阻塞尝试同步本地仓库到远程。

    本函数为可选后置步骤，所有 Git 操作均被 try-except 包裹，
    任何异常都仅打印提示，不影响部署已成功完成的状态。

    流程：
    1. 检查工作区是否有未提交变更，若有则自动 `git add -A` 并提交；
    2. 尝试 `git push` 推送当前分支，失败仅打印提示；
    3. 创建 `deploy-backup-<timestamp>` 标签并尝试推送，失败仅打印提示。

    Args:
        timestamp: 部署时间戳，用于提交信息与标签命名。
    """
    print("【可选步骤】尝试同步本地仓库到远程...")

    # 检查工作区是否有未提交变更，必要时自动提交
    try:
        status_output = run_local_command(
            ["git", "status", "--porcelain"], "检查 Git 工作区状态"
        )
        if status_output:
            print("检测到工作区存在未提交变更，正在自动提交...")
            run_local_command(["git", "add", "-A"], "添加本地变更")
            run_local_command(
                ["git", "commit", "-m", f"chore(deploy): 部署后同步 {timestamp}"],
                "提交本地变更",
            )
        else:
            print("Git 工作区已干净，无需提交。")
    except RuntimeError as exc:
        print(f"⚠️ Git 提交阶段失败，部署已成功完成，请稍后手动处理代码同步：{exc}")
        return

    # 尝试推送当前分支，失败仅打印提示，不抛异常
    try:
        print("推送当前分支到远程仓库...")
        run_local_command(["git", "push"], "推送当前分支")
    except RuntimeError as exc:
        print("⚠️ Git 推送失败，部署已成功完成，请稍后手动推送代码")
        print(f"  详细错误: {exc}")
        return

    # 创建部署备份标签并尝试推送，失败仅打印提示
    tag_name = f"deploy-backup-{timestamp}"
    try:
        run_local_command(["git", "tag", tag_name], "创建部署备份标签")
        print(f"已创建 Git 备份标签: {tag_name}")
    except RuntimeError as exc:
        print(f"⚠️ Git 标签创建失败，部署已成功完成：{exc}")
        return

    try:
        run_local_command(["git", "push", "origin", tag_name], "推送部署备份标签")
        print(f"已推送 Git 备份标签到远程仓库: {tag_name}")
    except RuntimeError as exc:
        print(f"⚠️ Git 标签推送失败，部署已成功完成，请稍后手动推送标签 {tag_name}")
        print(f"  详细错误: {exc}")


def run_local_validation() -> None:
    """在本地执行 lint、test 与 build。

    若根目录 package.json 中存在 lint/test 脚本，则执行；
    缺失时输出提示并跳过，不中断部署。
    构建命令（主服务、主前端、Admin 服务端、Admin 客户端）必须全部成功。

    Raises:
        RuntimeError: 当任意构建命令返回非零退出码时抛出。
    """
    root = get_project_root()

    if npm_script_exists("lint", root):
        run_local_command(["npm", "run", "lint"], "本地 lint 检查", cwd=root)
    else:
        print("未检测到根目录 lint 脚本，跳过 lint 检查。")

    if npm_script_exists("test", root):
        run_local_command(["npm", "run", "test"], "本地测试", cwd=root)
    else:
        print("未检测到根目录 test 脚本，跳过测试。")

    for description, relative_dir, command in resolve_local_build_commands():
        cwd = os.path.normpath(os.path.join(root, relative_dir))
        if not os.path.isdir(cwd):
            raise RuntimeError(f"构建目录不存在：{cwd}，请检查项目结构。")
        run_local_command(command, f"本地构建 {description}", cwd=cwd)


def resolve_default_dist_list(project_dir: str) -> List[Tuple[str, str]]:
    """将默认产物目录映射中的远程路径补充为绝对路径。

    Args:
        project_dir: 服务器上的项目目录绝对路径。

    Returns:
        本地相对路径与远程绝对路径的映射列表。
    """
    return [
        (local_rel, remote_abs if remote_abs else f"{project_dir}/{local_rel}")
        for local_rel, remote_abs in DEFAULT_DIST_DIRS
    ]


def build_dist_list(config: Dict[str, str]) -> List[Tuple[str, str]]:
    """构建本次部署需要上传的产物目录列表。

    优先读取环境变量 DEPLOY_DIST_DIRS（JSON 数组），格式示例：
    [
      {"local": "server/dist", "remote": "/www/wwwroot/AI_mindmap/server/dist"}
    ]
    若未设置该环境变量，则使用默认产物目录列表。

    Args:
        config: 部署配置字典。

    Returns:
        本地相对路径与远程绝对路径的映射列表。

    Raises:
        ValueError: 当 DEPLOY_DIST_DIRS 格式不正确时抛出。
    """
    raw_dist_list = os.getenv("DEPLOY_DIST_DIRS")
    if not raw_dist_list:
        return resolve_default_dist_list(config["DEPLOY_PROJECT_DIR"])

    try:
        mappings = json.loads(raw_dist_list)
    except json.JSONDecodeError as exc:
        raise ValueError("DEPLOY_DIST_DIRS 不是有效的 JSON 字符串") from exc

    if not isinstance(mappings, list):
        raise ValueError("DEPLOY_DIST_DIRS 必须是 JSON 数组")

    dist_list: List[Tuple[str, str]] = []
    for item in mappings:
        if not isinstance(item, dict) or "local" not in item or "remote" not in item:
            raise ValueError("DEPLOY_DIST_DIRS 数组元素必须包含 local 和 remote 字段")
        local_rel = str(item["local"])
        remote_abs = str(item["remote"])
        if not local_rel or not remote_abs:
            raise ValueError("DEPLOY_DIST_DIRS 中的 local 和 remote 字段不能为空字符串")
        dist_list.append((local_rel, remote_abs))

    return dist_list


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


def cleanup_old_backups(ssh: paramiko.SSHClient, config: Dict[str, str], keep_count: int = 10) -> None:
    """清理服务器上过期的 dist 备份目录。

    按时间戳保留最新的 keep_count 个完整备份组，删除更早的 .bak-* 目录。
    清理失败仅打印警告，不影响当前部署。

    Args:
        ssh: 已连接的 SSH 客户端。
        config: 部署配置字典。
        keep_count: 保留的备份组数量，默认 10。
    """
    keep_count_str = os.getenv("DEPLOY_BACKUP_KEEP_COUNT")
    if keep_count_str and keep_count_str.isdigit():
        keep_count = int(keep_count_str)

    project_dir = config["DEPLOY_PROJECT_DIR"]
    backup_pattern = f"{project_dir}/server/dist.bak-*"

    try:
        exit_code, out, err = run_ssh_command(
            ssh, f"ls -1d {shlex.quote(backup_pattern)} 2>/dev/null || true", timeout=60, raise_on_error=False
        )
        if exit_code != 0 or not out.strip():
            return

        timestamps: List[str] = []
        for line in out.strip().splitlines():
            # 提取时间戳后缀，例如 /path/server/dist.bak-20250701-120000 -> 20250701-120000
            suffix = line.rsplit(".bak-", 1)[-1]
            if suffix and suffix not in timestamps:
                timestamps.append(suffix)

        # YYYYMMDD-HHMMSS 字符串按字典序降序即时间降序
        timestamps.sort(reverse=True)
        timestamps_to_delete = timestamps[keep_count:]

        if not timestamps_to_delete:
            return

        dist_dirs = ["client/dist", "server/dist", "admin/server/dist", "admin/client/dist"]
        for ts in timestamps_to_delete:
            for dist_dir in dist_dirs:
                backup_dir = f"{project_dir}/{dist_dir}.bak-{ts}"
                run_ssh_command(ssh, f"rm -rf {shlex.quote(backup_dir)}", timeout=60, raise_on_error=False)
        print(f"已清理 {len(timestamps_to_delete)} 组过期备份")
    except Exception as exc:
        print(f"⚠️ 清理旧备份失败: {exc}")


def backup_server_dists(ssh: paramiko.SSHClient, config: Dict[str, str], timestamp: str) -> None:
    """在服务器上备份本次将要替换的 dist 目录。

    分别备份 client/dist、server/dist、admin/server/dist、admin/client/dist 为对应名称的 .bak-<timestamp> 目录。
    若源目录不存在，则跳过该目录并输出提示。
    备份完成后会验证每个实际生成的备份目录存在且非空，验证失败则中止部署。
    验证通过后会清理服务器上的过期备份，默认保留最近 10 个完整备份组。

    Args:
        ssh: 已连接的 SSH 客户端。
        config: 部署配置字典。
        timestamp: 备份时间戳，用于目录后缀。

    Raises:
        RuntimeError: 当备份命令执行失败或备份验证失败时抛出。
    """
    project_dir = config["DEPLOY_PROJECT_DIR"]
    dist_dirs = ["client/dist", "server/dist", "admin/server/dist", "admin/client/dist"]
    backed_up_dirs: List[str] = []

    for dist_dir in dist_dirs:
        src_dir = f"{project_dir}/{dist_dir}"
        dst_dir = f"{src_dir}.bak-{timestamp}"
        command = (
            f"if [ -d {shlex.quote(src_dir)} ]; then "
            f"cp -a {shlex.quote(src_dir)} {shlex.quote(dst_dir)}; "
            f"echo '已备份: {src_dir} -> {dst_dir}'; "
            f"else echo '跳过不存在的目录: {src_dir}'; fi"
        )
        run_ssh_command(ssh, command, timeout=300)
        # 源目录存在时记录备份目录，供后续验证
        check_command = f"[ -d {shlex.quote(src_dir)} ] && echo 'exists' || echo 'missing'"
        _, check_out, _ = run_ssh_command(ssh, check_command, timeout=60, raise_on_error=False)
        if check_out.strip() == "exists":
            backed_up_dirs.append(dst_dir)

    # 备份后验证：每个实际执行了复制的备份目录必须存在且非空
    for dst_dir in backed_up_dirs:
        verify_command = f"[ -d {shlex.quote(dst_dir)} ] && [ \"$(ls -A {shlex.quote(dst_dir)})\" ] && echo 'ok' || echo 'fail'"
        _, verify_out, _ = run_ssh_command(ssh, verify_command, timeout=60, raise_on_error=False)
        if verify_out.strip() != "ok":
            raise RuntimeError(f"备份验证失败: {dst_dir} 不存在或为空，部署已中止")

    print("备份验证通过")
    cleanup_old_backups(ssh, config)


def upload_directory(
    sftp: paramiko.SFTPClient,
    local_dir: str,
    remote_dir: str,
) -> None:
    """递归上传本地目录到远程服务器。

    Args:
        sftp: 已打开的 SFTP 客户端。
        local_dir: 本地源目录绝对路径。
        remote_dir: 远程目标目录绝对路径。

    Raises:
        FileNotFoundError: 当本地目录不存在时抛出。
        RuntimeError: 当创建远程目录或上传文件失败时抛出。
    """
    if not os.path.isdir(local_dir):
        raise FileNotFoundError(f"本地目录不存在: {local_dir}")

    # 先确保远程根目录存在（SFTP mkdir 只能创建一级目录，不能递归）
    try:
        sftp.mkdir(remote_dir)
    except IOError:
        pass  # 目录已存在，忽略

    for root, dirs, files in os.walk(local_dir):
        relative_path = os.path.relpath(root, local_dir)
        # 当 relative_path 为 "." 时（根目录），直接使用 remote_dir
        if relative_path == ".":
            remote_path = remote_dir
        else:
            remote_path = f"{remote_dir}/{relative_path.replace(chr(92), '/')}".replace("\\", "/")

        try:
            sftp.mkdir(remote_path)
        except IOError:
            pass  # 目录已存在，忽略

        for filename in files:
            local_file = os.path.join(root, filename)
            remote_file = f"{remote_path}/{filename}"
            try:
                sftp.put(local_file, remote_file)
            except Exception as exc:
                raise RuntimeError(
                    f"上传文件失败: {local_file} -> {remote_file}，错误: {exc}"
                ) from exc


def replace_dist_dirs(
    ssh: paramiko.SSHClient,
    config: Dict[str, str],
    dist_list: List[Tuple[str, str]],
    timestamp: str,
) -> None:
    """上传本地构建产物并原子替换服务器上的 dist 目录。

    对每个产物目录：
    1. 将本地 dist 上传到远程临时目录 `<remote>.deploy-<timestamp>`；
    2. 删除服务器上当前 dist 目录（已备份）；
    3. 将临时目录重命名为 dist。

    Args:
        ssh: 已连接的 SSH 客户端。
        config: 部署配置字典。
        dist_list: 本地相对路径与远程绝对路径的映射列表。
        timestamp: 部署时间戳，用于临时目录命名。

    Raises:
        RuntimeError: 当任意替换命令返回非零退出码时抛出。
    """
    project_root = get_project_root()
    sftp = ssh.open_sftp()
    try:
        for local_rel, remote_path in dist_list:
            local_path = os.path.normpath(os.path.join(project_root, local_rel))
            if not os.path.isdir(local_path):
                print(f"跳过上传：本地目录不存在 {local_path}")
                continue

            staging_path = f"{remote_path}.deploy-{timestamp}"
            print(f"\n上传并替换: {local_rel} -> {remote_path}")
            print(f"  临时目录: {staging_path}")

            # 确保远程父目录存在
            remote_parent = os.path.dirname(remote_path)
            run_ssh_command(ssh, f"mkdir -p {shlex.quote(remote_parent)}", timeout=60)

            # 上传本地 dist 到临时目录
            upload_directory(sftp, local_path, staging_path)

            # 原子替换：删除当前 dist，将临时目录重命名为 dist
            replace_command = (
                f"rm -rf {shlex.quote(remote_path)} && "
                f"mv {shlex.quote(staging_path)} {shlex.quote(remote_path)}"
            )
            run_ssh_command(ssh, replace_command, timeout=300)
            print(f"  替换完成: {remote_path}")
    finally:
        sftp.close()


def restart_services(ssh: paramiko.SSHClient, config: Dict[str, str]) -> None:
    """在服务器上重启 PM2 服务。

    Args:
        ssh: 已连接的 SSH 客户端。
        config: 部署配置字典。

    Raises:
        RuntimeError: 当任意重启命令返回非零退出码时抛出。
    """
    steps: List[Tuple[str, str]] = [
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

    dist_list = build_dist_list(config)
    print(f"\n待上传构建产物目录（{len(dist_list)} 个）：")
    for local_rel, remote_path in dist_list:
        print(f"  - {local_rel} -> {remote_path}")

    print("\n服务器端备份目录：")
    for local_rel in ["client/dist", "server/dist", "admin/server/dist", "admin/client/dist"]:
        print(f"  - {project_dir}/{local_rel} -> {project_dir}/{local_rel}.bak-{timestamp}")

    print("\n本地构建命令：")
    for description, relative_dir, command in resolve_local_build_commands():
        print(f"  - {' '.join(command)} (工作目录: {relative_dir}) # {description}")

    print("\n服务器端操作：")
    print("  - 备份 dist 目录并验证备份完整性")
    print("  - 清理过期备份（保留最近 10 个）")
    print("  - 上传并替换 dist 目录")
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
    parser = argparse.ArgumentParser(description="本地构建后上传产物到远程服务器的部署脚本")
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
        log_step(2, "本地构建与校验")
        run_local_validation()

        log_step(3, "连接远程服务器")
        ssh = connect_ssh(config)

        log_step(4, "服务器端备份 dist 目录")
        backup_server_dists(ssh, config, timestamp)

        log_step(5, "构建上传产物目录列表")
        dist_list = build_dist_list(config)
        print(f"待上传构建产物目录数量: {len(dist_list)}")

        log_step(6, "上传并替换构建产物")
        replace_dist_dirs(ssh, config, dist_list, timestamp)

        log_step(7, "重启服务")
        restart_services(ssh, config)

        log_step(8, "健康检查")
        health_check(ssh, config)

        print("\n部署完成！")

        log_step(9, "同步本地仓库到远程（可选，非阻塞）")
        try_sync_to_remote_repo(timestamp)
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
