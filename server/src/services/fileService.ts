import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { mongoDBService } from '../data/mongodb/connection';

/**
 * 工作区文件信息接口
 */
export interface WorkspaceFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  workspaceId: string;
  uploadedBy: string;
  createdAt: Date;
  extractedText?: string;
}

/**
 * 文件解析结果接口
 */
interface ParsedFileContent {
  text: string;
  truncated: boolean;
  charCount: number;
}

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const MAX_TEXT_LENGTH = 200000;
const COLLECTION_NAME = 'workspace_files';

/**
 * 文件头 magic bytes 校验映射表
 * 每项包含 MIME 类型与对应的文件头字节序列
 */
interface MagicBytesRule {
  /** MIME 类型 */
  mime: string;
  /** 文件头 magic bytes（十六进制字节序列） */
  signature: number[];
}

/**
 * 已知文件类型的 magic bytes 规则列表
 * 覆盖 JPEG、PNG、GIF、PDF 等具有固定文件头的类型
 */
const MAGIC_BYTES_RULES: MagicBytesRule[] = [
  { mime: 'image/jpeg', signature: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/gif', signature: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'application/pdf', signature: [0x25, 0x50, 0x44, 0x46] },
];

/**
 * 文本类 MIME 类型集合
 * 这些类型无固定文件头，通过可打印文本检查进行校验
 */
const TEXT_MIME_TYPES: ReadonlySet<string> = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'text/xml',
  'application/json',
  'application/xml',
  'application/javascript',
  'application/typescript',
  'application/x-yaml',
]);

/**
 * 校验缓冲区内容是否为可打印文本
 * 通过检查前 16 字节是否包含空字节或非法控制字符来判断
 * @param buffer - 文件头字节缓冲区
 * @returns 是否为可打印文本（true=是，false=否）
 */
function isPrintableText(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    // 允许制表符、换行符、回车符
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d) continue;
    // 允许可打印 ASCII 字符（0x20 - 0x7E）
    if (byte >= 0x20 && byte <= 0x7e) continue;
    // 允许 UTF-8 多字节序列的高位字节
    if (byte >= 0x80) continue;
    // 空字节或其他控制字符 → 判定为二进制文件
    return false;
  }
  return true;
}

/**
 * 校验文件 magic bytes 是否与声明的 MIME 类型匹配
 * 读取 buffer 前 16 字节进行文件头校验，覆盖项目允许的文件类型：
 * - JPEG（FF D8 FF）、PNG（89 50 4E 47...）、GIF（47 49 46 38）、PDF（25 50 44 46）进行严格 magic bytes 匹配
 * - 文本类文件（text/plain、text/markdown、application/json 等）检查是否为可打印文本
 * - 其他类型（doc/docx/xls/xlsx 等）无简单可校验的文件头，允许通过
 * @param buffer - 文件前 16 字节缓冲区
 * @param declaredMime - 浏览器声明的 MIME 类型
 * @returns 校验是否通过（true=通过，false=不通过）
 */
export function verifyFileSignature(buffer: Buffer, declaredMime: string): boolean {
  // 空缓冲区直接拒绝
  if (buffer.length === 0) return false;

  // 检查是否有对应的 magic bytes 规则
  const rule = MAGIC_BYTES_RULES.find((r) => r.mime === declaredMime);
  if (rule) {
    // 缓冲区长度不足，无法校验
    if (buffer.length < rule.signature.length) return false;
    // 逐字节比对文件头
    for (let i = 0; i < rule.signature.length; i++) {
      if (buffer[i] !== rule.signature[i]) return false;
    }
    return true;
  }

  // 文本类文件：检查是否为可打印文本
  if (TEXT_MIME_TYPES.has(declaredMime)) {
    return isPrintableText(buffer);
  }

  // 其他类型（doc/docx/xls/xlsx 等）无简单可校验的文件头，允许通过
  return true;
}

/**
 * 文件服务类
 * 管理工作区文件的上传、存储、解析和检索
 */
class FileService {

  /**
   * 初始化文件服务
   * 确保上传目录和数据库索引存在
   */
  async initialize(): Promise<void> {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const col = mongoDBService.getCollection(COLLECTION_NAME);
    if (col) {
      await col.createIndex({ workspaceId: 1 });
      await col.createIndex({ id: 1 }, { unique: true });
    }
  }

  /**
   * 保存文件记录到数据库
   * @param file - 文件信息
   */
  async saveFileRecord(file: WorkspaceFile): Promise<void> {
    await mongoDBService.insertOne(COLLECTION_NAME, file);
  }

  /**
   * 获取工作区所有文件列表
   * @param workspaceId - 工作区ID
   * @returns 文件列表（不含提取的文本内容，减少传输量）
   */
  async getFilesByWorkspace(workspaceId: string): Promise<Array<Omit<WorkspaceFile, 'extractedText'>>> {
    const files = await mongoDBService.find(COLLECTION_NAME, { workspaceId }, { sort: { createdAt: -1 } });
    if (!files) return [];

    return files.map((f: Record<string, unknown>) => {
      const { extractedText, ...rest } = f;
      void extractedText;
      return rest as Omit<WorkspaceFile, 'extractedText'>;
    });
  }

  /**
   * 获取单个文件信息
   * @param fileId - 文件ID
   * @returns 文件信息（含提取的文本）
   */
  async getFileById(fileId: string): Promise<WorkspaceFile | null> {
    return await mongoDBService.findOne<WorkspaceFile>(COLLECTION_NAME, { id: fileId });
  }

  /**
   * 获取多个文件的提取文本（用于AI对话上下文）
   * @param fileIds - 文件ID列表
   * @returns 文件文本内容列表
   */
  async getFilesTextForContext(fileIds: string[]): Promise<Array<{ filename: string; text: string }>> {
    if (fileIds.length === 0) return [];

    const files = await mongoDBService.find<WorkspaceFile>(COLLECTION_NAME, { id: { $in: fileIds } });
    if (!files) return [];

    return files.map((f: WorkspaceFile) => ({
      filename: f.originalName || f.filename,
      text: f.extractedText || '',
    }));
  }

  /**
   * 删除文件
   * 同时删除数据库记录和本地文件
   * @param fileId - 文件ID
   * @param workspaceId - 工作区ID（用于权限校验）
   * @returns 是否删除成功
   */
  async deleteFile(fileId: string, workspaceId: string): Promise<boolean> {
    const file = await this.getFileById(fileId);
    if (!file || file.workspaceId !== workspaceId) return false;

    const filePath = path.join(UPLOAD_DIR, file.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return await mongoDBService.deleteOne(COLLECTION_NAME, { id: fileId });
  }

  /**
   * 获取文件本地路径
   * @param fileId - 文件ID
   * @returns 文件本地路径，不存在则返回null
   */
  async getFilePath(fileId: string): Promise<string | null> {
    const file = await this.getFileById(fileId);
    if (!file) return null;

    const filePath = path.join(UPLOAD_DIR, file.filename);
    if (!fs.existsSync(filePath)) return null;

    return filePath;
  }

  /**
   * 生成唯一文件名
   * @param originalName - 原始文件名
   * @returns 唯一文件名
   */
  generateFilename(originalName: string): string {
    const ext = path.extname(originalName);
    return `${uuidv4()}${ext}`;
  }

  /**
   * 解析文件内容，提取文本
   * 支持 PDF、Word、Excel、纯文本、代码文件等
   * @param filePath - 文件本地路径
   * @param mimeType - 文件MIME类型
   * @param originalName - 原始文件名
   * @returns 解析后的文本内容
   */
  async parseFile(filePath: string, mimeType: string, originalName: string): Promise<ParsedFileContent> {
    try {
      let text = '';

      if (mimeType === 'application/pdf') {
        text = await this.parsePdf(filePath);
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword'
      ) {
        text = await this.parseDocx(filePath);
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimeType === 'application/vnd.ms-excel'
      ) {
        text = await this.parseExcel(filePath);
      } else if (
        mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        mimeType === 'application/xml' ||
        mimeType === 'application/javascript' ||
        mimeType === 'application/typescript' ||
        mimeType === 'application/x-yaml'
      ) {
        text = this.parseTextFile(filePath);
      } else {
        const ext = path.extname(originalName).toLowerCase();
        const textExtensions = [
          '.txt', '.md', '.json', '.xml', '.yaml', '.yml',
          '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h',
          '.css', '.scss', '.less', '.html', '.htm',
          '.sh', '.bash', '.zsh', '.bat', '.ps1',
          '.sql', '.graphql', '.proto',
          '.toml', '.ini', '.cfg', '.conf', '.env',
          '.log', '.csv', '.tsv',
          '.rs', '.go', '.rb', '.php', '.swift', '.kt', '.scala',
          '.r', '.R', '.m', '.mm',
          '.vue', '.svelte',
        ];

        if (textExtensions.includes(ext)) {
          text = this.parseTextFile(filePath);
        } else {
          text = `[不支持的文件格式: ${ext || mimeType}，无法提取文本内容]`;
        }
      }

      const charCount = text.length;
      const truncated = charCount > MAX_TEXT_LENGTH;
      if (truncated) {
        text = text.substring(0, MAX_TEXT_LENGTH) + '\n\n[... 文件内容过长，已截断 ...]';
      }

      return { text, truncated, charCount };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        text: `[文件解析失败: ${msg}]`,
        truncated: false,
        charCount: 0,
      };
    }
  }

  /**
   * 解析PDF文件
   * @param filePath - 文件路径
   * @returns 提取的文本内容
   */
  private async parsePdf(filePath: string): Promise<string> {
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = (pdfParseModule as Record<string, unknown>).default || pdfParseModule;
    const dataBuffer = fs.readFileSync(filePath);
    const data = await (pdfParse as (buffer: Buffer) => Promise<{ text: string }>)(dataBuffer);
    return data.text || '';
  }

  /**
   * 解析Word文档(.docx)
   * @param filePath - 文件路径
   * @returns 提取的文本内容
   */
  private async parseDocx(filePath: string): Promise<string> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  }

  /**
   * 解析Excel文件(.xlsx)
   * @param filePath - 文件路径
   * @returns 提取的文本内容（表格形式）
   */
  private async parseExcel(filePath: string): Promise<string> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.readFile(filePath);
    const lines: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      lines.push(`=== 工作表: ${sheetName} ===`);
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
      for (const row of data) {
        if (Array.isArray(row)) {
          lines.push(row.map((cell: unknown) => String(cell ?? '')).join(' | '));
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 读取纯文本文件
   * @param filePath - 文件路径
   * @returns 文件文本内容
   */
  private parseTextFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
  }
}

export const fileService = new FileService();
