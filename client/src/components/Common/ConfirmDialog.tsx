import React from 'react';

/**
 * 确认弹窗组件属性接口
 * @property isOpen - 是否显示弹窗
 * @property title - 弹窗标题
 * @property message - 弹窗提示信息
 * @property confirmText - 确认按钮文字，默认"确认"
 * @property cancelText - 取消按钮文字，默认"取消"
 * @property onConfirm - 确认回调
 * @property onCancel - 取消回调
 */
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 自定义确认弹窗组件
 * 替代原生 confirm()，与项目整体深色 UI 风格保持一致
 * 支持遮罩层点击关闭、自定义按钮文案
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-dark-800 rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-dark-600 animate-scale-in">
        <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
        <p className="text-dark-300 text-sm mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-dark-300 hover:text-white hover:bg-dark-700 transition-colors text-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors text-sm"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
