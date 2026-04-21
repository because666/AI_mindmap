import React, { useState, useEffect } from 'react';
import { X, Link2, Save, Info } from 'lucide-react';
import { useAppStore, RELATION_TYPE_LABELS, type RelationType } from '../../stores/appStore';
import type { NodeData } from '../../stores/appStore';
import useIsMobile from '../../hooks/useIsMobile';

interface RelationEditorProps {
  isOpen: boolean;
  onClose: () => void;
  sourceNodeId?: string;
  targetNodeId?: string;
  allNodes: Map<string, NodeData>;
}

/**
 * 关系编辑器组件
 * 支持桌面端居中弹窗和移动端全屏显示
 */
const RelationEditor: React.FC<RelationEditorProps> = ({
  isOpen,
  onClose,
  sourceNodeId: initialSourceId,
  targetNodeId: initialTargetId,
  allNodes
}) => {
  const { addRelation } = useAppStore();
  const [sourceId, setSourceId] = useState(initialSourceId || '');
  const [targetId, setTargetId] = useState(initialTargetId || '');
  const [relationType, setRelationType] = useState<RelationType>('supports');
  const [description, setDescription] = useState('');
  const isMobile = useIsMobile();

  useEffect(() => {
    if (initialSourceId) setSourceId(initialSourceId);
    if (initialTargetId) setTargetId(initialTargetId);
  }, [initialSourceId, initialTargetId]);

  const handleSave = () => {
    if (!sourceId || !targetId) {
      alert('请选择源节点和目标节点');
      return;
    }

    if (sourceId === targetId) {
      alert('源节点和目标节点不能相同');
      return;
    }

    addRelation({
      sourceId,
      targetId,
      type: relationType,
      description: description || undefined
    });

    onClose();
  };

  if (!isOpen) return null;

  const nodeList = Array.from(allNodes.values());
  const selectedType = RELATION_TYPE_LABELS[relationType];

  const editorContent = (
    <>
      <div className={`flex items-center justify-between px-6 py-4 border-b border-dark-700 ${isMobile ? 'h-14' : ''}`}>
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white">创建关系</h2>
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
          <label className="text-sm font-medium text-dark-300">源节点</label>
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:border-primary-500 focus:outline-none transition-colors min-h-[48px]"
          >
            <option value="">选择源节点</option>
            {nodeList.map((node) => (
              <option key={node.id} value={node.id}>
                {node.title} {node.isRoot ? '(根)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-dark-300">关系类型</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(RELATION_TYPE_LABELS) as RelationType[])
              .filter(type => type !== 'parent-child')
              .map((type) => (
              <button
                key={type}
                onClick={() => setRelationType(type)}
                className={`px-3 py-3 rounded-lg text-sm font-medium transition-all min-h-[48px] ${
                  relationType === type
                    ? 'text-white ring-2 ring-white/20'
                    : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                }`}
                style={{
                  backgroundColor: relationType === type
                    ? RELATION_TYPE_LABELS[type].color
                    : undefined
                }}
                title={RELATION_TYPE_LABELS[type].description}
              >
                {RELATION_TYPE_LABELS[type].label}
              </button>
            ))}
          </div>

          <div className="flex items-start gap-2 p-3 bg-dark-700 rounded-lg">
            <Info className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-dark-400">{selectedType.description}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-dark-300">目标节点</label>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:border-primary-500 focus:outline-none transition-colors min-h-[48px]"
          >
            <option value="">选择目标节点</option>
            {nodeList.filter(n => n.id !== sourceId).map((node) => (
              <option key={node.id} value={node.id}>
                {node.title} {node.isRoot ? '(根)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-dark-300">关系描述（可选）</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:border-primary-500 focus:outline-none resize-none transition-colors"
            placeholder="描述此关系的具体含义..."
          />
        </div>

        {sourceId && targetId && (
          <div className="p-3 bg-dark-700 rounded-xl">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="text-white font-medium">
                {allNodes.get(sourceId)?.title}
              </span>
              <span
                className="px-2 py-0.5 rounded text-xs text-white"
                style={{ backgroundColor: selectedType.color }}
              >
                {selectedType.label}
              </span>
              <span className="text-white font-medium">
                {allNodes.get(targetId)?.title}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className={`flex justify-end gap-3 px-6 py-4 border-t border-dark-700 bg-dark-900 ${isMobile ? 'pb-safe' : ''}`}>
        <button
          onClick={onClose}
          className="px-4 py-2.5 bg-dark-600 text-white rounded-xl hover:bg-dark-500 transition-colors min-h-[44px]"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={!sourceId || !targetId}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
        >
          <Save className="w-4 h-4" />
          创建关系
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col">
        {editorContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md mx-4 bg-dark-800 rounded-2xl shadow-2xl overflow-hidden border border-dark-700">
        {editorContent}
      </div>
    </div>
  );
};

export default RelationEditor;
