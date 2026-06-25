---
name: "server-deploy-checklist"
description: "服务端TypeScript项目部署检查清单。当部署服务端代码到远程服务器时触发，确保编译、上传、重启流程完整，避免遗漏编译步骤导致旧代码运行。"
---

# 服务端 TypeScript 项目部署检查清单

## 触发条件

当需要将服务端 TypeScript 代码部署到远程服务器时，必须执行此检查清单。

## 核心教训

**问题**：服务器运行的是 `dist/` 目录下编译后的 JS 文件，而非 TypeScript 源码。如果只上传了 `.ts` 源文件但没有在服务器上执行编译，服务器仍然运行旧版本的编译代码，导致修复不生效。

**症状**：
- 代码修改已上传但行为未变化
- 添加的 `console.log` 调试日志不出现在服务器日志中
- `grep` 检查 `dist/` 下的 JS 文件不包含新增代码

## 部署流程

### 第一步：上传源码

```bash
scp "本地路径/server/src/routes/xxx.ts" root@服务器IP:/项目路径/server/src/routes/xxx.ts
```

### 第二步：在服务器上编译 TypeScript（关键步骤！）

```bash
ssh root@服务器IP "cd /项目路径/server && npx tsc"
```

**验证编译成功**：
- 编译命令 exit code 为 0
- 无错误输出

### 第三步：验证编译产物包含新代码

```bash
ssh root@服务器IP "grep -c '新代码关键词' /项目路径/server/dist/routes/xxx.js"
```

- 如果返回 **0**：编译未生效，需排查
- 如果返回 **>0**：编译成功，新代码已包含在 JS 产物中

### 第四步：重启 PM2 服务

```bash
ssh root@43.139.43.112 "cd /项目路径 && pm2 restart 服务名"
```

### 第五步：验证服务正常运行

```bash
ssh root@服务器IP "pm2 logs 服务名 --nostream --lines 20"
```

检查：
- 服务状态为 `online`
- 无启动错误
- 新增的调试日志（如有）出现在输出中

## 客户端 vs 服务端部署差异

| 步骤 | 客户端（Vite/React） | 服务端（TypeScript/Node） |
|------|---------------------|--------------------------|
| 本地构建 | `npm run build` | 不需要 |
| 上传产物 | `dist/assets/*` + `dist/index.html` | `src/**/*.ts` 源文件 |
| 服务器编译 | 不需要 | **必须执行 `npx tsc`** |
| 重启服务 | 不需要（静态文件） | **必须 `pm2 restart`** |

## 常见错误

1. **只上传 .ts 文件不编译**：服务器运行 `dist/` 下的旧 JS，修改不生效
2. **编译失败但未检查**：TypeScript 类型错误导致编译失败，但旧 JS 仍在运行
3. **忘记重启 PM2**：编译成功但进程仍运行旧代码

## 当前项目部署信息

- 服务器IP：43.139.43.112
- 项目路径：/www/wwwroot/AI_mindmap
- 服务端服务名：deepmindmap-server
- Admin服务名：deepmindmap-admin
- 服务端运行目录：/www/wwwroot/AI_mindmap/server/dist
