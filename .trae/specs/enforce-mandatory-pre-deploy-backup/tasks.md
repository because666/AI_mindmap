# Tasks

- [x] Task 1: 修复并增强 `deploy_server.py` 备份逻辑
  - [ ] SubTask 1.1: 统一备份目录命名为 `{project_dir}/{dist_dir}.bak-{timestamp}` 格式（与现有一致）
  - [ ] SubTask 1.2: 在 `backup_server_dists` 中备份后验证每个备份目录存在且非空
  - [ ] SubTask 1.3: 备份失败时抛出 `RuntimeError` 中止部署（利用现有 `run_ssh_command` 默认行为）
  - [ ] SubTask 1.4: 新增 `cleanup_old_backups` 函数，默认保留最近 10 个完整备份组，超期自动清理
  - [ ] SubTask 1.5: 在 `backup_server_dists` 成功后调用 `cleanup_old_backups`
  - [ ] SubTask 1.6: 清理失败时用 `print` 打印警告，不阻塞部署
  - [ ] SubTask 1.7: 更新 `print_deployment_plan` 输出备份验证与清理计划
  - [ ] SubTask 1.8: 执行 `python -m py_compile deploy_server.py` 校验语法

- [x] Task 2: 修复 `rollback_remote.py` 备份路径格式不一致
  - [ ] SubTask 2.1: 修改 `get_backup_paths` 返回四个路径：`server/dist.bak-*`、`admin/server/dist.bak-*`、`client/dist.bak-*`、`admin/client/dist.bak-*`
  - [ ] SubTask 2.2: 修改 `find_latest_backup` 以 `server/dist.bak-*` 为候选，校验四个备份目录同时存在
  - [ ] SubTask 2.3: 修改 `restore_backup` 还原四个目录到原位置
  - [ ] SubTask 2.4: 执行 `python -m py_compile rollback_remote.py` 校验语法
  - [ ] SubTask 2.5: 执行 `python rollback_remote.py --help` 确认命令行正常

- [x] Task 3: 更新 `.trae/skills/deploy-assistant/SKILL.md`
  - [ ] SubTask 3.1: 在核心理念中强调"所有部署必须先备份后替换，备份失败禁止继续部署"
  - [ ] SubTask 3.2: 在部署流程"上传前服务器端备份"步骤中补充备份验证与旧备份清理说明
  - [ ] SubTask 3.3: 在失败处理中补充"备份失败应立即中止，不得继续替换"

- [x] Task 4: 更新 `.trae/skills/server-deploy-checklist/SKILL.md`
  - [ ] SubTask 4.1: 将"上传前服务器端备份"提升为不可跳过的强制步骤
  - [ ] SubTask 4.2: 增加备份验证检查点：四个目录备份均存在且非空
  - [ ] SubTask 4.3: 在常见错误中新增"未备份直接替换产物"条目

- [x] Task 5: 更新 `.trae/hooks.json`
  - [ ] SubTask 5.1: 在 `pre-task` 中新增/更新"任何部署必须先完成服务器端 dist 备份，备份失败必须中止"
  - [ ] SubTask 5.2: 在 `pre-completion` 中新增"必须确认上传前已完成服务器端备份且备份完整"
  - [ ] SubTask 5.3: 在 `pre-commit` 中新增"部署顺序：本地构建 → 服务器端备份 → 上传替换 → 重启 → 健康检查"
  - [ ] SubTask 5.4: 执行 `python -m json.tool .trae/hooks.json` 校验 JSON 语法

- [x] Task 6: 更新 `project_memory.md`
  - [ ] SubTask 6.1: 在 Hard Constraints 中新增"所有部署必须在服务器端完成产物备份后才能替换，禁止无备份部署"
  - [ ] SubTask 6.2: 在 Engineering Conventions 中补充"备份完成后需验证备份目录存在且非空"

- [x] Task 7: 更新 `docs/deploy.md`
  - [ ] SubTask 7.1: 同步备份目录格式（server/dist.bak-* 等）
  - [ ] SubTask 7.2: 在"完整部署"脚本执行顺序中补充"备份验证"与"旧备份清理"步骤
  - [ ] SubTask 7.3: 在"服务器端说明"中补充"备份失败将中止部署"
  - [ ] SubTask 7.4: 在"远程回滚"中同步四个 dist 目录的备份路径

- [x] Task 8: 验证一致性
  - [x] SubTask 8.1: 检查 `deploy_server.py` 与 `rollback_remote.py` 备份目录格式完全一致
  - [x] SubTask 8.2: 执行 `python deploy_server.py --dry-run`，确认部署计划包含备份验证与清理
  - [x] SubTask 8.3: 执行 `python -m py_compile deploy_server.py rollback_remote.py` 校验语法
  - [x] SubTask 8.4: 执行 `python -m json.tool .trae/hooks.json` 校验 JSON
  - [x] SubTask 8.5: 全文搜索项目根目录（排除 .git、node_modules）确认 skill/hooks/project_memory/docs 中备份强制描述一致

# Task Dependencies

- Task 1 与 Task 2 可并行执行（分别修改部署脚本与回滚脚本）
- Task 3、Task 4、Task 5、Task 6、Task 7 可并行执行（文档/规则更新互不依赖）
- Task 8 依赖 Task 1-7 全部完成
