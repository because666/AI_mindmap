import { describe, expect, it } from 'vitest';
import { isBroadQuestion } from './broadQuestion';

/**
 * 宽泛问题检测工具单元测试
 * 覆盖正常流程、异常流程、边界情况
 */
describe('isBroadQuestion', () => {
  describe('边界情况', () => {
    it('空字符串应返回 false', () => {
      expect(isBroadQuestion('')).toBe(false);
    });

    it('纯空格输入应返回 false', () => {
      expect(isBroadQuestion('   ')).toBe(false);
    });

    it('长度小于 5 的输入应返回 false', () => {
      expect(isBroadQuestion('介绍')).toBe(false);
    });

    it('刚好 4 字符的输入应返回 false（低于下限 5）', () => {
      expect(isBroadQuestion('介绍一下')).toBe(false);
    });

    it('长度超过 80 的输入应返回 false', () => {
      const longInput = '介绍'.repeat(45);
      expect(longInput.length).toBeGreaterThan(80);
      expect(isBroadQuestion(longInput)).toBe(false);
    });

    it('刚好 80 字符的宽泛问题应返回 true（在上限内）', () => {
      // 构造正好 80 字符且包含宽泛词"介绍"的输入：2 + 4*19 + 2 = 80
      const input = '介绍' + '主题内容'.repeat(19) + '主题';
      expect(input.length).toBe(80);
      expect(isBroadQuestion(input)).toBe(true);
    });

    it('非字符串输入应返回 false', () => {
      expect(isBroadQuestion(null as unknown as string)).toBe(false);
      expect(isBroadQuestion(undefined as unknown as string)).toBe(false);
    });
  });

  describe('正常流程：宽泛关键词命中', () => {
    it('包含"什么是"应返回 true', () => {
      expect(isBroadQuestion('什么是机器学习')).toBe(true);
    });

    it('包含"介绍"应返回 true', () => {
      expect(isBroadQuestion('介绍一下深度学习')).toBe(true);
    });

    it('包含"如何学习"应返回 true', () => {
      expect(isBroadQuestion('如何学习前端开发')).toBe(true);
    });

    it('包含"概述"应返回 true', () => {
      expect(isBroadQuestion('区块链技术概述')).toBe(true);
    });

    it('包含"讲讲"应返回 true', () => {
      expect(isBroadQuestion('讲讲微服务架构')).toBe(true);
    });

    it('包含"入门"应返回 true', () => {
      expect(isBroadQuestion('Python入门指南')).toBe(true);
    });

    it('包含"全面"应返回 true', () => {
      expect(isBroadQuestion('全面了解人工智能')).toBe(true);
    });

    it('包含"体系"应返回 true', () => {
      expect(isBroadQuestion('前端知识体系')).toBe(true);
    });

    it('包含"包含哪些"应返回 true', () => {
      expect(isBroadQuestion('机器学习包含哪些内容')).toBe(true);
    });
  });

  describe('异常流程：具体细节词排除', () => {
    it('包含"代码"应返回 false（即使含宽泛词）', () => {
      expect(isBroadQuestion('介绍一下这段代码')).toBe(false);
    });

    it('包含"报错"应返回 false', () => {
      expect(isBroadQuestion('程序报错了怎么解决')).toBe(false);
    });

    it('包含"配置"应返回 false', () => {
      expect(isBroadQuestion('介绍下这个配置文件')).toBe(false);
    });

    it('包含"安装"应返回 false', () => {
      expect(isBroadQuestion('如何安装这个软件')).toBe(false);
    });

    it('包含"参数"应返回 false', () => {
      expect(isBroadQuestion('这个函数的参数怎么用')).toBe(false);
    });

    it('包含"api"应返回 false（大小写不敏感）', () => {
      expect(isBroadQuestion('介绍一下这个API的用法')).toBe(false);
    });

    it('包含"函数"应返回 false', () => {
      expect(isBroadQuestion('讲讲这个函数的实现')).toBe(false);
    });

    it('包含"语法"应返回 false', () => {
      expect(isBroadQuestion('详解一下这个语法')).toBe(false);
    });
  });

  describe('短句兜底逻辑', () => {
    it('不以问号结尾且长度 < 15 字应返回 true', () => {
      // 7 字，无宽泛词、无具体词、不以问号结尾，触发短句兜底
      expect(isBroadQuestion('前端开发工程师')).toBe(true);
    });

    it('以问号结尾的短句不应触发短句兜底（但可能命中关键词）', () => {
      // "什么是AI？" 长度 6，以问号结尾，但命中"什么是"关键词，仍应返回 true
      expect(isBroadQuestion('什么是AI？')).toBe(true);
    });

    it('不以问号结尾且长度 >= 15 字且无宽泛词应返回 false', () => {
      // 16 字无宽泛词、无具体词、不以问号结尾，不触发短句兜底
      expect(isBroadQuestion('明天我们一起去公园散步然后吃晚饭')).toBe(false);
    });

    it('以问号结尾且无宽泛词应返回 false（即使短句）', () => {
      // 长度 9，以问号结尾，无宽泛词，无具体词 -> 不触发短句兜底，返回 false
      expect(isBroadQuestion('今天的天气怎么样？')).toBe(false);
    });

    it('纯数字短句应返回 false（无中文字符不触发兜底）', () => {
      // 5 字纯数字，无中文，不应触发短句兜底
      expect(isBroadQuestion('12345')).toBe(false);
    });

    it('纯英文短句应返回 false（无中文字符不触发兜底）', () => {
      // 5 字纯英文，无中文，不应触发短句兜底
      expect(isBroadQuestion('abcde')).toBe(false);
    });

    it('纯标点短句应返回 false（无中文字符不触发兜底）', () => {
      // 4 字纯标点，无中文，长度低于下限，应返回 false
      expect(isBroadQuestion('。。。。')).toBe(false);
    });

    it('纯标点达到长度下限应返回 false（无中文字符不触发兜底）', () => {
      // 5 字纯标点，无中文，长度达到下限但无中文字符，不触发短句兜底
      expect(isBroadQuestion('。。？！。')).toBe(false);
    });

    it('包含至少 2 个中文字符的短句应返回 true（触发兜底，不要求连续）', () => {
      // 5 字纯中文，包含 2 个以上中文字符，长度达到下限，触发短句兜底
      expect(isBroadQuestion('你好世界啊')).toBe(true);
    });

    it('包含 2 个不连续中文字符的短句应返回 true（触发兜底）', () => {
      // 5 字符，包含 2 个不连续中文字符 "你" 和 "好"，触发短句兜底
      expect(isBroadQuestion('你ab好c')).toBe(true);
    });

    it('纯英文短句 "hello world" 应返回 false（无中文字符不触发兜底）', () => {
      // 11 字纯英文，无中文，不以问号结尾，长度 < 15 但无中文字符，不触发短句兜底
      expect(isBroadQuestion('hello world')).toBe(false);
    });

    it('纯英文长句无宽泛词应返回 false（长度在上限内但无中文兜底）', () => {
      // 20 字纯英文，无中文，不触发短句兜底，无宽泛词
      expect(isBroadQuestion('hello world test data')).toBe(false);
    });
  });

  describe('长度边界与关键词组合', () => {
    it('刚好 5 字符且包含宽泛词应返回 true', () => {
      // 6 字，包含宽泛词"介绍"
      expect(isBroadQuestion('介绍一下AI')).toBe(true);
    });

    it('刚好 5 字符无宽泛词无问号应返回 true（短句兜底）', () => {
      // 7 字，无宽泛词、无具体词、不以问号结尾，触发短句兜底
      expect(isBroadQuestion('前端开发工程师')).toBe(true);
    });

    it('长度 15 字符无宽泛词无问号应返回 false（达到短句阈值）', () => {
      // 构造正好 15 字符，无宽泛词、无具体词、不以问号结尾，短句兜底不触发
      const input = '明天我们去公园散步然后回家';
      expect(input.length).toBe(13);
      // 13 < 15 会触发短句兜底，补足到 15
      const input15 = input + '吃饭';
      expect(input15.length).toBe(15);
      expect(isBroadQuestion(input15)).toBe(false);
    });
  });
});
