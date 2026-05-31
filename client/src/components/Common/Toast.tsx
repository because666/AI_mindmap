import React from 'react'
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'
import { useToastStore, type ToastType } from '../../stores/toastStore'
import useIsMobile from '../../hooks/useIsMobile'

/**
 * Toast类型与图标组件的映射
 */
const TOAST_ICONS: Record<ToastType, React.FC<{ className?: string }>> = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
}

/**
 * Toast类型与图标颜色的映射
 */
const TOAST_ICON_COLORS: Record<ToastType, string> = {
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
  info: 'text-primary-400',
}

/**
 * 单条Toast通知组件
 * 显示图标、消息内容和关闭按钮
 * @param toast - Toast通知数据项
 */
const ToastItem: React.FC<{
  toast: { id: string; type: ToastType; message: string }
}> = ({ toast }) => {
  const removeToast = useToastStore((s) => s.removeToast)
  const isMobile = useIsMobile()
  const IconComponent = TOAST_ICONS[toast.type]
  const iconColor = TOAST_ICON_COLORS[toast.type]

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 bg-dark-800/90 backdrop-blur-sm border border-dark-600/50 rounded-xl shadow-lg min-w-[280px] max-w-[420px] ${
        isMobile ? 'toast-enter-mobile' : 'toast-enter'
      }`}
    >
      <IconComponent className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
      <span className="flex-1 text-sm text-white leading-snug">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="p-1 text-dark-400 hover:text-white transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

/**
 * 全局Toast通知容器组件
 * 桌面端固定定位在右上角，移动端固定定位在顶部居中
 * 从toastStore读取通知列表并渲染
 */
const Toast: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts)
  const isMobile = useIsMobile()

  if (toasts.length === 0) return null

  return (
    <div
      className={`fixed z-[10000] flex flex-col gap-2 pointer-events-none ${
        isMobile
          ? 'top-4 left-4 right-4 items-center'
          : 'top-4 right-4 items-end'
      }`}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  )
}

export default Toast
