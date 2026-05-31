import React from 'react';
import { Undo2, Redo2, Clock, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 根据命令描述推断操作图标
 * @param description - 命令描述文本
 * @returns 对应的图标字符
 */
const getCommandIcon = (description: string): string => {
  if (description.startsWith('创建节点')) return '➕';
  if (description.startsWith('删除节点')) return '🗑️';
  if (description.startsWith('更新节点')) return '✏️';
  if (description.startsWith('创建关系')) return '🔗';
  if (description.startsWith('删除关系')) return '✂️';
  return '📝';
};

/**
 * 历史版本管理面板
 * 显示undoStack中的操作描述列表，支持点击撤销到指定状态
 */
const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, onClose: _onClose }) => {
  const undoStack = useAppStore(state => state.undoStack);
  const redoStack = useAppStore(state => state.redoStack);
  const canUndo = useAppStore(state => state.canUndo);
  const canRedo = useAppStore(state => state.canRedo);
  const undo = useAppStore(state => state.undo);
  const redo = useAppStore(state => state.redo);
  const undoTo = useAppStore(state => state.undoTo);

  /**
   * 处理点击历史记录项，撤销到指定位置
   * @param index - 目标命令在undoStack中的索引
   */
  const handleUndoTo = (index: number) => {
    undoTo(index);
  };

  return (
    <div className={`bg-dark-800 border-l border-dark-700 h-full overflow-hidden flex flex-col transition-opacity duration-300 ease-out ${
      isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
    }`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary-400" />
          <h3 className="text-white font-medium">操作历史</h3>
        </div>
      </div>

      <div className="flex gap-2 p-4 border-b border-dark-700">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Undo2 className="w-4 h-4" />
          撤销
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Redo2 className="w-4 h-4" />
          重做
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {undoStack.length === 0 && redoStack.length === 0 ? (
          <div className="px-4 py-8 text-center text-dark-400">
            <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无操作历史</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-700">
            {[...undoStack].reverse().map((command, idx) => {
              const actualIndex = undoStack.length - 1 - idx;
              const isTopOfStack = actualIndex === undoStack.length - 1;

              return (
                <div
                  key={command.id}
                  onClick={() => handleUndoTo(actualIndex)}
                  className={`px-4 py-3 cursor-pointer hover:bg-dark-600/50 transition-colors ${
                    isTopOfStack
                      ? 'bg-primary-600/20 border-l-2 border-primary-500'
                      : 'bg-dark-700/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{getCommandIcon(command.description)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {command.description}
                      </p>
                    </div>
                    {isTopOfStack && (
                      <span className="text-xs text-primary-400">当前</span>
                    )}
                  </div>
                </div>
              );
            })}
            {redoStack.length > 0 && (
              <>
                <div className="px-4 py-2 bg-dark-900/50">
                  <span className="text-xs text-dark-500">已撤销的操作</span>
                </div>
                {[...redoStack].reverse().map((command) => (
                  <div
                    key={command.id}
                    className="px-4 py-3 opacity-50"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{getCommandIcon(command.description)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-dark-400 truncate">
                          {command.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-dark-700 bg-dark-900">
        <p className="text-xs text-dark-400">
          可撤销 {undoStack.length} 步 • 可重做 {redoStack.length} 步
        </p>
      </div>
    </div>
  );
};

export default HistoryPanel;
