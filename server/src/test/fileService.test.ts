import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import type { WorkspaceFile } from '../services/fileService';

/**
 * 文件服务单元测试
 * 覆盖文件保存、查询、删除、解析等核心功能
 * 使用 vi.doMock + 动态导入模拟 mongoDBService、fs、uuid 及动态导入的解析库
 */

/** 模拟的 MongoDB Collection 方法集合 */
interface MockCollection {
  createIndex: ReturnType<typeof vi.fn>;
}

/** 模拟的 mongoDBService 方法集合 */
interface MockMongoDBService {
  isConnected: ReturnType<typeof vi.fn>;
  insertOne: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  updateOne: ReturnType<typeof vi.fn>;
  deleteOne: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  getCollection: ReturnType<typeof vi.fn>;
}

/** 模拟的 fs 模块方法集合 */
interface MockFs {
  existsSync: ReturnType<typeof vi.fn>;
  mkdirSync: ReturnType<typeof vi.fn>;
  unlinkSync: ReturnType<typeof vi.fn>;
  readFileSync: ReturnType<typeof vi.fn>;
}

/** 模拟的 mongoDBService 实例 */
let mockMongoDBService: MockMongoDBService;

/** 模拟的 Collection 实例 */
let mockCollection: MockCollection;

/** 模拟的 fs 模块 */
let mockFs: MockFs;

/** 测试用文件数据结构 */
interface TestFile extends WorkspaceFile {
  _id?: string;
}

/**
 * 创建测试用文件数据
 * @param overrides - 覆盖的文件属性
 * @returns 完整的测试文件数据
 */
function createTestFile(overrides: Partial<TestFile> = {}): TestFile {
  return {
    id: 'file-1',
    filename: 'uuid-1234.pdf',
    originalName: '测试文件.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    workspaceId: 'ws-1',
    uploadedBy: 'visitor-1',
    createdAt: new Date('2025-06-15T10:00:00.000Z'),
    extractedText: '文件提取的文本内容',
    ...overrides,
  };
}

describe('FileService 文件服务', () => {
  beforeEach(() => {
    vi.resetModules();

    mockCollection = {
      createIndex: vi.fn().mockResolvedValue('index-name'),
    };

    mockMongoDBService = {
      isConnected: vi.fn(() => true),
      insertOne: vi.fn().mockResolvedValue('inserted-id'),
      findOne: vi.fn(),
      find: vi.fn(),
      updateOne: vi.fn().mockResolvedValue(true),
      deleteOne: vi.fn().mockResolvedValue(true),
      deleteMany: vi.fn().mockResolvedValue(1),
      getCollection: vi.fn(() => mockCollection),
    };

    mockFs = {
      existsSync: vi.fn(() => true),
      mkdirSync: vi.fn(),
      unlinkSync: vi.fn(),
      readFileSync: vi.fn(() => Buffer.from('文件文本内容')),
    };

    vi.doMock('../data/mongodb/connection', () => ({
      mongoDBService: mockMongoDBService,
    }));

    vi.doMock('fs', () => ({
      ...mockFs,
      default: mockFs,
    }));

    vi.doMock('uuid', () => ({
      v4: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).substring(2, 8)),
    }));
  });

  afterEach(() => {
    vi.doUnmock('fs');
    vi.doUnmock('uuid');
    vi.doUnmock('../data/mongodb/connection');
  });

  /**
   * 动态导入 fileService，确保 mock 生效
   * 每次测试前重新导入以获取全新的实例
   * @returns fileService 实例
   */
  async function getService() {
    const mod = await import('../services/fileService');
    return mod.fileService;
  }

  describe('initialize - 初始化文件服务', () => {
    it('上传目录已存在时应跳过创建', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const service = await getService();
      await service.initialize();

      expect(mockFs.existsSync).toHaveBeenCalled();
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });

    it('上传目录不存在时应创建目录', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const service = await getService();
      await service.initialize();

      expect(mockFs.existsSync).toHaveBeenCalled();
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });

    it('MongoDB 连接时应创建索引', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const service = await getService();
      await service.initialize();

      expect(mockMongoDBService.getCollection).toHaveBeenCalledWith('workspace_files');
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ workspaceId: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ id: 1 }, { unique: true });
    });

    it('MongoDB 未连接时应跳过索引创建', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockMongoDBService.getCollection.mockReturnValue(null);

      const service = await getService();
      await service.initialize();

      expect(mockCollection.createIndex).not.toHaveBeenCalled();
    });
  });

  describe('saveFileRecord - 保存文件记录', () => {
    it('正常流程：应将文件记录写入数据库', async () => {
      const file = createTestFile();

      const service = await getService();
      await service.saveFileRecord(file);

      expect(mockMongoDBService.insertOne).toHaveBeenCalledWith('workspace_files', file);
    });

    it('MongoDB 未连接时 insertOne 返回 null 不应抛出异常', async () => {
      const file = createTestFile();
      mockMongoDBService.insertOne.mockResolvedValue(null);

      const service = await getService();
      // 不应抛出异常
      await expect(service.saveFileRecord(file)).resolves.toBeUndefined();
    });
  });

  describe('getFilesByWorkspace - 获取工作区文件列表', () => {
    it('正常流程：应返回工作区内所有文件（不含 extractedText）', async () => {
      const file1 = createTestFile({ id: 'file-1', extractedText: '文本1' });
      const file2 = createTestFile({
        id: 'file-2',
        originalName: '文件2.pdf',
        extractedText: '文本2',
      });
      mockMongoDBService.find.mockResolvedValue([file1, file2]);

      const service = await getService();
      const result = await service.getFilesByWorkspace('ws-1');

      expect(mockMongoDBService.find).toHaveBeenCalledWith(
        'workspace_files',
        { workspaceId: 'ws-1' },
        { sort: { createdAt: -1 } }
      );
      expect(result).toHaveLength(2);
      // extractedText 应被剥离
      expect(result[0]).not.toHaveProperty('extractedText');
      expect(result[1]).not.toHaveProperty('extractedText');
      expect(result[0].id).toBe('file-1');
      expect(result[1].id).toBe('file-2');
    });

    it('空工作区应返回空数组', async () => {
      mockMongoDBService.find.mockResolvedValue([]);

      const service = await getService();
      const result = await service.getFilesByWorkspace('ws-empty');

      expect(result).toEqual([]);
    });

    it('MongoDB 返回 null 应降级为空数组', async () => {
      mockMongoDBService.find.mockResolvedValue(null as unknown as never);

      const service = await getService();
      const result = await service.getFilesByWorkspace('ws-1');

      expect(result).toEqual([]);
    });
  });

  describe('getFileById - 获取单个文件', () => {
    it('正常流程：应返回文件信息（含 extractedText）', async () => {
      const file = createTestFile();
      mockMongoDBService.findOne.mockResolvedValue(file);

      const service = await getService();
      const result = await service.getFileById('file-1');

      expect(mockMongoDBService.findOne).toHaveBeenCalledWith('workspace_files', { id: 'file-1' });
      expect(result).toEqual(file);
      expect(result?.extractedText).toBe('文件提取的文本内容');
    });

    it('文件不存在时应返回 null', async () => {
      mockMongoDBService.findOne.mockResolvedValue(null);

      const service = await getService();
      const result = await service.getFileById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getFilesTextForContext - 获取文件文本上下文', () => {
    it('正常流程：应返回文件名和文本内容列表', async () => {
      const file1 = createTestFile({
        id: 'file-1',
        originalName: '文档1.pdf',
        extractedText: '文档1内容',
      });
      const file2 = createTestFile({
        id: 'file-2',
        originalName: '文档2.pdf',
        extractedText: '文档2内容',
      });
      mockMongoDBService.find.mockResolvedValue([file1, file2]);

      const service = await getService();
      const result = await service.getFilesTextForContext(['file-1', 'file-2']);

      expect(mockMongoDBService.find).toHaveBeenCalledWith('workspace_files', {
        id: { $in: ['file-1', 'file-2'] },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ filename: '文档1.pdf', text: '文档1内容' });
      expect(result[1]).toEqual({ filename: '文档2.pdf', text: '文档2内容' });
    });

    it('空文件 ID 列表应直接返回空数组（不查库）', async () => {
      const service = await getService();
      const result = await service.getFilesTextForContext([]);

      expect(result).toEqual([]);
      expect(mockMongoDBService.find).not.toHaveBeenCalled();
    });

    it('文件无 extractedText 时应返回空字符串', async () => {
      const file = createTestFile({ extractedText: undefined });
      mockMongoDBService.find.mockResolvedValue([file]);

      const service = await getService();
      const result = await service.getFilesTextForContext(['file-1']);

      expect(result[0].text).toBe('');
    });

    it('文件无 originalName 时应回退使用 filename', async () => {
      const file = createTestFile({
        originalName: '',
        filename: 'fallback-name.pdf',
      });
      mockMongoDBService.find.mockResolvedValue([file]);

      const service = await getService();
      const result = await service.getFilesTextForContext(['file-1']);

      expect(result[0].filename).toBe('fallback-name.pdf');
    });

    it('MongoDB 返回 null 应降级为空数组', async () => {
      mockMongoDBService.find.mockResolvedValue(null as unknown as never);

      const service = await getService();
      const result = await service.getFilesTextForContext(['file-1']);

      expect(result).toEqual([]);
    });
  });

  describe('deleteFile - 删除文件', () => {
    it('正常流程：应删除数据库记录和本地文件', async () => {
      const file = createTestFile();
      mockMongoDBService.findOne.mockResolvedValue(file);
      mockFs.existsSync.mockReturnValue(true);

      const service = await getService();
      const result = await service.deleteFile('file-1', 'ws-1');

      expect(result).toBe(true);
      expect(mockMongoDBService.deleteOne).toHaveBeenCalledWith('workspace_files', { id: 'file-1' });
      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('文件不存在时应返回 false', async () => {
      mockMongoDBService.findOne.mockResolvedValue(null);

      const service = await getService();
      const result = await service.deleteFile('nonexistent', 'ws-1');

      expect(result).toBe(false);
      expect(mockMongoDBService.deleteOne).not.toHaveBeenCalled();
    });

    it('工作区 ID 不匹配时应返回 false（权限校验）', async () => {
      const file = createTestFile({ workspaceId: 'ws-1' });
      mockMongoDBService.findOne.mockResolvedValue(file);

      const service = await getService();
      const result = await service.deleteFile('file-1', 'ws-other');

      expect(result).toBe(false);
      expect(mockMongoDBService.deleteOne).not.toHaveBeenCalled();
    });

    it('本地文件不存在时应仅删除数据库记录', async () => {
      const file = createTestFile();
      mockMongoDBService.findOne.mockResolvedValue(file);
      mockFs.existsSync.mockReturnValue(false);

      const service = await getService();
      const result = await service.deleteFile('file-1', 'ws-1');

      expect(result).toBe(true);
      expect(mockMongoDBService.deleteOne).toHaveBeenCalledWith('workspace_files', { id: 'file-1' });
      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });

    it('数据库删除失败时应返回 false', async () => {
      const file = createTestFile();
      mockMongoDBService.findOne.mockResolvedValue(file);
      mockMongoDBService.deleteOne.mockResolvedValue(false);

      const service = await getService();
      const result = await service.deleteFile('file-1', 'ws-1');

      expect(result).toBe(false);
    });
  });

  describe('getFilePath - 获取文件路径', () => {
    it('正常流程：应返回文件本地路径', async () => {
      const file = createTestFile({ filename: 'test.pdf' });
      mockMongoDBService.findOne.mockResolvedValue(file);
      mockFs.existsSync.mockReturnValue(true);

      const service = await getService();
      const result = await service.getFilePath('file-1');

      expect(result).not.toBeNull();
      expect(result).toContain('test.pdf');
    });

    it('文件不存在时应返回 null', async () => {
      mockMongoDBService.findOne.mockResolvedValue(null);

      const service = await getService();
      const result = await service.getFilePath('nonexistent');

      expect(result).toBeNull();
    });

    it('本地文件不存在时应返回 null', async () => {
      const file = createTestFile();
      mockMongoDBService.findOne.mockResolvedValue(file);
      mockFs.existsSync.mockReturnValue(false);

      const service = await getService();
      const result = await service.getFilePath('file-1');

      expect(result).toBeNull();
    });
  });

  describe('generateFilename - 生成文件名', () => {
    it('应保留原文件扩展名并生成 UUID 文件名', async () => {
      const service = await getService();
      const result = service.generateFilename('文档.pdf');

      expect(result).toMatch(/^mock-uuid-.+\.pdf$/);
    });

    it('无扩展名的文件应仅返回 UUID', async () => {
      const service = await getService();
      const result = service.generateFilename('无扩展名文件');

      expect(result).toMatch(/^mock-uuid-.+$/);
      expect(result).not.toContain('.');
    });

    it('多次调用应生成不同的文件名', async () => {
      const service = await getService();
      const name1 = service.generateFilename('test.txt');
      const name2 = service.generateFilename('test.txt');

      expect(name1).not.toBe(name2);
    });
  });

  describe('parseFile - 解析文件内容', () => {
    it('解析纯文本文件应返回文件内容', async () => {
      mockFs.readFileSync.mockReturnValue('Hello World');

      const service = await getService();
      const result = await service.parseFile('/path/to/file.txt', 'text/plain', 'file.txt');

      expect(result.text).toBe('Hello World');
      expect(result.truncated).toBe(false);
      expect(result.charCount).toBe(11);
    });

    it('解析 Markdown 文件应返回文件内容', async () => {
      mockFs.readFileSync.mockReturnValue('# 标题\n内容');

      const service = await getService();
      const result = await service.parseFile('/path/to/file.md', 'text/markdown', 'file.md');

      expect(result.text).toBe('# 标题\n内容');
      expect(result.truncated).toBe(false);
    });

    it('解析 JSON 文件应返回文件内容', async () => {
      mockFs.readFileSync.mockReturnValue('{"key":"value"}');

      const service = await getService();
      const result = await service.parseFile('/path/to/file.json', 'application/json', 'file.json');

      expect(result.text).toBe('{"key":"value"}');
    });

    it('解析 XML 文件应返回文件内容', async () => {
      mockFs.readFileSync.mockReturnValue('<root></root>');

      const service = await getService();
      const result = await service.parseFile('/path/to/file.xml', 'application/xml', 'file.xml');

      expect(result.text).toBe('<root></root>');
    });

    it('解析 JavaScript 文件应返回文件内容', async () => {
      mockFs.readFileSync.mockReturnValue('const x = 1;');

      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.js',
        'application/javascript',
        'file.js'
      );

      expect(result.text).toBe('const x = 1;');
    });

    it('解析 YAML 文件应返回文件内容', async () => {
      mockFs.readFileSync.mockReturnValue('key: value');

      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.yaml',
        'application/x-yaml',
        'file.yaml'
      );

      expect(result.text).toBe('key: value');
    });

    it('未知 MIME 类型但扩展名为 .py 应按文本文件解析', async () => {
      mockFs.readFileSync.mockReturnValue('print("hello")');

      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.py',
        'application/octet-stream',
        'file.py'
      );

      expect(result.text).toBe('print("hello")');
    });

    it('未知 MIME 类型且扩展名为 .py 应按文本文件解析（大小写不敏感）', async () => {
      mockFs.readFileSync.mockReturnValue('print("hello")');

      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.PY',
        'application/octet-stream',
        'file.PY'
      );

      expect(result.text).toBe('print("hello")');
    });

    it('不支持的文件格式应返回提示信息', async () => {
      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.bin',
        'application/octet-stream',
        'file.bin'
      );

      expect(result.text).toContain('不支持的文件格式');
      expect(result.truncated).toBe(false);
      expect(result.charCount).toBe(result.text.length);
    });

    it('文件内容超过最大长度时应截断并标记 truncated', async () => {
      // 生成超过 200000 字符的超长文本
      const longText = 'a'.repeat(250000);
      mockFs.readFileSync.mockReturnValue(longText);

      const service = await getService();
      const result = await service.parseFile('/path/to/file.txt', 'text/plain', 'file.txt');

      expect(result.truncated).toBe(true);
      expect(result.charCount).toBe(250000);
      expect(result.text.length).toBeLessThan(250000);
      expect(result.text).toContain('文件内容过长，已截断');
    });

    it('解析失败时应返回错误信息且不抛出异常', async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('读取文件失败');
      });

      const service = await getService();
      const result = await service.parseFile('/path/to/file.txt', 'text/plain', 'file.txt');

      expect(result.text).toContain('文件解析失败');
      expect(result.text).toContain('读取文件失败');
      expect(result.truncated).toBe(false);
      expect(result.charCount).toBe(0);
    });

    it('解析抛出非 Error 对象时应安全处理', async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw '字符串错误'; // eslint-disable-line no-throw-literal
      });

      const service = await getService();
      const result = await service.parseFile('/path/to/file.txt', 'text/plain', 'file.txt');

      expect(result.text).toContain('文件解析失败');
      expect(result.text).toContain('字符串错误');
    });
  });

  describe('parseFile - PDF 解析', () => {
    it('应调用 pdf-parse 解析 PDF 文件', async () => {
      // 模拟 pdf-parse 模块
      vi.doMock('pdf-parse', () => ({
        default: vi.fn().mockResolvedValue({ text: 'PDF 文本内容' }),
      }));

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf'));

      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.pdf',
        'application/pdf',
        'file.pdf'
      );

      expect(result.text).toBe('PDF 文本内容');
      expect(result.truncated).toBe(false);
    });

    it('PDF 解析返回空文本时应返回空字符串', async () => {
      vi.doMock('pdf-parse', () => ({
        default: vi.fn().mockResolvedValue({ text: '' }),
      }));

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf'));

      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.pdf',
        'application/pdf',
        'file.pdf'
      );

      expect(result.text).toBe('');
    });

    it('PDF 解析失败时应返回错误信息', async () => {
      vi.doMock('pdf-parse', () => ({
        default: vi.fn().mockRejectedValue(new Error('PDF 解析失败')),
      }));

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf'));

      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.pdf',
        'application/pdf',
        'file.pdf'
      );

      expect(result.text).toContain('文件解析失败');
      expect(result.text).toContain('PDF 解析失败');
    });

    it('pdf-parse 模块无 default 导出时应使用模块本身', async () => {
      // 模拟模块无 default 导出的情况
      vi.doMock('pdf-parse', () => ({
        text: 'not a function',
      }));

      mockFs.readFileSync.mockReturnValue(Buffer.from('fake pdf'));

      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.pdf',
        'application/pdf',
        'file.pdf'
      );

      // 应进入 catch 分支，返回错误信息
      expect(result.text).toContain('文件解析失败');
    });
  });

  describe('parseFile - Word 文档解析', () => {
    it('应调用 mammoth 解析 DOCX 文件', async () => {
      vi.doMock('mammoth', () => ({
        extractRawText: vi.fn().mockResolvedValue({ value: 'Word 文本内容' }),
      }));

      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'file.docx'
      );

      expect(result.text).toBe('Word 文本内容');
    });

    it('应调用 mammoth 解析 DOC 文件', async () => {
      vi.doMock('mammoth', () => ({
        extractRawText: vi.fn().mockResolvedValue({ value: 'DOC 文本内容' }),
      }));

      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.doc',
        'application/msword',
        'file.doc'
      );

      expect(result.text).toBe('DOC 文本内容');
    });

    it('Word 解析返回空文本时应返回空字符串', async () => {
      vi.doMock('mammoth', () => ({
        extractRawText: vi.fn().mockResolvedValue({ value: '' }),
      }));

      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'file.docx'
      );

      expect(result.text).toBe('');
    });

    it('Word 解析失败时应返回错误信息', async () => {
      vi.doMock('mammoth', () => ({
        extractRawText: vi.fn().mockRejectedValue(new Error('Word 解析失败')),
      }));

      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'file.docx'
      );

      expect(result.text).toContain('文件解析失败');
      expect(result.text).toContain('Word 解析失败');
    });
  });

  describe('parseFile - Excel 解析', () => {
    it('应调用 xlsx 解析 XLSX 文件', async () => {
      vi.doMock('xlsx', () => ({
        readFile: vi.fn().mockReturnValue({
          SheetNames: ['Sheet1'],
          Sheets: {
            Sheet1: { A1: { t: 's', v: '单元格内容' } },
          },
        }),
        utils: {
          sheet_to_json: vi.fn().mockReturnValue([['单元格内容']]),
        },
      }));

      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'file.xlsx'
      );

      expect(result.text).toContain('工作表: Sheet1');
      expect(result.text).toContain('单元格内容');
    });

    it('应调用 xlsx 解析 XLS 文件', async () => {
      vi.doMock('xlsx', () => ({
        readFile: vi.fn().mockReturnValue({
          SheetNames: ['数据'],
          Sheets: {
            数据: {},
          },
        }),
        utils: {
          sheet_to_json: vi.fn().mockReturnValue([['A', 'B'], ['1', '2']]),
        },
      }));

      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.xls',
        'application/vnd.ms-excel',
        'file.xls'
      );

      expect(result.text).toContain('工作表: 数据');
      expect(result.text).toContain('A | B');
      expect(result.text).toContain('1 | 2');
    });

    it('Excel 多个工作表应全部解析', async () => {
      vi.doMock('xlsx', () => ({
        readFile: vi.fn().mockReturnValue({
          SheetNames: ['Sheet1', 'Sheet2'],
          Sheets: {
            Sheet1: {},
            Sheet2: {},
          },
        }),
        utils: {
          sheet_to_json: vi.fn()
            .mockReturnValueOnce([['S1-A']])
            .mockReturnValueOnce([['S2-A']]),
        },
      }));

      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'file.xlsx'
      );

      expect(result.text).toContain('工作表: Sheet1');
      expect(result.text).toContain('工作表: Sheet2');
      expect(result.text).toContain('S1-A');
      expect(result.text).toContain('S2-A');
    });

    it('Excel 解析失败时应返回错误信息', async () => {
      vi.doMock('xlsx', () => ({
        readFile: vi.fn().mockImplementation(() => {
          throw new Error('Excel 解析失败');
        }),
        utils: {},
      }));

      const service = await getService();
      const result = await service.parseFile(
        '/path/to/file.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'file.xlsx'
      );

      expect(result.text).toContain('文件解析失败');
      expect(result.text).toContain('Excel 解析失败');
    });
  });

  describe('边界情况', () => {
    it('解析文件路径为空字符串时不应崩溃', async () => {
      mockFs.readFileSync.mockReturnValue('内容');

      const service = await getService();
      const result = await service.parseFile('', 'text/plain', 'file.txt');

      // 应正常返回，不崩溃
      expect(result.text).toBe('内容');
    });

    it('解析文件 MIME 类型为空字符串时应进入扩展名判断', async () => {
      mockFs.readFileSync.mockReturnValue('print("hello")');

      const service = await getService();
      const result = await service.parseFile('/path/to/file.py', '', 'file.py');

      expect(result.text).toBe('print("hello")');
    });

    it('解析文件名无扩展名且 MIME 未知时应返回不支持提示', async () => {
      const service = await getService();
      const result = await service.parseFile('/path/to/file', 'application/octet-stream', 'file');

      expect(result.text).toContain('不支持的文件格式');
    });

    it('文件内容恰好等于最大长度时不应截断', async () => {
      // MAX_TEXT_LENGTH = 200000，恰好 200000 字符不应截断
      const exactText = 'a'.repeat(200000);
      mockFs.readFileSync.mockReturnValue(exactText);

      const service = await getService();
      const result = await service.parseFile('/path/to/file.txt', 'text/plain', 'file.txt');

      expect(result.truncated).toBe(false);
      expect(result.charCount).toBe(200000);
      expect(result.text).toBe(exactText);
    });

    it('文件内容超过最大长度 1 字符时应截断', async () => {
      const overText = 'a'.repeat(200001);
      mockFs.readFileSync.mockReturnValue(overText);

      const service = await getService();
      const result = await service.parseFile('/path/to/file.txt', 'text/plain', 'file.txt');

      expect(result.truncated).toBe(true);
      expect(result.charCount).toBe(200001);
    });
  });
});
