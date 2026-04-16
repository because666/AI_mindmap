import React, { useState, useMemo } from 'react';
import { Settings, Server, Key, Globe, Plus, Trash2, Edit3, X } from 'lucide-react';
import { useAPIConfigStore } from '../../stores/apiConfigStore';
import { AI_PROVIDERS } from '../../utils/aiModels';
import type { AIProvider, AIModel } from '../../types';

interface APIConfigPanelProps {
}

/**
 * 自定义模型表单组件
 */
const CustomModelForm: React.FC<{
  provider: AIProvider;
  onSave: (model: Omit<AIModel, 'id'>) => void;
  onCancel: () => void;
  editModel?: AIModel | null;
}> = ({ provider, onSave, onCancel, editModel }) => {
  const [name, setName] = useState(editModel?.name || '');
  const [modelIdInput, setModelIdInput] = useState(editModel?.id?.replace(/^custom-/, '') || '');
  const [description, setDescription] = useState(editModel?.description || '');
  const [maxTokens, setMaxTokens] = useState(String(editModel?.maxTokens || 4096));

  const handleSubmit = () => {
    if (!name.trim() || !modelIdInput.trim()) return;
    onSave({
      name: name.trim(),
      provider,
      description: description.trim(),
      maxTokens: parseInt(maxTokens, 10) || 4096,
    });
  };

  return (
    <div className="p-4 bg-dark-800/50 border border-dark-600/50 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">
          {editModel ? '编辑模型' : '添加自定义模型'}
        </span>
        <button onClick={onCancel} className="p-1 text-dark-400 hover:text-white rounded transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label className="block text-xs text-dark-400 mb-1">模型名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如：GPT-4o、Claude-3.5-Sonnet"
          className="input-field"
        />
      </div>

      <div>
        <label className="block text-xs text-dark-400 mb-1">模型ID（API调用标识）</label>
        <input
          type="text"
          value={modelIdInput}
          onChange={(e) => setModelIdInput(e.target.value)}
          placeholder="如：gpt-4o、claude-3-5-sonnet-20241022"
          className="input-field font-mono text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-dark-400 mb-1">描述（可选）</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="简要说明模型特点或用途"
          className="input-field"
        />
      </div>

      <div>
        <label className="block text-xs text-dark-400 mb-1">最大Token数</label>
        <input
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(e.target.value)}
          min={256}
          max={200000}
          className="input-field font-mono text-sm"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!name.trim() || !modelIdInput.trim()}
        className="btn-primary w-full py-2 text-sm"
      >
        {editModel ? '保存修改' : '添加模型'}
      </button>
    </div>
  );
};

/**
 * API配置面板组件
 * 仅显示用户自定义模型，隐藏所有内置默认模型数据
 */
const APIConfigPanel: React.FC<APIConfigPanelProps> = () => {
  const {
    config,
    customModels,
    setProvider,
    setModel,
    setApiKey,
    setBaseUrl,
    resetConfig,
    addCustomModel,
    removeCustomModel,
    updateCustomModel,
    getCustomModelsByProvider,
  } = useAPIConfigStore();

  const [showAddModelForm, setShowAddModelForm] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

  /**
   * 获取当前提供商的自定义模型列表（安全过滤）
   * 仅返回用户自己添加的模型，不包含任何默认模型
   */
  const currentModels: AIModel[] = useMemo(() => {
    return getCustomModelsByProvider(config.provider);
  }, [config.provider, customModels]);

  /**
   * 当前选中模型的显示信息
   */
  const selectedModelInfo: AIModel | undefined = useMemo(() => {
    if (!config.modelId) return undefined;
    return customModels.find(m => m.id === config.modelId);
  }, [config.modelId, customModels]);

  /**
   * 处理提供商切换
   */
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider as AIProvider);
    setShowAddModelForm(false);
    setEditingModelId(null);
    setModel('');
  };

  /**
   * 处理模型选择变更（安全验证：仅允许选择自定义模型）
   */
  const handleModelChange = (modelId: string) => {
    const isValidModel = customModels.some(m => m.id === modelId && m.provider === config.provider);
    if (!isValidModel) return;

    setModel(modelId);
  };

  /**
   * 添加自定义模型
   */
  const handleAddModel = (modelData: Omit<AIModel, 'id'>) => {
    addCustomModel(modelData);
    setShowAddModelForm(false);

    if (!config.modelId) {
      setModel(`custom-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`);
    }
  };

  /**
   * 开始编辑模型
   */
  const handleStartEdit = (modelId: string) => {
    setEditingModelId(modelId);
    setShowAddModelForm(false);
  };

  /**
   * 保存编辑的模型
   */
  const handleSaveEdit = (updates: Omit<AIModel, 'id'>) => {
    if (!editingModelId) return;
    updateCustomModel(editingModelId, updates);
    setEditingModelId(null);
  };

  /**
   * 删除自定义模型（带确认）
   */
  const handleDeleteModel = (modelId: string) => {
    if (!confirm('确定要删除此模型吗？')) return;
    removeCustomModel(modelId);
  };

  /**
   * 取消编辑
   */
  const handleCancelEdit = () => {
    setEditingModelId(null);
    setShowAddModelForm(false);
  };

  return (
    <div className="space-y-6 p-1">
      {/* 标题 */}
      <div className="flex items-center gap-2 pb-2 border-b border-dark-700">
        <Settings className="w-5 h-5 text-primary-400" />
        <h2 className="text-lg font-semibold text-white">API 配置</h2>
      </div>

      {/* 服务商选择 */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-dark-300 mb-2">
          <Server className="w-4 h-4" />
          AI 服务提供商
        </label>
        <select
          value={config.provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-xl text-white focus:border-primary-500 focus:outline-none appearance-none cursor-pointer transition-colors text-sm"
        >
          {Object.entries(AI_PROVIDERS).map(([key, { name }]) => (
            <option key={key} value={key}>{name}</option>
          ))}
        </select>
      </div>

      {/* 模型管理区域 */}
      <div>
        <label className="flex items-center justify-between text-sm font-medium text-dark-300 mb-2">
          <span className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            AI 模型
          </span>
          {!editingModelId && !showAddModelForm && (
            <button
              onClick={() => setShowAddModelForm(true)}
              className="flex items-center gap-1 px-2 py-1 text-primary-400 hover:text-primary-300 text-xs rounded-lg hover:bg-primary-600/10 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              添加模型
            </button>
          )}
        </label>

        {currentModels.length > 0 ? (
          <>
            <select
              value={config.modelId}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-xl text-white focus:border-primary-500 focus:outline-none appearance-none cursor-pointer transition-colors text-sm"
            >
              <option value="">请选择模型</option>
              {currentModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.id})
                </option>
              ))}
            </select>

            {selectedModelInfo && (
              <p className="mt-2 text-xs text-dark-400 leading-relaxed">
                {selectedModelInfo.description || `最大Token: ${selectedModelInfo.maxTokens.toLocaleString()}`}
              </p>
            )}

            {/* 已添加的模型列表 */}
            <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
              {currentModels.map((model) => (
                <div key={model.id} className="flex items-center gap-2 p-2.5 bg-dark-800/60 rounded-lg group">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{model.name}</div>
                    <div className="text-dark-500 text-xs font-mono truncate">{model.id}</div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartEdit(model.id)}
                      className="p-1.5 text-dark-400 hover:text-primary-400 rounded-md hover:bg-dark-700 transition-all"
                      title="编辑"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteModel(model.id)}
                      className="p-1.5 text-dark-400 hover:text-red-400 rounded-md hover:bg-dark-700 transition-all"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8 px-4 bg-dark-800/30 border border-dashed border-dark-600/50 rounded-xl">
            <Server className="w-10 h-10 mx-auto mb-3 text-dark-600" />
            <p className="text-dark-400 text-sm mb-3">尚未添加自定义模型</p>
            <p className="text-dark-500 text-xs mb-4">
              请先为当前服务商添加至少一个自定义模型
            </p>
            <button
              onClick={() => setShowAddModelForm(true)}
              className="btn-primary inline-flex items-center gap-1.5 text-sm"
            >
              <Plus className="w-4 h-4" />
              添加第一个模型
            </button>
          </div>
        )}

        {/* 编辑模型表单 */}
        {editingModelId && (
          <div className="mt-3 animate-in">
            <CustomModelForm
              provider={config.provider}
              editModel={customModels.find(m => m.id === editingModelId) || null}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
            />
          </div>
        )}
      </div>

      {/* 添加模型表单 */}
      {showAddModelForm && !editingModelId && (
        <div className="animate-in">
          <CustomModelForm
            provider={config.provider}
            onSave={handleAddModel}
            onCancel={handleCancelEdit}
          />
        </div>
      )}

      {/* API密钥 */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-dark-300 mb-2">
          <Key className="w-4 h-4" />
          API 密钥
        </label>
        <div className="relative">
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="输入你的API密钥..."
            className="w-full pl-4 pr-12 py-2.5 bg-dark-800 border border-dark-600 rounded-xl text-white placeholder-dark-500 focus:border-primary-500 focus:outline-none transition-colors text-sm pr-10"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(config.apiKey);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-dark-400 hover:text-white rounded-md hover:bg-dark-700 transition-all"
            title="复制密钥"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          </button>
        </div>
        <p className="mt-1.5 text-xs text-dark-500">
          获取密钥：
          <a href={config.provider === 'zhipu' ? 'https://open.bigmodel.cn/' : config.provider === 'openai' ? 'https://platform.openai.com/api-keys' : 'https://console.anthropic.com/settings/keys'} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300 underline ml-1">
            {config.provider === 'zhipu' ? 'https://open.bigmodel.cn/' : config.provider === 'openai' ? 'platform.openai.com' : 'console.anthropic.com'}
          </a>
        </p>
      </div>

      {/* 基础URL */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-dark-300 mb-2">
          <Globe className="w-4 h-4" />
          API 基础地址（可选）
        </label>
        <input
          type="url"
          value={config.baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={`默认: ${AI_PROVIDERS[config.provider].baseUrl}`}
          className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-xl text-white placeholder-dark-500 focus:border-primary-500 focus:outline-none transition-colors text-sm"
        />
        <p className="mt-1.5 text-xs text-dark-500">
          留空使用默认地址，支持自定义代理地址
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={resetConfig}
          className="px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-xl text-dark-300 hover:bg-dark-600 hover:text-white transition-all"
        >
          重置配置
        </button>
      </div>
    </div>
  );
};

export default APIConfigPanel;
