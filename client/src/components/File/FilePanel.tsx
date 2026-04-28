import React, { useState, useRef } from 'react';
import { X, Download, Upload, FileJson, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { nodeApi } from '../../services/api';
import { useAppStore } from '../../stores/appStore';

interface FilePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ImportResult {
  nodes: number;
  relations: number;
  conversations: number;
}

/**
 * 文件导入/导出面板组件
 * 支持JSON和Markdown格式的导入导出操作
 */
const FilePanel: React.FC<FilePanelProps> = ({ isOpen, onClose }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFormat, setImportFormat] = useState<'json' | 'markdown'>('json');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reloadWorkspaceData = useAppStore(state => state.reloadWorkspaceData);

  if (!isOpen) return null;

  /**
   * 处理JSON格式导出
   * 从服务端获取完整数据并下载为JSON文件
   */
  const handleExportJson = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const response = await nodeApi.exportData('json');
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `deepmindmap-export-${formatDate()}.json`);
      setStatusMessage({ type: 'success', text: 'JSON导出成功' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '导出失败，请重试';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * 处理Markdown格式导出
   * 从服务端获取Markdown大纲并下载为MD文件
   */
  const handleExportMarkdown = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const response = await nodeApi.exportData('markdown');
      const content = typeof response === 'string' ? response : String(response);
      const blob = new Blob([content], { type: 'text/markdown' });
      downloadBlob(blob, `deepmindmap-export-${formatDate()}.md`);
      setStatusMessage({ type: 'success', text: 'Markdown导出成功' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '导出失败，请重试';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * 处理文件选择
   * 读取文件内容并触发导入流程
   */
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    const detectedFormat = extension === 'md' || extension === 'markdown' ? 'markdown' : 'json';
    setImportFormat(detectedFormat);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        handleImport(detectedFormat, content);
      }
    };
    reader.onerror = () => {
      setStatusMessage({ type: 'error', text: '文件读取失败' });
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * 执行导入操作
   * 将数据发送到服务端，导入完成后刷新工作区数据
   * @param format - 导入格式
   * @param data - 导入数据字符串
   */
  const handleImport = async (format: 'json' | 'markdown', data: string) => {
    setIsImporting(true);
    setStatusMessage(null);
    setImportResult(null);
    try {
      const response = await nodeApi.importData(format, data);
      const result = (response as unknown as { success: boolean; data: ImportResult }).data;
      setImportResult(result);
      setStatusMessage({ type: 'success', text: '导入成功' });
      await reloadWorkspaceData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '导入失败，请检查文件格式';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * 触发文件选择对话框
   */
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  /**
   * 下载Blob文件
   * @param blob - 文件Blob对象
   * @param filename - 下载文件名
   */
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * 格式化当前日期为文件名安全字符串
   * @returns 格式化后的日期字符串
   */
  const formatDate = (): string => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600/20 rounded-xl flex items-center justify-center">
              <Download className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">文件管理</h2>
              <p className="text-dark-400 text-xs">导入导出思维导图数据</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {statusMessage && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
              statusMessage.type === 'success'
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {importResult && (
            <div className="bg-primary-600/10 border border-primary-500/20 rounded-xl p-4">
              <h4 className="text-primary-400 font-medium text-sm mb-2">导入结果</h4>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-white text-xl font-bold">{importResult.nodes}</div>
                  <div className="text-dark-400 text-xs">节点</div>
                </div>
                <div>
                  <div className="text-white text-xl font-bold">{importResult.relations}</div>
                  <div className="text-dark-400 text-xs">关系</div>
                </div>
                <div>
                  <div className="text-white text-xl font-bold">{importResult.conversations}</div>
                  <div className="text-dark-400 text-xs">对话</div>
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
              <Download className="w-4 h-4 text-primary-400" />
              导出数据
            </h3>
            <p className="text-dark-400 text-xs mb-3">
              将当前工作区的思维导图数据导出为文件，可用于备份或迁移
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleExportJson}
                disabled={isExporting}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-dark-800 hover:bg-dark-700 border border-dark-600 hover:border-primary-500/50 rounded-xl text-dark-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileJson className="w-4 h-4" />
                )}
                <span className="text-sm">JSON 格式</span>
              </button>
              <button
                onClick={handleExportMarkdown}
                disabled={isExporting}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-dark-800 hover:bg-dark-700 border border-dark-600 hover:border-primary-500/50 rounded-xl text-dark-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                <span className="text-sm">Markdown 格式</span>
              </button>
            </div>
            <div className="mt-2 text-dark-500 text-xs space-y-1">
              <p>• JSON：完整数据，包含节点、关系和对话记录，可重新导入</p>
              <p>• Markdown：大纲格式，适合阅读和文档归档</p>
            </div>
          </div>

          <div className="border-t border-dark-700 pt-6">
            <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary-400" />
              导入数据
            </h3>
            <p className="text-dark-400 text-xs mb-3">
              从文件导入思维导图数据到当前工作区，导入的数据会生成新的ID以避免冲突
            </p>

            <div className="flex items-center gap-3 mb-3">
              <span className="text-dark-400 text-xs">格式：</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setImportFormat('json')}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    importFormat === 'json'
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-800 text-dark-400 hover:text-white'
                  }`}
                >
                  JSON
                </button>
                <button
                  onClick={() => setImportFormat('markdown')}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    importFormat === 'markdown'
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-800 text-dark-400 hover:text-white'
                  }`}
                >
                  Markdown
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.md,.markdown,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              onClick={triggerFileInput}
              disabled={isImporting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-dark-800 hover:bg-dark-700 border-2 border-dashed border-dark-600 hover:border-primary-500/50 rounded-xl text-dark-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">导入中...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">选择文件导入</span>
                </>
              )}
            </button>

            <div className="mt-2 text-dark-500 text-xs space-y-1">
              <p>• JSON：从DeepMindMap导出的完整数据文件（.json）</p>
              <p>• Markdown：层级大纲格式（## 为根节点，缩进列表为子节点）</p>
              <p>• 导入会自动识别文件格式（.json / .md / .markdown）</p>
            </div>
          </div>

          <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <div className="text-dark-400 text-xs space-y-1">
                <p>导入数据会添加到当前工作区，不会覆盖已有数据。</p>
                <p>建议在导入前先导出备份当前数据。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilePanel;
