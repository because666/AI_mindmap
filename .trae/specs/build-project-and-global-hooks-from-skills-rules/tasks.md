# Tasks

- [x] Task 1: 梳理应纳入 hooks 的 skill/rule/记忆点
  - [x] SubTask 1.1: 列出全局 hooks 中应保留的现有通用规则提醒
  - [x] SubTask 1.2: 提取 `deploy-assistant` 与 `server-deploy-checklist` 中的关键触发条件
  - [x] SubTask 1.3: 提取项目记忆中的工程约定与经验教训
  - [x] SubTask 1.4: 提取产品策略中与非线性对话、移动端体验相关的核心原则

- [x] Task 2: 更新全局 hooks.json
  - [x] SubTask 2.1: 备份现有 `c:\Users\ASUS\.trae-cn\hooks.json`
  - [x] SubTask 2.2: 在 `pre-task` 中追加项目 skill 触发条件提醒
  - [x] SubTask 2.3: 在 `pre-completion` / `pre-commit` 中追加服务端部署检查提醒
  - [x] SubTask 2.4: 修复 `&&` 在 PowerShell 下的兼容性问题，将两个 echo 合并为一个

- [x] Task 3: 新建项目 hooks.json
  - [x] SubTask 3.1: 在 `d:\study1\DeepMindMap\v2\.trae\hooks.json` 创建文件
  - [x] SubTask 3.2: 配置 `pre-task` 提醒项目特定产品方向与工程约定
  - [x] SubTask 3.3: 配置 `post-save` 提醒检查项目特定约定
  - [x] SubTask 3.4: 配置 `pre-completion` / `pre-commit` 提醒项目交付与构建检查

- [x] Task 4: 验证 hooks 配置
  - [x] SubTask 4.1: 对全局与项目 hooks.json 进行 JSON 语法校验
  - [x] SubTask 4.2: 确认所有 hook 的 `blocking` 字段均为 `false`
  - [x] SubTask 4.3: 通过 echo 模拟触发，检查提醒文本内容完整、无乱码

# Task Dependencies

- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 and Task 3
