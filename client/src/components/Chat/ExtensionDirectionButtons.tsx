import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, Loader2 } from 'lucide-react';
import useIsMobile from '../../hooks/useIsMobile';

/**
 * 延伸方向按钮组组件属性
 */
interface ExtensionDirectionButtonsProps {
  /**
   * 延伸方向文本数组
   */
  directions: string[];

  /**
   * 用户点击某个方向时的回调函数
   * @param direction - 被点击的方向文本
   */
  onDirectionClick: (direction: string) => void;

  /**
   * 当前正在处理的方向文本（展示加载状态）
   * 为 null 时表示没有任何方向处于加载状态
   */
  loadingDirection?: string | null;
}

/**
 * 延伸方向按钮组组件
 *
 * 用于在 AI 回答气泡下方展示可点击的延伸方向按钮。
 * - 桌面端：按钮水平排列并自动换行
 * - 移动端：按钮垂直堆叠，宽度占满容器
 * - 点击后调用 onDirectionClick 回调
 *
 * @param directions - 需要展示的延伸方向列表
 * @param onDirectionClick - 方向点击回调
 * @param loadingDirection - 当前处于加载状态的方向文本（可选）
 * @returns 当 directions 为空时返回 null，否则渲染按钮组
 */
export const ExtensionDirectionButtons: React.FC<ExtensionDirectionButtonsProps> = ({
  directions,
  onDirectionClick,
  loadingDirection = null,
}) => {
  const { t } = useTranslation('chat');
  const isMobile = useIsMobile();

  if (directions.length === 0) {
    return null;
  }

  return (
    <div className="mt-3">
      <div className="text-xs text-dark-400 mb-2 flex items-center gap-1.5">
        <Lightbulb className="w-3 h-3 text-primary-400" />
        <span>{t('extensionDirectionsTitle')}</span>
      </div>
      <div className={`flex ${isMobile ? 'flex-col' : 'flex-row flex-wrap'} gap-2`}>
        {directions.map((direction) => {
          const isLoading = loadingDirection === direction;

          return (
            <button
              key={direction}
              type="button"
              onClick={() => onDirectionClick(direction)}
              disabled={loadingDirection !== null}
              className={`
                ${isMobile ? 'w-full' : ''}
                px-3 py-1.5 text-xs font-medium
                bg-dark-800/50 border border-primary-500/30 text-primary-400
                rounded-xl hover:bg-primary-600/15 hover:border-primary-500/50
                active:scale-95 transition-all
                disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
                text-left
              `}
            >
              {isLoading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{t('creatingBranch')}</span>
                </span>
              ) : (
                direction
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ExtensionDirectionButtons;
