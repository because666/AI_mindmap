# Checklist

- [x] `project_memory.md` 中新增 Hard Constraint：部署必须本地构建后上传，禁止服务器端拉取代码。
- [x] `project_memory.md` 中补充部署前服务器端 `dist` 目录备份与失败回滚原则。
- [x] `.trae/skills/deploy-assistant/SKILL.md` 的核心理念改为“先 Git 提交推送，再本地构建，最后上传产物”。
- [x] `.trae/skills/deploy-assistant/SKILL.md` 的部署流程明确为：本地 `git commit` / `git push` → 本地 `npm run build` → 上传产物 → 服务器替换/重启。
- [x] `.trae/skills/deploy-assistant/SKILL.md` 明确禁止服务器端执行 `git pull` / `git reset` / `npm run build`。
- [x] 项目 `d:\study1\DeepMindMap\v2\.trae\hooks.json` 的 `pre-task` 中包含部署前必须先提交并推送代码到仓库的提醒。
- [x] 项目 `d:\study1\DeepMindMap\v2\.trae\hooks.json` 的 `pre-task` / `pre-completion` 中包含禁止服务器端拉取代码、必须本地上传产物的提醒。
- [x] 项目 `d:\study1\DeepMindMap\v2\.trae\hooks.json` 的 `pre-completion` 中包含部署前需完成本地构建并准备上传的提醒。
- [x] `deploy_server.py` 支持本地构建后上传产物，不在服务器端拉取代码或构建。
- [x] `deploy_server.py` 在上传前自动备份服务器端 `client/dist`、`server/dist`、`admin/server/dist`。
- [x] `deploy_server.py` 在上传后执行 PM2 重启与健康检查。
- [x] `deploy.sh` 已调整为仅执行服务器端替换/重启，或明确输出废弃提示。
- [x] `README.md` 中的部署说明已更新为新的本地构建上传流程。
- [x] `docs/deploy.md` 中的部署说明与新的本地构建上传流程保持一致。
- [x] 所有修改后的 JSON/脚本/文档通过语法校验，无语法错误。
- [x] `project_memory.md`、skill、hooks、脚本、文档之间的部署流程描述无矛盾。
