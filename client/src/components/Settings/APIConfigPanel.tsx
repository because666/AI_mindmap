import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Plus, Trash2, Cpu, Zap } from 'lucide-react';
import { useAPIConfigStore } from '../../stores/apiConfigStore';
import { AI_PROVIDERS } from '../../utils/aiModels';
import { chatService } from '../../services/chatService';
import type { AIProvider } from '../../types';
import AddModelModal from './AddModelModal';

/**
 * 内置服务信息接口
 */
interface BuiltInServiceInfo {
  /** 服务商显示名称 */
  providerName: string;
  /** 模型显示名称 */
  modelName: string;
}

/**
 * API配置面板组件
 * 展示模型配置列表，支持切换激活配置和删除配置，
 * 包含当前使用状态提示、创意度滑块和添加新模型入口
 */
const APIConfigPanel: React.FC = () => {
  const { t } = useTranslation('settings');
  const savedConfigs = useAPIConfigStore((s) => s.savedConfigs);
  const activeConfigId = useAPIConfigStore((s) => s.activeConfigId);
  const temperature = useAPIConfigStore((s) => s.temperature);
  const setActiveConfigId = useAPIConfigStore((s) => s.setActiveConfigId);
  const removeSavedConfig = useAPIConfigStore((s) => s.removeSavedConfig);
  const setTemperature = useAPIConfigStore((s) => s.setTemperature);

  const [isAddModelModalOpen, setIsAddModelModalOpen] = useState(false);
  const [builtInInfo, setBuiltInInfo] = useState<BuiltInServiceInfo>({
    providerName: '智谱AI',
    modelName: 'glm-4-flash',
  });

  /**
   * 组件挂载时从后端获取内置服务状态
   * 动态更新服务商名称，失败时保持默认值
   */
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const result = await chatService.getStatus();
        if (result.success && result.defaultProvider) {
          const providerKey = result.defaultProvider as AIProvider;
          const providerInfo = AI_PROVIDERS[providerKey];
          if (providerInfo) {
            setBuiltInInfo({
              providerName: providerInfo.name,
              modelName: 'glm-4-flash',
            });
          }
        }
      } catch {
        // 获取失败时使用默认内置服务信息
      }
    };
    fetchStatus();
  }, []);

  /**
   * 当前激活的模型配置
   * 从 savedConfigs 中查找与 activeConfigId 匹配的配置项
   */
  const activeConfig = savedConfigs.find((c) => c.id === activeConfigId) ?? null;

  /**
   * 处理配置卡片点击，切换激活配置
   * @param configId - 配置ID，传null表示切换回内置服务
   */
  const handleConfigClick = (configId: string | null): void => {
    setActiveConfigId(configId);
  };

  /**
   * 处理删除配置
   * 如果删除的是当前激活配置，store会自动切换回null（内置服务）
   * @param configId - 要删除的配置ID
   */
  const handleDelete = (configId: string): void => {
    removeSavedConfig(configId);
  };

  /**
   * 打开添加模型弹窗
   */
  const handleOpenAddModal = (): void => {
    setIsAddModelModalOpen(true);
  };

  /**
   * 关闭添加模型弹窗
   */
  const handleCloseModal = (): void => {
    setIsAddModelModalOpen(false);
  };

  /**
   * 处理创意度滑块变化
   * @param event - range input变化事件
   */
  const handleTemperatureChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setTemperature(parseFloat(event.target.value));
  };

  return (
    <div className="space-y-4 p-1">
      {/* 当前使用状态提示 */}
      <div className="p-3 bg-primary-600/10 border border-primary-500/30 rounded-lg">
        {!activeConfigId ? (
          <p className="text-sm text-primary-400">
            ✅ {t('builtInAIService')} · {builtInInfo.providerName} · {builtInInfo.modelName}
          </p>
        ) : (
          <p className="text-sm text-primary-400">
            🤖 {activeConfig?.name ?? '未知配置'} · {AI_PROVIDERS[activeConfig?.provider ?? 'zhipu']?.name ?? '未知服务商'}
          </p>
        )}
      </div>

      {/* 模型配置列表 */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {/* 系统内置服务（不可删除） */}
        <div
          onClick={() => handleConfigClick(null)}
          className={`flex items-center gap-3 p-3 bg-dark-700 rounded-lg cursor-pointer hover:bg-dark-600 transition-colors ${
            activeConfigId === null ? 'border border-primary-500/50' : 'border border-transparent'
          }`}
        >
          <Cpu className="w-4 h-4 text-dark-200 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-dark-200 font-medium">{t('builtInService')}</p>
            <p className="text-xs text-dark-400">
              {builtInInfo.providerName} · {builtInInfo.modelName}
            </p>
          </div>
          {activeConfigId === null && (
            <CheckCircle className="w-4 h-4 text-primary-400 flex-shrink-0" />
          )}
        </div>

        {/* 已保存的用户配置列表 */}
        {savedConfigs.map((config) => (
          <div
            key={config.id}
            onClick={() => handleConfigClick(config.id)}
            className={`flex items-center gap-3 p-3 bg-dark-700 rounded-lg cursor-pointer hover:bg-dark-600 transition-colors ${
              activeConfigId === config.id ? 'border border-primary-500/50' : 'border border-transparent'
            }`}
          >
            <Zap className="w-4 h-4 text-dark-200 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-dark-200 font-medium truncate">{config.name}</p>
              <p className="text-xs text-dark-400 truncate">
                {AI_PROVIDERS[config.provider]?.name ?? config.provider}
                {config.description ? ` · ${config.description}` : ''}
              </p>
            </div>
            {activeConfigId === config.id && (
              <CheckCircle className="w-4 h-4 text-primary-400 flex-shrink-0" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(config.id);
              }}
              className="p-1 text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* 添加新模型配置按钮 */}
      <button
        onClick={handleOpenAddModal}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-lg text-dark-200 hover:bg-dark-600 hover:text-white transition-all text-sm"
      >
        <Plus className="w-4 h-4" />
        {t('addNewModelConfig')}
      </button>

      {/* 创意度滑块 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-dark-300">{t('creativity')}</label>
          <span className="text-sm text-primary-400 font-mono">{temperature.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={temperature}
          onChange={handleTemperatureChange}
          className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-dark-500">{t('precise')}</span>
          <span className="text-xs text-dark-500">{t('creative')}</span>
        </div>
      </div>

      {/* 添加模型弹窗 */}
      <AddModelModal
        isOpen={isAddModelModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default APIConfigPanel;
