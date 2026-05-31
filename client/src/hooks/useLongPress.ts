import { useCallback, useRef } from 'react';

interface UseLongPressOptions {
  threshold?: number;
  onLongPress: (e: React.MouseEvent | React.TouchEvent, clientX: number, clientY: number) => void;
  onClick?: (e: React.MouseEvent | React.TouchEvent) => void;
}

export function useLongPress(options: UseLongPressOptions) {
  const {
    threshold = 500,
    onLongPress,
    onClick
  } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressTriggered = useRef(false);
  const posRef = useRef({ x: 0, y: 0 });

  const start = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isLongPressTriggered.current = false;

    if ('touches' in e) {
      posRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else {
      posRef.current = { x: e.clientX, y: e.clientY };
    }

    const { x, y } = posRef.current;
    timerRef.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      onLongPress(e, x, y);
    }, threshold);
  }, [onLongPress, threshold]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isLongPressTriggered.current && onClick) {
      onClick(e);
    }
    cancel();
  }, [onClick, cancel]);

  const mouseEventHandlers = {
    onMouseDown: start,
    onMouseUp: handleEnd,
    onMouseLeave: cancel,
  };

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
