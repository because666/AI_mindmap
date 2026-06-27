import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus } from 'lucide-react';
import { BUILTIN_TEMPLATES, type TemplateData } from '../../data/templates';
import { useAppStore } from '../../stores/appStore';

/**
 * 模板库弹窗组件 Props
 */
interface TemplateLibraryProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 模板库弹窗组件
 *
 * 提供模板选择入口，用户可：
 * 1. 从内置模板列表中点击卡片，基于该模板创建一张新的思维导图（含节点与关系）
 * 2. 点击底部"创建空白地图"按钮，关闭弹窗并交由用户自行从空状态创建根节点
 * 3. 创建完成后自动为包含预置问题的节点发起AI对话，支持进度展示与取消
 *
 * 交互细节：
 * - 全屏遮罩层，点击遮罩关闭（创建中不可关闭）
 * - 弹窗居中显示，深色背景，圆角
 * - 模板卡片以网格形式排列（1/2/3 列响应式）
 * - 卡片 hover 时高亮边框并轻微放大
 * - 创建中显示进度覆盖层，包含进度条、进度文案和取消按钮
 *
 * 异常处理：
 * - 模板创建失败时通过 console.error 静默记录，不弹窗、不阻塞用户后续操作
 */
const TemplateLibrary: React.FC<TemplateLibraryProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation('canvas');

  /** 是否正在创建预置对话 */
  const [isCreating, setIsCreating] = useState(false);
  /** 当前进度 */
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  /** 取消标志引用（避免闭包捕获旧值） */
  const cancelRef = useRef(false);

  /**
   * 处理模板卡片点击
   *
   * 调用 nodeStore 的 createMapFromTemplate 创建思维导图，
   * 成功且模板中包含预置问题时，自动批量发起AI对话并展示进度；
   * 无预置问题或创建失败时直接关闭弹窗。
   *
   * @param template - 选中的模板数据
   */
  const handleSelectTemplate = useCallback(async (template: TemplateData): Promise<void> => {
    try {
      const result = useAppStore.getState().createMapFromTemplate(template);
      // 仅当成功生成根节点 ID 时继续
      if (!result.rootId) {
        return;
      }

      // 检查模板中是否有节点包含预置问题
      const nodesWithPresetCount = template.nodes.filter(
        (n) => n.presetQuestion && n.presetQuestion.trim().length > 0,
      ).length;

      if (nodesWithPresetCount > 0) {
        // 有预置问题，进入进度模式
        setIsCreating(true);
        setProgress({ current: 0, total: nodesWithPresetCount });
        cancelRef.current = false;

        const { createPresetConversationsForTemplate } = useAppStore.getState();

        await createPresetConversationsForTemplate(
          result.nodeIds,
          result.template,
          (currentIndex: number) => {
            // 计算已完成的有预置问题的节点数量
            const completedPresetCount = Math.min(currentIndex + 1, nodesWithPresetCount);
            setProgress({ current: completedPresetCount, total: nodesWithPresetCount });
          },
          () => !cancelRef.current,
        );

        setIsCreating(false);
      }

      // 关闭弹窗
      onClose();
    } catch (error) {
      // 异常静默处理：仅记录日志，不弹窗、不阻塞用户
      console.error('[TemplateLibrary] 从模板创建思维导图失败:', error);
      setIsCreating(false);
      onClose();
    }
  }, [onClose]);

  /**
   * 处理取消按钮点击
   * 设置取消标志，createPresetConversationsForTemplate 会在下一个节点检查时中断
   */
  const handleCancel = useCallback((): void => {
    cancelRef.current = true;
  }, []);

  /**
   * 处理"创建空白地图"按钮点击
   * 直接关闭弹窗，由用户在空状态自行创建根节点
   */
  const handleCreateBlankMap = (): void => {
    onClose();
  };

  /**
   * 处理遮罩层点击
   * 仅当点击事件目标为遮罩本身时关闭，避免误触内部卡片导致关闭
   * 创建过程中禁止通过点击遮罩关闭
   *
   * @param e - 鼠标点击事件
   */
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (isCreating) return;
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  /** 进度百分比 */
  const progressPercent = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  // 未打开时不渲染，避免占据 DOM 与触发动画
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-3xl max-h-[90vh] mx-4 bg-dark-800 rounded-2xl shadow-2xl border border-dark-700/50 flex flex-col animate-scale-in overflow-hidden">
        {/* 弹窗头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700/50">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {t('templateLibrary')}
            </h2>
            <p className="text-sm text-dark-400 mt-1">
              {t('templateLibraryDesc')}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isCreating}
            className="p-2 rounded-lg hover:bg-dark-700/50 text-dark-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('cancel')}
            aria-label={t('cancel')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 模板卡片网格 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 relative">
          {/* 创建中覆盖层 */}
          {isCreating && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-dark-800/90 backdrop-blur-sm rounded-lg mx-6 my-5">
              {/* 进度文案 */}
              <p className="text-white text-sm mb-4">
                正在为节点 {progress.current}/{progress.total} 生成AI回答...
              </p>
              {/* 进度条 */}
              <div className="w-64 h-2 bg-dark-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {/* 百分比 */}
              <p className="text-dark-400 text-xs mt-2">
                {progressPercent}%
              </p>
              {/* 取消按钮 */}
              <button
                onClick={handleCancel}
                className="mt-6 px-4 py-2 rounded-lg border border-dark-600 text-dark-300 hover:bg-dark-700/50 hover:text-white transition-colors text-sm"
              >
                取消
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {BUILTIN_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => { void handleSelectTemplate(template); }}
                disabled={isCreating}
                className="group flex flex-col items-start text-left p-4 bg-dark-700/30 border border-dark-600/50 rounded-xl transition-all duration-200 hover:border-primary-500 hover:scale-[1.02] hover:bg-dark-700/50 focus:outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                title={t('selectTemplate')}
              >
                {/* 模板图标 */}
                <span className="text-4xl mb-3" aria-hidden="true">
                  {template.icon}
                </span>
                {/* 模板名称 */}
                <span className="font-semibold text-white mb-1 line-clamp-1">
                  {template.name}
                </span>
                {/* 模板描述（2 行截断） */}
                <span className="text-sm text-dark-400 line-clamp-2 leading-relaxed mb-3">
                  {template.description}
                </span>
                {/* 底部标签：节点数 */}
                <span className="mt-auto inline-flex items-center text-xs text-dark-500 bg-dark-800/60 px-2 py-1 rounded-md">
                  {t('nodesCount', { count: template.nodes.length })}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 弹窗底部 */}
        <div className="px-6 py-4 border-t border-dark-700/50">
          <button
            onClick={handleCreateBlankMap}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dark-600 text-dark-300 hover:bg-dark-700/50 hover:text-white transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('createBlankMap')}
          >
            <Plus className="w-4 h-4" />
            <span>{t('createBlankMap')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateLibrary;
