import argparse
import subprocess
import unittest
from unittest.mock import MagicMock, patch

import rollback_local


class TestRunGitCommand(unittest.TestCase):
    """测试 run_git_command 函数。"""

    @patch("rollback_local.subprocess.run")
    def test_run_git_command_success(self, mock_run: MagicMock) -> None:
        """验证 Git 命令成功时返回标准输出。"""
        mock_run.return_value = MagicMock(returncode=0, stdout="tag1\ntag2\n", stderr="")
        result = rollback_local.run_git_command(["tag", "-l"], "列标签")
        self.assertEqual(result, "tag1\ntag2")
        mock_run.assert_called_once_with(
            ["git", "tag", "-l"], capture_output=True, text=True, encoding="utf-8"
        )

    @patch("rollback_local.subprocess.run")
    def test_run_git_command_failure(self, mock_run: MagicMock) -> None:
        """验证 Git 命令失败时抛出 RuntimeError。"""
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="fatal error")
        with self.assertRaises(RuntimeError):
            rollback_local.run_git_command(["invalid"], "执行无效命令")


class TestListBackupTags(unittest.TestCase):
    """测试 list_backup_tags 函数。"""

    @patch("rollback_local.run_git_command")
    def test_list_backup_tags_with_results(self, mock_run: MagicMock) -> None:
        """验证存在标签时按行解析为列表。"""
        mock_run.return_value = "deploy-backup-20240101-120000\ndeploy-backup-20231231-080000"
        tags = rollback_local.list_backup_tags()
        self.assertEqual(
            tags,
            ["deploy-backup-20240101-120000", "deploy-backup-20231231-080000"],
        )
        mock_run.assert_called_once_with(
            ["tag", "-l", "deploy-backup-*", "--sort=-creatordate"],
            "列出部署备份标签",
        )

    @patch("rollback_local.run_git_command")
    def test_list_backup_tags_empty(self, mock_run: MagicMock) -> None:
        """验证无标签时返回空列表。"""
        mock_run.return_value = ""
        tags = rollback_local.list_backup_tags()
        self.assertEqual(tags, [])


class TestFindTargetTag(unittest.TestCase):
    """测试 find_target_tag 函数。"""

    @patch("rollback_local.list_backup_tags")
    def test_find_latest(self, mock_list: MagicMock) -> None:
        """验证未指定时间戳时返回最新标签。"""
        mock_list.return_value = [
            "deploy-backup-20240101-120000",
            "deploy-backup-20231231-080000",
        ]
        tag = rollback_local.find_target_tag(None)
        self.assertEqual(tag, "deploy-backup-20240101-120000")

    @patch("rollback_local.list_backup_tags")
    def test_find_by_timestamp(self, mock_list: MagicMock) -> None:
        """验证指定时间戳时返回对应标签。"""
        mock_list.return_value = [
            "deploy-backup-20240101-120000",
            "deploy-backup-20231231-080000",
        ]
        tag = rollback_local.find_target_tag("20231231-080000")
        self.assertEqual(tag, "deploy-backup-20231231-080000")

    @patch("rollback_local.list_backup_tags")
    def test_no_tags(self, mock_list: MagicMock) -> None:
        """验证无标签时抛出 ValueError。"""
        mock_list.return_value = []
        with self.assertRaises(ValueError):
            rollback_local.find_target_tag(None)

    @patch("rollback_local.list_backup_tags")
    def test_timestamp_not_found(self, mock_list: MagicMock) -> None:
        """验证指定时间戳不存在时抛出 ValueError。"""
        mock_list.return_value = ["deploy-backup-20240101-120000"]
        with self.assertRaises(ValueError):
            rollback_local.find_target_tag("20231231-080000")


class TestConfirmRollback(unittest.TestCase):
    """测试 confirm_rollback 函数。"""

    @patch("builtins.input", return_value="y")
    def test_confirm_yes(self, mock_input: MagicMock) -> None:
        """验证用户输入 y 时返回 True。"""
        self.assertTrue(rollback_local.confirm_rollback("deploy-backup-20240101-120000"))

    @patch("builtins.input", return_value="yes")
    def test_confirm_yes_full(self, mock_input: MagicMock) -> None:
        """验证用户输入 yes 时返回 True。"""
        self.assertTrue(rollback_local.confirm_rollback("deploy-backup-20240101-120000"))

    @patch("builtins.input", return_value="N")
    def test_confirm_no(self, mock_input: MagicMock) -> None:
        """验证用户输入 N 时返回 False。"""
        self.assertFalse(rollback_local.confirm_rollback("deploy-backup-20240101-120000"))

    @patch("builtins.input", return_value="")
    def test_confirm_empty(self, mock_input: MagicMock) -> None:
        """验证用户直接回车时返回 False。"""
        self.assertFalse(rollback_local.confirm_rollback("deploy-backup-20240101-120000"))


class TestRollbackToTag(unittest.TestCase):
    """测试 rollback_to_tag 函数。"""

    @patch("rollback_local.run_git_command")
    def test_rollback_success(self, mock_run: MagicMock) -> None:
        """验证回滚命令调用正确。"""
        rollback_local.rollback_to_tag("deploy-backup-20240101-120000")
        mock_run.assert_called_once_with(
            ["reset", "--hard", "deploy-backup-20240101-120000"],
            "回滚到标签 deploy-backup-20240101-120000",
        )


class TestParseArguments(unittest.TestCase):
    """测试 parse_arguments 函数。"""

    @patch("sys.argv", ["rollback_local.py"])
    def test_no_args(self) -> None:
        """验证无参数时返回 latest 模式。"""
        args = rollback_local.parse_arguments()
        self.assertIsNone(args.timestamp)
        self.assertFalse(args.latest)

    @patch("sys.argv", ["rollback_local.py", "20240101-120000"])
    def test_timestamp(self) -> None:
        """验证时间戳参数解析正确。"""
        args = rollback_local.parse_arguments()
        self.assertEqual(args.timestamp, "20240101-120000")
        self.assertFalse(args.latest)

    @patch("sys.argv", ["rollback_local.py", "--latest"])
    def test_latest_flag(self) -> None:
        """验证 --latest 参数解析正确。"""
        args = rollback_local.parse_arguments()
        self.assertTrue(args.latest)
        self.assertIsNone(args.timestamp)


class TestMain(unittest.TestCase):
    """测试 main 函数。"""

    @patch("rollback_local.load_deploy_env")
    @patch("rollback_local.find_target_tag")
    @patch("rollback_local.confirm_rollback", return_value=True)
    @patch("rollback_local.rollback_to_tag")
    @patch("sys.argv", ["rollback_local.py"])
    def test_main_success(
        self,
        mock_rollback: MagicMock,
        mock_confirm: MagicMock,
        mock_find: MagicMock,
        mock_load: MagicMock,
    ) -> None:
        """验证正常回滚流程返回 0。"""
        mock_find.return_value = "deploy-backup-20240101-120000"
        result = rollback_local.main()
        self.assertEqual(result, 0)
        mock_load.assert_called_once()
        mock_find.assert_called_once_with(None)
        mock_rollback.assert_called_once_with("deploy-backup-20240101-120000")

    @patch("rollback_local.load_deploy_env")
    @patch("rollback_local.find_target_tag")
    @patch("rollback_local.confirm_rollback", return_value=False)
    @patch("sys.argv", ["rollback_local.py"])
    def test_main_cancel(
        self,
        mock_confirm: MagicMock,
        mock_find: MagicMock,
        mock_load: MagicMock,
    ) -> None:
        """验证用户取消时返回 0。"""
        mock_find.return_value = "deploy-backup-20240101-120000"
        result = rollback_local.main()
        self.assertEqual(result, 0)

    @patch("rollback_local.load_deploy_env")
    @patch("rollback_local.find_target_tag", side_effect=ValueError("未找到标签"))
    @patch("sys.argv", ["rollback_local.py", "20231231-080000"])
    def test_main_not_found(
        self,
        mock_find: MagicMock,
        mock_load: MagicMock,
    ) -> None:
        """验证标签不存在时返回 1。"""
        result = rollback_local.main()
        self.assertEqual(result, 1)

    @patch("sys.argv", ["rollback_local.py", "20240101-120000", "--latest"])
    def test_main_conflict_args(self) -> None:
        """验证同时指定时间戳和 --latest 时返回 1。"""
        result = rollback_local.main()
        self.assertEqual(result, 1)


if __name__ == "__main__":
    unittest.main()
