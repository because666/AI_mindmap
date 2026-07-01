# 强制部署前备份与回滚一致性 Spec

## Why

用户明确要求：**所有的新部署一定要备份，防止出问题**。当前项目虽然已要求"上传前必须在服务器端备份 client/dist、server/dist、admin/server/dist、admin/client/dist"，但 `deploy_server.py` 与 `rollback_remote.py` 的备份目录命名格式不一致，导致部署后生成的备份无法被回滚脚本正确识别，备份机制形同虚设。此外，当前备份策略缺少备份完整性校验、旧备份清理等保护手段，长期运行可能导致磁盘空间膨胀或回滚失败。

需要强制所有部署在替换产物前必须完成可验证的服务器端备份，并修复备份/回滚目录格式不一致，确保"有部署必有可回滚备份"。

## What Changes

- **修复备份/回滚目录格式不一致**：统一 `deploy_server.py` 与 `rollback_remote.py` 的备份目录命名格式，使部署生成的备份能够被回滚脚本识别和使用。
- **增强 `deploy_server.py` 备份逻辑**：
  - 备份前检查源目录是否存在；
  - 备份后验证备份目录存在且非空；
  - 任一目录备份失败时立即中止部署，禁止无备份继续替换；
  - 备份成功后清理过期备份（默认保留最近 10 个，可通过环境变量配置）。
- **修复 `rollback_remote.py` 备份路径与格式**：
  - 统一读取 `server/dist.bak-*`、`admin/server/dist.bak-*`、`client/dist.bak-*`、`admin/client/dist.bak-*`；
  - 支持 `--latest` 正确匹配最新完整备份；
  - 回滚时校验四个备份目录均完整存在。
- **更新 `.trae/skills/deploy-assistant/SKILL.md`**：强调"所有部署必须先备份后替换，备份失败禁止继续部署"，并补充备份验证与旧备份清理说明。
- **更新 `.trae/skills/server-deploy-checklist/SKILL.md`**：将"上传前服务器端备份"提升为独立且不可跳过的强制步骤，增加备份验证检查点。
- **更新 `.trae/hooks.json`**：pre-task / pre-completion / pre-commit 中强调"任何部署操作必须先完成服务器端备份，备份失败必须中止"。
- **更新 `project_memory.md`**：新增 Hard Constraint「所有部署必须在服务器端完成产物备份后才能替换，禁止无备份部署」。
- **更新 `docs/deploy.md`**：同步备份目录格式与回滚命令，补充"备份失败自动中止部署"说明。

## Impact

- Affected specs: `enforce-direct-deploy-without-git`（部署后同步为可选，备份为强制前置）
- Affected code:
  - `deploy_server.py`（备份函数增强、目录格式统一、旧备份清理）
  - `rollback_remote.py`（备份路径格式统一、查找与校验逻辑修复）
  - `.trae/skills/deploy-assistant/SKILL.md`（强调强制备份）
  - `.trae/skills/server-deploy-checklist/SKILL.md`（备份为不可跳过步骤）
  - `.trae/hooks.json`（新增备份强制提醒）
  - `c:\Users\ASUS\.trae-cn\memory\projects\-d-study1-DeepMindMap-v2\project_memory.md`（新增 Hard Constraint）
  - `docs/deploy.md`（同步备份与回滚文档）

## ADDED Requirements

### Requirement: 部署前强制备份

系统 SHALL 在执行任何产物替换前，先在服务器端完整备份 `client/dist`、`server/dist`、`admin/server/dist`、`admin/client/dist`。备份失败时 SHALL 立即中止部署，禁止继续上传或替换。

#### Scenario: 标准部署流程（强制备份）

- **WHEN** 用户执行部署
- **THEN** 系统先连接远程服务器
- **AND** 对四个 dist 目录分别执行 `cp -a` 备份到 `.bak-<timestamp>` 目录
- **AND** 备份完成后验证每个备份目录存在且非空
- **AND** 任一备份失败时抛出异常并中止部署
- **AND** 备份成功后继续上传、替换、重启、健康检查

#### Scenario: 旧备份清理

- **WHEN** 备份成功完成后
- **THEN** 系统自动清理同一项目目录下超过保留数量（默认 10 个）的历史 `.bak-*` 备份
- **AND** 清理时按时间戳保留最新的 10 个完整备份组
- **AND** 清理失败仅打印警告，不影响当前部署

### Requirement: 备份与回滚格式一致

系统 SHALL 保证部署脚本创建的备份目录与回滚脚本期望的备份目录格式完全一致，确保每次部署生成的备份均可被 `rollback_remote.py` 识别和恢复。

#### Scenario: 回滚脚本识别部署备份

- **WHEN** 用户使用 `python rollback_remote.py --latest`
- **THEN** 回滚脚本能找到 `deploy_server.py` 最近一次部署创建的备份
- **AND** 回滚脚本校验四个 dist 备份目录均完整存在
- **AND** 回滚脚本使用这些备份恢复服务器状态

## MODIFIED Requirements

### Requirement: 现有 `deploy_server.py` 备份函数

`backup_server_dists` SHALL 在复制完成后验证每个备份目录存在且非空；SHALL 在备份成功后调用 `cleanup_old_backups` 清理过期备份；SHALL 在备份失败时通过抛出 `RuntimeError` 中止部署。

### Requirement: 现有 `rollback_remote.py` 备份路径

`get_backup_paths`、`find_latest_backup`、`_backup_exists`、`validate_backup_exists` SHALL 统一使用 `server/dist.bak-*`、`admin/server/dist.bak-*`、`client/dist.bak-*`、`admin/client/dist.bak-*` 四个路径，与 `deploy_server.py` 保持一致。

### Requirement: 现有 skill 与 hooks

`.trae/skills/deploy-assistant/SKILL.md`、`.trae/skills/server-deploy-checklist/SKILL.md`、`.trae/hooks.json` 中关于部署备份的描述 SHALL 从"建议/应当备份"提升为"强制备份，失败中止"。

### Requirement: 现有 `project_memory.md`

`project_memory.md` 的 Hard Constraints 中 SHALL 新增："所有部署必须在服务器端完成产物备份后才能替换 dist 目录，禁止无备份部署；备份失败必须中止部署，不得继续上传或替换"。

## REMOVED Requirements

无。
