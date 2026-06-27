/**
 * 模板数据单元测试
 *
 * 覆盖 BUILTIN_TEMPLATES 的结构完整性、关系索引合法性，
 * 以及 getTemplatesByCategory / getTemplateById 查询函数的正确性。
 */
import { describe, it, expect } from 'vitest';
import {
  BUILTIN_TEMPLATES,
  getTemplateById,
  getTemplatesByCategory,
} from './templates';

describe('内置模板数据 BUILTIN_TEMPLATES', () => {
  it('应包含 5 个模板', () => {
    expect(BUILTIN_TEMPLATES).toHaveLength(5);
  });

  it('每个模板应有唯一的 id', () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('每个模板至少有 1 个根节点（isRoot: true）', () => {
    for (const template of BUILTIN_TEMPLATES) {
      const rootCount = template.nodes.filter((n) => n.isRoot).length;
      expect(rootCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('每个模板有且仅有 1 个根节点', () => {
    for (const template of BUILTIN_TEMPLATES) {
      const rootCount = template.nodes.filter((n) => n.isRoot).length;
      expect(rootCount).toBe(1);
    }
  });

  it('每个模板至少有 3 个节点', () => {
    for (const template of BUILTIN_TEMPLATES) {
      expect(template.nodes.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('关系索引不应越界（source 与 target 均在 nodes 数组范围内）', () => {
    for (const template of BUILTIN_TEMPLATES) {
      const nodeCount = template.nodes.length;
      for (const relation of template.relations) {
        expect(relation.source).toBeGreaterThanOrEqual(0);
        expect(relation.source).toBeLessThan(nodeCount);
        expect(relation.target).toBeGreaterThanOrEqual(0);
        expect(relation.target).toBeLessThan(nodeCount);
      }
    }
  });

  it('每个模板的 name 与 description 非空', () => {
    for (const template of BUILTIN_TEMPLATES) {
      expect(template.name.trim().length).toBeGreaterThan(0);
      expect(template.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('每个模板的 icon 非空', () => {
    for (const template of BUILTIN_TEMPLATES) {
      expect(template.icon.trim().length).toBeGreaterThan(0);
    }
  });

  it('每个节点都有预置问题（presetQuestion）', () => {
    for (const template of BUILTIN_TEMPLATES) {
      for (const node of template.nodes) {
        expect(node.presetQuestion).toBeDefined();
        expect(typeof node.presetQuestion).toBe('string');
        expect((node.presetQuestion as string).trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('getTemplatesByCategory', () => {
  it('getTemplatesByCategory("guide") 应返回 1 个模板', () => {
    const result = getTemplatesByCategory('guide');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('guide-deepmindmap');
  });

  it('getTemplatesByCategory("learning") 应返回 2 个模板', () => {
    const result = getTemplatesByCategory('learning');
    expect(result).toHaveLength(2);
    const ids = result.map((t) => t.id).sort();
    expect(ids).toEqual(['learn-ml-basics', 'learn-python']);
  });

  it('getTemplatesByCategory("research") 未匹配时应返回空数组', () => {
    const result = getTemplatesByCategory('research');
    expect(result).toEqual([]);
  });
});

describe('getTemplateById', () => {
  it('getTemplateById("guide-deepmindmap") 应返回正确模板', () => {
    const result = getTemplateById('guide-deepmindmap');
    expect(result).toBeDefined();
    expect(result?.name).toBe('DeepMindMap 使用指南');
    expect(result?.icon).toBe('🗺️');
    expect(result?.category).toBe('guide');
  });

  it('getTemplateById("nonexistent") 应返回 undefined', () => {
    const result = getTemplateById('nonexistent');
    expect(result).toBeUndefined();
  });
});
