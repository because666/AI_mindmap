# Checklist

## deploy_server.py 修改验证

- [x] `deploy_server.py` 中 `ensure_git_commit_and_push` 函数已被移除或清空为直接 return（无任何 `git` 命令调用）
- [x] `deploy_server.py` 的 `main()` 中不再调用 `ensure_git_commit_and_push`
- [x] `deploy_server.py` 的 argparse 中不再有 `--skip-git-push` 选项
- [x] `deploy_server.py` 的 main() 步骤编号连续（无跳号）
- [x] `deploy_server.py` 中所有"请使用 --skip-git-push 选项重试"文案已移除
- [x] `python deploy_server.py --dry-run` 输出的部署计划中无 Git 步骤
- [x] `python deploy_server.py --dry-run` 执行成功，退出码为 0

## deploy-assistant skill 验证

- [x] `.trae/skills/deploy-assistant/SKILL.md` 核心理念不再包含"先本地 Git 提交推送"
- [x] `.trae/skills/deploy-assistant/SKILL.md` 部署流程中无"本地 Git 提交并推送"步骤
- [x] `.trae/skills/deploy-assistant/SKILL.md` "立即部署"选项不再提及 Git 操作
- [x] `.trae/skills/deploy-assistant/SKILL.md` "仅备份"选项已改为仅在服务器端备份产物目录
- [x] `.trae/skills/deploy-assistant/SKILL.md` 失败处理中无"通过 Git 标签恢复代码"
- [x] `.trae/skills/deploy-assistant/SKILL.md` 安全要求中无"部署前必须完成本地 Git 提交、推送与标签"
- [x] `.trae/skills/deploy-assistant/SKILL.md` 开发任务开始时检查中无"本地 Git 工作区是否干净"

## server-deploy-checklist skill 验证

- [x] `.trae/skills/server-deploy-checklist/SKILL.md` 中无"第一步：本地 Git 提交并推送"章节
- [x] `.trae/skills/server-deploy-checklist/SKILL.md` 步骤编号连续（第一步为本地执行构建）
- [x] `.trae/skills/server-deploy-checklist/SKILL.md` 常见错误中无"未先提交到仓库"条目
- [x] `.trae/skills/server-deploy-checklist/SKILL.md` 全文无残留的 Git 提交推送描述

## hooks.json 验证

- [x] `.trae/hooks.json` 的 `pre-task` 中无"必须先执行 git add / git commit / git push"
- [x] `.trae/hooks.json` 的 `pre-task` 中包含"部署必须直接本地上传产物，不走 Git"
- [x] `.trae/hooks.json` 的 `pre-completion` 中无 Git 提交推送相关提醒
- [x] `.trae/hooks.json` 的 `pre-commit` 中无"本地 Git 提交并推送"顺序描述
- [x] `.trae/hooks.json` JSON 语法正确（`python -m json.tool` 校验通过）

## project_memory.md 验证

- [x] `project_memory.md` 的 Hard Constraints 中新增"部署流程不走 Git，直接本地上传产物到服务器"
- [x] `project_memory.md` 保留"所有部署必须本地构建后上传服务器，禁止在服务器端拉取 Git 代码或运行构建"
- [x] `project_memory.md` 的 Engineering Conventions 中补充明确本地不执行 git push 作为部署前置

## docs/deploy.md 验证（Task 7 新增）

- [x] `docs/deploy.md` 部署概述中无"本地完成 Git 提交并推送到远程仓库"作为部署第一步
- [x] `docs/deploy.md` 脚本执行顺序中步骤 2-4 不再是 Git 操作
- [x] `docs/deploy.md` 本地回滚章节有"依赖可选同步步骤"的说明
- [x] `docs/deploy.md` 安全注意事项中无"部署前必须完成 Git 提交、推送与标签"
- [x] `docs/deploy.md` 全文无 Git 提交推送作为部署前置的残留（可选同步步骤中的 Git 操作允许）

## 全局一致性验证

- [x] 全文搜索项目根目录（排除 .git、node_modules、.trae/specs）无"git push"作为部署前置的残留描述（仅可选同步步骤中的 git push 允许）
- [x] 全文搜索项目根目录（排除 .git、node_modules、.trae/specs）无"deploy-backup-" Git 标签作为部署前置的残留（仅可选同步与回滚工具允许）
- [x] `deploy_server.py`、两个 skill、hooks.json、project_memory.md、docs/deploy.md 之间部署流程描述无矛盾
- [x] `deploy_server.py` Python 语法校验通过（`python -m py_compile deploy_server.py`）
