import { describe, expect, it } from 'vitest';
import { parseExtensionDirections } from './extensionDirections';

describe('parseExtensionDirections', () => {
  it('应解析中文标准格式的 3 个延伸方向', () => {
    const content = `🌱 延伸方向：
- 泰勒展开的推导
- 拉格朗日中值定理的应用
- 函数极值判定方法`;

    const result = parseExtensionDirections(content);

    expect(result.directions).toEqual([
      '泰勒展开的推导',
      '拉格朗日中值定理的应用',
      '函数极值判定方法',
    ]);
    expect(result.cleanContent).toBe('');
  });

  it('应解析英文标准格式的 3 个延伸方向', () => {
    const content = `🌱 Extension Directions:
* Derivation of Taylor expansion
* Application of Lagrange Mean Value Theorem
* Method for determining function extrema`;

    const result = parseExtensionDirections(content);

    expect(result.directions).toEqual([
      'Derivation of Taylor expansion',
      'Application of Lagrange Mean Value Theorem',
      'Method for determining function extrema',
    ]);
    expect(result.cleanContent).toBe('');
  });

  it('英文标记应不区分大小写', () => {
    const content = `🌱 extension directions:
- Lowercase marker`;

    const result = parseExtensionDirections(content);

    expect(result.directions).toEqual(['Lowercase marker']);
  });

  it('应正确处理混合内容：保留正文并移除延伸方向块', () => {
    const body = '这是回答正文。';
    const content = `${body}\n\n🌱 延伸方向：\n- 方向一\n- 方向二`;

    const result = parseExtensionDirections(content);

    expect(result.directions).toEqual(['方向一', '方向二']);
    // 保留标记之前的全部内容，包括换行
    expect(result.cleanContent).toBe(`${body}\n\n`);
  });

  it('当内容中不存在延伸方向块时应原样返回', () => {
    const content = '这是一段普通的回答，没有延伸方向。';

    const result = parseExtensionDirections(content);

    expect(result.directions).toEqual([]);
    expect(result.cleanContent).toBe(content);
  });

  it('当延伸方向块为空或格式异常时应原样返回', () => {
    const content = `🌱 延伸方向：
这里没有任何列表项
只是普通文本`;

    const result = parseExtensionDirections(content);

    expect(result.directions).toEqual([]);
    expect(result.cleanContent).toBe(content);
  });

  it('应解析编号列表格式的延伸方向', () => {
    const content = `🌱 延伸方向：
1. 泰勒展开的推导
2. 拉格朗日中值定理的应用
3. 函数极值判定方法`;

    const result = parseExtensionDirections(content);

    expect(result.directions).toEqual([
      '泰勒展开的推导',
      '拉格朗日中值定理的应用',
      '函数极值判定方法',
    ]);
  });

  it('应去除方向条目中的尾部补充描述', () => {
    const content = `🌱 延伸方向：
- 泰勒展开的推导 — 适合作为新的分支节点标题
- 拉格朗日中值定理的应用：深入理解导数与函数单调性
- 函数极值判定方法 - 注意这里是普通连字符，不应被截断`;

    const result = parseExtensionDirections(content);

    expect(result.directions).toEqual([
      '泰勒展开的推导',
      '拉格朗日中值定理的应用',
      '函数极值判定方法 - 注意这里是普通连字符，不应被截断',
    ]);
  });

  it('应忽略列表项之间的空行与非列表行', () => {
    const content = `正文前面\n\n🌱 延伸方向：
- 方向一

中间的非列表说明
- 方向二
* 方向三`;

    const result = parseExtensionDirections(content);

    expect(result.directions).toEqual(['方向一', '方向二', '方向三']);
    expect(result.cleanContent).toBe('正文前面\n\n');
  });
});
