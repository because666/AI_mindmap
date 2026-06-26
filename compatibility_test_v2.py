"""
任务8：第二轮兼容性验证浏览器测试脚本 - 第二版
更细致地探测页面实际渲染内容，再判断元素可见性
"""
import os
from playwright.sync_api import sync_playwright

OUT_DIR = r"d:\study1\DeepMindMap\v2\compatibility_screenshots"
os.makedirs(OUT_DIR, exist_ok=True)


def explore_page(page, label):
    """探测页面实际渲染内容"""
    print(f"\n--- 探测 {label} 页面 ---")
    # 输出页面标题
    try:
        title = page.title()
        print(f"页面标题: {title}")
    except Exception as e:
        print(f"获取标题失败: {e}")

    # 输出页面 URL
    print(f"页面 URL: {page.url}")

    # 输出 body 部分内容
    try:
        body_text = page.locator('body').inner_text(timeout=3000)
        # 仅打印前 500 字符
        print(f"body 文本前500字:\n{body_text[:500]}")
    except Exception as e:
        print(f"获取 body 文本失败: {e}")

    # 探测所有按钮
    try:
        buttons = page.locator('button').all()
        print(f"按钮总数: {len(buttons)}")
        for i, btn in enumerate(buttons[:20]):
            try:
                title_attr = btn.get_attribute('title') or ''
                aria_label = btn.get_attribute('aria-label') or ''
                text = btn.inner_text(timeout=500)[:30] if btn.inner_text(timeout=500) else ''
                print(f"  按钮[{i}]: title='{title_attr}' aria-label='{aria_label}' text='{text}'")
            except Exception:
                pass
    except Exception as e:
        print(f"获取按钮失败: {e}")

    # 探测 react-flow
    try:
        react_flow_count = page.locator('.react-flow').count()
        print(f"react-flow 容器数量: {react_flow_count}")
    except Exception as e:
        print(f"获取 react-flow 失败: {e}")

    # 探测 chat-panel-v2
    try:
        chat_count = page.locator('[data-testid="chat-panel-v2"]').count()
        print(f"chat-panel-v2 数量: {chat_count}")
    except Exception as e:
        print(f"获取 chat-panel-v2 失败: {e}")

    # 探测是否有 LayoutTemplate svg (模板库图标)
    try:
        # lucide-react 图标通常以 svg 形式渲染
        layout_template_svgs = page.locator('svg.lucide-layout-template').count()
        print(f"lucide-layout-template svg 数量: {layout_template_svgs}")
    except Exception as e:
        print(f"获取 layout-template svg 失败: {e}")

    # 探测 h2 标题（可能为模板库弹窗标题）
    try:
        h2s = page.locator('h2').all()
        print(f"h2 总数: {len(h2s)}")
        for i, h2 in enumerate(h2s[:10]):
            try:
                txt = h2.inner_text(timeout=500)
                print(f"  h2[{i}]: {txt}")
            except Exception:
                pass
    except Exception as e:
        print(f"获取 h2 失败: {e}")


def test_viewport(viewport_name, width, height, is_mobile=False):
    """通用 viewport 测试函数"""
    print(f"\n===== {viewport_name} ({width}x{height}) 测试开始 =====")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        if is_mobile:
            # 使用 iPhone X 模拟移动端
            iphone_x = p.devices["iPhone X"]
            context = browser.new_context(**iphone_x)
        else:
            context = browser.new_context(viewport={"width": width, "height": height})
        page = context.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        # 错误日志
        page.on("pageerror", lambda err: console_logs.append(f"[pageerror] {err}"))

        try:
            page.goto("http://localhost:5173/", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_load_state("networkidle", timeout=20000)
        except Exception as e:
            print(f"[警告] 页面加载异常: {e}")

        # 给予额外等待时间确保 React 渲染
        page.wait_for_timeout(3500)

        # 第一次探测 - 探查实际渲染内容
        explore_page(page, f"{viewport_name}-initial")

        # 截图：第一次加载
        first_shot = os.path.join(OUT_DIR, f"{viewport_name}_first_load.png")
        page.screenshot(path=first_shot, full_page=False)
        print(f"[截图] 首屏: {first_shot}")

        # 清除 localStorage 并重载,验证首次进入触发模板库
        try:
            page.evaluate("localStorage.clear()")
            page.reload(wait_until="domcontentloaded", timeout=20000)
            page.wait_for_load_state("networkidle", timeout=20000)
            page.wait_for_timeout(3500)
        except Exception as e:
            print(f"[警告] 清除 localStorage 后重载异常: {e}")

        # 第二次探测
        explore_page(page, f"{viewport_name}-after-clear")

        # 截图：清除 localStorage 后
        cleared_shot = os.path.join(OUT_DIR, f"{viewport_name}_after_clear.png")
        page.screenshot(path=cleared_shot, full_page=False)
        print(f"[截图] 清除 localStorage 后: {cleared_shot}")

        # 完整页面截图
        full_shot = os.path.join(OUT_DIR, f"{viewport_name}_full_page.png")
        page.screenshot(path=full_shot, full_page=True)
        print(f"[截图] 完整页面: {full_shot}")

        print(f"\n[{viewport_name}] 控制台日志（最后10条）:")
        for log in console_logs[-10:]:
            print(f"  {log}")

        browser.close()


if __name__ == "__main__":
    # 桌面端
    test_viewport("desktop_1280x800", 1280, 800, is_mobile=False)
    # 移动端
    test_viewport("mobile_375x812_iPhoneX", 375, 812, is_mobile=True)
    print("\n===== 探测完成 =====")
