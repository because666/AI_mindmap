# Tasks

- [x] Task 1: 将部署流程规范写入项目记忆
  - [x] SubTask 1.1: 在 `project_memory.md` 中新增 Hard Constraint：部署必须本地构建后上传，禁止服务器端拉取代码
  - [x] SubTask 1.2: 在 `project_memory.md` 中补充备份与回滚原则

- [x] Task 2: 更新 deploy-assistant skill
  - [x] SubTask 2.1: 修改 `.trae/skills/deploy-assistant/SKILL.md` 的核心理念与部署流程
  - [x] SubTask 2.2: 明确部署顺序为：本地 Git 提交并推送 → 本地构建 → 上传产物 → 服务器替换/重启
  - [x] SubTask 2.3: 在 skill 中明确禁止服务器端执行 `git pull` / `git reset` / `npm run build`

- [x] Task 3: 更新项目级 hooks
  - [x] SubTask 3.1: 在项目 `pre-task` 中追加：涉及部署时必须先提交并推送代码到仓库
  - [x] SubTask 3.2: 在项目 `pre-task` / `pre-completion` 中追加：部署必须通过本地上传产物，禁止在服务器拉取代码
  - [x] SubTask 3.3: 在项目 `pre-completion` 中追加：部署前需确认已完成本地构建并准备上传

- [x] Task 4: 调整部署脚本
  - [x] SubTask 4.1: 检查现有 `deploy_server.py`，确认或增强其“本地构建 → 上传产物 → 服务器替换/重启”能力
  - [x] SubTask 4.2: 在 `deploy_server.py` 中增加上传前服务器端 `dist` 目录备份逻辑
  - [x] SubTask 4.3: 调整 `deploy.sh`，改为仅执行服务器端替换/重启，或输出废弃提示

- [x] Task 5: 更新部署文档
  - [x] SubTask 5.1: 更新 `README.md` 中的部署说明，明确新的部署流程
  - [x] SubTask 5.2: 检查并更新 `docs/deploy.md`，与新的本地构建上传流程保持一致

- [x] Task 6: 验证部署流程与 hooks/skill 一致性
  - [x] SubTask 6.1: 检查 `project_memory.md`、skill、hooks、脚本、文档之间无矛盾
  - [x] SubTask 6.2: 对修改后的 JSON/脚本/文档进行语法校验
  - [x] SubTask 6.3: 模拟执行部署脚本的关键路径（构建 → 上传 → 重启命令格式检查）

# Task Dependencies

- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2
- Task 5 depends on Task 4
- Task 6 depends on Task 2、Task 3、Task 4、Task 5
