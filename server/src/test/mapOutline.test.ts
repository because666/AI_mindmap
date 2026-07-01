import { describe, expect, it } from 'vitest';
import { parseMapOutlineJson } from '../routes/ai';

/**
 * 构造标准分支数组（4 个有效分支），用于补齐分支数量满足下限要求
 * @param count 需要构造的分支数量
 * @returns 标准分支对象数组
 */
function makeBranches(count: number): Array<{ title: string; description: string }> {
  return Array.from({ length: count }, (_, i) => ({
    title: `分支${i + 1}`,
    description: `描述${i + 1}`,
  }));
}

/**
 * 将对象序列化为 JSON 字符串
 * @param data 待序列化对象
 * @returns JSON 字符串
 */
function stringify(data: unknown): string {
  return JSON.stringify(data);
}

/**
 * 地图大纲 JSON 解析器单元测试
 * 覆盖正常流程、异常流程、边界情况，验证容错处理逻辑
 * 验证 4-6 分支数量限制、Markdown 代码块正则、特殊字符处理等
 */
describe('parseMapOutlineJson', () => {
  describe('正常流程', () => {
    it('应正确解析标准 JSON 大纲（4 分支）', () => {
      const content = stringify({
        rootTitle: '机器学习',
        branches: makeBranches(4),
      });
      const result = parseMapOutlineJson(content);
      expect(result).not.toBeNull();
      expect(result?.rootTitle).toBe('机器学习');
      expect(result?.branches).toHaveLength(4);
      expect(result?.branches[0].title).toBe('分支1');
      expect(result?.branches[0].description).toBe('描述1');
    });

    it('应解析带前后多余文字的 JSON', () => {
      const content = '好的，这是大纲：\n' + stringify({
        rootTitle: '前端',
        branches: makeBranches(4),
      }) + '\n以上是结果。';
      const result = parseMapOutlineJson(content);
      expect(result).not.toBeNull();
      expect(result?.rootTitle).toBe('前端');
      expect(result?.branches).toHaveLength(4);
    });

    it('应解析 Markdown 代码块包裹的 JSON', () => {
      const content = '```json\n' + stringify({
        rootTitle: '深度学习',
        branches: makeBranches(4),
      }) + '\n```';
      const result = parseMapOutlineJson(content);
      expect(result).not.toBeNull();
      expect(result?.rootTitle).toBe('深度学习');
      expect(result?.branches[0].title).toBe('分支1');
    });

    it('应解析无 description 字段的分支（description 置空）', () => {
      // 仅 1 个分支但缺 description，因总数不足下限 4，应返回 null
      const content = '{"rootTitle":"主题","branches":[{"title":"分支1"}]}';
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('应解析包含 4 个无 description 字段的分支', () => {
      const content = stringify({
        rootTitle: '主题',
        branches: Array.from({ length: 4 }, (_, i) => ({ title: `分支${i + 1}` })),
      });
      const result = parseMapOutlineJson(content);
      expect(result).not.toBeNull();
      expect(result?.branches[0].description).toBe('');
    });

    it('应过滤掉 title 为空字符串的分支（剩余不足下限返回 null）', () => {
      // 输入 4 个分支，其中 3 个标题为空，1 个有效 → 有效数 < 4 → null
      const content = stringify({
        rootTitle: '主题',
        branches: [
          { title: '有效分支', description: '描述' },
          { title: '', description: '空标题1' },
          { title: '', description: '空标题2' },
          { title: '', description: '空标题3' },
        ],
      });
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('应过滤掉 title 为空字符串的分支（剩余满足下限返回有效结果）', () => {
      // 输入 5 个分支，其中 1 个标题为空，4 个有效 → 有效数 = 4 → 正常返回
      const content = stringify({
        rootTitle: '主题',
        branches: [
          { title: '有效分支1', description: '描述1' },
          { title: '有效分支2', description: '描述2' },
          { title: '有效分支3', description: '描述3' },
          { title: '有效分支4', description: '描述4' },
          { title: '', description: '空标题' },
        ],
      });
      const result = parseMapOutlineJson(content);
      expect(result).not.toBeNull();
      expect(result?.branches).toHaveLength(4);
      expect(result?.branches[0].title).toBe('有效分支1');
    });

    it('应 trim 标题和描述的首尾空白', () => {
      const content = stringify({
        rootTitle: '  主题  ',
        branches: makeBranches(4).map((b) => ({
          title: `  ${b.title}  `,
          description: `  ${b.description}  `,
        })),
      });
      const result = parseMapOutlineJson(content);
      expect(result?.rootTitle).toBe('主题');
      expect(result?.branches[0].title).toBe('分支1');
      expect(result?.branches[0].description).toBe('描述1');
    });
  });

  describe('异常流程', () => {
    it('空字符串应返回 null', () => {
      expect(parseMapOutlineJson('')).toBeNull();
    });

    it('非 JSON 文本应返回 null', () => {
      expect(parseMapOutlineJson('这不是 JSON 格式的内容')).toBeNull();
    });

    it('JSON 缺少 rootTitle 字段应返回 null', () => {
      const content = stringify({ branches: makeBranches(4) });
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('JSON 的 rootTitle 为空字符串应返回 null', () => {
      const content = stringify({ rootTitle: '', branches: makeBranches(4) });
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('JSON 的 rootTitle 为 null 应返回 null', () => {
      const content = stringify({ rootTitle: null, branches: makeBranches(4) });
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('JSON 缺少 branches 字段应返回 null', () => {
      const content = stringify({ rootTitle: '主题' });
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('JSON 的 branches 为空数组应返回 null', () => {
      const content = stringify({ rootTitle: '主题', branches: [] });
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('JSON 的 branches 为非数组类型（字符串）应返回 null', () => {
      const content = stringify({ rootTitle: '主题', branches: '不是数组' });
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('JSON 的 branches 为非数组类型（对象）应返回 null', () => {
      const content = stringify({ rootTitle: '主题', branches: { a: 1 } });
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('JSON 的 branches 为非数组类型（数字）应返回 null', () => {
      const content = stringify({ rootTitle: '主题', branches: 123 });
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('JSON 的 branches 全部无效时应返回 null', () => {
      const content = stringify({
        rootTitle: '主题',
        branches: [
          { title: '', description: '空1' },
          { description: '无标题1' },
          { title: '', description: '空2' },
          { description: '无标题2' },
        ],
      });
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('JSON 语法错误应返回 null', () => {
      const content = '{"rootTitle":"主题","branches":[{"title":"分支",}]}';
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('JSON 的 rootTitle 类型错误（数字）应返回 null', () => {
      const content = stringify({ rootTitle: 123, branches: makeBranches(4) });
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('JSON 的 rootTitle 类型错误（数组）应返回 null', () => {
      const content = stringify({ rootTitle: ['主题'], branches: makeBranches(4) });
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('JSON 的 rootTitle 类型错误（对象）应返回 null', () => {
      const content = stringify({ rootTitle: { title: '主题' }, branches: makeBranches(4) });
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('输入为 null 应返回 null', () => {
      expect(parseMapOutlineJson(null as unknown as string)).toBeNull();
    });

    it('输入为 undefined 应返回 null', () => {
      expect(parseMapOutlineJson(undefined as unknown as string)).toBeNull();
    });
  });

  describe('分支数量限制', () => {
    it('分支数量为 4 应正常返回（达到下限）', () => {
      const content = stringify({ rootTitle: '主题', branches: makeBranches(4) });
      const result = parseMapOutlineJson(content);
      expect(result?.branches).toHaveLength(4);
    });

    it('分支数量为 6 应正常返回（达到上限）', () => {
      const content = stringify({ rootTitle: '主题', branches: makeBranches(6) });
      const result = parseMapOutlineJson(content);
      expect(result?.branches).toHaveLength(6);
    });

    it('分支数量为 5 应正常返回（在下限与上限之间）', () => {
      const content = stringify({ rootTitle: '主题', branches: makeBranches(5) });
      const result = parseMapOutlineJson(content);
      expect(result?.branches).toHaveLength(5);
    });

    it('分支数量 < 4（3 个有效）应返回 null', () => {
      const content = stringify({ rootTitle: '主题', branches: makeBranches(3) });
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('分支数量 < 4（1 个有效）应返回 null', () => {
      const content = stringify({ rootTitle: '主题', branches: makeBranches(1) });
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('分支数量 > 6（7 个）应截取前 6 个', () => {
      const content = stringify({ rootTitle: '主题', branches: makeBranches(7) });
      const result = parseMapOutlineJson(content);
      expect(result?.branches).toHaveLength(6);
      expect(result?.branches[0].title).toBe('分支1');
      expect(result?.branches[5].title).toBe('分支6');
    });

    it('超长输入（1000 个分支）应截取前 6 个', () => {
      const content = stringify({ rootTitle: '主题', branches: makeBranches(1000) });
      const result = parseMapOutlineJson(content);
      expect(result?.branches).toHaveLength(6);
      expect(result?.branches[0].title).toBe('分支1');
      expect(result?.branches[5].title).toBe('分支6');
    });

    it('过滤无效分支后数量仍超上限应截取前 6 个', () => {
      // 输入 8 个分支，其中 2 个无效，6 个有效 → 截取后 6 个
      const content = stringify({
        rootTitle: '主题',
        branches: [
          ...makeBranches(6),
          { title: '', description: '无效1' },
          { description: '无效2' },
        ],
      });
      const result = parseMapOutlineJson(content);
      expect(result?.branches).toHaveLength(6);
    });

    it('过滤无效分支后数量不足下限应返回 null', () => {
      // 输入 5 个分支，其中 3 个无效，2 个有效 → 有效数 2 < 4 → null
      const content = stringify({
        rootTitle: '主题',
        branches: [
          { title: '有效1', description: '描述1' },
          { title: '有效2', description: '描述2' },
          { title: '', description: '无效1' },
          { description: '无效2' },
          { title: '', description: '无效3' },
        ],
      });
      expect(parseMapOutlineJson(content)).toBeNull();
    });
  });

  describe('边界情况', () => {
    it('仅含花括号的字符串应返回 null', () => {
      expect(parseMapOutlineJson('{}')).toBeNull();
    });

    it('多分支大纲应全部保留（6 个）', () => {
      const branches = [1, 2, 3, 4, 5, 6].map((i) => `{"title":"分支${i}","description":"描述${i}"}`).join(',');
      const content = `{"rootTitle":"主题","branches":[${branches}]}`;
      const result = parseMapOutlineJson(content);
      expect(result?.branches).toHaveLength(6);
    });

    it('description 为非字符串类型时应置空', () => {
      const content = stringify({
        rootTitle: '主题',
        branches: Array.from({ length: 4 }, (_, i) => ({
          title: `分支${i + 1}`,
          description: 123,
        })),
      });
      const result = parseMapOutlineJson(content);
      expect(result?.branches[0].description).toBe('');
    });

    it('branch 为非对象类型时应被过滤（剩余不足下限返回 null）', () => {
      // 输入 4 个分支，3 个为字符串/数字/null，1 个有效 → 有效数 1 < 4 → null
      const content = stringify({
        rootTitle: '主题',
        branches: ['字符串', 123, null, { title: '有效', description: '描述' }],
      });
      expect(parseMapOutlineJson(content)).toBeNull();
    });

    it('branch 为非对象类型时应被过滤（剩余满足下限返回有效结果）', () => {
      // 输入 6 个分支，2 个为字符串/数字，4 个有效 → 有效数 4 → 正常返回
      const content = stringify({
        rootTitle: '主题',
        branches: [
          '字符串',
          123,
          { title: '有效1', description: '描述1' },
          { title: '有效2', description: '描述2' },
          { title: '有效3', description: '描述3' },
          { title: '有效4', description: '描述4' },
        ],
      });
      const result = parseMapOutlineJson(content);
      expect(result?.branches).toHaveLength(4);
      expect(result?.branches[0].title).toBe('有效1');
    });

    it('分支描述含嵌套 JSON 字符串时应正确解析', () => {
      // 使用 JSON.stringify 构造合法 JSON，description 值为 JSON 字符串
      const data = {
        rootTitle: '主题',
        branches: Array.from({ length: 4 }, (_, i) => ({
          title: `分支${i + 1}`,
          description: '{"nested":true}',
        })),
      };
      const content = JSON.stringify(data);
      const result = parseMapOutlineJson(content);
      expect(result?.rootTitle).toBe('主题');
      expect(result?.branches[0].title).toBe('分支1');
      expect(result?.branches[0].description).toBe('{"nested":true}');
    });

    it('分支 title 含特殊字符（引号、反斜杠）应正确解析', () => {
      // 构造包含双引号和反斜杠的 title，验证 JSON 转义正常工作
      const content = stringify({
        rootTitle: '主题',
        branches: [
          { title: '分支"引号"', description: '描述1' },
          { title: '分支\\反斜杠', description: '描述2' },
          { title: '分支3', description: '描述3' },
          { title: '分支4', description: '描述4' },
        ],
      });
      const result = parseMapOutlineJson(content);
      expect(result?.branches).toHaveLength(4);
      expect(result?.branches[0].title).toBe('分支"引号"');
      expect(result?.branches[1].title).toBe('分支\\反斜杠');
    });

    it('多个 JSON 对象串联应提取第一个', () => {
      const first = stringify({ rootTitle: '第一个', branches: makeBranches(4) });
      const second = stringify({ rootTitle: '第二个', branches: makeBranches(4) });
      const content = first + '\n' + second;
      const result = parseMapOutlineJson(content);
      expect(result?.rootTitle).toBe('第一个');
    });
  });

  describe('Markdown 代码块正则修复', () => {
    it('应正确解析无语言标记的 ``` 代码块', () => {
      const content = '```\n' + stringify({ rootTitle: '主题', branches: makeBranches(4) }) + '\n```';
      const result = parseMapOutlineJson(content);
      expect(result?.rootTitle).toBe('主题');
    });

    it('应正确解析 JSON 代码块（小写）', () => {
      const content = '```json\n' + stringify({ rootTitle: '主题', branches: makeBranches(4) }) + '\n```';
      const result = parseMapOutlineJson(content);
      expect(result?.rootTitle).toBe('主题');
    });

    it('应正确解析 JSON 代码块（大写）', () => {
      const content = '```JSON\n' + stringify({ rootTitle: '主题', branches: makeBranches(4) }) + '\n```';
      const result = parseMapOutlineJson(content);
      expect(result?.rootTitle).toBe('主题');
    });

    it('JSON 值中合法包含 ``` 字符时不应误删', () => {
      // 构造 description 中包含 ``` 的合法 JSON，验证新的正则不会误删
      const data = {
        rootTitle: '主题',
        branches: [
          { title: '分支1', description: '代码：```code```' },
          { title: '分支2', description: '描述2' },
          { title: '分支3', description: '描述3' },
          { title: '分支4', description: '描述4' },
        ],
      };
      const content = stringify(data);
      const result = parseMapOutlineJson(content);
      expect(result?.branches[0].description).toBe('代码：```code```');
    });

    it('Markdown 代码块包裹且 JSON 值中含 ``` 应正确解析', () => {
      // 整体被 ``` 包裹，且 description 中也含 ```
      const data = {
        rootTitle: '主题',
        branches: [
          { title: '分支1', description: '```code```' },
          { title: '分支2', description: '描述2' },
          { title: '分支3', description: '描述3' },
          { title: '分支4', description: '描述4' },
        ],
      };
      const content = '```json\n' + stringify(data) + '\n```';
      const result = parseMapOutlineJson(content);
      expect(result?.rootTitle).toBe('主题');
      expect(result?.branches[0].description).toBe('```code```');
    });
  });
});
