import { useCallback, useRef } from 'react';

/**
 * 长按Hook配置接口
 */
interface UseLongPressOptions {
  /**
   * 长按阈值时间（毫秒），默认500ms
   */
  threshold?: number;
  
  /**
   * 长按成功回调
   */
  onLongPress: (e: React.MouseEvent | React.TouchEvent) => void;
  
  /**
   * 点击回调（短按时触发）
   */
  onClick?: (e: React.MouseEvent | React.TouchEvent) => void;
}

/**
 * 长按检测自定义Hook
 * 支持PC端（鼠标长按）和移动端（触摸长按）
 * @param options - 配置选项
 * @returns 事件处理器对象
 */
export function useLongPress(options: UseLongPressOptions) {
  const { 
    threshold = 500, 
    onLongPress, 
    onClick 
  } = options;
  
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressTriggered = useRef(false);
  
  /**
   * 开始计时
   */
  const start = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isLongPressTriggered.current = false;
    
    timerRef.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      onLongPress(e);
    }, threshold);
  }, [onLongPress, threshold]);
  
  /**
   * 取消计时
   */
  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  
  /**
   * 处理结束事件
   */
  const handleEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isLongPressTriggered.current && onClick) {
      onClick(e);
    }
    cancel();
  }, [onClick, cancel]);
  
  /**
   * 鼠标事件处理器（PC端）
   */
  const mouseEventHandlers = {
    onMouseDown: start,
    onMouseUp: handleEnd,
    onMouseLeave: cancel,
  };
  
  /**
   * 触摸事件处理器（移动端）
   */
  const touchEventHandlers = {
    onTouchStart: start,
    onTouchEnd: handleEnd,
    onTouchMove: cancel,
    onTouchCancel: cancel,
  };
  
  return {
    ...mouseEventHandlers,
    ...touchEventHandlers,
  };
}
