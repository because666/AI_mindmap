"""
任务8：第二轮兼容性验证浏览器测试脚本
验证客户端在桌面端/移动端 viewport 下的核心 UI 可见可用
"""
import os
from playwright.sync_api import sync_playwright

# 截图保存目录
OUT_DIR = r"d:\study1\DeepMindMap\v2\compatibility_screenshots"
os.makedirs(OUT_DIR, exist_ok=True)


def test_desktop_viewport():
    """桌面端 viewport (1280x800) 验证"""
    print("\n===== 桌面端 viewport (1280x800) 测试开始 =====")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # 收集控制台日志
        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        try:
            page.goto("http://localhost:5173/", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_load_state("networkidle", timeout=15000)
        except Exception as e:
            print(f"[警告] 页面加载异常: {e}")

        # 给予额外等待时间确保 React 渲染
        page.wait_for_timeout(2500)

        # 清除 localStorage 确保首次进入触发模板库弹窗
        try:
            page.evaluate("localStorage.clear()")
            page.reload(wait_until="domcontentloaded", timeout=20000)
            page.wait_for_load_state("networkidle", timeout=15000)
            page.wait_for_timeout(2000)
        except Exception as e:
            print(f"[警告] 清除 localStorage 后重载异常: {e}")

        # 截图：完整首屏
        desktop_first = os.path.join(OUT_DIR, "desktop_1280x800_first_load.png")
        page.screenshot(path=desktop_first, full_page=False)
        print(f"[截图] 桌面端首屏: {desktop_first}")

        # 验证模板库入口按钮（LayoutTemplate 图标）
        template_btn_desktop = None
        try:
            # 桌面端工具栏模板库按钮 title 通常为模板库/Template Library
            template_btn_desktop = page.locator('button[title*="模板"], button[title*="Template"], button[title*="template"]').all()
        except Exception as e:
            print(f"[警告] 查询模板库按钮异常: {e}")

        desktop_template_btn_count = len(template_btn_desktop) if template_btn_desktop else 0
        print(f"[结果] 桌面端模板库入口按钮数量: {desktop_template_btn_count}")

        # 验证模板库弹窗是否自动弹出
        template_modal_visible = False
        try:
            # 模板库弹窗头部标题
            template_modal_visible = page.locator('text=模板库, text=Template Library, h2:has-text("模板"), h2:has-text("Template")').first.is_visible(timeout=3000)
        except Exception:
            template_modal_visible = False
        print(f"[结果] 桌面端首次进入模板库弹窗自动弹出: {template_modal_visible}")

        # 验证 ChatPanel 可见
        chat_panel_visible = False
        try:
            chat_panel_visible = page.locator('[data-testid="chat-panel-v2"]').first.is_visible(timeout=3000)
        except Exception:
            chat_panel_visible = False
        print(f"[结果] 桌面端 ChatPanel 可见: {chat_panel_visible}")

        # 验证 CanvasPage 主区域（ReactFlow 容器）
        canvas_visible = False
        try:
            canvas_visible = page.locator('.react-flow').first.is_visible(timeout=3000)
        except Exception:
            canvas_visible = False
        print(f"[结果] 桌面端 CanvasPage 主区域可见: {canvas_visible}")

        # 截图：渲染后的状态
        desktop_state = os.path.join(OUT_DIR, "desktop_1280x800_state.png")
        page.screenshot(path=desktop_state, full_page=False)
        print(f"[截图] 桌面端渲染状态: {desktop_state}")

        # 输出部分控制台日志
        print(f"[控制台日志数量]: {len(console_logs)}")
        for log in console_logs[-5:]:
            print(f"  {log}")

        browser.close()
        return {
            "viewport": "1280x800",
            "template_btn_count": desktop_template_btn_count,
            "template_modal_auto_open": template_modal_visible,
            "chat_panel_visible": chat_panel_visible,
            "canvas_visible": canvas_visible,
        }


def test_mobile_viewport():
    """移动端 viewport (375x812, iPhone X) 验证"""
    print("\n===== 移动端 viewport (375x812) 测试开始 =====")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # 模拟 iPhone X
        iphone_x = p.devices["iPhone X"]
        context = browser.new_context(**iphone_x)
        page = context.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        try:
            page.goto("http://localhost:5173/", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_load_state("networkidle", timeout=15000)
        except Exception as e:
            print(f"[警告] 页面加载异常: {e}")

        page.wait_for_timeout(2500)

        # 清除 localStorage 确保首次进入触发模板库弹窗
        try:
            page.evaluate("localStorage.clear()")
            page.reload(wait_until="domcontentloaded", timeout=20000)
            page.wait_for_load_state("networkidle", timeout=15000)
            page.wait_for_timeout(2000)
        except Exception as e:
            print(f"[警告] 清除 localStorage 后重载异常: {e}")

        # 截图：移动端首屏
        mobile_first = os.path.join(OUT_DIR, "mobile_375x812_first_load.png")
        page.screenshot(path=mobile_first, full_page=False)
        print(f"[截图] 移动端首屏: {mobile_first}")

        # 验证移动端工具栏模板库入口按钮
        mobile_template_btn_count = 0
        try:
            btns = page.locator('button[title*="模板"], button[title*="Template"], button[title*="template"]').all()
            mobile_template_btn_count = len(btns)
        except Exception as e:
            print(f"[警告] 查询移动端模板库按钮异常: {e}")
        print(f"[结果] 移动端模板库入口按钮数量: {mobile_template_btn_count}")

        # 验证模板库弹窗是否自动弹出
        mobile_template_modal_visible = False
        try:
            mobile_template_modal_visible = page.locator('text=模板库, text=Template Library, h2:has-text("模板"), h2:has-text("Template")').first.is_visible(timeout=3000)
        except Exception:
            mobile_template_modal_visible = False
        print(f"[结果] 移动端首次进入模板库弹窗自动弹出: {mobile_template_modal_visible}")

        # 验证 ChatPanel 可见或可触发显示
        mobile_chat_visible = False
        try:
            mobile_chat_visible = page.locator('[data-testid="chat-panel-v2"]').first.is_visible(timeout=3000)
        except Exception:
            mobile_chat_visible = False
        print(f"[结果] 移动端 ChatPanel 可见: {mobile_chat_visible}")

        # 验证 CanvasPage 主区域
        mobile_canvas_visible = False
        try:
            mobile_canvas_visible = page.locator('.react-flow').first.is_visible(timeout=3000)
        except Exception:
            mobile_canvas_visible = False
        print(f"[结果] 移动端 CanvasPage 主区域可见: {mobile_canvas_visible}")

        # 截图：移动端渲染状态
        mobile_state = os.path.join(OUT_DIR, "mobile_375x812_state.png")
        page.screenshot(path=mobile_state, full_page=False)
        print(f"[截图] 移动端渲染状态: {mobile_state}")

        print(f"[控制台日志数量]: {len(console_logs)}")
        for log in console_logs[-5:]:
            print(f"  {log}")

        browser.close()
        return {
            "viewport": "375x812",
            "template_btn_count": mobile_template_btn_count,
            "template_modal_auto_open": mobile_template_modal_visible,
            "chat_panel_visible": mobile_chat_visible,
            "canvas_visible": mobile_canvas_visible,
        }


if __name__ == "__main__":
    results = {}
    try:
        results["desktop"] = test_desktop_viewport()
    except Exception as e:
        print(f"[错误] 桌面端测试失败: {e}")
        results["desktop"] = {"error": str(e)}

    try:
        results["mobile"] = test_mobile_viewport()
    except Exception as e:
        print(f"[错误] 移动端测试失败: {e}")
        results["mobile"] = {"error": str(e)}

    print("\n===== 测试结果汇总 =====")
    print(results)
