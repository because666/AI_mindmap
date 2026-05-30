# 终极版粒子网络背景 Demo Spec

## Why
当前 `background-demo/index.html` 已实现基础粒子网络背景，但整体仍偏经典粒子效果，视觉深度、发光质感、色彩层次和交互惊喜不足。需要先备份当前可用版本，再在独立 Demo 中实现方案 A 的完整升级版，用于对比确认后再决定是否集成到正式项目。

## What Changes
- 备份当前 `background-demo/index.html` 为 `background-demo/index-basic-backup.html`
- 在 `background-demo/index.html` 上实现终极版视觉升级
- 添加多层粒子系统，形成远景、中景、近景的空间深度
- 添加背景底层动态星云光晕，增强氛围基底
- 添加粒子径向发光、连线微光、脉动和闪烁效果
- 添加蓝、青、靛蓝、紫的统一冷色调色彩层次
- 添加点击涟漪扩散交互，让背景具有更强反馈感
- 保留 FPS 检测与自动降级机制，避免低端设备卡顿

## Impact
- Affected specs: add-particle-background（在现有独立 Demo 基础上升级）
- Affected code: `background-demo/index.html`、`background-demo/index-basic-backup.html`
- 不修改 `client/`、`server/`、`admin/` 等正式项目代码

## ADDED Requirements

### Requirement: 基础版本备份
系统 SHALL 在升级前保留当前基础版 Demo，方便用户对比和回退。

#### Scenario: 用户查看备份文件
- **WHEN** 用户打开 `background-demo/index-basic-backup.html`
- **THEN** 看到升级前的基础粒子网络背景效果
- **AND** 备份文件内容与升级前 `background-demo/index.html` 保持一致

### Requirement: 多层空间粒子系统
系统 SHALL 将粒子分为远景、中景、近景三层，形成空间纵深和视差感。

#### Scenario: 用户打开终极版页面
- **WHEN** 页面开始运行
- **THEN** 远景层粒子更小、更暗、移动更慢
- **AND** 中景层粒子保持主要网络连接效果
- **AND** 近景层粒子更亮、更大、移动略快，带更强光晕

### Requirement: 动态星云光晕背景
系统 SHALL 在粒子层下方绘制 2-4 个缓慢漂移的大型径向光晕，作为氛围基底。

#### Scenario: 页面正常运行
- **WHEN** 用户观察背景整体氛围
- **THEN** 背景不再是单纯黑色，而有极低透明度的蓝、靛蓝、紫色星云光晕
- **AND** 光晕缓慢移动并柔和变化，不抢占粒子主体视觉

### Requirement: 粒子发光与脉动
系统 SHALL 为粒子添加径向光晕，并让部分粒子具有微弱脉动或闪烁。

#### Scenario: 用户观察粒子细节
- **WHEN** 粒子在画面中漂移
- **THEN** 粒子周围有柔和发光，而不是单纯实心点
- **AND** 近景层粒子光晕更明显
- **AND** 粒子透明度或光晕大小有轻微周期性变化

### Requirement: 高级色彩层次
系统 SHALL 在统一冷色调内为粒子和光晕提供色彩变化。

#### Scenario: 页面正常显示
- **WHEN** 用户观察整体色彩
- **THEN** 画面包含蓝色、青色、靛蓝和少量紫色变化
- **AND** 色彩保持统一高级，不出现杂乱彩虹色
- **AND** 与 DeepMindMap 当前深色科技风主题协调

### Requirement: 点击涟漪交互
系统 SHALL 在用户点击画面时产生一圈柔和扩散的能量涟漪。

#### Scenario: 用户点击背景
- **WHEN** 用户点击页面任意位置
- **THEN** 点击位置出现一圈蓝紫色半透明涟漪并逐渐扩散消失
- **AND** 涟漪扩散时对附近粒子产生轻微推力
- **AND** 涟漪生命周期结束后自动移除

### Requirement: 鼠标聚焦增强
系统 SHALL 在鼠标附近增强粒子和连线的亮度，形成聚焦感。

#### Scenario: 用户移动鼠标
- **WHEN** 鼠标靠近粒子网络
- **THEN** 鼠标附近粒子光晕增强
- **AND** 鼠标与附近粒子的连线更亮
- **AND** 粒子仍然保持柔和排斥，不产生突兀跳动

### Requirement: 性能保护与降级
系统 SHALL 保留 FPS 检测与自动降级，并在降级时同步减少高成本视觉效果。

#### Scenario: 低端设备帧率持续低于 30fps
- **WHEN** 连续 3 秒平均帧率低于 30fps
- **THEN** 粒子总数减少约 50%
- **AND** 降低光晕绘制强度或减少星云数量
- **AND** 降级后不自动恢复，避免反复切换

## MODIFIED Requirements

### Requirement: Demo 页面说明
终极版 Demo 页面 SHALL 清晰标识当前为高级质感版，并保留实时 FPS、当前粒子数、降级状态提示。

#### Scenario: 用户查看终极版 Demo
- **WHEN** 用户打开 `background-demo/index.html`
- **THEN** 页面显示"DeepMindMap 粒子网络背景 · 高级质感版"
- **AND** 底部显示多层粒子、星云光晕、点击涟漪等关键参数说明

## REMOVED Requirements
无。
