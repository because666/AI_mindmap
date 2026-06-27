# Checklist

## 后端接口
- [x] `GET /api/workspaces/mine/metadata` 接口正常返回节点数和最后编辑时间
- [x] 接口需要访客签名认证（visitorAuth 中间件）
- [x] 接口返回的 nodeCount 与实际节点数一致
- [x] 接口异常时返回清晰错误信息

## 前端 API 和 Store
- [x] `workspaceApi.getMineMetadata()` 正确调用后端接口
- [x] `workspaceMetadata` 状态正确存储和更新
- [x] `fetchWorkspaceMetadata` 方法在地图库打开时触发调用

## 地图库面板
- [x] 点击侧边栏"地图库"按钮打开面板
- [x] 面板展示用户所有工作区列表
- [x] 每个地图卡片显示：名称、节点数、最后编辑时间
- [x] 当前工作区在列表中有高亮标记
- [x] 搜索框输入关键词后实时过滤列表
- [x] 排序切换（最近编辑 / 创建时间）后列表重新排序
- [x] 点击地图卡片切换到该工作区并关闭面板
- [x] "新建地图"按钮可创建新工作区
- [x] 移动端侧边栏有地图库入口

## i18n 和埋点
- [x] 中文和英文翻译键完整
- [x] `map_library_opened` 事件在面板打开时上报
- [x] `map_library_search` 事件在搜索时上报
- [x] `map_library_switch` 事件在切换地图时上报

## 整体验收
- [x] 桌面端侧边栏地图库入口正常工作
- [x] 移动端侧边栏地图库入口正常工作
- [x] 面板打开/关闭动画流畅
- [x] 空工作区列表时显示空状态提示
- [x] 无语法报错、无依赖缺失、运行无异常
