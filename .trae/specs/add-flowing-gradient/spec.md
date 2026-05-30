# 基础版粒子背景添加流光渐变 Spec

## Why
用户确认基础版粒子背景（80 粒子、单色、简洁）是最佳基调，但希望在此基础上增加缓慢流动的渐变色彩，让背景不再是纯黑死板，而是有微妙的色彩呼吸感，同时保持简洁高级的质感。

## What Changes
- 将 `background-demo/index.html` 恢复为基础版代码（从 `index-basic-backup.html` 复制）
- 在基础版之上添加缓慢流动的背景渐变色彩层
- 流光颜色使用项目品牌色系（primary-500 `#0ea5e9` 天蓝 + 靛蓝 `#6366f1` + primary-400 `#38bdf8` 浅蓝）
- 流光渐变在粒子层之下绘制，不干扰粒子主体视觉
- 流光移动极其缓慢，产生"深海/星空"的微妙氛围感

## Impact
- Affected specs: 之前所有粒子背景升级规范（均已完成，本规范为新的独立方向）
- Affected code: `background-demo/index.html`
- 不修改 `client/`、`server/`、`admin/` 等正式项目代码

## ADDED Requirements

### Requirement: 恢复基础版粒子背景
系统 SHALL 将 `background-demo/index.html` 恢复为 `index-basic-backup.html` 的内容作为起点。

#### Scenario: 用户打开恢复后的页面
- **WHEN** 用户打开 `background-demo/index.html`
- **THEN** 看到 80 个 cyan 色粒子、简洁连线、鼠标排斥交互
- **AND** 无光晕、无星云、无涟漪、无拖尾等额外效果

### Requirement: 缓慢流光渐变背景
系统 SHALL 在粒子层下方绘制 2-3 个缓慢移动的大型径向渐变光斑，形成流光效果。

#### Scenario: 用户观察背景整体氛围
- **WHEN** 页面正常运行
- **THEN** 背景不再是纯黑 `#020617`，而是有极低透明度的色彩缓慢流动
- **AND** 流光颜色为天蓝 `#0ea5e9`、靛蓝 `#6366f1`、浅蓝 `#38bdf8`（项目品牌色系）
- **AND** 流光透明度极低（0.03-0.06），不抢占粒子主体视觉
- **AND** 流光移动速度极慢，每帧位移约 0.1-0.3 像素
- **AND** 流光产生"深海微光"或"极光"的微妙氛围感

#### Scenario: 流光不干扰粒子可读性
- **WHEN** 粒子和连线在流光之上绘制
- **THEN** 粒子和连线的可见性不受流光影响
- **AND** 流光只是背景氛围，不与粒子争夺视觉注意力

### Requirement: 流光渐变与项目色彩协调
系统 SHALL 使用项目 Tailwind 主题中定义的品牌色作为流光颜色。

#### Scenario: 流光颜色与项目 UI 一致
- **WHEN** 用户将 Demo 背景与正式项目 UI 对比
- **THEN** 流光颜色与项目 primary 色系和装饰色一致
- **AND** 不引入项目色彩体系之外的颜色

## MODIFIED Requirements
无。

## REMOVED Requirements
无。
