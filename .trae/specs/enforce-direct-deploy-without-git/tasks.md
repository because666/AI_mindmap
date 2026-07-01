# Tasks

- [ ] Task 1: 修改 `deploy_server.py` 移除 Git 步骤
  - [ ] SubTask 1.1: 移除 `ensure_git_commit_and_push` 函数（或将其内容清空为直接 return）
  - [ ] SubTask 1.2: 移除 `main()` 中 `log_step(2, "本地 Git 提交并推送")` 与 `ensure_git_commit_and_push(timestamp, skip_git_push=args.skip_git_push)` 调用
  - [ ] SubTask 1.3: 移除 argparse 中的 `--skip-git-push` 选项
  - [ ] SubTask 1.4: 重新排列 main() 中后续步骤编号（原步骤 3-9 改为步骤 2-8）
  - [ ] SubTask 1.5: 更新 `print_deployment_plan` 中关于 Git 的输出（如有）
  - [ ] SubTask 1.6: 移除失败提示中"请使用 --skip-git-push 选项重试"的文案

- [ ] Task 2: 修改 `.trae/skills/deploy-assistant/SKILL.md`
  - [ ] SubTask 2.1: 核心理念改为「本地构建，上传产物，服务器替换/重启」，移除"先本地 Git 提交推送"
  - [ ] SubTask 2.2: 部署流程移除第一步"本地 Git 提交并推送"，原步骤 2-7 改为步骤 1-6
  - [ ] SubTask 2.3: "立即部署"选项描述移除"本地 Git 提交推送"
  - [ ] SubTask 2.4: "仅备份"选项改为"仅在服务器端备份当前产物目录，不上传、不重启"
  - [ ] SubTask 2.5: 失败处理与回滚中移除"通过 Git 标签 `deploy-backup-<timestamp>` 恢复代码"
  - [ ] SubTask 2.6: 安全要求中移除"部署前必须完成本地 Git 提交、推送与标签"
  - [ ] SubTask 2.7: 开发任务开始时检查中移除"本地 Git 工作区是否干净"检查项

- [ ] Task 3: 修改 `.trae/skills/server-deploy-checklist/SKILL.md`
  - [ ] SubTask 3.1: 移除"第一步：本地 Git 提交并推送"整节
  - [ ] SubTask 3.2: 原"第二步：本地执行构建"改为"第一步：本地执行构建"，后续步骤依次前移
  - [ ] SubTask 3.3: 常见错误中移除"未先提交到仓库"条目
  - [ ] SubTask 3.4: 检查全文是否还有残留的 Git 相关描述

- [x] Task 4: 修改 `.trae/hooks.json`
  - [ ] SubTask 4.1: `pre-task` 中移除"必须先执行 git add / git commit / git push 将代码提交并推送到仓库"，改为"部署必须直接本地上传产物，不走 Git"
  - [ ] SubTask 4.2: `pre-completion` 中移除所有 Git 提交推送相关提醒
  - [ ] SubTask 4.3: `pre-commit` 中移除"本地 Git 提交并推送 -> 本地 lint/test/build"顺序描述，改为"本地 lint/test/build -> 本地上传产物"
  - [ ] SubTask 4.4: 校验 JSON 语法正确

- [ ] Task 5: 修改 `project_memory.md`
  - [ ] SubTask 5.1: 在 Hard Constraints 中新增："部署流程不走 Git，直接本地上传产物到服务器，禁止将 Git 推送作为部署前置条件"
  - [ ] SubTask 5.2: 保留现有"所有部署必须本地构建后上传服务器，禁止在服务器端拉取 Git 代码或运行构建"约束
  - [ ] SubTask 5.3: 在 Engineering Conventions 中将"服务器端仅执行目录替换、PM2 重启与健康检查，不做任何 git/npm build 操作"补充明确"本地也不执行 git push 作为部署前置"

- [x] Task 6: 验证一致性
  - [x] SubTask 6.1: 检查 `deploy_server.py`、两个 skill、hooks.json、project_memory.md 之间无矛盾
  - [x] SubTask 6.2: 校验 `deploy_server.py` Python 语法正确
  - [x] SubTask 6.3: 校验 `.trae/hooks.json` JSON 语法正确
  - [x] SubTask 6.4: 全文搜索项目根目录下是否还有"git push"作为部署前置的残留描述（排除 .git 目录与 node_modules）
  - [x] SubTask 6.5: 模拟执行 `python deploy_server.py --dry-run`，确认部署计划中无 Git 步骤

- [x] Task 7: 修复 `docs/deploy.md` 旧流程残留（验证阶段发现）
  - [x] SubTask 7.1: 修改第 7 行"本地完成 Git 提交并推送到远程仓库"为部署不走 Git 的描述
  - [x] SubTask 7.2: 修改第 42-53 行脚本执行顺序，移除步骤 2-4（Git 检查/推送/标签），重新编号，新增可选同步步骤
  - [x] SubTask 7.3: 修改第 82-88 行本地回滚说明，明确依赖可选同步步骤创建的标签
  - [x] SubTask 7.4: 修改第 115 行"本地代码需要回退"说明
  - [x] SubTask 7.5: 修改第 134 行"部署前必须完成 Git 提交、推送与标签"为"部署前必须在服务器端备份旧产物目录"

# Task Dependencies

- Task 2、Task 3、Task 4、Task 5 可并行执行（互不依赖）
- Task 1 独立执行（修改部署脚本）
- Task 6 依赖 Task 1-5 全部完成
- Task 7 依赖 Task 6（验证阶段发现的残留问题）
