# Checklist

## 构建验证
- [ ] client tsc --noEmit 通过
- [ ] client npm run build 通过
- [ ] server tsc --noEmit 通过
- [ ] server npm run build 通过
- [ ] admin/server tsc --noEmit 通过
- [ ] admin/server npm run build 通过
- [ ] admin/client npm run build 通过

## 单元测试
- [ ] client 所有测试通过
- [ ] server 所有测试通过（或仅有已知无关的失败）

## 安全审计
- [ ] 无硬编码 API Key
- [ ] 无硬编码数据库密码
- [ ] .env 被 .gitignore 排除
- [ ] client ESLint 无 error
- [ ] server ESLint 无 error

## 部署
- [ ] deploy_server.py 文件列表包含所有新增文件
- [ ] 服务器构建成功
- [ ] PM2 重启成功
- [ ] 健康检查 3001/health 返回 200
- [ ] 健康检查 3002/api/health 返回 200
