import { create } from 'zustand'

/**
 * Toast通知类型
 * - success: 操作成功提示
 * - warning: 警告提示
 * - error: 错误提示
 * - info: 信息提示
 */
type ToastType = 'success' | 'warning' | 'error' | 'info'

/**
 * Toast通知项接口
 * @property id - 唯一标识符
 * @property type - 通知类型
 * @property message - 通知消息内容
 * @property duration - 自动关闭时长（毫秒）
 */
interface ToastItem {
  id: string
  type: ToastType
  message: string
  duration: number
}

/**
 * Toast状态接口
 * @property toasts - 当前显示的Toast列表
 * @property addToast - 添加Toast通知
 * @property removeToast - 移除指定Toast通知
 */
interface ToastState {
  toasts: ToastItem[]
  addToast: (type: ToastType, message: string, duration?: number) => void
  removeToast: (id: string) => void
}

/**
 * 各类型Toast的默认持续时间（毫秒）
 */
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  info: 3000,
  warning: 5000,
  error: 8000,
}

/**
 * Toast最大显示数量
 * 超过此数量时自动移除最早的Toast
 */
const MAX_TOASTS = 5

/**
 * 全局Toast通知状态管理Store
 * 管理Toast通知的添加、移除和自动关闭逻辑
 */
export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],

  /**
   * 添加Toast通知
   * 生成唯一ID，设置默认持续时间，自动定时移除
   * 超过最大数量时移除最早的Toast
   * @param type - 通知类型
   * @param message - 通知消息内容
   * @param duration - 可选的自定义持续时间，不传则使用类型默认值
   */
  addToast: (type: ToastType, message: string, duration?: number) => {
    const id = `${Date.now()}-${Math.random()}`
    const toastDuration = duration ?? DEFAULT_DURATIONS[type]

    set((state) => {
      const newToasts = [...state.toasts, { id, type, message, duration: toastDuration }]
      if (newToasts.length > MAX_TOASTS) {
        newToasts.shift()
      }
      return { toasts: newToasts }
    })

    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    }, toastDuration)
  },

  /**
   * 移除指定ID的Toast通知
   * @param id - 要移除的Toast唯一标识符
   */
  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
}))

export type { ToastType, ToastItem, ToastState }
