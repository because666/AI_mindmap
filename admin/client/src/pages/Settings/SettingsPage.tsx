import React, { useState, useEffect } from 'react';
import { settingsApi } from '../../services/api';
import type { AdminIP, AdminFeatures, GrayRule, GrayRuleField, GrayRuleMatch, AIProvider } from '../../types';
import { Shield, Key, ToggleLeft, Plus, Trash2, Filter, X, Cpu, Edit2 } from 'lucide-react';

/**
 * 灰度规则编辑弹窗组件属性接口
 */
interface GrayRuleModalProps {
  /** 功能开关键名 */
  featureKey: string;
  /** 功能开关显示名称 */
  featureLabel: string;
  /** 当前灰度规则列表 */
  rules: GrayRule[];
  /** 保存回调 */
  onSave: (rules: GrayRule[]) => void;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * AI 服务商编辑弹窗组件属性接口
 */
interface AIProviderModalProps {
  /** 正在编辑的服务商，为 null 时表示新增模式 */
  provider: AIProvider | null;
  /** 已存在的服务商 ID 列表（用于唯一性校验，编辑时排除自身） */
  existingIds: string[];
  /** 保存回调 */
  onSave: (provider: AIProvider) => void;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 灰度规则编辑弹窗组件
 * 支持添加/删除灰度规则，每条规则可选择字段、匹配方式和值
 */
const GrayRuleModal: React.FC<GrayRuleModalProps> = ({ featureKey, featureLabel, rules, onSave, onClose }) => {
  const [localRules, setLocalRules] = useState<GrayRule[]>([...rules]);

  /** 字段选项列表 */
  const fieldOptions: { value: GrayRuleField; label: string }[] = [
    { value: 'userId', label: '用户ID' },
    { value: 'ip', label: 'IP地址' },
    { value: 'workspaceId', label: '工作区ID' },
  ];

  /** 匹配方式选项列表 */
  const matchOptions: { value: GrayRuleMatch; label: string }[] = [
    { value: 'equals', label: '精确匹配' },
    { value: 'contains', label: '包含' },
    { value: 'startsWith', label: '前缀匹配' },
    { value: 'regex', label: '正则表达式' },
  ];

  /**
   * 添加一条新的灰度规则
   */
  const handleAddRule = () => {
    setLocalRules([...localRules, { field: 'userId', match: 'equals', value: '' }]);
  };

  /**
   * 删除指定索引的灰度规则
   * @param index - 规则索引
   */
  const handleRemoveRule = (index: number) => {
    setLocalRules(localRules.filter((_, i) => i !== index));
  };

  /**
   * 更新指定索引的灰度规则
   * @param index - 规则索引
   * @param field - 更新的字段名
   * @param value - 更新的值
   */
  const handleUpdateRule = (index: number, field: keyof GrayRule, value: string) => {
    const updated = [...localRules];
    updated[index] = { ...updated[index], [field]: value };
    setLocalRules(updated);
  };

  /**
   * 保存灰度规则
   */
  const handleSave = () => {
    const validRules = localRules.filter((rule) => rule.value.trim() !== '');
    onSave(validRules);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">
            灰度规则 - {featureLabel}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 max-h-96 overflow-y-auto">
          {localRules.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              暂无灰度规则，点击下方按钮添加
            </div>
          ) : (
            <div className="space-y-3">
              {localRules.map((rule, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <select
                    value={rule.field}
                    onChange={(e) => handleUpdateRule(index, 'field', e.target.value)}
                    className="px-2 py-1.5 border rounded-lg text-sm bg-white min-w-[90px]"
                  >
                    {fieldOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

                  <select
                    value={rule.match}
                    onChange={(e) => handleUpdateRule(index, 'match', e.target.value)}
                    className="px-2 py-1.5 border rounded-lg text-sm bg-white min-w-[100px]"
                  >
                    {matchOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={rule.value}
                    onChange={(e) => handleUpdateRule(index, 'value', e.target.value)}
                    placeholder="匹配值"
                    className="flex-1 px-2 py-1.5 border rounded-lg text-sm"
                  />

                  <button
                    onClick={() => handleRemoveRule(index)}
                    className="p-1 text-gray-400 hover:text-red-600 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-gray-100">
          <button
            onClick={handleAddRule}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            <Plus className="w-4 h-4" /> 添加规则
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * AI 服务商编辑弹窗组件
 * 支持新增和编辑两种模式，校验必填字段和 ID 唯一性
 */
const AIProviderEditModal: React.FC<AIProviderModalProps> = ({ provider, existingIds, onSave, onClose }) => {
  const isEdit = provider !== null;
  const [form, setForm] = useState<AIProvider>(
    provider || {
      id: '',
      name: '',
      url: '',
      apiKey: '',
      model: '',
      priority: 0,
    }
  );
  const [error, setError] = useState('');

  /**
   * 更新表单字段
   * @param field - 字段名
   * @param value - 字段值
   */
  const handleFieldChange = (field: keyof AIProvider, value: string | number): void => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  /**
   * 保存服务商配置
   * 校验必填字段和 ID 唯一性
   */
  const handleSave = (): void => {
    if (!form.id.trim()) {
      setError('服务商 ID 不能为空');
      return;
    }
    if (!form.name.trim()) {
      setError('服务商名称不能为空');
      return;
    }
    if (!form.url.trim()) {
      setError('API 地址不能为空');
      return;
    }
    if (!form.apiKey.trim()) {
      setError('API 密钥不能为空');
      return;
    }
    if (!form.model.trim()) {
      setError('模型名称不能为空');
      return;
    }

    const checkIds = isEdit ? existingIds.filter((id) => id !== provider.id) : existingIds;
    if (checkIds.includes(form.id.trim())) {
      setError(`服务商 ID "${form.id.trim()}" 已存在，请使用其他 ID`);
      return;
    }

    onSave({
      ...form,
      id: form.id.trim(),
      name: form.name.trim(),
      url: form.url.trim(),
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">
            {isEdit ? '编辑 AI 服务商' : '添加 AI 服务商'}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">服务商 ID</label>
              <input
                type="text"
                value={form.id}
                onChange={(e) => handleFieldChange('id', e.target.value)}
                placeholder="如：zhipu"
                disabled={isEdit}
                className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">显示名称</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="如：智谱GLM"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API 地址</label>
            <input
              type="text"
              value={form.url}
              onChange={(e) => handleFieldChange('url', e.target.value)}
              placeholder="如：https://open.bigmodel.cn/api/paas/v4"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API 密钥</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => handleFieldChange('apiKey', e.target.value)}
              placeholder="输入 API Key"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">默认模型</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => handleFieldChange('model', e.target.value)}
                placeholder="如：glm-4-flash"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">优先级</label>
              <input
                type="number"
                value={form.priority}
                onChange={(e) => handleFieldChange('priority', parseInt(e.target.value, 10) || 0)}
                min={0}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">数值越小优先级越高</p>
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ip' | 'password' | 'features' | 'aiProviders'>('ip');
  const [whitelist, setWhitelist] = useState<AdminIP[]>([]);
  const [currentIp, setCurrentIp] = useState('');
  const [features, setFeatures] = useState<AdminFeatures | null>(null);
  const [loading, setLoading] = useState(true);

  const [newIp, setNewIp] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  /** 灰度规则弹窗状态 */
  const [grayRuleModal, setGrayRuleModal] = useState<{
    open: boolean;
    featureKey: string;
    featureLabel: string;
  }>({ open: false, featureKey: '', featureLabel: '' });

  /** AI 服务商列表 */
  const [aiProviders, setAIProviders] = useState<AIProvider[]>([]);
  /** AI 服务商编辑弹窗状态 */
  const [providerModal, setProviderModal] = useState<{
    open: boolean;
    provider: AIProvider | null;
  }>({ open: false, provider: null });
  /** AI 服务商保存提示 */
  const [providerMessage, setProviderMessage] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [wlRes, ftRes, aiRes] = await Promise.all([
        settingsApi.getIpWhitelist(),
        settingsApi.getFeatures(),
        settingsApi.getAIProviders(),
      ]);
      const wlData = wlRes.data.data as { whitelist: AdminIP[]; currentIp: string };
      setWhitelist(wlData?.whitelist || []);
      setCurrentIp(wlData?.currentIp || '');
      setFeatures(ftRes.data.data as AdminFeatures);
      setAIProviders((aiRes.data.data as AIProvider[]) || []);
    } catch (error) {
      console.error('加载设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddIp = async () => {
    if (!newIp || !newNickname) return;
    try {
      await settingsApi.addIp(newIp, newNickname);
      setNewIp('');
      setNewNickname('');
      loadData();
    } catch (error) {
      console.error('添加IP失败:', error);
    }
  };

  const handleRemoveIp = async (ip: string) => {
    const isSelf = ip === currentIp;
    if (isSelf && !confirm('确定要删除自己的IP吗？删除后将无法访问后台')) return;
    try {
      await settingsApi.removeIp(ip, isSelf);
      loadData();
    } catch (error) {
      console.error('删除IP失败:', error);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (newPassword !== confirmPassword) {
      setMessage('新密码与确认密码不一致');
      return;
    }
    try {
      await settingsApi.changePassword(oldPassword, newPassword, confirmPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('密码修改成功');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setMessage(err.response?.data?.error || '修改失败');
    }
  };

  /**
   * 切换功能开关状态
   * @param key - 功能开关键名
   */
  const handleToggleFeature = async (key: keyof AdminFeatures) => {
    if (!features) return;
    const updated = { ...features, [key]: !features[key] };
    setFeatures(updated);
    try {
      await settingsApi.updateFeatures(updated as Record<string, unknown>);
    } catch (error) {
      console.error('更新功能开关失败:', error);
      setFeatures(features);
    }
  };

  /**
   * 保存灰度规则
   * @param featureKey - 功能开关键名
   * @param rules - 新的灰度规则列表
   */
  const handleSaveGrayRules = async (featureKey: string, rules: GrayRule[]) => {
    if (!features) return;
    const updatedGrayRules = { ...(features.grayRules || {}) };
    if (rules.length > 0) {
      updatedGrayRules[featureKey] = rules;
    } else {
      delete updatedGrayRules[featureKey];
    }
    const updated = { ...features, grayRules: updatedGrayRules };
    setFeatures(updated);
    try {
      await settingsApi.updateFeatures(updated as Record<string, unknown>);
    } catch (error) {
      console.error('保存灰度规则失败:', error);
      setFeatures(features);
    }
    setGrayRuleModal({ open: false, featureKey: '', featureLabel: '' });
  };

  /**
   * 打开灰度规则编辑弹窗
   * @param featureKey - 功能开关键名
   * @param featureLabel - 功能开关显示名称
   */
  const handleOpenGrayRuleModal = (featureKey: string, featureLabel: string) => {
    setGrayRuleModal({ open: true, featureKey, featureLabel });
  };

  /**
   * 保存 AI 服务商配置到后端
   * @param providers - 服务商配置列表
   */
  const handleSaveAIProviders = async (providers: AIProvider[]): Promise<boolean> => {
    setProviderMessage('');
    try {
      await settingsApi.updateAIProviders(providers);
      setAIProviders(providers);
      setProviderMessage('AI 服务商配置已保存');
      return true;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      setProviderMessage(err.response?.data?.error || '保存失败');
      return false;
    }
  };

  /**
   * 打开 AI 服务商编辑弹窗（新增模式）
   */
  const handleAddProvider = (): void => {
    setProviderModal({ open: true, provider: null });
  };

  /**
   * 打开 AI 服务商编辑弹窗（编辑模式）
   * @param provider - 待编辑的服务商配置
   */
  const handleEditProvider = (provider: AIProvider): void => {
    setProviderModal({ open: true, provider });
  };

  /**
   * 删除指定 ID 的 AI 服务商
   * @param providerId - 服务商 ID
   */
  const handleDeleteProvider = async (providerId: string): Promise<void> => {
    if (!confirm(`确定要删除服务商 "${providerId}" 吗？`)) return;
    const updated = aiProviders.filter((p) => p.id !== providerId);
    await handleSaveAIProviders(updated);
  };

  /**
   * 保存单个服务商（新增或编辑）
   * @param provider - 服务商配置
   */
  const handleSaveProvider = async (provider: AIProvider): Promise<void> => {
    const isEdit = providerModal.provider !== null;
    let updated: AIProvider[];
    if (isEdit) {
      updated = aiProviders.map((p) => (p.id === providerModal.provider!.id ? provider : p));
    } else {
      updated = [...aiProviders, provider];
    }
    const success = await handleSaveAIProviders(updated);
    if (success) {
      setProviderModal({ open: false, provider: null });
    }
  };

  const tabs = [
    { key: 'ip' as const, label: 'IP白名单', icon: Shield },
    { key: 'password' as const, label: '修改密码', icon: Key },
    { key: 'features' as const, label: '功能开关', icon: ToggleLeft },
    { key: 'aiProviders' as const, label: 'AI 服务商', icon: Cpu },
  ];

  if (loading) return <div className="text-center py-20 text-gray-400">加载中...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">系统设置</h1>

      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'ip' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <div className="flex gap-2">
              <input type="text" placeholder="IP地址" value={newIp} onChange={(e) => setNewIp(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg text-sm" />
              <input type="text" placeholder="昵称" value={newNickname} onChange={(e) => setNewNickname(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg text-sm" />
              <button onClick={handleAddIp} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                <Plus className="w-4 h-4" /> 添加
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {whitelist.map((ip) => (
              <div key={ip._id} className="p-4 flex justify-between items-center">
                <div>
                  <span className="font-medium text-gray-800">{ip.nickname}</span>
                  <span className="ml-2 text-sm text-gray-500">{ip.ipAddress}</span>
                  {ip.ipAddress === currentIp && <span className="ml-2 text-xs text-blue-500">（当前）</span>}
                  {ip.isFirstAdmin && <span className="ml-2 text-xs text-purple-500">超级管理员</span>}
                </div>
                <button onClick={() => handleRemoveIp(ip.ipAddress)} className="p-1 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'password' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 max-w-md">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <input type="password" placeholder="原密码" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm" required />
            <input type="password" placeholder="新密码（至少6位）" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm" required />
            <input type="password" placeholder="确认新密码" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm" required />
            {message && <p className={`text-sm ${message.includes('成功') ? 'text-green-600' : 'text-red-500'}`}>{message}</p>}
            <button type="submit" className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium">修改密码</button>
          </form>
        </div>
      )}

      {activeTab === 'features' && features && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="space-y-4">
            {([
              { key: 'sensitiveWordCheck' as const, label: '敏感词检测', desc: '自动检测对话中的敏感词' },
              { key: 'auditLog' as const, label: '审计日志', desc: '记录管理操作日志' },
              { key: 'dataExport' as const, label: '数据导出', desc: '允许导出系统数据' },
            ]).map((item) => {
              const ruleCount = features.grayRules?.[item.key]?.length || 0;
              return (
                <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{item.label}</div>
                    <div className="text-sm text-gray-400">{item.desc}</div>
                    {ruleCount > 0 && (
                      <div className="text-xs text-amber-600 mt-1">
                        已配置 {ruleCount} 条灰度规则
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenGrayRuleModal(item.key, item.label)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        ruleCount > 0
                          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                      title="灰度规则"
                    >
                      <Filter className="w-3.5 h-3.5" />
                      灰度{ruleCount > 0 && `(${ruleCount})`}
                    </button>
                    <button onClick={() => handleToggleFeature(item.key)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        features[item.key] ? 'bg-blue-600' : 'bg-gray-200'
                      }`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        features[item.key] ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'aiProviders' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">AI 服务商配置</h3>
              <p className="text-sm text-gray-400 mt-0.5">管理 AI 服务商的连接信息和优先级，优先级数值越小越优先使用</p>
            </div>
            <button
              onClick={handleAddProvider}
              className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> 添加服务商
            </button>
          </div>

          {providerMessage && (
            <div className={`px-4 py-2 text-sm ${
              providerMessage.includes('成功') || providerMessage.includes('已保存')
                ? 'text-green-600 bg-green-50'
                : 'text-red-500 bg-red-50'
            }`}>
              {providerMessage}
            </div>
          )}

          {aiProviders.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              暂无 AI 服务商配置，点击上方按钮添加
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {aiProviders.map((provider) => (
                <div key={provider.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{provider.name}</span>
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">ID: {provider.id}</span>
                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">优先级: {provider.priority}</span>
                    </div>
                    <div className="text-sm text-gray-400 mt-1 truncate">
                      {provider.url} · 模型: {provider.model}
                    </div>
                    <div className="text-sm text-gray-400">
                      密钥: {provider.apiKey.slice(0, 6)}{'*'.repeat(Math.max(0, provider.apiKey.length - 6))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <button
                      onClick={() => handleEditProvider(provider)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                      title="编辑"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProvider(provider.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {grayRuleModal.open && features && (
        <GrayRuleModal
          featureKey={grayRuleModal.featureKey}
          featureLabel={grayRuleModal.featureLabel}
          rules={features.grayRules?.[grayRuleModal.featureKey] || []}
          onSave={(rules) => handleSaveGrayRules(grayRuleModal.featureKey, rules)}
          onClose={() => setGrayRuleModal({ open: false, featureKey: '', featureLabel: '' })}
        />
      )}

      {providerModal.open && (
        <AIProviderEditModal
          provider={providerModal.provider}
          existingIds={aiProviders.map((p) => p.id)}
          onSave={handleSaveProvider}
          onClose={() => setProviderModal({ open: false, provider: null })}
        />
      )}
    </div>
  );
};

export default SettingsPage;
