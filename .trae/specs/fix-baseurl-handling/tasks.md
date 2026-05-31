# Tasks

- [ ] Task 1: 修改 AddModelModal URL处理和提示文案
  - [ ] 保存时自动去除 baseUrl 末尾的 `/chat/completions`
  - [ ] 优化 placeholder 为 `如 https://api.openai.com/v1`
  - [ ] 输入框下方增加提示文字："请填写API基础地址，无需包含 /chat/completions"

- [ ] Task 2: 构建验证并部署
  - [ ] 客户端 `npx tsc --noEmit` 无错误
  - [ ] 上传到服务器并构建重启

# Task Dependencies
- Task 2 依赖 Task 1
