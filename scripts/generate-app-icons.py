import os
from PIL import Image, ImageDraw


def make_circle_icon(src_image: Image.Image, size: int) -> Image.Image:
    """
    将源图片按比例缩放并裁剪为圆形图标，超出圆的部分设为透明。

    :param src_image: 原始图标图片
    :param size: 输出正方形边长
    :return: 圆形图标
    """
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # 按比例缩放，短边填满 size
    src_image.thumbnail((size, size), Image.Resampling.LANCZOS)
    # 如果图片不是正方形，先扩展成居中正方形
    square = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - src_image.width) // 2
    y = (size - src_image.height) // 2
    square.paste(src_image, (x, y), src_image)
    # 应用圆形蒙版
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size, size), fill=255)
    canvas.paste(square, (0, 0), mask)
    return canvas


def generate_android_icons(src_path: str, android_res_dir: str) -> None:
    """
    根据源图片生成 Android 各密度下的启动图标。

    :param src_path: 源图标文件路径
    :param android_res_dir: Android res 目录路径
    """
    source = Image.open(src_path).convert("RGBA")

    # 密度名称: (普通图标尺寸, 自适应前景图尺寸)
    density_map = {
        "mdpi": (48, 108),
        "hdpi": (72, 162),
        "xhdpi": (96, 216),
        "xxhdpi": (144, 324),
        "xxxhdpi": (192, 432),
    }

    for density, (launcher_size, foreground_size) in density_map.items():
        mipmap_dir = os.path.join(android_res_dir, f"mipmap-{density}")
        os.makedirs(mipmap_dir, exist_ok=True)

        # 普通启动图标（保持原图比例填充）
        launcher = source.copy()
        launcher.thumbnail((launcher_size, launcher_size), Image.Resampling.LANCZOS)
        launcher_square = Image.new("RGBA", (launcher_size, launcher_size), (0, 0, 0, 0))
        lx = (launcher_size - launcher.width) // 2
        ly = (launcher_size - launcher.height) // 2
        launcher_square.paste(launcher, (lx, ly), launcher)
        launcher_square.save(os.path.join(mipmap_dir, "ic_launcher.png"), "PNG")

        # 圆形启动图标
        round_icon = make_circle_icon(source.copy(), launcher_size)
        round_icon.save(os.path.join(mipmap_dir, "ic_launcher_round.png"), "PNG")

        # 自适应前景图标
        foreground = source.copy()
        foreground.thumbnail((foreground_size, foreground_size), Image.Resampling.LANCZOS)
        foreground_square = Image.new("RGBA", (foreground_size, foreground_size), (0, 0, 0, 0))
        fx = (foreground_size - foreground.width) // 2
        fy = (foreground_size - foreground.height) // 2
        foreground_square.paste(foreground, (fx, fy), foreground)
        foreground_square.save(os.path.join(mipmap_dir, "ic_launcher_foreground.png"), "PNG")

        print(f"已生成 mipmap-{density}: {launcher_size}x{launcher_size}, 前景 {foreground_size}x{foreground_size}")


if __name__ == "__main__":
    src_icon = r"d:\study1\DeepMindMap\v2\IMG_20260625_233610..png"
    android_res = r"d:\study1\DeepMindMap\v2\client\android\app\src\main\res"
    generate_android_icons(src_icon, android_res)
