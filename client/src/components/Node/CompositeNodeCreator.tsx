import React, { useState } from 'react';
import { X, Layers, Check } from 'lucide-react';
import { useAppStore, type NodeData } from '../../stores/appStore';
import useIsMobile from '../../hooks/useIsMobile';

interface CompositeNodeCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNodeIds: string[];
  allNodes: Map<string, NodeData>;
}

/**
 * 复合节点创建器组件
 * 支持桌面端居中弹窗和移动端全屏显示
 */
const CompositeNodeCreator: React.FC<CompositeNodeCreatorProps> = ({
  isOpen,
  onClose,
  selectedNodeIds,
  allNodes
}) => {
  const { createCompositeNode } = useAppStore();
  const [title, setTitle] = useState('');
  const isMobile = useIsMobile();

  const handleCreate = () => {
    if (!title.trim()) {
      alert('请输入复合节点标题');
      return;
    }

    if (selectedNodeIds.length < 2) {
      alert('请至少选择2个节点进行聚合');
      return;
    }

    createCompositeNode(selectedNodeIds, title.trim());
    setTitle('');
    onClose();
  };

  if (!isOpen) return null;

  const selectedNodes = selectedNodeIds
    .map(id => allNodes.get(id))
    .filter(Boolean) as NodeData[];

  const creatorContent = (
    <>
      <div className={`flex items-center justify-between px-6 py-4 border-b border-dark-700 ${isMobile ? 'h-14' : ''}`}>
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white">创建复合节点</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className={`p-6 space-y-5 overflow-y-auto ${isMobile ? 'flex-1' : ''}`}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-dark-300">复合节点标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：XX功能模块"
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:border-primary-500 focus:outline-none transition-colors min-h-[48px]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-dark-300">
            将聚合以下 {selectedNodes.length} 个节点
          </label>
          <div className="max-h-48 overflow-y-auto bg-dark-700 border border-dark-600 rounded-xl">
            {selectedNodes.map((node) => (
              <div
                key={node.id}
                className="flex items-center gap-2 px-4 py-3 border-b border-dark-600 last:border-b-0 min-h-[48px]"
              >
                <Check className="w-4 h-4 text-primary-400 flex-shrink-0" />
                <span className="text-white truncate">{node.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 bg-dark-700 rounded-xl">
          <p className="text-sm text-dark-300">
            复合节点将在画布上显示为单一单元，双击可展开查看内部子节点网络。
          </p>
        </div>
      </div>

      <div className={`flex justify-end gap-3 px-6 py-4 border-t border-dark-700 bg-dark-900 ${isMobile ? 'pb-safe' : ''}`}>
        <button
          onClick={onClose}
          className="px-4 py-2.5 bg-dark-600 text-white rounded-xl hover:bg-dark-500 transition-colors min-h-[44px]"
        >
          取消
        </button>
        <button
          onClick={handleCreate}
          disabled={!title.trim() || selectedNodes.length < 2}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
        >
          <Layers className="w-4 h-4" />
          创建复合节点
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col">
        {creatorContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md mx-4 bg-dark-800 rounded-2xl shadow-2xl overflow-hidden">
        {creatorContent}
      </div>
    </div>
  );
};

export default CompositeNodeCreator;
