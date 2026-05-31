# Tasks

- [x] Task 1: 修复 handleSearch 中的闭包陷阱
  - [x] 修改 `admin/client/src/pages/Feedback/FeedbackPage.tsx` 的 `handleSearch` 函数
  - [x] 移除 `setPage(1)` 后的 `loadList()` 调用
  - [x] 仅保留 `setPage(1)`，依赖 useEffect 自动触发重新加载

- [x] Task 2: 增强分页区域显示总记录数和当前范围
  - [x] 修改分页区域（第456-476行），增加总记录数显示
  - [x] 计算当前页的数据范围（第X-Y条）
  - [x] 格式：「共 N 条记录，第 X-Y 条」
  - [x] 单页时仅显示总记录数，不显示翻页按钮

- [x] Task 3: 构建验证
  - [x] Admin前端 `npm run build` 无错误