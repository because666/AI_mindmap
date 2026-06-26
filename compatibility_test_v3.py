"""
任务8：第二轮兼容性验证浏览器测试脚本 - 第三版
完整模拟用户进入流程：注册访客 -> 创建工作区 -> 验证 CanvasPage 与 ChatPanel
"""
import os
import time
from playwright.sync_api import sync_playwright

OUT_DIR = r"d:\study1\DeepMindMap\v2\compatibility_screenshots"
os.makedirs(OUT_DIR, exist_ok=True)


def setup_user_workspace(page, label):
    """模拟用户进入工作区流程（访客身份由系统自动注册）"""
    print(f"\n--- [{label}] 模拟用户进入流程 ---")

    # 0. 先关闭可能存在的新手引导（OnboardingGuide）
    try:
        close_guide_btn = page.locator('button[title="关闭引导"], button[title="Skip"], button:has-text("跳过")').first
        if close_guide_btn.is_visible(timeout=2000):
            close_guide_btn.click()
            print(f"[{label}] 已关闭新手引导(OnboardingGuide)")
            page.wait_for_timeout(500)
    except Exception:
        pass

    # 1. 等待工作区选择页加载（访客身份已自动注册）
    try:
        page.wait_for_selector('button:has-text("创建"), button:has-text("Create")', timeout=10000, state="visible")
        print(f"[{label}] 工作区选择页已加载")
    except Exception as e:
        print(f"[{label}] 等待工作区选择页失败: {e}")
        try:
            page.screenshot(path=os.path.join(OUT_DIR, f"{label}_waiting_workspace_page.png"))
        except Exception:
            pass
        return False

    # 2. 点击"创建"按钮,展开创建工作区表单
    try:
        create_btn = page.locator('button:has-text("创建"), button:has-text("Create")').first
        create_btn.click()
        print(f"[{label}] 点击创建按钮,展开创建工作区表单")
        page.wait_for_timeout(800)
    except Exception as e:
        print(f"[{label}] 点击创建按钮失败: {e}")
        return False

    # 3. 填入工作区名称（创建工作区表单中的 input）
    try:
        # 等待表单中的输入框可见
        page.wait_for_selector('input[type="text"]', timeout=5000, state="visible")
        ws_name_input = page.locator('input[type="text"]').first
        ws_name_input.fill(f"测试工作区_{label}")
        print(f"[{label}] 填入工作区名称")
    except Exception as e:
        print(f"[{label}] 填入工作区名称失败: {e}")
        try:
            page.screenshot(path=os.path.join(OUT_DIR, f"{label}_create_form.png"))
            # 探查表单结构
            all_inputs = page.locator('input').all()
            print(f"[{label}] 当前 input 数量: {len(all_inputs)}")
            for i, inp in enumerate(all_inputs):
                try:
                    placeholder = inp.get_attribute('placeholder') or ''
                    visible = inp.is_visible()
                    print(f"  input[{i}] placeholder: {placeholder}, visible: {visible}")
                except Exception:
                    pass
        except Exception:
            pass
        return False

    # 4. 提交创建工作区表单
    try:
        submit_btn = page.locator('form button[type="submit"]').first
        submit_btn.click()
        print(f"[{label}] 提交创建工作区表单")
    except Exception as e:
        print(f"[{label}] 提交创建工作区表单失败: {e}")
        return False

    # 5. 等待进入主界面 (CanvasPage)
    try:
        page.wait_for_selector('.react-flow', timeout=15000)
        print(f"[{label}] 已进入 CanvasPage")
    except Exception as e:
        print(f"[{label}] 等待 CanvasPage 加载失败: {e}")
        try:
            page.screenshot(path=os.path.join(OUT_DIR, f"{label}_waiting_canvas.png"))
        except Exception:
            pass
        return False

    # 给予额外等待时间确保 ChatPanel 等异步组件渲染
    page.wait_for_timeout(3000)

    return True


def verify_ui(page, label, is_mobile=False):
    """验证 UI 元素可见可用"""
    result = {"label": label, "is_mobile": is_mobile}

    # 1. 验证 CanvasPage 主区域（react-flow 容器）
    try:
        result["canvas_visible"] = page.locator('.react-flow').first.is_visible(timeout=3000)
    except Exception:
        result["canvas_visible"] = False
    print(f"[{label}] CanvasPage 主区域可见: {result['canvas_visible']}")

    # 2. 验证模板库入口按钮（LayoutTemplate 图标）
    # 通过 svg.lucide-layout-template 查找
    template_btn_count = 0
    try:
        # lucide-react 渲染的 svg 会带 lucide-layout-template 类
        template_btn_count = page.locator('svg.lucide-layout-template').count()
    except Exception:
        pass
    result["template_btn_count"] = template_btn_count
    print(f"[{label}] 模板库入口按钮(LayoutTemplate svg)数量: {template_btn_count}")

    # 3. 验证模板库弹窗是否自动弹出（首次进入）
    template_modal_visible = False
    try:
        # 模板库弹窗的标题 h2
        template_modal_visible = page.locator('h2:has-text("模板库"), h2:has-text("Template Library"), h2:has-text("模板")').first.is_visible(timeout=3000)
    except Exception:
        template_modal_visible = False
    result["template_modal_auto_open"] = template_modal_visible
    print(f"[{label}] 首次进入模板库弹窗自动弹出: {template_modal_visible}")

    # 4. 验证 ChatPanel 可见（默认未打开,需主动触发）
    chat_panel_visible_default = False
    try:
        chat_panel_visible_default = page.locator('[data-testid="chat-panel-v2"]').first.is_visible(timeout=2000)
    except Exception:
        chat_panel_visible_default = False
    result["chat_panel_visible_default"] = chat_panel_visible_default
    print(f"[{label}] ChatPanel 默认可见: {chat_panel_visible_default}")

    # 4.5 如果模板库弹窗在显示,先关闭它,避免遮挡 ChatPanel 触发按钮
    try:
        modal_visible_now = page.locator('h2:has-text("模板库"), h2:has-text("Template Library")').first.is_visible(timeout=1000)
        if modal_visible_now:
            # 点击模板库弹窗右上角的 X 按钮
            close_modal_btn = page.locator('.fixed.inset-0.z-50 button:has(svg.lucide-x)').first
            close_modal_btn.click(timeout=2000)
            print(f"[{label}] 已关闭模板库弹窗以避免遮挡")
            page.wait_for_timeout(800)
    except Exception as e:
        print(f"[{label}] 关闭模板库弹窗失败: {e}")
        # 备用：按 Escape 键关闭
        try:
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
        except Exception:
            pass

    # 5. 主动触发 ChatPanel 显示,并验证可见
    chat_panel_triggered = False
    chat_panel_root_count = 0
    chat_header_visible = False
    chat_panel_select_node_visible = False  # ChatPanel 未选中节点时的空状态文案
    try:
        if is_mobile:
            # 移动端：通过移动端顶部栏的 MessageSquare 按钮触发
            chat_btn = page.locator('header button:has(svg.lucide-message-square)').first
            chat_btn.click(timeout=3000, force=True)
            print(f"[{label}] 点击移动端顶部栏 ChatPanel 触发按钮")
        else:
            # 桌面端：通过桌面端侧边栏的 MessageSquare 按钮触发
            chat_btn = page.locator('aside button:has(svg.lucide-message-square)').first
            chat_btn.click(timeout=3000, force=True)
            print(f"[{label}] 点击桌面端侧边栏 ChatPanel 触发按钮")
        page.wait_for_timeout(2500)

        # 多种检查方式
        # 5.1 检查 [data-testid="chat-panel-v2"] 是否存在(数量) - 仅在 nodeId 存在时渲染
        chat_panel_root_count = page.locator('[data-testid="chat-panel-v2"]').count()
        # 5.2 检查 ChatPanel 容器标题 "AI 对话" 是否可见
        try:
            chat_header_visible = page.locator('text=AI 对话').first.is_visible(timeout=2000)
        except Exception:
            chat_header_visible = False
        # 5.3 检查 ChatPanel 空状态文案"选择节点开始对话"是否可见
        try:
            chat_panel_select_node_visible = page.locator('text=选择节点开始对话').first.is_visible(timeout=2000)
        except Exception:
            chat_panel_select_node_visible = False
        # 5.4 综合判断 ChatPanel 是否被触发显示
        if chat_header_visible or chat_panel_select_node_visible or chat_panel_root_count > 0:
            chat_panel_triggered = True
    except Exception as e:
        print(f"[{label}] 触发 ChatPanel 失败: {e}")
    result["chat_panel_root_count"] = chat_panel_root_count
    result["chat_panel_header_visible"] = chat_header_visible
    result["chat_panel_select_node_visible"] = chat_panel_select_node_visible
    result["chat_panel_triggered_visible"] = chat_panel_triggered
    print(f"[{label}] ChatPanel root 数量: {chat_panel_root_count}, header 可见: {chat_header_visible}, 空状态文案可见: {chat_panel_select_node_visible}, 综合触发成功: {chat_panel_triggered}")

    # 5.5 截图：ChatPanel 触发后状态
    try:
        chat_shot = os.path.join(OUT_DIR, f"{label}_chatpanel_opened.png")
        page.screenshot(path=chat_shot, full_page=False)
        print(f"[截图] ChatPanel 触发后: {chat_shot}")
    except Exception:
        pass

    # 6. 探测页面 lucide svg 图标总数
    try:
        all_svgs = page.locator('svg[class*="lucide"]').count()
        print(f"[{label}] 页面 lucide svg 图标总数: {all_svgs}")
        result["total_lucide_svgs"] = all_svgs
    except Exception:
        pass

    return result


def test_viewport(viewport_name, width, height, is_mobile=False):
    """完整 viewport 测试"""
    print(f"\n===== {viewport_name} ({width}x{height}) 测试开始 =====")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        if is_mobile:
            iphone_x = p.devices["iPhone X"]
            context = browser.new_context(**iphone_x)
        else:
            context = browser.new_context(viewport={"width": width, "height": height})
        page = context.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: console_logs.append(f"[pageerror] {err}"))

        # 先访问一次,清除 localStorage（避免之前测试残留访客身份/工作区），
        # 并预设 onboarding 完成标记跳过新手引导倒计时
        try:
            page.goto("http://localhost:5173/", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_load_state("networkidle", timeout=20000)
            page.wait_for_timeout(1500)
            page.evaluate("""localStorage.clear();
                            localStorage.setItem('deepmindmap_onboarding_completed', 'true');
                            localStorage.setItem('deepmindmap_onboarding_timestamp', new Date().toISOString());""")
            print(f"[{viewport_name}] 已清除 localStorage,并预设 onboarding 完成标记")
            page.reload(wait_until="domcontentloaded", timeout=20000)
            page.wait_for_load_state("networkidle", timeout=20000)
            page.wait_for_timeout(2500)
        except Exception as e:
            print(f"[警告] 初始化/清除 localStorage 异常: {e}")

        # 模拟用户进入流程
        ok = setup_user_workspace(page, viewport_name)

        # 进入主界面后截图
        after_enter_shot = os.path.join(OUT_DIR, f"{viewport_name}_after_enter.png")
        page.screenshot(path=after_enter_shot, full_page=False)
        print(f"[截图] 进入主界面后: {after_enter_shot}")

        if not ok:
            print(f"[{viewport_name}] 用户进入流程失败,跳过 UI 验证")
            # 输出最后几条日志
            print(f"[{viewport_name}] 控制台日志最后5条:")
            for log in console_logs[-5:]:
                print(f"  {log}")
            browser.close()
            return {"label": viewport_name, "error": "setup_user_workspace_failed"}

        # 验证 UI 元素（首次进入）
        result = verify_ui(page, viewport_name, is_mobile=is_mobile)

        # 截图：首次进入状态
        first_state_shot = os.path.join(OUT_DIR, f"{viewport_name}_first_state.png")
        page.screenshot(path=first_state_shot, full_page=False)
        print(f"[截图] 首次进入状态: {first_state_shot}")

        # 再次清除 localStorage 的 templateLibraryDismissed 并刷新,验证首次进入触发
        # 注意：需要确保画布为空（nodes.length === 0），因此清除已选中节点
        try:
            # 仅清除 templateLibraryDismissed
            page.evaluate("localStorage.removeItem('templateLibraryDismissed')")
            page.reload(wait_until="domcontentloaded", timeout=20000)
            page.wait_for_load_state("networkidle", timeout=15000)
            page.wait_for_timeout(4000)
        except Exception as e:
            print(f"[警告] 清除 templateLibraryDismissed 后重载异常: {e}")

        # 验证首次进入触发模板库弹窗（重试3次,每次等1秒）
        modal_visible = False
        for retry in range(3):
            try:
                modal_visible = page.locator('h2:has-text("模板库"), h2:has-text("Template Library"), h2:has-text("模板")').first.is_visible(timeout=2000)
                if modal_visible:
                    break
                page.wait_for_timeout(1500)
            except Exception:
                pass
        result["template_modal_after_clear"] = modal_visible
        print(f"[{viewport_name}] 清除 dismissed 标记后模板库弹窗自动弹出: {modal_visible}")

        # 截图：清除 dismissed 后的状态
        after_clear_shot = os.path.join(OUT_DIR, f"{viewport_name}_after_clear_dismissed.png")
        page.screenshot(path=after_clear_shot, full_page=False)
        print(f"[截图] 清除 dismissed 后: {after_clear_shot}")

        # 完整页面截图
        full_shot = os.path.join(OUT_DIR, f"{viewport_name}_full_page.png")
        page.screenshot(path=full_shot, full_page=True)
        print(f"[截图] 完整页面: {full_shot}")

        print(f"\n[{viewport_name}] 控制台日志（最后10条）:")
        for log in console_logs[-10:]:
            print(f"  {log}")

        browser.close()
        return result


if __name__ == "__main__":
    results = {}
    try:
        results["desktop"] = test_viewport("desktop_1280x800", 1280, 800, is_mobile=False)
    except Exception as e:
        print(f"[错误] 桌面端测试失败: {e}")
        results["desktop"] = {"error": str(e)}

    try:
        results["mobile"] = test_viewport("mobile_375x812_iPhoneX", 375, 812, is_mobile=True)
    except Exception as e:
        print(f"[错误] 移动端测试失败: {e}")
        results["mobile"] = {"error": str(e)}

    print("\n===== 测试结果汇总 =====")
    for k, v in results.items():
        print(f"\n[{k}]:")
        for kk, vv in v.items():
            print(f"  {kk}: {vv}")
