# Tasks

- [x] Task 1: 实现右键/长按节点操作菜单组件
  - [x] 创建 `client/src/components/Canvas/NodeContextMenu.tsx` 组件
  - [x] 菜单项：编辑节点、创建分支、复制节点、删除节点
  - [x] 支持桌面端右键定位和移动端长按定位
  - [x] 点击菜单外部关闭
  - [x] 删除节点需二次确认

- [x] Task 2: 修改双击节点行为为打开对话面板
  - [x] 修改 `CanvasPage.tsx` 中 `onNodeDoubleClick` 处理逻辑
  - [x] 普通节点双击 → 选中节点 + 打开对话面板
  - [x] 复合节点双击 → 保持展开/折叠行为

- [x] Task 3: 修改长按节点行为为弹出操作菜单
  - [x] 修改 `CanvasPage.tsx` 中长按节点处理逻辑
  - [x] 长按节点 → 弹出 NodeContextMenu（替代原来的打开对话面板）
  - [x] 修改 `useLongPress.ts` hook 回调参数，传递坐标用于菜单定位

- [x] Task 4: 实现右键节点弹出操作菜单
  - [x] 在 `CanvasPage.tsx` 中添加 `onNodeContextMenu` 处理
  - [x] 右键节点 → 阻止默认右键菜单 → 弹出 NodeContextMenu
  - [x] 菜单定位跟随鼠标位置

- [x] Task 5: 创建节点后跳过编辑器直接打开对话
  - [x] 修改 `handleCreateRootNode`：创建后打开对话面板
  - [x] 修改 `handleCreateChildNode`：同上
  - [x] 菜单中"创建分支"也跳过编辑器

- [x] Task 6: 对话面板自动聚焦输入框
  - [x] 修改 `ChatPanel.tsx`：对话面板打开时自动聚焦 textarea
  - [x] 仅桌面端自动聚焦，移动端不自动聚焦
  - [x] 使用 useEffect 监听 nodeId 变化

- [x] Task 7: 节点标题自动命名
  - [x] 修改 `ChatPanel.tsx`：用户首次发送消息时自动取消息前15字作为标题
  - [x] 仅当节点标题为默认值（"新对话"/"新分支"）时触发
  - [x] 已自定义标题的节点不受影响

- [x] Task 8: 新手引导等待时间缩短
  - [x] 修改 `onboardingContent.ts`：将强制等待从10秒改为3秒

- [x] Task 9: 更新底部提示栏文案
  - [x] 修改 `CanvasPage.tsx` 中底部提示栏文案
  - [x] 新文案："双击节点开始对话 | 右键/长按节点更多操作 | 点击「创建对话」添加根节点"

- [x] Task 10: 构建验证
  - [x] 主前端 `npm run build` 无错误
  - [x] 服务器端构建并部署成功

# Task Dependencies
- Task 1 是 Task 2/3/4 的前置依赖（菜单组件需先创建）
- Task 2、Task 3、Task 4 相互独立，可并行（但都依赖 Task 1）
- Task 5、Task 6、Task 7、Task 8、Task 9 相互独立，可并行
- Task 10 依赖所有其他任务