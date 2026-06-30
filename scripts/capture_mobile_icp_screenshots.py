"""
移动端 APP ICP 备案号截图脚本

启动 client 预览服务器，通过 mock 后端 API 绕过访客注册/工作区创建流程，
直接进入主界面后打开设置弹窗，在 4.7/6.1/6.7 英寸竖屏及 6.1 英寸横屏下截图，
保存到 compatibility_screenshots/mobile-icp-filing/ 目录。
"""

import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright


PROJECT_ROOT = Path(__file__).resolve().parent.parent
CLIENT_DIR = PROJECT_ROOT / "client"
SCREENSHOT_DIR = PROJECT_ROOT / "compatibility_screenshots" / "mobile-icp-filing"
PREVIEW_URL = "http://localhost:4173"
API_BASE_URL = "http://localhost:3001/api"

# 设备视口配置：名称 -> (width, height, device_scale_factor)
# 覆盖 4.7/6.1/6.7 英寸竖屏（iOS/Android 各至少 1 种）及横屏场景
DEVICES = {
    "iphone-se-4.7-portrait": (375, 667, 2),
    "pixel-5-6.1-portrait-android": (393, 851, 2.75),
    "samsung-s23-ultra-6.7-portrait-android": (412, 915, 3.5),
    "iphone-se-4.7-landscape": (667, 375, 2),
}

# mock 数据
VISITOR_ID = "v-test-icp"
VISITOR_SECRET = "test-secret"
WORKSPACE_ID = "ws-test-icp"
NICKNAME = "备案截图用户"


def wait_for_server(url: str, timeout: float = 30.0) -> bool:
    """等待预览服务器就绪。"""
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2):
                return True
        except Exception:
            time.sleep(0.5)
    return False


def setup_api_mocks(page) -> None:
    """配置后端 API mock 路由，使前端可直接进入主界面。"""

    def handle_route(route, request):
        url = request.url
        method = request.method

        if "/api/" in url:
            print(f"[API] {method} {url}")

        if "workspaces/visitor/register" in url and method == "POST":
            return route.fulfill(
                status=200,
                content_type="application/json",
                body='{"success":true,"data":{"id":"' + VISITOR_ID + '","nickname":"' + NICKNAME + '","lastSeen":"2026-06-30T00:00:00.000Z","workspaces":["' + WORKSPACE_ID + '"],"createdAt":"2026-06-30T00:00:00.000Z","visitorSecret":"' + VISITOR_SECRET + '"}}',
            )

        if f"/workspaces/visitor/{VISITOR_ID}" in url and method == "GET":
            return route.fulfill(
                status=200,
                content_type="application/json",
                body='{"success":true,"data":{"id":"' + VISITOR_ID + '","nickname":"' + NICKNAME + '","lastSeen":"2026-06-30T00:00:00.000Z","workspaces":["' + WORKSPACE_ID + '"],"createdAt":"2026-06-30T00:00:00.000Z"}}',
            )

        if "/workspaces/mine" in url and method == "GET":
            return route.fulfill(
                status=200,
                content_type="application/json",
                body='{"success":true,"data":[{"id":"' + WORKSPACE_ID + '","name":"截图测试工作区","type":"public","ownerId":"' + VISITOR_ID + '","members":[{"visitorId":"' + VISITOR_ID + '","nickname":"' + NICKNAME + '","role":"owner","joinedAt":"2026-06-30T00:00:00.000Z"}],"createdAt":"2026-06-30T00:00:00.000Z","updatedAt":"2026-06-30T00:00:00.000Z"}]}',
            )

        if "/workspaces" in url and method == "POST":
            return route.fulfill(
                status=200,
                content_type="application/json",
                body='{"success":true,"data":{"id":"' + WORKSPACE_ID + '","name":"截图测试工作区","type":"public","ownerId":"' + VISITOR_ID + '","members":[{"visitorId":"' + VISITOR_ID + '","nickname":"' + NICKNAME + '","role":"owner","joinedAt":"2026-06-30T00:00:00.000Z"}],"createdAt":"2026-06-30T00:00:00.000Z","updatedAt":"2026-06-30T00:00:00.000Z"}}',
            )

        if url.endswith("/api/nodes") and method == "GET":
            return route.fulfill(
                status=200,
                content_type="application/json",
                body='{"success":true,"data":{"nodes":[],"relations":[]}}',
            )

        if url.endswith("/api/conversations") and method == "GET":
            return route.fulfill(
                status=200,
                content_type="application/json",
                body='{"success":true,"data":[]}',
            )

        return route.continue_()

    page.route("**/api/**", handle_route)


def main() -> int:
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

    # 启动预览服务器
    server = subprocess.Popen(
        "npm run preview",
        cwd=CLIENT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        shell=True,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
    )

    try:
        print("等待预览服务器启动...")
        if not wait_for_server(PREVIEW_URL):
            print("预览服务器启动失败", file=sys.stderr)
            return 1
        print(f"预览服务器已就绪: {PREVIEW_URL}")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)

            for name, (width, height, dpr) in DEVICES.items():
                context = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=dpr,
                    is_mobile=True,
                    has_touch=True,
                )
                page = context.new_page()
                setup_api_mocks(page)

                # 第一次加载：通过 mock 注册接口自动创建访客身份
                page.goto(PREVIEW_URL, wait_until="networkidle")
                page.wait_for_timeout(800)

                # 设置当前工作区ID后刷新，使应用进入主界面
                page.evaluate(
                    f"""() => {{
                        localStorage.setItem('currentWorkspaceId', '{WORKSPACE_ID}');
                        localStorage.setItem('onboarding-completed', 'true');
                    }}"""
                )
                page.reload(wait_until="networkidle")
                page.wait_for_timeout(800)

                # 触发 resize 确保 useIsMobile 更新为移动端状态
                page.evaluate("() => { window.dispatchEvent(new Event('resize')); }")
                page.wait_for_timeout(500)

                # 打开设置弹窗
                page.evaluate("() => { window.dispatchEvent(new CustomEvent('settings:open-api')); }")
                page.wait_for_timeout(500)

                # 验证备案号存在
                footer = page.locator('[aria-label="APP ICP 备案号"]')
                footer_count = footer.count()
                if footer_count == 0:
                    debug_path = SCREENSHOT_DIR / f"{name}-debug.png"
                    page.screenshot(path=str(debug_path), full_page=False)
                    print(f"[{name}] 未找到备案号，调试截图: {debug_path}")
                    print(f"[{name}] innerWidth={page.evaluate('() => window.innerWidth')}")
                assert footer_count == 1, f"[{name}] 未找到 APP ICP 备案号元素"

                text = footer.inner_text()
                assert "桂ICP备2026005821号-3A" in text, f"[{name}] 备案号文案不匹配: {text}"

                screenshot_path = SCREENSHOT_DIR / f"{name}.png"
                page.screenshot(path=str(screenshot_path), full_page=False)
                print(f"已保存截图: {screenshot_path}")

                context.close()

            browser.close()

        return 0
    finally:
        print("关闭预览服务器...")
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    sys.exit(main())
