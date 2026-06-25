# Tasks

- [x] Task 1: 修复趋势数据和模型分布数据的解析逻辑
  - [x] 1.1 修改 `trendsRes.data.data` 的解析：从 `data.items` 改为直接读取数组
  - [x] 1.2 修改 `modelRes.data.data` 的解析：从 `data.items` 改为直接读取数组

- [x] Task 2: 修复日期范围生成逻辑
  - [x] 2.1 修改 `getDateRange` 函数中所有 `endDate` 返回值，追加 `T23:59:59` 时间后缀

# Task Dependencies

- Task 1 和 Task 2 相互独立，可并行修改
