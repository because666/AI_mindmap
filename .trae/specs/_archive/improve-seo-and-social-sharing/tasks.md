# Tasks

- [x] Task 1: 设计并准备 OG 封面图
  - [x] SubTask 1.1: 确定封面图尺寸（推荐 1200×630 像素）和内容布局
  - [x] SubTask 1.2: 使用用户提供的产品展示图作为 `client/public/og-cover.png`

- [x] Task 2: 重写 `client/index.html` 的 SEO 元信息
  - [x] SubTask 2.1: 修改 `<title>` 为中文默认标题
  - [x] SubTask 2.2: 添加 `<meta name="description">`（中文默认，不超过 120 字符）
  - [x] SubTask 2.3: 添加 Open Graph 标签（og:title、og:description、og:image、og:url、og:type）
  - [x] SubTask 2.4: 添加 Twitter Card 标签（twitter:card、twitter:title、twitter:description、twitter:image）
  - [x] SubTask 2.5: 添加 hreflang alternate 链接（zh、en、x-default）
  - [x] SubTask 2.6: 保留并复用之前添加的缓存控制 meta 标签

- [x] Task 3: 添加多语言翻译 key
  - [x] SubTask 3.1: 在 `client/src/locales/common/zh.json` 添加 `pageTitle` 和 `pageDescription`
  - [x] SubTask 3.2: 在 `client/src/locales/common/en.json` 添加 `pageTitle` 和 `pageDescription`

- [x] Task 4: 运行时动态更新标题和描述
  - [x] SubTask 4.1: 在 `client/src/i18n.ts` 中监听语言变化事件
  - [x] SubTask 4.2: 语言变化时更新 `document.title` 和 `<meta name="description">` 的 content
  - [x] SubTask 4.3: 初始化时也执行一次更新，确保首次加载正确

- [x] Task 5: 构建验证与部署
  - [x] SubTask 5.1: 客户端构建通过
  - [x] SubTask 5.2: 通过服务器 grep 验证 OG 标签
  - [x] SubTask 5.3: 部署到服务器并清理旧 assets

# Task Dependencies
- Task 1 与 Task 2 可并行开始（OG 图地址确定后才能完成 Task 2.3）
- Task 3 与 Task 2 可并行
- Task 4 依赖 Task 3（需要翻译 key 存在）
- Task 5 依赖所有前置任务
