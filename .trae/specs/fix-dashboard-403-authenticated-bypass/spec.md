# 修复已登录用户被 IP 白名单拦截 403 Spec

## Why

后台 IP 白名单中间件只检查客户端 IP，不检查是否已登录。当已登录管理员更换网络（如手机 APK、换 WiFi）时，即使 session 有效，所有 `/api/dashboard/*` 和 `/api/admin/*` 接口仍返回 403，导致后台完全无法使用。不只是这个问题，我使用正常的IP登录也是失败的无法获取数据，实在不行就去掉对管理员的IP限制。限制最重要的是我在后台完全看不到任何的数据了

## What Changes

* 修改 `admin/server/src/middleware/ipWhitelist.ts` 的 `ipWhitelistMiddleware` 函数

* 在白名单非空时，先检查请求是否携带有效 session（`req.session?.sessionId` 存在）

* 如果已登录，跳过 IP 白名单检查，直接放行

* 如果未登录，保持原有 IP 白名单逻辑（防止未授权外部访问）

## Impact

* Affected code:

  * `admin/server/src/middleware/ipWhitelist.ts`（核心修改）

## ADDED Requirements

### Requirement: 已登录用户跳过 IP 白名单

系统 SHALL 在 IP 白名单检查之前，先检查请求是否携带已登录 session。已登录用户（`req.session.sessionId` 存在）应直接放行，不受 IP 白名单限制。

#### Scenario: 已登录用户更换网络后访问后台

* **WHEN** 已登录管理员从手机 APK 或新网络访问 `/api/dashboard/*`

* **THEN** 中间件检测到 `req.session.sessionId` 存在

* **AND** 跳过 IP 白名单检查，直接放行

* **AND** 后续 `requireAuth` 中间件验证 session 有效性

* **AND** 返回正常数据，不返回 403

#### Scenario: 未登录用户仍受 IP 白名单保护

* **WHEN** 未登录用户（无 session）从非白名单 IP 访问 `/api/dashboard/*`

* **THEN** 中间件走原有 IP 白名单逻辑

* **AND** IP 不在白名单，返回 403

* **AND** 防止未授权外部请求探测后台接口

#### Scenario: 白名单为空时放行所有请求

* **WHEN** `admin_ips` 集合为空（首次配置场景）

* **THEN** 保持原有逻辑，放行所有请求（无论是否登录）

## MODIFIED Requirements

### Requirement: IP 白名单中间件

原逻辑：白名单非空时，所有请求必须 IP 在白名单中才能放行。
修改为：白名单非空时，先检查 `req.session?.sessionId` 是否存在；存在则放行（已登录用户），不存在则走 IP 白名单检查（未登录用户）。
