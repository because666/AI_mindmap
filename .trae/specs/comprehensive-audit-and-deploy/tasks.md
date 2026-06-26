# Tasks

- [ ] Task 1: 本地构建验证
  - [ ] client: tsc --noEmit + npm run build
  - [ ] server: tsc --noEmit + npm run build
  - [ ] admin/server: tsc --noEmit + npm run build
  - [ ] admin/client: npm run build

- [ ] Task 2: 全量单元测试
  - [ ] client: npx vitest run
  - [ ] server: npx vitest run

- [ ] Task 3: 安全审计与代码质量
  - [ ] 检查硬编码密钥（API Key、密码、连接串）
  - [ ] client ESLint 检查
  - [ ] server ESLint 检查
  - [ ] 检查 .gitignore 是否排除 .env

- [ ] Task 4: 修复发现的问题
  - [ ] 修复测试失败
  - [ ] 修复 ESLint error
  - [ ] 修复安全问题

- [ ] Task 5: 部署到服务器
  - [ ] 更新 deploy_server.py 文件列表
  - [ ] 执行部署脚本
  - [ ] 验证健康检查

# Task Dependencies
- Task 4 依赖 Task 1-3 的结果
- Task 5 依赖 Task 4 完成
