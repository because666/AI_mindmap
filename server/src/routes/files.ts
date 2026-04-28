import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileService } from '../services/fileService';
import { workspaceMemberAuth } from '../middleware';

const router = Router();

const MAX_FILE_SIZE = 100 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
];

const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.txt', '.md', '.csv', '.tsv',
  '.json', '.xml', '.yaml', '.yml',
  '.js', '.ts', '.jsx', '.tsx',
  '.py', '.java', '.c', '.cpp', '.h',
  '.css', '.scss', '.less', '.html', '.htm',
  '.sh', '.bash', '.bat', '.ps1',
  '.sql', '.graphql', '.proto',
  '.toml', '.ini', '.cfg', '.conf',
  '.rs', '.go', '.rb', '.php', '.swift', '.kt',
  '.vue', '.svelte',
];

/**
 * Multer 存储配置
 * 文件保存到本地 uploads 目录，使用唯一文件名
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = fileService.generateFilename(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10,
  },
});

/**
 * 上传文件到工作区
 * 支持多文件同时上传，上传后自动解析文件内容
 * 文件类型校验在上传后进行，不支持的类型返回错误
 */
router.post('/upload', workspaceMemberAuth, upload.array('files', 10) as unknown as import('express').RequestHandler, async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: '未选择文件' });
    }

    const workspaceId = req.workspaceId!;
    const visitorId = req.visitorId!;
    const results: Array<{ id: string; originalName: string; size: number; mimeType: string }> = [];
    const errors: Array<{ filename: string; error: string }> = [];

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const mimeAllowed = ALLOWED_MIME_TYPES.includes(file.mimetype);
      const extAllowed = ALLOWED_EXTENSIONS.includes(ext);

      if (!mimeAllowed && !extAllowed) {
        const filePath = file.path;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        errors.push({ filename: file.originalname, error: `不支持的文件类型: ${ext || file.mimetype}` });
        continue;
      }

      const fileId = `file_${uuidv4()}`;

      const parsedContent = await fileService.parseFile(
        file.path,
        file.mimetype,
        file.originalname
      );

      const fileRecord = {
        id: fileId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        workspaceId,
        uploadedBy: visitorId,
        createdAt: new Date(),
        extractedText: parsedContent.text,
      };

      await fileService.saveFileRecord(fileRecord);

      results.push({
        id: fileId,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
      });
    }

    res.json({ success: true, data: { uploaded: results, errors } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 获取工作区文件列表
 */
router.get('/list', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const files = await fileService.getFilesByWorkspace(req.workspaceId!);
    res.json({ success: true, data: files });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 获取单个文件信息
 */
router.get('/:fileId', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const file = await fileService.getFileById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ success: false, error: '文件不存在' });
    }
    if (file.workspaceId !== req.workspaceId) {
      return res.status(403).json({ success: false, error: '无权访问此文件' });
    }
    res.json({ success: true, data: file });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 下载文件
 */
router.get('/:fileId/download', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const file = await fileService.getFileById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ success: false, error: '文件不存在' });
    }
    if (file.workspaceId !== req.workspaceId) {
      return res.status(403).json({ success: false, error: '无权访问此文件' });
    }

    const filePath = await fileService.getFilePath(req.params.fileId);
    if (!filePath) {
      return res.status(404).json({ success: false, error: '文件已丢失' });
    }

    res.download(filePath, file.originalName);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 删除文件
 */
router.delete('/:fileId', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const success = await fileService.deleteFile(req.params.fileId, req.workspaceId!);
    if (!success) {
      return res.status(404).json({ success: false, error: '文件不存在或无权删除' });
    }
    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
