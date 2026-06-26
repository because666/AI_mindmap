# Checklist

## 图标生成

- [x] `client/public/favicon.png` 已替换为 32x32 高清版本
- [x] `client/public/apple-touch-icon.png` 已生成 180x180 版本
- [x] `client/public/logo.png` 已替换为 512x512 版本

## HTML 更新

- [x] `client/index.html` 中包含 `/favicon.png` 的 `link rel="icon"`
- [x] `client/index.html` 中包含 `/apple-touch-icon.png` 的 `link rel="apple-touch-icon"`

## 构建验证

- [x] `cd client && npm run build` 构建成功
- [x] `client/dist/favicon.png` 为新图标（32x32）
- [x] `client/dist/apple-touch-icon.png` 存在（180x180）
- [x] `client/dist/logo.png` 为新图标（512x512）
- [x] `client/dist/index.html` 中图标链接正确

## 部署验证

- [x] 服务器 `/www/wwwroot/AI_mindmap/client/dist` 已更新
- [x] https://deepmindmap.work/ 返回 200
- [x] https://deepmindmap.work/favicon.png 返回 200
- [x] https://deepmindmap.work/apple-touch-icon.png 返回 200
- [x] 无 404 图标请求
