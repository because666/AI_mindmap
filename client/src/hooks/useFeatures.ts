import { useState, useEffect, useCallback } from 'react';
import { featuresApi, type FeatureVisibility } from '../services/api';

/**
 * 功能开关 Hook 返回值接口
 */
interface UseFeaturesResult {
  /** 功能开关可见性映射 */
  features: FeatureVisibility;
  /** 是否正在加载 */
  loading: boolean;
  /** 判断指定功能是否可见 */
  isVisible: (key: string) => boolean;
  /** 重新加载功能开关 */
  refresh: () => void;
}

/**
 * 功能开关 Hook
 * 从 /api/features 获取当前用户的功能开关状态
 * 提供isVisible方法判断指定功能是否对当前用户可见
 * @returns 功能开关状态和判断方法
 */
export function useFeatures(): UseFeaturesResult {
  const [features, setFeatures] = useState<FeatureVisibility>({});
  const [loading, setLoading] = useState(true);

  const loadFeatures = useCallback(async () => {
    setLoading(true);
    try {
      const data = await featuresApi.fetchFeatures();
      setFeatures(data);
    } catch (error) {
      console.error('加载功能开关失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  /**
   * 判断指定功能是否可见
   * 未加载完成时默认可见，避免功能闪烁
   * @param key - 功能开关键名
   * @returns 是否可见
   */
  const isVisible = useCallback((key: string): boolean => {
    if (loading) return true;
    if (key in features) return features[key];
    return true;
  }, [features, loading]);

  return { features, loading, isVisible, refresh: loadFeatures };
}
