# 修复反馈列表筛选与分页 - 验收清单

- [x] handleSearch 不再在 setPage(1) 后直接调用 loadList()
- [x] 切换筛选条件后列表从第一页开始加载
- [x] 分页区域显示总记录数
- [x] 分页区域显示当前数据范围（第X-Y条）
- [x] 单页数据时不显示翻页按钮，仅显示总记录数
- [x] Admin前端 npm run build 无错误