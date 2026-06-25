from PIL import Image

input_path = r'd:\study1\DeepMindMap\v2\client\public\favicon.png'
output_path = r'd:\study1\DeepMindMap\v2\client\public\favicon.png'

img = Image.open(input_path).convert('RGBA')
alpha = img.getchannel('A')
bbox = alpha.getbbox()

if bbox:
    cropped = img.crop(bbox)
    w, h = cropped.size
    # 以长边为准创建正方形画布，保证 favicon 在浏览器中居中且比例正确
    side = max(w, h)
    # 添加 5% 内边距，保证圆角完整显示
    padding = max(int(side * 0.05), 4)
    new_size = side + 2 * padding
    result = Image.new('RGBA', (new_size, new_size), (0, 0, 0, 0))
    # 居中粘贴
    offset_x = (new_size - w) // 2
    offset_y = (new_size - h) // 2
    result.paste(cropped, (offset_x, offset_y))
    result.save(output_path)
    print(f'已裁剪并保存：{output_path}，尺寸：{result.size}')
else:
    print('未找到非透明内容')
