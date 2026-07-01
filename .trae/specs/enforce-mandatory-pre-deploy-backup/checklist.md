# Checklist

## deploy_server.py 备份增强验证

- [x] `backup_server_dists` 对每个 dist 目录执行 `cp -a` 备份到 `.bak-<timestamp>` 目录
- [x] `backup_server_dists` 备份后验证每个备份目录存在且非空
- [x] 备份失败时抛出 `RuntimeError` 中止部署，不继续上传替换
- [x] 新增 `cleanup_old_backups` 函数，默认保留最近 10 个完整备份组
- [x] 备份成功后调用 `cleanup_old_backups` 清理过期备份
- [x] 清理失败仅打印警告，不影响当前部署
- [x] `print_deployment_plan` 输出包含备份验证与清理计划
- [x] `python -m py_compile deploy_server.py` 语法校验通过

## rollback_remote.py 路径一致性验证

- [x] `get_backup_paths` 返回四个路径：`server/dist.bak-*`、`admin/server/dist.bak-*`、`client/dist.bak-*`、`admin/client/dist.bak-*`
- [x] `find_latest_backup` 以 `server/dist.bak-*` 为候选，并校验四个备份目录同时存在
- [x] `_backup_exists` 检查四个备份目录均存在
- [x] `restore_backup` 还原四个目录到各自原位置
- [x] `python -m py_compile rollback_remote.py` 语法校验通过
- [x] `python rollback_remote.py --help` 命令行正常

## deploy-assistant skill 验证

- [x] 核心理念包含"所有部署必须先备份后替换，备份失败禁止继续部署"
- [x] 部署流程中"上传前服务器端备份"步骤包含备份验证与旧备份清理说明
- [x] 失败处理中明确"备份失败应立即中止，不得继续替换"

## server-deploy-checklist skill 验证

- [x] "上传前服务器端备份"为不可跳过的强制步骤
- [x] 备份验证检查点明确：四个目录备份均存在且非空
- [x] 常见错误中包含"未备份直接替换产物"条目

## hooks.json 验证

- [x] `pre-task` 中包含"任何部署必须先完成服务器端 dist 备份，备份失败必须中止"
- [x] `pre-completion` 中包含"必须确认上传前已完成服务器端备份且备份完整"
- [x] `pre-commit` 中部署顺序为"本地构建 → 服务器端备份 → 上传替换 → 重启 → 健康检查"
- [x] `python -m json.tool .trae/hooks.json` JSON 语法校验通过

## project_memory.md 验证

- [x] Hard Constraints 中新增"所有部署必须在服务器端完成产物备份后才能替换，禁止无备份部署"
- [x] Engineering Conventions 中补充"备份完成后需验证备份目录存在且非空"

## docs/deploy.md 验证

- [x] 备份目录格式与 `deploy_server.py`/`rollback_remote.py` 一致（server/dist.bak-* 等）
- [x] "完整部署"脚本执行顺序中包含"备份验证"与"旧备份清理"
- [x] "服务器端说明"中补充"备份失败将中止部署"
- [x] "远程回滚"中同步四个 dist 目录的备份路径

## 全局一致性验证

- [x] `deploy_server.py` 与 `rollback_remote.py` 备份目录命名格式完全一致
- [x] `python deploy_server.py --dry-run` 输出包含备份验证与清理，退出码为 0
- [x] 全文搜索项目根目录（排除 .git、node_modules）无"备份可选""跳过备份"等与新规范矛盾的描述
- [x] 所有修改后的 Python/JSON/Markdown 文件语法校验通过
