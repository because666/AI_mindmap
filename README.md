# DeepMindMap

> AI 驱动的非线性思维导图与知识管理平台
> 
> 把一次深度 AI 探索，变成一张可管理、可沉淀、可分享的思维地图。

---

## 项目简介

DeepMindMap 是一款面向深度探索场景的下一代 AI 思维导图工具。

与 DeepSeek、ChatGPT 等传统线性对话不同，DeepMindMap 让每一次追问都变成地图上的自然分支：

- 你对某个回答产生疑问 → 点击延伸方向，自动创建子节点
- 支线聊完后 → 一键回到主线，支线自动生成摘要
- 多次探索后 → 得到一张结构化的知识地图，可随时复习、编辑、导出

典型使用场景：

- 学习复杂概念（如 Transformer、泰勒展开）
- 做产品/项目分析
- 写技术方案前的思路梳理
- 创意发散与头脑风暴
- 研究与论文拆解

---

## 核心特性

### 1. 节点即对话

每个思维导图节点都承载一段完整的 AI 对话历史，节点与对话同步生长。

### 2. 非线性分支

AI 回答末尾智能推荐 2-4 个延伸方向，用户点击后自动创建子节点并深入探讨，不打乱主线。

### 3. 节点摘要

支线聊完后，自动提炼该节点的核心结论，生成节点摘要，地图信息密度随使用自然提升。

### 4. 多工作区管理

支持多个工作区，每个工作区可包含多张地图，适合按主题或项目组织知识。

### 5. AI 工具调用

内置 `create_node`、`expand_node` 等 AI 工具，AI 可直接在画布上创建、扩展节点。

### 6. 多模型支持

用户可填写自己的 API Key，后端也支持内置多模型池与 fallback 链路。

### 7. 文件上传与分析

支持上传文档，让 AI 基于文件内容对话与生成节点。

### 8. 中英双语

完整支持中文与英文界面，国际化架构可进一步扩展。

### 9. 管理后台

提供独立 Admin 后台，支持用户管理、工作区管理、AI 用量监控、公告与消息推送、审计日志等。

### 10. 移动端支持

基于 Capacitor 构建 Android 应用，核心功能可在移动端使用。

---

## 技术架构

### 前端

| 技术 | 用途 |
|---|---|
| React 18 + TypeScript | UI 框架 |
| Vite 6 | 构建工具 |
| Tailwind CSS 3 | 样式 |
| Zustand | 状态管理 |
| @xyflow/react | 思维导图画布引擎 |
| i18next + react-i18next | 国际化 |
| React Router v7 | 路由 |
| react-markdown + remark-gfm | Markdown 渲染 |
| Capacitor 8 | 移动端封装 |

### 后端

| 技术 | 用途 |
|---|---|
| Node.js + Express + TypeScript | 主服务框架 |
| MongoDB | 主数据库 |
| Neo4j | 图数据库（可选） |
| Redis | 缓存与会话 |
| Socket.io（规划中） | 实时协作 |
| Multer | 文件上传 |
| pdf-parse / mammoth / xlsx | 文档解析 |

### 后台管理

| 技术 | 用途 |
|---|---|
| React + TypeScript | Admin 前端 |
| Express | Admin 服务 |
| MongoDB | 数据存储 |

### 移动端

| 技术 | 用途 |
|---|---|
| Capacitor 8 | Web 转 Android |
| JPush | 消息推送 |

---

## 项目结构

```text
DeepMindMap/
├── client/                 # 主站前端（React + Vite）
│   ├── src/
│   │   ├── components/     # 组件（Canvas、Chat、Settings 等）
│   │   ├── services/       # API 服务
│   │   ├── stores/         # Zustand 状态管理
│   │   ├── locales/        # i18n 翻译文件
│   │   └── utils/          # 工具函数
│   ├── android/            # Capacitor Android 工程
│   └── package.json
├── server/                 # 主后端服务
│   ├── src/
│   │   ├── config/         # 配置与 prompt
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务服务
│   │   ├── middleware/     # 中间件
│   │   ├── models/         # 数据模型
│   │   └── utils/          # 工具函数
│   └── package.json
├── admin/                  # 后台管理系统
│   ├── client/             # Admin 前端
│   └── server/             # Admin 服务
├── docs/                   # 产品、技术、运营文档
│   ├── admin/              # 后台管理需求文档
│   ├── tech/               # 技术文档
│   └── marketing/          # 营销材料
├── .trae/specs/            # 产品与技术规格文档
│   ├── nonlinear-conversation-experience/  # 当前主策略
│   └── _archive/           # 历史规格归档
├── archive/                # 历史杂物归档
├── docker-compose.yml      # Docker 本地环境
├── Dockerfile              # 生产镜像
├── deploy.sh               # 部署脚本
└── README.md               # 本文件
```

---

## 快速开始

### 环境要求

- Node.js >= 18
- MongoDB
- Neo4j（可选）
- Redis（可选，默认 MongoDB 存储会话）

### 1. 安装依赖

```powershell
cd d:\study1\DeepMindMap\v2
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，并填入真实值：

```text
MONGO_PASSWORD=your_mongo_password
NEO4J_PASSWORD=your_neo4j_password
```

同时配置 `server/.env` 中的 AI 服务密钥，例如：

```text
GLM_API_KEY=your_glm_key
DEEPSEEK_API_KEY=your_deepseek_key
```

### 3. 启动开发环境

```powershell
# 终端 1：启动后端
npm run dev:server

# 终端 2：启动前端
npm run dev:client
```

访问 http://localhost:5173。

---

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev:client` | 启动前端开发服务器 |
| `npm run dev:server` | 启动后端开发服务器 |
| `npm run build:client` | 构建前端生产包 |
| `npm run build:server` | 编译后端 TypeScript |
| `npm run build` | 同时构建前后端 |
| `npm run start` | 启动生产后端 |

---

## 部署

项目支持多种部署方式：

- **Docker**: 使用 `docker-compose.yml` 一键启动
- **Zeabur**: 已配置 `zeabur.json`
- **自建服务器**: 使用 `deploy.sh` 与 `deploy_server.py`

生产部署前务必先编译后端：

```powershell
cd server
npm run build
```

更多细节参考 `docs/tech/capacitor-setup.md` 与 `.trae/skills/server-deploy-checklist/SKILL.md`。

---

## 产品方向

当前重点：非线性对话体验。

详见 `.trae/specs/nonlinear-conversation-experience/product-strategy.md`。

核心目标：

- 让分支成为对话的自然下一步
- 让每张地图都能沉淀为可复用的知识资产
- 让管理员能持续推送高质量示例与模板

---

## 许可证

MIT License
