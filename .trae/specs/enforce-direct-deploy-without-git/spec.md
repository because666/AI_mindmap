# 强制直接本地上传部署（不走 Git）Spec

## Why

现有部署规范（`standardize-local-upload-deployment`）虽已禁止服务器端拉取代码，但本地部署流程仍强制执行 `git add` / `git commit` / `git push` / 创建并推送 `deploy-backup-<timestamp>` 标签。在网络异常、远程仓库不可达、或仅需快速验证线上效果的场景下，Git 推送步骤会阻塞部署，导致流程中断。用户明确要求：**以后所有部署到服务器的操作都要直接本地上传到服务器，不要提供 Git**。

需要将"不走 Git"作为部署流程的默认与唯一行为，从脚本、skill、hooks、项目记忆中彻底移除 Git 推送步骤，仅保留本地构建 → 上传产物 → 服务器替换/重启 → 健康检查的纯净流程。最后上传完后可以试试同步到仓库里面

## What Changes

* **`deploy_server.py`**：移除部署流程中的 Git 步骤（`ensure_git_commit_and_push` 调用、`--skip-git-push` 选项、Git 备份标签创建），部署默认且仅执行"本地构建 → 上传 → 服务器替换/重启 → 健康检查"。

* **`.trae/skills/deploy-assistant/SKILL.md`**：核心理念改为「本地构建，上传产物，服务器替换/重启」；移除"本地 Git 提交推送"步骤与 `deploy-backup-<timestamp>` 标签逻辑；回滚方式仅保留服务器端 `dist.bak-<timestamp>` 恢复。

* **`.trae/skills/server-deploy-checklist/SKILL.md`**：移除"第一步：本地 Git 提交并推送"，重新编号后续步骤；常见错误中移除"未先提交到仓库"。

* **`.trae/hooks.json`**：`pre-task` / `pre-completion` / `pre-commit` 中移除所有"必须先执行 git add / git commit / git push"的提醒，改为"直接本地上传产物，不走 Git"。

* **`project_memory.md`**：新增 Hard Constraint「部署流程不走 Git，直接本地上传产物到服务器」；修改现有约束，明确禁止本地 Git 推送作为部署前置条件。

## Impact

* Affected specs: `standardize-local-upload-deployment`（其"本地 Git 提交并推送 → 本地构建"的顺序被本 spec 覆盖）

* Affected code:

  * `deploy_server.py`（移除 Git 相关函数与 main 中的调用步骤）

  * `.trae/skills/deploy-assistant/SKILL.md`（重写核心理念与部署流程）

  * `.trae/skills/server-deploy-checklist/SKILL.md`（移除 Git 步骤，重排编号）

  * `.trae/hooks.json`（更新 pre-task / pre-completion / pre-commit 文案）

  * `c:\Users\ASUS\.trae-cn\memory\projects\-d-study1-DeepMindMap-v2\project_memory.md`（新增 Hard Constraint）

## ADDED Requirements

### Requirement: 部署流程不走 Git

系统 SHALL 采用"本地构建 → 直接上传产物 → 服务器替换/重启 → 健康检查"的部署流程，全程不执行任何 Git 操作（`git add` / `git commit` / `git push` / `git tag`），部署的成功与否不依赖远程仓库可达性。

#### Scenario: 标准部署流程（无 Git）

* **WHEN** 用户要求部署到服务器

* **THEN** AI 在本地执行 `npm run build:client` / `npm run build:server` / `npm run build:admin`

* **AND** 通过 SSH/SFTP 将本地构建产物上传到服务器对应目录

* **AND** 在服务器端执行目录替换、PM2 重启、健康检查

* **AND** 全程不执行 `git add` / `git commit` / `git push` / `git tag` 任何 Git 命令

* **AND** 部署前在服务器端备份 `client/dist`、`server/dist`、`admin/server/dist`、`admin/client/dist`

#### Scenario: 部署失败回滚（无 Git 标签）

* **WHEN** 上传后健康检查失败

* **THEN** 在服务器端将 `dist.bak-<timestamp>` 目录恢复为运行目录

* **AND** 重启 PM2 服务

* **AND** 不依赖 Git 标签回滚（Git 标签机制已移除）

## MODIFIED Requirements

### Requirement: 现有 `deploy_server.py` Git 步骤

`deploy_server.py` 中的 `ensure_git_commit_and_push` 函数及其在 `main()` 中的调用（步骤 2）SHALL 被移除；`--skip-git-push` 命令行选项 SHALL 被移除（因默认即不走 Git）；部署步骤编号需重新排列（原步骤 3-9 改为步骤 2-8）。

### Requirement: 现有 `deploy-assistant` skill

`.trae/skills/deploy-assistant/SKILL.md` 的核心理念 SHALL 从「先本地 Git 提交推送，再本地构建，最后上传产物」改为「本地构建，上传产物，服务器替换/重启」；部署流程 SHALL 移除第一步"本地 Git 提交并推送"；"立即部署"选项 SHALL 不再包含 Git 操作；"仅备份"选项 SHALL 改为"仅在服务器端备份当前产物目录，不上传、不重启"；安全要求中 SHALL 移除"部署前必须完成本地 Git 提交、推送与标签"。

### Requirement: 现有 `server-deploy-checklist` skill

`.trae/skills/server-deploy-checklist/SKILL.md` SHALL 移除"第一步：本地 Git 提交并推送"整节内容；原"第二步：本地执行构建"改为"第一步：本地执行构建"；后续步骤编号依次前移；常见错误中 SHALL 移除"未先提交到仓库"条目。

### Requirement: 现有 `.trae/hooks.json`

`.trae/hooks.json` 的 `pre-task` 中 SHALL 移除"必须先执行 git add / git commit / git push 将代码提交并推送到仓库"，改为"部署必须直接本地上传产物，不走 Git"；`pre-completion` 与 `pre-commit` 中 SHALL 移除所有 Git 提交推送相关提醒。

### Requirement: 现有 `project_memory.md` Hard Constraints

`project_memory.md` 的 Hard Constraints 中 SHALL 新增："部署流程不走 Git，直接本地上传产物到服务器，禁止将 Git 推送作为部署前置条件"；现有"所有部署必须本地构建后上传服务器，禁止在服务器端拉取 Git 代码或运行构建"SHALL 保留（仍禁止服务器端 Git 操作）。

## REMOVED Requirements

### Requirement: `deploy_server.py` 的 `--skip-git-push` 选项

**Reason**: 部署默认即不走 Git，`--skip-git-push` 选项失去存在意义。
**Migration**: 移除该命令行选项及 `ensure_git_commit_and_push` 函数中所有 Git 命令调用；保留函数签名兼容性可通过直接删除函数实现，因部署脚本仅内部调用。

### Requirement: `deploy-assistant` skill 中的 `deploy-backup-<timestamp>` Git 标签机制

**Reason**: 部署不再依赖 Git，标签机制无用。
**Migration**: 回滚统一通过服务器端 `dist.bak-<timestamp>` 目录恢复实现，无需 Git 标签。
