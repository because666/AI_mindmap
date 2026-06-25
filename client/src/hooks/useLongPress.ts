import { useCallback, useRef } from 'react';

/**
 * 长按配置选项
 */
interface UseLongPressOptions {
  /**
   * 长按触发阈值，单位毫秒，默认 500ms
   */
  threshold?: number;
  /**
   * 长按触发时的回调函数
   * @param e - 触发事件的 React 合成事件对象
   * @param clientX - 触发点相对于视口的 X 坐标
   * @param clientY - 触发点相对于视口的 Y 坐标
   */
  onLongPress: (e: React.MouseEvent | React.TouchEvent, clientX: number, clientY: number) => void;
  /**
   * 短按（未触发长按）结束时的回调函数
   * @param e - 触发事件的 React 合成事件对象
   */
  onClick?: (e: React.MouseEvent | React.TouchEvent) => void;
}

/**
 * 坐标点类型
 */
interface Position {
  x: number;
  y: number;
}

/**
 * 手指移动取消长按的阈值，单位像素
 */
const TOUCH_MOVE_THRESHOLD = 10;

/**
 * 长按交互 Hook
 *
 * 功能说明：
 * - 同时支持鼠标与触摸设备的长按识别。
 * - 在触摸设备上通过标记 touch 状态，避免浏览器模拟的 mouse 事件造成重复触发。
 * - 手指移动超过阈值时取消长按定时器，防止轻微滑动误触发。
 * - 阻止默认浏览器上下文菜单，避免与自定义菜单冲突。
 *
 * @param options - 长按配置选项
 * @returns 可直接绑定到 DOM 元素的事件处理对象
 */
export function useLongPress(options: UseLongPressOptions) {
  const { threshold = 500, onLongPress, onClick } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressTriggered = useRef(false);
  const startPosRef = useRef<Position>({ x: 0, y: 0 });
  /**
   * 标记当前是否处于触摸会话中，用于 touchmove 判断是否取消长按
   */
  const isTouchActiveRef = useRef(false);
  /**
   * 标记本次交互是否由触摸发起，用于忽略后续模拟的 mouse 事件
   */
  const hasTouchRef = useRef(false);

  /**
   * 取消长按定时器并清理触摸状态
   */
  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    isTouchActiveRef.current = false;
  }, []);

  /**
   * 长按/点击开始处理
   *
   * 核心逻辑：
   * - 触摸开始时记录起始坐标、标记触摸状态，并调用 preventDefault 阻止浏览器默认菜单与 mouse 模拟事件。
   * - 若已由触摸发起，则忽略鼠标事件，避免重复创建定时器。
   * - 启动定时器，到达阈值后触发 onLongPress。
   */
  const start = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      isLongPressTriggered.current = false;

      if ('touches' in e) {
        // 触摸事件：记录坐标、阻止默认行为（系统菜单、mouse 模拟）
        if (e.touches.length === 0) {
          return;
        }
        isTouchActiveRef.current = true;
        hasTouchRef.current = true;
        startPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        e.preventDefault();
      } else {
        // 鼠标事件：如果本次交互已经由触摸发起，则忽略模拟 mouse 事件
        if (hasTouchRef.current) {
          return;
        }
        startPosRef.current = { x: e.clientX, y: e.clientY };
      }

      const { x, y } = startPosRef.current;
      timerRef.current = setTimeout(() => {
        isLongPressTriggered.current = true;
        onLongPress(e, x, y);
      }, threshold);
    },
    [onLongPress, threshold]
  );

  /**
   * 长按/点击结束处理
   *
   * 核心逻辑：
   * - 若未触发长按且提供了 onClick，则触发点击回调。
   * - 清理定时器与状态。
   */
  const handleEnd = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isLongPressTriggered.current && onClick) {
        onClick(e);
      }
      cancel();
    },
    [onClick, cancel]
  );

  /**
   * 触摸结束处理
   *
   * 核心逻辑：
   * - 复用通用的结束处理。
   * - 延迟重置 hasTouchRef，避免浏览器在 touch 结束后模拟的 mouse 事件再次触发点击。
   */
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      handleEnd(e);
      window.setTimeout(() => {
        hasTouchRef.current = false;
      }, 0);
    },
    [handleEnd]
  );

  /**
   * 触摸移动处理
   *
   * 核心逻辑：
   * - 若手指移动距离超过阈值，则取消长按定时器。
   * - 未超过阈值时保留定时器，允许轻微抖动。
   */
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isTouchActiveRef.current || e.touches.length === 0) {
        return;
      }
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - startPosRef.current.x);
      const dy = Math.abs(touch.clientY - startPosRef.current.y);
      if (dx > TOUCH_MOVE_THRESHOLD || dy > TOUCH_MOVE_THRESHOLD) {
        cancel();
      }
    },
    [cancel]
  );

  /**
   * 阻止默认上下文菜单
   *
   * 核心逻辑：
   * - 阻止浏览器默认的右键/长按上下文菜单，避免与自定义菜单同时弹出。
   */
  const handleContextMenu = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: handleEnd,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove,
    onTouchCancel: cancel,
    onContextMenu: handleContextMenu,
  };
}
