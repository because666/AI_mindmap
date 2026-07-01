# Checklist

- [x] 全局 hooks.json 中保留了原有通用规则提醒（JSDoc、TS 类型、敏感信息、异常捕获、代码规范、简体中文）。
- [x] 全局 hooks.json 的 `pre-task` 中新增了 `deploy-assistant` 与 `server-deploy-checklist` 触发条件提醒。
- [x] 全局 hooks.json 的 `pre-completion` / `pre-commit` 中新增了服务端 TypeScript 部署检查提醒（远程编译、验证 dist、重启 PM2）。
- [x] 项目 hooks.json 已创建在 `d:\study1\DeepMindMap\v2\.trae\hooks.json`。
- [x] 项目 hooks.json 的 `pre-task` 中包含非线性对话产品方向提醒。
- [x] 项目 hooks.json 的 `pre-task` 中包含移动端与桌面端差异化布局提醒。
- [x] 项目 hooks.json 的 `pre-task` 中包含安全区域适配 `env(safe-area-inset-top)` 提醒。
- [x] 项目 hooks.json 的 `pre-task` 中包含节点连接点尺寸移动端单独调整提醒。
- [x] 项目 hooks.json 的 `pre-task` 中包含创建子节点必须显式传入父节点 ID 的提醒。
- [x] 项目 hooks.json 的 `post-save` 中包含对项目特定约定的检查提醒。
- [x] 项目 hooks.json 的 `pre-completion` / `pre-commit` 中包含前后端构建与 Capacitor Android 构建检查提醒。
- [x] 所有 hooks 配置均为有效 JSON，无语法错误。
- [x] 所有 hooks 的 `blocking` 字段均为 `false`，`enabled` 字段均为 `true`。
- [x] 提醒文本使用简体中文，无乱码或非法转义字符。
