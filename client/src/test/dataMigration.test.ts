import { describe, it, expect } from 'vitest';

/**
 * 测试数据迁移函数
 */
const migrateNodeData = (node: Partial<Record<string, unknown>>): Record<string, unknown> => {
  return {
    ...node,
    hidden: node.hidden ?? false,
    expanded: node.expanded ?? true,
    compositeParent: node.compositeParent ?? undefined,
    compositeChildren: node.compositeChildren ?? undefined,
    tags: node.tags ?? [],
    summary: node.summary ?? '',
    parentIds: node.parentIds ?? [],
    childrenIds: node.childrenIds ?? []
  };
};

/**
 * 测试关系数据迁移函数
 */
const migrateRelationsData = (relations: unknown): unknown[] => {
  if (!relations) return [];

  if (!Array.isArray(relations)) return [];

  const arr = relations as unknown[];

  const firstItem = arr[0];
  if (Array.isArray(firstItem) && firstItem.length === 2) {
    return arr
      .map((entry) => (entry as [unknown, unknown])[1])
      .filter((r) => r && typeof r === 'object' &&
        Boolean((r as Record<string, unknown>).type && (r as Record<string, unknown>).id && (r as Record<string, unknown>).sourceId && (r as Record<string, unknown>).targetId));
  }

  return arr.filter((r) => r && typeof r === 'object' &&
    Boolean((r as Record<string, unknown>).type && (r as Record<string, unknown>).id && (r as Record<string, unknown>).sourceId && (r as Record<string, unknown>).targetId));
};

describe('Node Data Migration', () => {
  it('should add missing hidden property', () => {
    const node = { id: '1', title: 'Test' };
    const migrated = migrateNodeData(node);
    expect(migrated.hidden).toBe(false);
  });

  it('should preserve existing hidden property', () => {
    const node = { id: '1', title: 'Test', hidden: true };
    const migrated = migrateNodeData(node);
    expect(migrated.hidden).toBe(true);
  });

  it('should add missing expanded property', () => {
    const node = { id: '1', title: 'Test' };
    const migrated = migrateNodeData(node);
    expect(migrated.expanded).toBe(true);
  });

  it('should add missing tags array', () => {
    const node = { id: '1', title: 'Test' };
    const migrated = migrateNodeData(node);
    expect(migrated.tags).toEqual([]);
  });

  it('should preserve existing tags', () => {
    const node = { id: '1', title: 'Test', tags: ['tag1', 'tag2'] };
    const migrated = migrateNodeData(node);
    expect(migrated.tags).toEqual(['tag1', 'tag2']);
  });

  it('should add missing parentIds array', () => {
    const node = { id: '1', title: 'Test' };
    const migrated = migrateNodeData(node);
    expect(migrated.parentIds).toEqual([]);
  });

  it('should add missing childrenIds array', () => {
    const node = { id: '1', title: 'Test' };
    const migrated = migrateNodeData(node);
    expect(migrated.childrenIds).toEqual([]);
  });

  it('should handle composite node properties', () => {
    const node = { id: '1', title: 'Test', isComposite: true };
    const migrated = migrateNodeData(node);
    expect(migrated.compositeChildren).toBeUndefined();
    expect(migrated.compositeParent).toBeUndefined();
  });

  it('should preserve composite children', () => {
    const node = { id: '1', title: 'Test', compositeChildren: ['2', '3'] };
    const migrated = migrateNodeData(node);
    expect(migrated.compositeChildren).toEqual(['2', '3']);
  });
});

describe('Relations Data Migration', () => {
  it('should return empty array for null input', () => {
    const result = migrateRelationsData(null);
    expect(result).toEqual([]);
  });

  it('should return empty array for undefined input', () => {
    const result = migrateRelationsData(undefined);
    expect(result).toEqual([]);
  });

  it('should return empty array for non-array input', () => {
    const result = migrateRelationsData('not an array');
    expect(result).toEqual([]);
  });

  it('should filter out invalid relations', () => {
    const relations = [
      { id: '1', sourceId: 'a', targetId: 'b', type: 'parent-child' },
      { id: '2', sourceId: 'c', targetId: 'd' },
      { id: '3', sourceId: 'e', targetId: 'f', type: 'supports' },
      null,
      undefined,
    ];
    const result = migrateRelationsData(relations);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });

  it('should convert Map entries format to array', () => {
    const relations = [
      ['1', { id: '1', sourceId: 'a', targetId: 'b', type: 'parent-child' }],
      ['2', { id: '2', sourceId: 'c', targetId: 'd', type: 'supports' }],
    ];
    const result = migrateRelationsData(relations);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
  });

  it('should filter out invalid Map entries', () => {
    const relations = [
      ['1', { id: '1', sourceId: 'a', targetId: 'b', type: 'parent-child' }],
      ['2', { id: '2', sourceId: 'c', targetId: 'd' }],
      ['3', null],
    ];
    const result = migrateRelationsData(relations);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});

describe('ID Generation', () => {
  it('should generate unique IDs', () => {
    const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
    
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    
    expect(ids.size).toBe(100);
  });

  it('should generate IDs with correct format', () => {
    const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
    
    const id = generateId();
    const parts = id.split('-');
    
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[a-z0-9]+$/);
    expect(parts[1]).toMatch(/^[a-z0-9]+$/);
  });
});

describe('Node Position Calculation', () => {
  const calculateNodePosition = (
    parentNode: { position: { x: number; y: number } } | null,
    siblingIndex: number,
    siblingCount: number
  ): { x: number; y: number } => {
    if (!parentNode) {
      return { x: 400, y: 100 };
    }
    
    const offsetX = 280;
    const offsetY = 120;
    const spreadAngle = siblingCount > 1 ? 60 : 0;
    const angleStep = spreadAngle / (siblingCount - 1 || 1);
    const startAngle = -spreadAngle / 2;
    
    const angle = (startAngle + angleStep * siblingIndex) * Math.PI / 180;
    
    return {
      x: parentNode.position.x + offsetX,
      y: parentNode.position.y + Math.sin(angle) * offsetY * (siblingCount > 1 ? 1.5 : 0)
    };
  };

  it('should return default position for no parent', () => {
    const position = calculateNodePosition(null, 0, 1);
    expect(position.x).toBe(400);
    expect(position.y).toBe(100);
  });

  it('should position child to the right of parent', () => {
    const parent = { position: { x: 100, y: 100 } };
    const position = calculateNodePosition(parent, 0, 1);
    expect(position.x).toBe(380);
    expect(position.y).toBe(100);
  });

  it('should spread multiple children', () => {
    const parent = { position: { x: 100, y: 200 } };
    const positions = [
      calculateNodePosition(parent, 0, 3),
      calculateNodePosition(parent, 1, 3),
      calculateNodePosition(parent, 2, 3),
    ];
    
    expect(positions[0].x).toBe(380);
    expect(positions[0].y).toBeLessThan(200);
    expect(positions[1].y).toBe(200);
    expect(positions[2].y).toBeGreaterThan(200);
  });
});
