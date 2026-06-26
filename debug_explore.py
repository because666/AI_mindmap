"""探查脚本：查看页面当前渲染内容"""
import os
from playwright.sync_api import sync_playwright

OUT_DIR = r"d:\study1\DeepMindMap\v2\compatibility_screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    page = context.new_page()

    page.goto("http://localhost:5173/", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_load_state("networkidle", timeout=20000)
    page.wait_for_timeout(2500)

    # 清除 localStorage 并设置 onboarding 完成
    page.evaluate("""localStorage.clear();
                    localStorage.setItem('deepmindmap_onboarding_completed', 'true');
                    localStorage.setItem('deepmindmap_onboarding_timestamp', new Date().toISOString());""")
    print("已清除 localStorage 并设置 onboarding 完成标记")

    page.reload(wait_until="domcontentloaded", timeout=20000)
    page.wait_for_load_state("networkidle", timeout=20000)
    page.wait_for_timeout(3500)

    # 截图
    page.screenshot(path=os.path.join(OUT_DIR, "debug_desktop_state.png"))

    # 输出 body 完整 HTML
    html = page.content()
    with open(os.path.join(OUT_DIR, "debug_desktop_dom.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print(f"DOM 已写入: debug_desktop_dom.html (长度: {len(html)})")

    # 输出 body 文本
    body_text = page.locator('body').inner_text(timeout=5000)
    print(f"\n=== body 文本前 1500 字 ===")
    print(body_text[:1500])

    # 列出所有 input
    inputs = page.locator('input').all()
    print(f"\n=== input 元素总数: {len(inputs)} ===")
    for i, inp in enumerate(inputs):
        try:
            attrs = inp.evaluate("""e => {
                return {
                    type: e.type,
                    placeholder: e.placeholder,
                    className: e.className,
                    id: e.id,
                    name: e.name,
                    visible: e.offsetParent !== null,
                    rect: e.getBoundingClientRect()
                };
            }""")
            print(f"  input[{i}]: {attrs}")
        except Exception as e:
            print(f"  input[{i}] 获取属性失败: {e}")

    # 列出所有 button
    buttons = page.locator('button').all()
    print(f"\n=== button 元素总数: {len(buttons)} ===")
    for i, btn in enumerate(buttons[:20]):
        try:
            attrs = btn.evaluate("""e => {
                return {
                    text: e.innerText,
                    title: e.title,
                    type: e.type,
                    className: e.className.substring(0, 80),
                    visible: e.offsetParent !== null,
                    disabled: e.disabled
                };
            }""")
            print(f"  button[{i}]: {attrs}")
        except Exception as e:
            print(f"  button[{i}] 获取属性失败: {e}")

    # 列出所有 svg
    svgs = page.locator('svg').all()
    print(f"\n=== svg 元素总数: {len(svgs)} ===")
    for i, svg in enumerate(svgs[:20]):
        try:
            cls = svg.get_attribute('class') or ''
            print(f"  svg[{i}]: class={cls}")
        except Exception:
            pass

    browser.close()
