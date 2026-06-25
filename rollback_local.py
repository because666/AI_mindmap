import argparse
import os
import subprocess
import sys
from typing import List, Optional

from dotenv import load_dotenv


def get_project_root() -> str:
    """获取项目根目录（即本脚本所在目录）。

    Returns:
        项目根目录的绝对路径。
    """
    return os.path.dirname(os.path.abspath(__file__))


def load_deploy_env() -> None:
    """从项目根目录的 .env.deploy 加载环境变量。

    若配置文件不存在，则输出警告但不退出，因为本地回滚主要依赖 Git 操作。
    """
    env_path = os.path.join(get_project_root(), ".env.deploy")
    if not os.path.isfile(env_path):
        print(f"警告：配置文件不存在: {env_path}")
        return
    load_dotenv(env_path)


def run_git_command(args: List[str], description: str) -> str:
    """执行 Git 命令并返回标准输出。

    Args:
        args: Git 命令参数列表（不含 git 本身）。
        description: 命令用途描述，用于错误提示。

    Returns:
        命令执行后的标准输出字符串（已去除首尾空白）。

    Raises:
        RuntimeError: 当命令返回非零退出码时抛出。
    """
    command = ["git"] + args
    print(f">>> 执行: {' '.join(command)}")
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8")
    if result.returncode != 0:
        raise RuntimeError(
            f"{description} 失败，退出码 {result.returncode}，错误：{result.stderr.strip()}"
        )
    return result.stdout.strip()


def list_backup_tags() -> List[str]:
    """列出所有部署备份标签，按创建时间倒序排列。

    Returns:
        标签名称列表；不存在标签时返回空列表。

    Raises:
        RuntimeError: 当 Git 命令执行失败时抛出。
    """
    output = run_git_command(
        ["tag", "-l", "deploy-backup-*", "--sort=-creatordate"],
        "列出部署备份标签",
    )
    if not output:
        return []
    return [tag.strip() for tag in output.splitlines() if tag.strip()]


def find_target_tag(timestamp: Optional[str]) -> str:
    """根据时间戳或最新标志查找目标回滚标签。

    Args:
        timestamp: 用户指定的时间戳；为 None 时表示回滚到最新标签。

    Returns:
        目标标签的完整名称。

    Raises:
        ValueError: 当未找到任何备份标签或指定时间戳对应的标签不存在时抛出。
    """
    tags = list_backup_tags()
    if not tags:
        raise ValueError("未找到任何 deploy-backup-* 标签")

    if timestamp is None:
        return tags[0]

    target = f"deploy-backup-{timestamp}"
    if target not in tags:
        raise ValueError(f"未找到标签: {target}")
    return target


def confirm_rollback(tag: str) -> bool:
    """提示用户确认是否执行回滚操作。

    Args:
        tag: 待回滚到的目标标签。

    Returns:
        用户输入 y 或 yes 时返回 True，否则返回 False。
    """
    prompt = (
        f"确认要将当前分支回滚到标签 {tag} 吗？"
        "此操作会丢失回滚点之后的所有提交（y/N）："
    )
    user_input = input(prompt).strip().lower()
    return user_input in ("y", "yes")


def rollback_to_tag(tag: str) -> None:
    """执行硬重置回滚到指定标签。

    Args:
        tag: 目标 Git 标签。

    Raises:
        RuntimeError: 当 git reset --hard 执行失败时抛出。
    """
    run_git_command(["reset", "--hard", tag], f"回滚到标签 {tag}")
    print(f"已成功回滚到标签: {tag}")


def parse_arguments() -> argparse.Namespace:
    """解析命令行参数。

    Returns:
        解析后的命令行参数命名空间。
    """
    parser = argparse.ArgumentParser(description="本地 Git 回滚脚本")
    parser.add_argument(
        "timestamp",
        nargs="?",
        default=None,
        help="要回滚到的部署时间戳，例如 20240101-120000",
    )
    parser.add_argument(
        "--latest",
        action="store_true",
        help="回滚到最近的 deploy-backup-* 标签（默认行为）",
    )
    return parser.parse_args()


def main() -> int:
    """本地回滚脚本主入口。

    Returns:
        程序退出码：0 表示成功或用户取消，1 表示失败。
    """
    args = parse_arguments()

    if args.latest and args.timestamp is not None:
        print("错误：不能同时指定时间戳参数和 --latest 参数")
        return 1

    timestamp: Optional[str] = None if args.latest else args.timestamp

    try:
        load_deploy_env()
        tag = find_target_tag(timestamp)
        print(f"找到目标标签: {tag}")

        if not confirm_rollback(tag):
            print("已取消回滚操作")
            return 0

        rollback_to_tag(tag)
        return 0
    except Exception as exc:
        print(f"错误: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
