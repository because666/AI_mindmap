import { describe, it, expect, vi } from 'vitest';

// 模拟 MongoDB 连接，避免测试时触发真实数据库连接
vi.mock('../data/mongodb/connection', () => ({
  mongoDBService: {},
}));

import { verifyFileSignature } from '../services/fileService';

/**
 * 构造指定文件头前缀并填充至 16 字节的缓冲区
 * @param prefix - 文件头 magic bytes 字节数组
 * @returns 16 字节的 Buffer（不足部分用 0x00 填充）
 */
function makeHeader(prefix: number[]): Buffer {
  const buf = Buffer.alloc(16, 0x00);
  for (let i = 0; i < prefix.length && i < 16; i++) {
    buf[i] = prefix[i];
  }
  return buf;
}

/**
 * 构造纯文本缓冲区（16 字节）
 * @param text - 文本内容
 * @returns 16 字节的 Buffer（不足部分用空格填充，超出截断）
 */
function makeTextHeader(text: string): Buffer {
  const textBuf = Buffer.from(text, 'utf-8');
  const buf = Buffer.alloc(16, 0x20); // 用空格填充
  textBuf.copy(buf, 0, 0, Math.min(textBuf.length, 16));
  return buf;
}

describe('verifyFileSignature - magic bytes 校验', () => {
  describe('JPEG 文件校验', () => {
    it('真实 JPEG 文件头（FF D8 FF）应通过校验', () => {
      const header = makeHeader([0xff, 0xd8, 0xff, 0xe0]);
      expect(verifyFileSignature(header, 'image/jpeg')).toBe(true);
    });

    it('JPEG 文件头 FF D8 FF E1（EXIF）应通过校验', () => {
      const header = makeHeader([0xff, 0xd8, 0xff, 0xe1]);
      expect(verifyFileSignature(header, 'image/jpeg')).toBe(true);
    });

    it('文件头不以 FF D8 FF 开头时声明为 JPEG 应拒绝', () => {
      const header = makeHeader([0x00, 0xd8, 0xff, 0xe0]);
      expect(verifyFileSignature(header, 'image/jpeg')).toBe(false);
    });
  });

  describe('PNG 文件校验', () => {
    it('真实 PNG 文件头（89 50 4E 47 0D 0A 1A 0A）应通过校验', () => {
      const header = makeHeader([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(verifyFileSignature(header, 'image/png')).toBe(true);
    });

    it('文件头不匹配 PNG 签名应拒绝', () => {
      const header = makeHeader([0x89, 0x50, 0x4e, 0x48, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(verifyFileSignature(header, 'image/png')).toBe(false);
    });
  });

  describe('GIF 文件校验', () => {
    it('真实 GIF 文件头（47 49 46 38）应通过校验', () => {
      const header = makeHeader([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      expect(verifyFileSignature(header, 'image/gif')).toBe(true);
    });

    it('文件头不匹配 GIF 签名应拒绝', () => {
      const header = makeHeader([0x47, 0x49, 0x46, 0x39]);
      expect(verifyFileSignature(header, 'image/gif')).toBe(false);
    });
  });

  describe('PDF 文件校验', () => {
    it('真实 PDF 文件头（25 50 44 46）应通过校验', () => {
      const header = makeHeader([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]);
      expect(verifyFileSignature(header, 'application/pdf')).toBe(true);
    });

    it('文件头不以 %PDF 开头时声明为 PDF 应拒绝', () => {
      const header = makeHeader([0x25, 0x50, 0x44, 0x41]);
      expect(verifyFileSignature(header, 'application/pdf')).toBe(false);
    });
  });

  describe('伪造 MIME 类型检测', () => {
    it('EXE 文件（4D 5A）声明为 image/jpeg 应被拦截', () => {
      // MZ 是 Windows PE/EXE 文件的 magic bytes
      const exeHeader = makeHeader([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
      expect(verifyFileSignature(exeHeader, 'image/jpeg')).toBe(false);
    });

    it('EXE 文件（4D 5A）声明为 image/png 应被拦截', () => {
      const exeHeader = makeHeader([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
      expect(verifyFileSignature(exeHeader, 'image/png')).toBe(false);
    });

    it('EXE 文件（4D 5A）声明为 application/pdf 应被拦截', () => {
      const exeHeader = makeHeader([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
      expect(verifyFileSignature(exeHeader, 'application/pdf')).toBe(false);
    });

    it('PNG 文件声明为 image/jpeg 应被拦截', () => {
      const pngHeader = makeHeader([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(verifyFileSignature(pngHeader, 'image/jpeg')).toBe(false);
    });
  });

  describe('空文件处理', () => {
    it('空缓冲区应校验失败', () => {
      const emptyBuffer = Buffer.alloc(0);
      expect(verifyFileSignature(emptyBuffer, 'image/jpeg')).toBe(false);
    });

    it('空缓冲区声明为 text/plain 应校验失败', () => {
      const emptyBuffer = Buffer.alloc(0);
      expect(verifyFileSignature(emptyBuffer, 'text/plain')).toBe(false);
    });

    it('空缓冲区声明为 application/pdf 应校验失败', () => {
      const emptyBuffer = Buffer.alloc(0);
      expect(verifyFileSignature(emptyBuffer, 'application/pdf')).toBe(false);
    });
  });

  describe('文本类文件校验（Markdown/TXT）', () => {
    it('Markdown 文本内容声明为 text/markdown 应通过校验', () => {
      const header = makeTextHeader('# 标题\n');
      expect(verifyFileSignature(header, 'text/markdown')).toBe(true);
    });

    it('纯文本内容声明为 text/plain 应通过校验', () => {
      const header = makeTextHeader('Hello World!');
      expect(verifyFileSignature(header, 'text/plain')).toBe(true);
    });

    it('JSON 文本内容声明为 application/json 应通过校验', () => {
      const header = makeTextHeader('{"key":"value"}');
      expect(verifyFileSignature(header, 'application/json')).toBe(true);
    });

    it('YAML 文本内容声明为 application/x-yaml 应通过校验', () => {
      const header = makeTextHeader('key: value\n');
      expect(verifyFileSignature(header, 'application/x-yaml')).toBe(true);
    });

    it('CSV 文本内容声明为 text/csv 应通过校验', () => {
      const header = makeTextHeader('a,b,c\n1,2,3');
      expect(verifyFileSignature(header, 'text/csv')).toBe(true);
    });

    it('含空字节的二进制内容声明为 text/plain 应拒绝', () => {
      const binaryHeader = Buffer.alloc(16, 0x00);
      binaryHeader[0] = 0x48; // 'H'
      binaryHeader[1] = 0x00; // 空字节
      expect(verifyFileSignature(binaryHeader, 'text/plain')).toBe(false);
    });

    it('含控制字符的二进制内容声明为 text/markdown 应拒绝', () => {
      const binaryHeader = Buffer.alloc(16, 0x20);
      binaryHeader[0] = 0x01; // 控制字符
      expect(verifyFileSignature(binaryHeader, 'text/markdown')).toBe(false);
    });
  });

  describe('其他类型文件校验', () => {
    it('DOC 类型（application/msword）无严格 magic bytes 校验，应通过', () => {
      const header = makeHeader([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      expect(verifyFileSignature(header, 'application/msword')).toBe(true);
    });

    it('DOCX 类型（OOXML）无严格 magic bytes 校验，应通过', () => {
      const header = makeHeader([0x50, 0x4b, 0x03, 0x04]);
      expect(verifyFileSignature(header, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
    });

    it('未知 MIME 类型应通过校验（交由 MIME/扩展名校验把关）', () => {
      const header = makeHeader([0x00, 0x01, 0x02, 0x03]);
      expect(verifyFileSignature(header, 'application/octet-stream')).toBe(true);
    });
  });

  describe('缓冲区长度边界情况', () => {
    it('仅 3 字节的 JPEG 文件头应通过校验', () => {
      const header = Buffer.from([0xff, 0xd8, 0xff]);
      expect(verifyFileSignature(header, 'image/jpeg')).toBe(true);
    });

    it('仅 2 字节声明为 JPEG 应拒绝（长度不足）', () => {
      const header = Buffer.from([0xff, 0xd8]);
      expect(verifyFileSignature(header, 'image/jpeg')).toBe(false);
    });

    it('仅 4 字节的 PDF 文件头应通过校验', () => {
      const header = Buffer.from([0x25, 0x50, 0x44, 0x46]);
      expect(verifyFileSignature(header, 'application/pdf')).toBe(true);
    });

    it('仅 3 字节声明为 PDF 应拒绝（长度不足）', () => {
      const header = Buffer.from([0x25, 0x50, 0x44]);
      expect(verifyFileSignature(header, 'application/pdf')).toBe(false);
    });

    it('单字节文本内容声明为 text/plain 应通过校验', () => {
      const header = Buffer.from([0x41]); // 'A'
      expect(verifyFileSignature(header, 'text/plain')).toBe(true);
    });
  });
});
