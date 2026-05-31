import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { X, Server, Key, Globe, Cpu, Save, AlertCircle } from 'lucide-react';
import { AI_PROVIDERS, PRESET_MODELS, getPresetModelById } from '../../utils/aiModels';
import { useAPIConfigStore, createConfigId } from '../../stores/apiConfigStore';
import { useToastStore } from '../../stores/toastStore';
import type { AIProvider, ModelConfig } from '../../types';

/**
 * API格式选项类型
 */
type APIFormat = 'openai' | 'zhipu' | 'anthropic' | 'deepseek';

/**
 * 弹窗标签页类型
 */
type ModalTab = 'provider' | 'custom';

/**
 * 添加模型弹窗组件Props接口
 */
interface AddModelModalProps {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 关闭弹窗回调 */
  onClose: () => void;
}

/**
 * 服务商标签页表单状态
 */
interface ProviderFormState {
  provider: AIProvider;
  modelId: string;
  apiKey: string;
}

/**
 * 自定义配置标签页表单状态
 */
interface CustomFormState {
  apiFormat: APIFormat;
  baseUrl: string;
  modelId: string;
  modelName: string;
  apiKey: string;
}

/**
 * 根据服务商获取预设模型列表
 * @param provider - 服务商类型
 * @returns 该服务商下的预设模型列表
 */
const getPresetModelsByProvider = (provider: AIProvider) => {
  return PRESET_MODELS.filter((model) => model.provider === provider);
};

/**
 * API格式选项映射
 */
const API_FORMAT_OPTIONS: { value: APIFormat; label: string }[] = [
  { value: 'openai', label: 'OpenAI兼容格式' },
  { value: 'zhipu', label: '智谱格式' },
  { value: 'anthropic', label: 'Anthropic格式' },
  { value: 'deepseek', label: 'DeepSeek格式' },
];

/**
 * 添加模型弹窗组件
 * 支持"模型服务商"和"自定义配置"两种添加方式
 */
const AddModelModal: React.FC<AddModelModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('provider');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [providerForm, setProviderForm] = useState<ProviderFormState>({
    provider: 'zhipu',
    modelId: '',
    apiKey: '',
  });

  const [customForm, setCustomForm] = useState<CustomFormState>({
    apiFormat: 'openai',
    baseUrl: '',
    modelId: '',
    modelName: '',
    apiKey: '',
  });

  /**
   * 弹窗打开时重置错误状态
   */
  useEffect(() => {
    if (isOpen) {
      setErrors({});
    }
  }, [isOpen]);

  /**
   * 获取当前服务商的预设模型列表
   */
  const presetModels = useMemo(() => {
    return getPresetModelsByProvider(providerForm.provider);
  }, [providerForm.provider]);

  /**
   * 处理服务商变更
   * 如果当前选中的模型不在新服务商列表中，清空模型选择
   */
  const handleProviderChange = useCallback(
    (newProvider: AIProvider) => {
      setProviderForm((prev) => {
        const newModels = getPresetModelsByProvider(newProvider);
        const modelExists = newModels.some((m) => m.id === prev.modelId);
        return {
          ...prev,
          provider: newProvider,
          modelId: modelExists ? prev.modelId : '',
        };
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next.providerModelId;
        return next;
      });
    },
    []
  );

  /**
   * 处理服务商标签页表单字段变更
   */
  const handleProviderFormChange = useCallback(
    <K extends keyof ProviderFormState>(field: K, value: ProviderFormState[K]) => {
      setProviderForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`provider${field.charAt(0).toUpperCase() + field.slice(1)}`];
        return next;
      });
    },
    []
  );

  /**
   * 处理自定义标签页表单字段变更
   */
  const handleCustomFormChange = useCallback(
    <K extends keyof CustomFormState>(field: K, value: CustomFormState[K]) => {
      setCustomForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`custom${field.charAt(0).toUpperCase() + field.slice(1)}`];
        return next;
      });
    },
    []
  );

  /**
   * 验证服务商标签页表单
   * @returns 是否验证通过
   */
  const validateProviderForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!providerForm.modelId.trim()) {
      newErrors.providerModelId = '请选择模型';
    }
    if (!providerForm.apiKey.trim()) {
      newErrors.providerApiKey = '请输入API密钥';
    }
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  }, [providerForm]);

  /**
   * 验证自定义标签页表单
   * @returns 是否验证通过
   */
  const validateCustomForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!customForm.modelId.trim()) {
      newErrors.customModelId = '请输入模型ID';
    }
    if (!customForm.apiKey.trim()) {
      newErrors.customApiKey = '请输入API密钥';
    }
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  }, [customForm]);

  /**
   * 处理服务商标签页保存操作
   * 构建ModelConfig对象并直接写入store
   */
  const handleProviderSave = useCallback(() => {
    if (!providerForm.provider || !providerForm.modelId.trim() || !providerForm.apiKey.trim()) {
      return;
    }

    const presetModel = getPresetModelById(providerForm.modelId);
    const config: ModelConfig = {
      id: createConfigId(),
      name: presetModel?.name || providerForm.modelId,
      provider: providerForm.provider,
      modelId: providerForm.modelId,
      apiKey: providerForm.apiKey.trim(),
      baseUrl: AI_PROVIDERS[providerForm.provider].baseUrl,
      isCustom: false,
      description: presetModel?.description || '',
      isMultimodal: presetModel?.isMultimodal || false,
    };

    useAPIConfigStore.getState().addSavedConfig(config);
    useToastStore.getState().addToast('success', '配置已保存');
    onClose();
  }, [providerForm, onClose]);

  /**
   * 处理自定义配置标签页保存操作
   * 构建ModelConfig对象并直接写入store
   */
  const handleCustomSave = useCallback(() => {
    if (!customForm.apiFormat || !customForm.modelId.trim() || !customForm.apiKey.trim()) {
      return;
    }

    const provider = customForm.apiFormat as AIProvider;
    let processedBaseUrl = customForm.baseUrl.trim();
    if (processedBaseUrl.endsWith('/chat/completions')) {
      processedBaseUrl = processedBaseUrl.slice(0, -'/chat/completions'.length);
    }
    const config: ModelConfig = {
      id: createConfigId(),
      name: customForm.modelName.trim() || customForm.modelId.trim(),
      provider,
      modelId: customForm.modelId.trim(),
      apiKey: customForm.apiKey.trim(),
      baseUrl: processedBaseUrl || undefined,
      apiFormat: customForm.apiFormat,
      isCustom: true,
      description: processedBaseUrl ? `中转站: ${processedBaseUrl}` : '',
    };

    useAPIConfigStore.getState().addSavedConfig(config);
    useToastStore.getState().addToast('success', '配置已保存');
    onClose();
  }, [customForm, onClose]);

  /**
   * 根据当前标签页分发保存操作
   */
  const handleSave = useCallback(() => {
    if (activeTab === 'provider') {
      if (!validateProviderForm()) return;
      handleProviderSave();
    } else {
      if (!validateCustomForm()) return;
      handleCustomSave();
    }
  }, [activeTab, validateProviderForm, validateCustomForm, handleProviderSave, handleCustomSave]);

  /**
   * 处理弹窗关闭
   */
  const handleClose = useCallback(() => {
    setErrors({});
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const tabs: { id: ModalTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'provider',
      label: '模型服务商',
      icon: <Server className="w-4 h-4" />,
    },
    {
      id: 'custom',
      label: '自定义配置',
      icon: <Cpu className="w-4 h-4" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* 弹窗内容 */}
      <div className="relative w-full max-w-lg mx-4 bg-dark-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-white">添加模型</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 标签页切换 */}
        <div className="flex border-b border-dark-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors min-h-[44px] flex-1 justify-center ${
                activeTab === tab.id
                  ? 'text-primary-400 border-b-2 border-primary-400 bg-dark-800/50'
                  : 'text-dark-400 hover:text-white hover:bg-dark-800/30'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* 表单内容 */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {activeTab === 'provider' && (
            <div className="space-y-5">
              {/* 服务商选择 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-dark-300 mb-2">
                  <Server className="w-4 h-4" />
                  服务商
                </label>
                <select
                  value={providerForm.provider}
                  onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                  className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-xl text-white focus:border-primary-500 focus:outline-none appearance-none cursor-pointer transition-colors text-sm"
                >
                  {Object.entries(AI_PROVIDERS).map(([key, { name }]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 模型选择 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-dark-300 mb-2">
                  <Cpu className="w-4 h-4" />
                  模型
                </label>
                <select
                  value={providerForm.modelId}
                  onChange={(e) => handleProviderFormChange('modelId', e.target.value)}
                  className={`w-full px-4 py-2.5 bg-dark-800 border rounded-xl text-white focus:outline-none appearance-none cursor-pointer transition-colors text-sm ${
                    errors.providerModelId ? 'border-red-500 focus:border-red-500' : 'border-dark-600 focus:border-primary-500'
                  }`}
                >
                  <option value="">请选择模型</option>
                  {presetModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} - {model.description}
                      {model.isMultimodal ? ' [多模态]' : ''}
                    </option>
                  ))}
                </select>
                {errors.providerModelId && (
                  <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.providerModelId}
                  </p>
                )}
                {providerForm.modelId && (
                  <p className="mt-1.5 text-xs text-dark-400">
                    {(() => {
                      const model = PRESET_MODELS.find((m) => m.id === providerForm.modelId);
                      return model ? `最大Token: ${model.maxTokens.toLocaleString()}` : '';
                    })()}
                  </p>
                )}
              </div>

              {/* API密钥 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-dark-300 mb-2">
                  <Key className="w-4 h-4" />
                  API密钥
                </label>
                <input
                  type="password"
                  value={providerForm.apiKey}
                  onChange={(e) => handleProviderFormChange('apiKey', e.target.value)}
                  placeholder="输入你的API密钥..."
                  className={`w-full px-4 py-2.5 bg-dark-800 border rounded-xl text-white placeholder-dark-500 focus:outline-none transition-colors text-sm ${
                    errors.providerApiKey ? 'border-red-500 focus:border-red-500' : 'border-dark-600 focus:border-primary-500'
                  }`}
                />
                {errors.providerApiKey && (
                  <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.providerApiKey}
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="space-y-5">
              {/* API格式选择 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-dark-300 mb-2">
                  <Server className="w-4 h-4" />
                  API格式
                </label>
                <select
                  value={customForm.apiFormat}
                  onChange={(e) => handleCustomFormChange('apiFormat', e.target.value as APIFormat)}
                  className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-xl text-white focus:border-primary-500 focus:outline-none appearance-none cursor-pointer transition-colors text-sm"
                >
                  {API_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 请求地址 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-dark-300 mb-2">
                  <Globe className="w-4 h-4" />
                  请求地址
                  <span className="text-xs text-dark-500">（选填，用于中转站）</span>
                </label>
                <input
                  type="url"
                  value={customForm.baseUrl}
                  onChange={(e) => handleCustomFormChange('baseUrl', e.target.value)}
                  placeholder="如 https://api.openai.com/v1"
                  className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-xl text-white placeholder-dark-500 focus:border-primary-500 focus:outline-none transition-colors text-sm"
                />
                <p className="mt-1.5 text-xs text-dark-500">请填写API基础地址，无需包含 /chat/completions</p>
              </div>

              {/* 模型名称 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-dark-300 mb-2">
                  模型名称
                  <span className="text-xs text-dark-500">（选填，不填则使用模型ID）</span>
                </label>
                <input
                  type="text"
                  value={customForm.modelName}
                  onChange={(e) => handleCustomFormChange('modelName', e.target.value)}
                  placeholder="如 我的GPT-4o"
                  className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-xl text-white placeholder-dark-500 focus:border-primary-500 focus:outline-none transition-colors text-sm"
                />
              </div>

              {/* 模型ID */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-dark-300 mb-2">
                  <Cpu className="w-4 h-4" />
                  模型ID
                </label>
                <input
                  type="text"
                  value={customForm.modelId}
                  onChange={(e) => handleCustomFormChange('modelId', e.target.value)}
                  placeholder="如 gpt-4o, deepseek-chat"
                  className={`w-full px-4 py-2.5 bg-dark-800 border rounded-xl text-white placeholder-dark-500 focus:outline-none transition-colors text-sm ${
                    errors.customModelId ? 'border-red-500 focus:border-red-500' : 'border-dark-600 focus:border-primary-500'
                  }`}
                />
                {errors.customModelId && (
                  <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.customModelId}
                  </p>
                )}
              </div>

              {/* API密钥 */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-dark-300 mb-2">
                  <Key className="w-4 h-4" />
                  API密钥
                </label>
                <input
                  type="password"
                  value={customForm.apiKey}
                  onChange={(e) => handleCustomFormChange('apiKey', e.target.value)}
                  placeholder="输入你的API密钥..."
                  className={`w-full px-4 py-2.5 bg-dark-800 border rounded-xl text-white placeholder-dark-500 focus:outline-none transition-colors text-sm ${
                    errors.customApiKey ? 'border-red-500 focus:border-red-500' : 'border-dark-600 focus:border-primary-500'
                  }`}
                />
                {errors.customApiKey && (
                  <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.customApiKey}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-700">
          <button
            onClick={handleClose}
            className="px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-xl text-dark-300 hover:bg-dark-600 hover:text-white transition-all text-sm font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors shadow-lg text-sm"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddModelModal;
