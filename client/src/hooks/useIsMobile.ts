import { useState, useEffect } from 'react';

/**
 * 移动端检测 Hook
 * 用于检测当前设备是否为移动端（屏幕宽度 < 768px）
 * @returns {boolean} 是否为移动端
 */
const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();

    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  return isMobile;
};

export default useIsMobile;
