from __future__ import annotations

import io
import os
import sys
import unittest
from typing import Dict, List, Tuple, cast
from unittest.mock import MagicMock, patch

import paramiko

import rollback_remote


class TestParseArguments(unittest.TestCase):
    """测试命令行参数解析。"""

    def test_timestamp_argument(self) -> None:
        """传入时间戳时，应正确解析 timestamp 字段。"""
        with patch.object(sys, "argv", ["rollback_remote.py", "20240101-120000"]):
            args = rollback_remote.parse_arguments()
        self.assertEqual(args.timestamp, "20240101-120000")
        self.assertFalse(args.latest)

    def test_latest_flag(self) -> None:
        """传入 --latest 时，latest 字段应为 True。"""
        with patch.object(sys, "argv", ["rollback_remote.py", "--latest"]):
            args = rollback_remote.parse_arguments()
        self.assertTrue(args.latest)
        self.assertIsNone(args.timestamp)

    def test_no_arguments(self) -> None:
        """无参数时，应默认查找最新备份。"""
        with patch.object(sys, "argv", ["rollback_remote.py"]):
            args = rollback_remote.parse_arguments()
        self.assertIsNone(args.timestamp)
        self.assertFalse(args.latest)


class TestGetBackupPaths(unittest.TestCase):
    """测试备份路径构造。"""

    def test_returns_three_paths(self) -> None:
        """应返回三个正确的远程绝对路径。"""
        server_bak, admin_bak, client_bak = rollback_remote.get_backup_paths(
            "/www/project", "20240101-120000"
        )
        self.assertEqual(server_bak, "/www/project/server.bak-20240101-120000")
        self.assertEqual(admin_bak, "/www/project/admin/server.bak-20240101-120000")
        self.assertEqual(client_bak, "/www/project/client/dist.bak-20240101-120000")


class TestFindLatestBackup(unittest.TestCase):
    """测试查找最新备份逻辑。"""

    def _mock_ssh(self) -> paramiko.SSHClient:
        """构造一个仅用于类型标注的 Mock SSH 客户端。"""
        return cast(paramiko.SSHClient, MagicMock(spec=paramiko.SSHClient))

    @patch("rollback_remote.run_ssh_command")
    def test_returns_latest_complete_backup(self, mock_run: MagicMock) -> None:
        """当存在多个候选时，应返回三套备份均存在的最大时间戳。"""
        mock_run.side_effect = [
            (0, "/www/project/server.bak-20240101-120000\n/www/project/server.bak-20240101-130000\n", ""),
            (0, "ok", ""),
        ]
        ssh = self._mock_ssh()
        result = rollback_remote.find_latest_backup(ssh, "/www/project")
        self.assertEqual(result, "20240101-130000")

    @patch("rollback_remote.run_ssh_command")
    def test_skips_incomplete_backup(self, mock_run: MagicMock) -> None:
        """当最新 server 备份缺少其他组件时，应回退到次新的完整备份。"""
        mock_run.side_effect = [
            (0, "/www/project/server.bak-20240101-120000\n/www/project/server.bak-20240101-130000\n", ""),
            (0, "missing", ""),
            (0, "ok", ""),
        ]
        ssh = self._mock_ssh()
        result = rollback_remote.find_latest_backup(ssh, "/www/project")
        self.assertEqual(result, "20240101-120000")

    @patch("rollback_remote.run_ssh_command")
    def test_raises_when_no_backup(self, mock_run: MagicMock) -> None:
        """当服务器上没有任何 server.bak-* 目录时，应抛出异常。"""
        mock_run.return_value = (0, "", "")
        ssh = self._mock_ssh()
        with self.assertRaises(RuntimeError):
            rollback_remote.find_latest_backup(ssh, "/www/project")

    @patch("rollback_remote.run_ssh_command")
    def test_raises_when_no_complete_backup(self, mock_run: MagicMock) -> None:
        """当所有候选都缺少其他组件时，应抛出异常。"""
        mock_run.side_effect = [
            (0, "/www/project/server.bak-20240101-120000\n", ""),
            (0, "missing", ""),
        ]
        ssh = self._mock_ssh()
        with self.assertRaises(RuntimeError):
            rollback_remote.find_latest_backup(ssh, "/www/project")


class TestValidateBackupExists(unittest.TestCase):
    """测试指定时间戳备份校验。"""

    @patch("rollback_remote.run_ssh_command")
    def test_passes_when_all_exist(self, mock_run: MagicMock) -> None:
        """三套备份均存在时不应抛出异常。"""
        mock_run.return_value = (0, "ok", "")
        ssh = cast(paramiko.SSHClient, MagicMock(spec=paramiko.SSHClient))
        rollback_remote.validate_backup_exists(ssh, "/www/project", "20240101-120000")

    @patch("rollback_remote.run_ssh_command")
    def test_raises_when_missing(self, mock_run: MagicMock) -> None:
        """任一备份缺失时应抛出异常。"""
        mock_run.return_value = (0, "missing", "")
        ssh = cast(paramiko.SSHClient, MagicMock(spec=paramiko.SSHClient))
        with self.assertRaises(RuntimeError):
            rollback_remote.validate_backup_exists(ssh, "/www/project", "20240101-120000")


class TestProcessControl(unittest.TestCase):
    """测试 PM2 停止与启动命令。"""

    def setUp(self) -> None:
        """初始化测试配置。"""
        self.config: Dict[str, str] = {
            "DEPLOY_PM2_SERVER": "server-app",
            "DEPLOY_PM2_ADMIN": "admin-app",
        }
        self.ssh = cast(paramiko.SSHClient, MagicMock(spec=paramiko.SSHClient))

    @patch("rollback_remote.run_ssh_command")
    def test_stop_pm2_processes(self, mock_run: MagicMock) -> None:
        """应依次停止两个 PM2 进程。"""
        rollback_remote.stop_pm2_processes(self.ssh, self.config)
        calls = [call[0][1] for call in mock_run.call_args_list]
        self.assertEqual(calls, ["pm2 stop server-app", "pm2 stop admin-app"])

    @patch("rollback_remote.run_ssh_command")
    def test_start_pm2_processes(self, mock_run: MagicMock) -> None:
        """应依次启动两个 PM2 进程。"""
        rollback_remote.start_pm2_processes(self.ssh, self.config)
        calls = [call[0][1] for call in mock_run.call_args_list]
        self.assertEqual(calls, ["pm2 restart server-app", "pm2 restart admin-app"])


class TestRestoreBackup(unittest.TestCase):
    """测试备份还原命令。"""

    @patch("rollback_remote.run_ssh_command")
    def test_restore_commands(self, mock_run: MagicMock) -> None:
        """应执行三套 rm -rf && cp -a 命令。"""
        ssh = cast(paramiko.SSHClient, MagicMock(spec=paramiko.SSHClient))
        rollback_remote.restore_backup(ssh, "/www/project", "20240101-120000")
        self.assertEqual(mock_run.call_count, 3)
        first_call = mock_run.call_args_list[0][0][1]
        self.assertIn("rm -rf", first_call)
        self.assertIn("cp -a", first_call)


class TestHealthCheck(unittest.TestCase):
    """测试健康检查逻辑。"""

    def setUp(self) -> None:
        """初始化测试配置与 Mock SSH 客户端。"""
        self.config: Dict[str, str] = {
            "DEPLOY_HEALTH_URL_SERVER": "http://localhost:3000/health",
            "DEPLOY_HEALTH_URL_ADMIN": "http://localhost:3100/health",
        }
        self.ssh = cast(paramiko.SSHClient, MagicMock(spec=paramiko.SSHClient))

    @patch("rollback_remote.run_ssh_command")
    @patch("rollback_remote.time.sleep")
    def test_passes_on_200(self, mock_sleep: MagicMock, mock_run: MagicMock) -> None:
        """两个 URL 均返回 200 时健康检查通过。"""
        mock_run.side_effect = [
            (0, "200", ""),
            (0, "200", ""),
        ]
        rollback_remote.health_check(self.ssh, self.config)
        self.assertEqual(mock_run.call_count, 2)
        mock_sleep.assert_called_once_with(5)

    @patch("rollback_remote.run_ssh_command")
    @patch("rollback_remote.time.sleep")
    def test_raises_on_non_200(self, mock_sleep: MagicMock, mock_run: MagicMock) -> None:
        """任一 URL 非 200 时应抛出异常。"""
        mock_run.side_effect = [
            (0, "200", ""),
            (0, "503", ""),
        ]
        with self.assertRaises(RuntimeError):
            rollback_remote.health_check(self.ssh, self.config)


class TestLoadConfiguration(unittest.TestCase):
    """测试配置加载。"""

    @patch("os.path.isfile")
    @patch.dict(os.environ, {}, clear=True)
    def test_exits_when_config_missing(self, mock_isfile: MagicMock) -> None:
        """.env.deploy 不存在时应调用 sys.exit(1)。"""
        mock_isfile.return_value = False
        with patch.object(sys, "argv", ["rollback_remote.py"]):
            with patch("sys.exit", side_effect=SystemExit) as mock_exit:
                with self.assertRaises(SystemExit):
                    rollback_remote.load_configuration()
                mock_exit.assert_called_once_with(1)

    @patch("os.path.isfile")
    @patch("rollback_remote.load_dotenv")
    @patch.dict(os.environ, {var: "value" for var in rollback_remote.REQUIRED_ENV_VARS}, clear=True)
    def test_returns_config_when_valid(self, mock_load_dotenv: MagicMock, mock_isfile: MagicMock) -> None:
        """所有必需环境变量均存在时应返回配置字典。"""
        mock_isfile.return_value = True
        config = rollback_remote.load_configuration()
        self.assertEqual(config["DEPLOY_HOST"], "value")
        mock_load_dotenv.assert_called_once()


class TestHelp(unittest.TestCase):
    """测试帮助信息输出。"""

    @patch("sys.exit")
    def test_help_output_is_chinese(self, mock_exit: MagicMock) -> None:
        """帮助信息应使用简体中文并包含关键说明。"""
        with patch("sys.stdout", new_callable=io.StringIO) as mock_stdout:
            rollback_remote.print_help_and_exit()
        output = mock_stdout.getvalue()
        self.assertIn("用法", output)
        self.assertIn("参数说明", output)
        self.assertIn("--latest", output)
        mock_exit.assert_called_once_with(0)


class TestMain(unittest.TestCase):
    """测试主流程编排。"""

    @patch("rollback_remote.parse_arguments")
    @patch("rollback_remote.load_configuration")
    @patch("rollback_remote.connect_ssh")
    @patch("rollback_remote.validate_backup_exists")
    @patch("rollback_remote.stop_pm2_processes")
    @patch("rollback_remote.restore_backup")
    @patch("rollback_remote.start_pm2_processes")
    @patch("rollback_remote.health_check")
    def test_main_with_timestamp_returns_zero(
        self,
        mock_health: MagicMock,
        mock_start: MagicMock,
        mock_restore: MagicMock,
        mock_stop: MagicMock,
        mock_validate: MagicMock,
        mock_connect: MagicMock,
        mock_load: MagicMock,
        mock_parse: MagicMock,
    ) -> None:
        """指定时间戳且全部步骤成功时，主函数应返回 0 并关闭 SSH。"""
        args = MagicMock(spec=rollback_remote._RollbackArgs)
        args.timestamp = "20240101-120000"
        args.latest = False
        args.help = False
        mock_parse.return_value = args

        config: Dict[str, str] = {
            "DEPLOY_PROJECT_DIR": "/www/project",
        }
        for var in rollback_remote.REQUIRED_ENV_VARS:
            if var not in config:
                config[var] = "value"
        mock_load.return_value = config

        mock_ssh = MagicMock()
        mock_connect.return_value = mock_ssh

        result = rollback_remote.main()

        self.assertEqual(result, 0)
        mock_connect.assert_called_once()
        mock_validate.assert_called_once_with(mock_ssh, "/www/project", "20240101-120000")
        mock_stop.assert_called_once_with(mock_ssh, config)
        mock_restore.assert_called_once_with(mock_ssh, "/www/project", "20240101-120000")
        mock_start.assert_called_once_with(mock_ssh, config)
        mock_health.assert_called_once_with(mock_ssh, config)
        mock_ssh.close.assert_called_once()

    @patch("rollback_remote.parse_arguments")
    @patch("rollback_remote.load_configuration")
    @patch("rollback_remote.connect_ssh")
    @patch("rollback_remote.find_latest_backup")
    @patch("rollback_remote.stop_pm2_processes")
    @patch("rollback_remote.restore_backup")
    @patch("rollback_remote.start_pm2_processes")
    @patch("rollback_remote.health_check")
    def test_main_latest_returns_zero(
        self,
        mock_health: MagicMock,
        mock_start: MagicMock,
        mock_restore: MagicMock,
        mock_stop: MagicMock,
        mock_find: MagicMock,
        mock_connect: MagicMock,
        mock_load: MagicMock,
        mock_parse: MagicMock,
    ) -> None:
        """使用 --latest 时，应查找最新备份并完成回滚流程。"""
        args = MagicMock(spec=rollback_remote._RollbackArgs)
        args.timestamp = None
        args.latest = True
        args.help = False
        mock_parse.return_value = args

        config: Dict[str, str] = {"DEPLOY_PROJECT_DIR": "/www/project"}
        for var in rollback_remote.REQUIRED_ENV_VARS:
            if var not in config:
                config[var] = "value"
        mock_load.return_value = config

        mock_ssh = MagicMock()
        mock_connect.return_value = mock_ssh
        mock_find.return_value = "20240101-130000"

        result = rollback_remote.main()

        self.assertEqual(result, 0)
        mock_find.assert_called_once_with(mock_ssh, "/www/project")
        mock_restore.assert_called_once_with(mock_ssh, "/www/project", "20240101-130000")
        mock_ssh.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
