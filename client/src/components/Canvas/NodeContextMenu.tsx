import React, { useEffect, useRef, useState } from 'react';
import { Pencil, GitBranch, Copy, Trash2 } from 'lucide-react';

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  onEdit: (nodeId: string) => void;
  onCreateBranch: (nodeId: string) => void;
  onCopy: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  action: () => void;
  danger?: boolean;
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  x,
  y,
  nodeId,
  onEdit,
  onCreateBranch,
  onCopy,
  onDelete,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let adjustedX = x;
    let adjustedY = y;
    if (rect.right > vw) adjustedX = vw - rect.width - 8;
    if (rect.bottom > vh) adjustedY = vh - rect.height - 8;
    if (adjustedX < 0) adjustedX = 8;
    if (adjustedY < 0) adjustedY = 8;
    menuRef.current.style.left = `${adjustedX}px`;
    menuRef.current.style.top = `${adjustedY}px`;
  }, [x, y]);

  const menuItems: MenuItem[] = [
    {
      icon: <Pencil className="w-4 h-4" />,
      label: '编辑节点',
      action: () => { onEdit(nodeId); onClose(); },
    },
    {
      icon: <GitBranch className="w-4 h-4" />,
      label: '创建分支',
      action: () => { onCreateBranch(nodeId); onClose(); },
    },
    {
      icon: <Copy className="w-4 h-4" />,
      label: '复制节点',
      action: () => { onCopy(nodeId); onClose(); },
    },
    {
      icon: <Trash2 className="w-4 h-4" />,
      label: '删除节点',
      action: () => { setDeleteConfirm(true); },
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-dark-800 border border-dark-600/50 rounded-xl shadow-2xl shadow-black/40 py-1.5 min-w-[160px] backdrop-blur-xl"
      style={{ left: x, top: y }}
    >
      {deleteConfirm ? (
        <div className="px-3 py-2">
          <p className="text-sm text-dark-200 mb-2">确定删除该节点？</p>
          <div className="flex gap-2">
            <button
              onClick={() => { onDelete(nodeId); onClose(); }}
              className="flex-1 px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              删除
            </button>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="flex-1 px-3 py-1.5 text-xs bg-dark-700 hover:bg-dark-600 text-dark-200 rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        menuItems.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
              item.danger
                ? 'text-red-400 hover:bg-red-500/10'
                : 'text-dark-200 hover:bg-dark-700'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))
      )}
    </div>
  );
};

export default NodeContextMenu;
