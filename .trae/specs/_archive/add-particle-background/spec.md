# 动态粒子网络背景 Demo Spec

## Why
当前背景（深色底色 + 淡蓝径向渐变光晕 + 点阵纹理）视觉层次单薄，缺乏与"思维导图/知识网络"产品主题的呼应。需要通过动态粒子网络背景提升视觉品质和产品辨识度。

## What Changes
- 在项目根目录下创建独立的 `background-demo` 文件夹，包含一个可独立运行的 HTML 演示页面
- 使用 Canvas 2D 实现动态粒子网络背景效果
- 粒子间距离小于阈值时绘制半透明连线，模拟神经网络/星座效果
- 粒子缓慢漂移，鼠标移动时附近粒子产生轻微交互反馈
- 深蓝色调与现有 UI 风格保持一致
- 包含 FPS 检测与自动降级机制

## Impact
- Affected specs: 无冲突（独立 demo，不修改现有项目代码）
- Affected code: 无（仅在 `background-demo/` 新建文件）

## ADDED Requirements

### Requirement: 独立可运行的粒子网络背景 Demo
系统 SHALL 在 `background-demo/` 文件夹中提供一个可独立运行的 HTML 页面，展示动态粒子网络背景效果。

#### Scenario: 用户打开 demo 页面
- **WHEN** 用户在浏览器中打开 `background-demo/index.html`
- **THEN** 页面显示深色背景（#020617）上缓慢漂移的粒子
- **AND** 粒子间距离小于阈值时显示半透明连线
- **AND** 鼠标移动时附近粒子产生轻微排斥/吸引交互

### Requirement: 粒子视觉效果
系统 SHALL 渲染 60-100 个粒子，每个粒子为小圆点，颜色为蓝色系（与 primary-500 #0ea5e9 协调），透明度在 0.3-0.8 之间随机分布。

#### Scenario: 粒子正常漂移
- **WHEN** 页面正常运行
- **THEN** 粒子以 0.2-0.5 px/frame 的速度随机方向漂移
- **AND** 粒子到达画布边界时从对侧重新进入（环绕效果）
- **AND** 粒子大小在 1-3px 之间随机分布

#### Scenario: 粒子间连线
- **WHEN** 两个粒子之间的距离小于 150px
- **THEN** 在两个粒子之间绘制一条半透明连线
- **AND** 连线透明度随距离增大而降低（距离越近越明显）
- **AND** 连线颜色为蓝色系（rgba(14, 165, 233, alpha)）

### Requirement: 鼠标交互反馈
系统 SHALL 在鼠标移动时对附近粒子产生轻微交互效果。

#### Scenario: 鼠标靠近粒子
- **WHEN** 鼠标位置距离某个粒子小于 120px
- **THEN** 该粒子受到轻微排斥力，远离鼠标方向偏移
- **AND** 鼠标与附近粒子之间也绘制连线
- **AND** 交互效果柔和自然，不产生突兀的跳动

### Requirement: FPS 检测与自动降级
系统 SHALL 检测渲染帧率并在性能不足时自动降级。

#### Scenario: 低端设备帧率低于 30fps
- **WHEN** 连续 3 秒平均帧率低于 30fps
- **THEN** 自动将粒子数量减少 50%
- **AND** 降级后不自动恢复（避免反复切换）

### Requirement: Demo 页面包含效果说明
系统 SHALL 在 demo 页面上叠加显示效果说明文字和 FPS 计数器。

#### Scenario: 用户查看 demo
- **WHEN** 用户打开 demo 页面
- **THEN** 页面中央显示"DeepMindMap 粒子网络背景 Demo"标题
- **AND** 右上角显示实时 FPS 计数器
- **AND** 底部显示简短的效果说明文字
