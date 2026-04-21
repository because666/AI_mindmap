import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, GitBranch } from 'lucide-react';
import { useAppStore, type NodeData } from '../../stores/appStore';
import useIsMobile from '../../hooks/useIsMobile';

interface NodeEditorProps {
  nodeId: string | null;
  isOpen: boolean;
  onClose: () => void;
  allNodes: Map<string, NodeData>;
}

/**
 * 节点编辑器组件
 * 支持桌面端居中弹窗和移动端全屏显示
 */
const NodeEditor: React.FC<NodeEditorProps> = ({ nodeId, isOpen, onClose, allNodes }) => {
  const { updateNode, deleteNode } = useAppStore();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [parentIds, setParentIds] = useState<string[]>([]);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (nodeId) {
      const node = allNodes.get(nodeId);
      if (node) {
        setTitle(node.title);
        setSummary(node.summary);
        setTags(node.tags || []);
        setParentIds(node.parentIds || []);
      }
    }
  }, [nodeId, allNodes]);

  const handleSave = () => {
    if (nodeId && title.trim()) {
      updateNode(nodeId, {
        title: title.trim(),
        summary: summary.trim(),
        tags,
        parentIds
      });
      onClose();
    }
  };

  const handleDelete = () => {
    if (nodeId && confirm('确定要删除此节点及其所有子节点吗？')) {
      deleteNode(nodeId);
      onClose();
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleParentToggle = (parentId: string) => {
    if (parentIds.includes(parentId)) {
      setParentIds(parentIds.filter(id => id !== parentId));
    } else {
      setParentIds([...parentIds, parentId]);
    }
  };

  if (!isOpen || !nodeId) return null;

  const node = allNodes.get(nodeId);
  if (!node) return null;

  const getDescendants = (id: string): Set<string> => {
    const descendants = new Set<string>();
    const node = allNodes.get(id);
    if (node) {
      node.childrenIds.forEach(childId => {
        descendants.add(childId);
        getDescendants(childId).forEach(d => descendants.add(d));
      });
    }
    return descendants;
  };

  const descendants = getDescendants(nodeId);
  const availableParents = Array.from(allNodes.values()).filter(
    n => n.id !== nodeId && !descendants.has(n.id)
  );

  const editorContent = (
    <>
      <div className={`flex items-center justify-between px-6 py-4 border-b border-dark-700 ${isMobile ? 'h-14' : ''}`}>
        <div className="flex items-center gap-2">
          {node.isRoot ? (
            <GitBranch className="w-5 h-5 text-primary-400" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-dark-600" />
          )}
          <h2 className="text-lg font-semibold text-white">
            {node.isRoot ? '编辑根节点' : '编辑节点'}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className={`p-6 space-y-5 overflow-y-auto ${isMobile ? 'flex-1' : 'max-h-[60vh]'}`}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-dark-300">节点标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:border-primary-500 focus:outline-none transition-colors min-h-[48px]"
            placeholder="输入节点标题"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-dark-300">节点摘要（可选）</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:border-primary-500 focus:outline-none resize-none transition-colors"
            placeholder="简短描述此节点的内容..."
          />
        </div>

        {!node.isRoot && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-dark-300">
              父节点（支持多选）
            </label>
            <div className="max-h-32 overflow-y-auto bg-dark-700 border border-dark-600 rounded-xl">
              {availableParents.length === 0 ? (
                <div className="px-4 py-3 text-dark-400 text-sm">暂无可用父节点</div>
              ) : (
                availableParents.map((parent) => (
                  <label
                    key={parent.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-dark-600 cursor-pointer transition-colors border-b border-dark-600 last:border-b-0 min-h-[48px]"
                  >
                    <input
                      type="checkbox"
                      checked={parentIds.includes(parent.id)}
                      onChange={() => handleParentToggle(parent.id)}
                      className="w-5 h-5 rounded border-dark-500 bg-dark-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
                    />
                    <span className="text-white text-sm">{parent.title}</span>
                    {parent.isRoot && (
                      <span className="text-xs text-primary-400">根</span>
                    )}
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-dark-400">
              选择多个父节点后，对话将综合所有父节点的上下文
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-dark-300">标签</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              className="flex-1 px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white focus:border-primary-500 focus:outline-none transition-colors text-sm min-h-[48px]"
              placeholder="添加标签"
            />
            <button
              onClick={handleAddTag}
              className="px-4 py-2 bg-dark-600 text-white rounded-xl hover:bg-dark-500 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600/20 text-primary-400 rounded-full text-sm min-h-[36px]"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-primary-300 p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-dark-700">
          <div className="text-xs text-dark-400 space-y-1">
            <p>创建时间: {new Date(node.createdAt).toLocaleString('zh-CN')}</p>
            <p>更新时间: {new Date(node.updatedAt).toLocaleString('zh-CN')}</p>
            {node.isRoot && (
              <p className="text-primary-400">这是一个根节点</p>
            )}
            {node.childrenIds.length > 0 && (
              <p className="text-dark-300">包含 {node.childrenIds.length} 个子节点</p>
            )}
          </div>
        </div>
      </div>

      <div className={`flex items-center justify-between px-6 py-4 border-t border-dark-700 bg-dark-900 ${isMobile ? 'pb-safe' : ''}`}>
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-4 py-2.5 text-red-400 hover:bg-red-900/30 rounded-xl transition-colors min-h-[44px]"
        >
          <Trash2 className="w-4 h-4" />
          删除节点
        </button>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-dark-600 text-white rounded-xl hover:bg-dark-500 transition-colors min-h-[44px]"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
        </div>
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

      <div className="relative w-full max-w-lg mx-4 bg-dark-800 rounded-2xl shadow-2xl overflow-hidden border border-dark-700">
        {editorContent}
      </div>
    </div>
  );
};

export default NodeEditor;
