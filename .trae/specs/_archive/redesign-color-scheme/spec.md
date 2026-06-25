# 重设计配色体系 Spec

## Why
用户反馈项目前端UI配色"太像AI了"。当前主色 `#0ea5e9`（Sky Blue）是ChatGPT、Claude等AI产品的标志性配色，深色背景+蓝色发光+蓝紫粒子效果的组合进一步强化了"AI聊天工具"的视觉印象。DeepMindMap作为思维导图工具，需要建立独特的视觉识别，摆脱AI产品的同质化配色。

## What Changes
- 将主色从 Sky Blue（天蓝色系）切换到 Warm Teal（暖青色系），建立独特的品牌识别
- 将深色背景从 Slate（冷灰蓝）切换到 Warm Slate（暖灰），减少冷色调AI感
- 重新设计发光效果，从蓝色光晕切换到青绿色光晕
- 重新设计粒子背景配色，从蓝紫系切换到青绿暖色系
- 重新设计语义色体系，使其更协调
- 创建HTML预览页面供用户确认新配色效果
- 确认满意后同步到项目代码

## Impact
- Affected code:
  - `client/tailwind.config.js` — 自定义色板定义
  - `client/src/index.css` — CSS变量、工具类、Markdown样式
  - `client/src/components/Background/DreamyUniverseBackground.tsx` — 粒子颜色
  - `client/src/components/Canvas/CanvasPage.tsx` — 关系颜色、节点颜色
  - `client/src/components/Chat/ChatPanel.tsx` — 聊天面板颜色
  - `client/src/components/Layout/MainLayout.tsx` — 布局颜色
  - `client/src/components/Workspace/WelcomePage.tsx` — 欢迎页颜色
  - `client/src/components/Onboarding/OnboardingGuide.tsx` — 引导页颜色
  - `client/src/components/Settings/` — 设置面板颜色
  - `client/src/components/Node/` — 节点编辑器颜色
  - `client/src/stores/appStore.ts` — 关系颜色定义
  - `admin/client/src/` — 管理后台配色（如需同步）

## ADDED Requirements

### Requirement: 新配色体系设计
系统 SHALL 提供一套全新的配色体系，核心设计原则如下：

1. **主色从 Sky Blue 切换到 Warm Teal**：新主色 `#0d9488`（Teal-600），色阶从50到900完整定义
2. **深色背景从冷灰蓝切换到暖灰**：新背景色 `#0c0a09`（Stone-950），色阶从50到950完整定义
3. **发光效果从蓝色切换到青绿色**：`--accent-glow` 使用 teal 色系
4. **粒子背景配色更新**：从蓝紫系切换到青绿暖色系
5. **关系颜色重新设计**：更协调、更易辨识的关系线配色
6. **语义色保持功能一致性**：amber/red/green 语义不变，微调色值以适配新主色

#### Scenario: 新配色不含有典型AI产品标志色
- **WHEN** 审查新配色体系
- **THEN** 主色不应为 Sky Blue (#0ea5e9)、Blue (#3b82f6)、Violet (#8b5cf6) 等典型AI产品色
- **THEN** 整体视觉印象应为"专业思维工具"而非"AI聊天助手"

#### Scenario: 新配色保持可访问性
- **WHEN** 应用新配色
- **THEN** 文字与背景的对比度符合 WCAG AA 标准（4.5:1）
- **THEN** 交互元素有清晰的视觉反馈

### Requirement: HTML预览页面
系统 SHALL 创建独立的HTML预览页面，展示新配色体系的所有元素：

1. 展示完整的色板（Primary + Dark + 语义色）
2. 展示典型UI组件在新配色下的效果（按钮、卡片、输入框、面板等）
3. 展示新旧配色对比
4. 展示粒子背景在新配色下的效果

#### Scenario: 用户可通过HTML预览确认配色
- **WHEN** 用户打开预览HTML文件
- **THEN** 可看到新配色体系下所有UI元素的实际效果
- **THEN** 可与旧配色进行直观对比

### Requirement: 配色同步到项目
当用户确认新配色满意后，系统 SHALL 将新配色同步到项目代码中：

1. 更新 `tailwind.config.js` 的色板定义
2. 更新 `index.css` 的CSS变量和工具类
3. 更新各组件中的颜色引用
4. 更新粒子背景的颜色配置

#### Scenario: 配色同步后项目正常运行
- **WHEN** 配色同步完成
- **THEN** 项目可正常编译运行
- **THEN** 所有UI元素正确使用新配色
- **THEN** 无残留的旧配色值

## 新配色体系详细定义

### Primary 色板（暖青色 Teal）
| 色阶 | 旧值 (Sky Blue) | 新值 (Warm Teal) | 用途 |
|------|-----------------|-------------------|------|
| primary-50 | `#f0f9ff` | `#f0fdfa` | 极浅背景 |
| primary-100 | `#e0f2fe` | `#ccfbf1` | 浅背景 |
| primary-200 | `#bae6fd` | `#99f6e4` | 浅色文字/边框 |
| primary-300 | `#7dd3fc` | `#5eead4` | 次要高亮 |
| primary-400 | `#38bdf8` | `#2dd4bf` | 核心强调色 |
| primary-500 | `#0ea5e9` | `#14b8a6` | 主色 |
| primary-600 | `#0284c7` | `#0d9488` | 按钮主色 |
| primary-700 | `#0369a1` | `#0f766e` | 按钮hover深色 |
| primary-800 | `#075985` | `#115e59` | 深色辅助 |
| primary-900 | `#0c4a6e` | `#134e4a` | 极深辅助 |

### Dark 色板（暖灰 Stone）
| 色阶 | 旧值 (Slate) | 新值 (Warm Stone) | 用途 |
|------|-------------|-------------------|------|
| dark-50 | `#f8fafc` | `#fafaf9` | 极浅文字 |
| dark-100 | `#f1f5f9` | `#f5f5f4` | 浅色文字 |
| dark-200 | `#e2e8f0` | `#e7e5e4` | 次要文字 |
| dark-300 | `#cbd5e1` | `#d6d3d1` | 辅助文字 |
| dark-400 | `#94a3b8` | `#a8a29e` | 次级文字 |
| dark-500 | `#64748b` | `#78716c` | 暗淡文字 |
| dark-600 | `#475569` | `#57534e` | 边框/分隔线 |
| dark-700 | `#334155` | `#44403c` | 卡片/输入框背景 |
| dark-800 | `#1e293b` | `#292524` | 面板背景 |
| dark-900 | `#0f172a` | `#1c1917` | 侧边栏/弹窗背景 |
| dark-950 | `#020617` | `#0c0a09` | 最深层背景 |

### CSS 变量更新
| 变量 | 旧值 | 新值 |
|------|------|------|
| `--accent-glow` | `rgba(14, 165, 233, 0.15)` | `rgba(13, 148, 136, 0.15)` |
| `--accent-glow-strong` | `rgba(14, 165, 233, 0.3)` | `rgba(13, 148, 136, 0.3)` |
| body 背景色 | `#020617` | `#0c0a09` |

### 粒子背景颜色更新
| 元素 | 旧值 | 新值 |
|------|------|------|
| 粒子主色 | `rgb(14, 165, 233)` | `rgb(13, 148, 136)` |
| 流光1 | `rgb(14, 165, 233)` #0ea5e9 | `rgb(13, 148, 136)` #0d9488 |
| 流光2 | `rgb(99, 102, 241)` #6366f1 | `rgb(217, 119, 6)` #d97706 |
| 流光3 | `rgb(56, 189, 248)` #38bdf8 | `rgb(45, 212, 191)` #2dd4bf |

### 关系颜色更新
| 关系类型 | 旧值 | 新值 |
|----------|------|------|
| parent-child | `#22c55e` | `#2dd4bf` (teal-400) |
| supports | `#22c55e` | `#34d399` (emerald-400) |
| contradicts | `#ef4444` | `#f87171` (red-400) |
| prerequisite | `#f59e0b` | `#fbbf24` (amber-400) |
| elaborates | `#3b82f6` | `#0d9488` (teal-600) |
| references | `#a855f7` | `#c084fc` (purple-400) |
| conclusion | `#06b6d4` | `#22d3ee` (cyan-400) |
| custom | `#eab308` | `#f59e0b` (amber-500) |

### 语义色保持
- amber: 保持不变，用于警告/限流/结论节点
- red: 保持不变，用于错误/危险
- green/emerald: 微调以适配新主色
- purple: 保持不变，用于复合节点/引用
