# 更新网站图标 Spec

## Why

当前网站浏览器标签页图标（favicon）显示太小且不清晰，用户提供了新的高清图标（`IMG_20260625_233610..png`），需要替换并生成适合浏览器标签页、移动设备主屏、PWA 等多种场景的标准尺寸图标。

## What Changes

- 将 `client/public/favicon.png` 替换为基于新图标生成的 32x32 高清 PNG
- 新增 `client/public/apple-touch-icon.png`（180x180）用于 iOS 主屏图标和 Safari 收藏夹
- 新增 `client/public/logo.png`（512x512 以内）用于应用 Logo 展示
- 更新 `client/index.html`，补充 `apple-touch-icon` 等图标链接
- 构建并部署前端产物到服务器

## Impact

- Affected specs: 无
- Affected code:
  - `client/public/favicon.png`
  - `client/public/logo.png`
  - `client/public/apple-touch-icon.png`（新增）
  - `client/index.html`
  - 服务器 `client/dist/` 静态目录

## ADDED Requirements

### Requirement: 多尺寸图标支持

The system SHALL provide icons in sizes appropriate for browser tabs, iOS home screen bookmarks, and in-app logo display.

#### Scenario: 浏览器标签页图标清晰
- **WHEN** 用户打开网站页面
- **THEN** 浏览器标签页显示的 favicon 清晰、边缘锐利

#### Scenario: iOS 主屏图标
- **WHEN** 用户将网站添加到 iOS 主屏
- **THEN** 使用 180x180 的 Apple Touch Icon 显示

## MODIFIED Requirements

无。

## REMOVED Requirements

无。
