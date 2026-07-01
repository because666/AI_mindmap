import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Star,
  X,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { aiModelApi } from '../../services/api';
import type { AIModelConfig, AIModelConfigInput, AIModelProvider } from '../../types';

/**
 * 服务商类型选项列表
 * 用于下拉选择
 */
const PROVIDER_OPTIONS: { value: AIModelProvider; label: string }[] = [
  { value: 'zhipu', label: '智谱 GLM' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'custom', label: '自定义（OpenAI 兼容）' },
];

/**
 * 服务商类型标签映射
 * 键为服务商类型，值为对应的中文标签和 TailwindCSS 样式类名
 */
const PROVIDER_LABEL_MAP: Record<AIModelProvider, { label: string; className: string }> = {
  zhipu: { label: '智谱 GLM', className: 'bg-blue-50 text-blue-600' },
  deepseek: { label: 'DeepSeek', className: 'bg-purple-50 text-purple-600' },
  openai: { label: 'OpenAI', className: 'bg-green-50 text-green-600' },
  custom: { label: '自定义', className: 'bg-orange-50 text-orange-600' },
};

/**
 * Toast 提示消息接口
 */
interface ToastMessage {
  type: 'success' | 'error';
  text: string;
}

/**
 * 表单数据初始值
 */
const EMPTY_FORM: AIModelConfigInput = {
  name: '',
  provider: 'zhipu',
  apiKey: '',
  baseUrl: '',
  modelId: '',
  temperature: 0.7,
  maxTokens: 2048,
  isActive: true,
  isDefault: false,
  priority: 99,
};

/**
 * AI 模型管理页面
 * 展示模型列表（名称/提供商/模型ID/状态/默认标记/优先级/操作），支持创建/编辑/删除/启用切换/设置默认
 */
const AIModelsPage: React.FC = () => {
  const [list, setList] = useState<AIModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AIModelConfigInput>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /**
   * 显示 Toast 提示
   * @param type - 提示类型：success 或 error
   * @param text - 提示文本内容
   */
  const showToast = (type: 'success' | 'error', text: string): void => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  /**
   * 加载模型列表数据
   * @param isRefresh - 是否为刷新操作（影响 loading 状态显示）
   */
  const loadList = useCallback(async (isRefresh = false): Promise<void> => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await aiModelApi.getAll();
      const data = res.data.data;
      if (Array.isArray(data)) {
        setList(data);
      } else {
        setList([]);
      }
    } catch (error) {
      console.error('加载 AI 模型列表失败:', error);
      showToast('error', '加载 AI 模型列表失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  /**
   * 打开创建弹窗
   */
  const handleCreate = (): void => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  /**
   * 打开编辑弹窗
   * apiKey 字段清空，提示用户留空表示不修改
   * @param item - 待编辑的模型配置
   */
  const handleEdit = (item: AIModelConfig): void => {
    setEditingId(item._id);
    setForm({
      name: item.name,
      provider: item.provider,
      apiKey: '',
      baseUrl: item.baseUrl,
      modelId: item.modelId,
      temperature: item.temperature,
      maxTokens: item.maxTokens,
      isActive: item.isActive,
      isDefault: item.isDefault,
      priority: item.priority,
    });
    setShowModal(true);
  };

  /**
   * 提交表单（创建或更新模型配置）
   * 校验必填字段后调用对应 API
   */
  const handleSubmit = async (): Promise<void> => {
    if (!form.name.trim()) {
      showToast('error', '请填写模型名称');
      return;
    }
    if (!form.modelId.trim()) {
      showToast('error', '请填写模型 ID');
      return;
    }
    // 创建时 apiKey 必填，编辑时可空（表示不更新）
    if (!editingId && !form.apiKey.trim()) {
      showToast('error', '请填写 API Key');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        // 编辑时 apiKey 为空表示不更新原值
        const payload: Partial<AIModelConfigInput> = { ...form };
        if (!form.apiKey.trim()) {
          delete payload.apiKey;
        }
        await aiModelApi.update(editingId, payload);
        showToast('success', '模型配置已更新');
      } else {
        await aiModelApi.create(form);
        showToast('success', '模型配置已创建');
      }
      setShowModal(false);
      loadList(true);
    } catch (error) {
      console.error('保存模型配置失败:', error);
      const message = error instanceof Error ? error.message : '保存模型配置失败';
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * 切换模型启用/禁用状态
   * @param item - 待切换的模型配置
   */
  const handleToggle = async (item: AIModelConfig): Promise<void> => {
    try {
      await aiModelApi.toggle(item._id, !item.isActive);
      showToast('success', '状态已切换');
      loadList(true);
    } catch (error) {
      console.error('切换状态失败:', error);
      showToast('error', '切换状态失败');
    }
  };

  /**
   * 将指定模型设置为默认模型
   * @param item - 待设置为默认的模型配置
   */
  const handleSetDefault = async (item: AIModelConfig): Promise<void> => {
    if (item.isDefault) return;
    try {
      await aiModelApi.setDefault(item._id);
      showToast('success', '已设置为默认模型');
      loadList(true);
    } catch (error) {
      console.error('设置默认模型失败:', error);
      showToast('error', '设置默认模型失败');
    }
  };

  /**
   * 确认删除模型配置
   */
  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await aiModelApi.delete(deleteConfirmId);
      showToast('success', '模型配置已删除');
      setDeleteConfirmId(null);
      loadList(true);
    } catch (error) {
      console.error('删除模型配置失败:', error);
      showToast('error', '删除模型配置失败');
    } finally {
      setDeleting(false);
    }
  };

  /**
   * 格式化日期显示
   * @param dateStr - ISO 日期字符串
   * @returns 格式化后的日期字符串
   */
  const formatDate = (dateStr: string): string => {
    try {
      return format(new Date(dateStr), 'yyyy-MM-dd HH:mm');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题与操作 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">AI 模型管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理 AI 服务商配置，设置默认模型与 fallback 优先级</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadList(true)}
            disabled={refreshing}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加模型
          </button>
        </div>
      </div>

      {/* 模型列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            暂无模型配置，点击右上角"添加模型"创建第一条配置
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">名称</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">提供商</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">模型 ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">API Key</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">默认</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">优先级</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">更新时间</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((item) => {
                  const providerInfo = PROVIDER_LABEL_MAP[item.provider] || PROVIDER_LABEL_MAP.custom;
                  return (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 truncate max-w-[180px]" title={item.name}>
                          {item.name}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${providerInfo.className}`}
                        >
                          {providerInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{item.modelId}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.apiKeyMasked}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggle(item)}
                          className="flex items-center gap-1"
                          title={item.isActive ? '点击禁用' : '点击启用'}
                        >
                          {item.isActive ? (
                            <ToggleRight className="w-6 h-6 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-gray-400" />
                          )}
                          <span
                            className={`text-xs ${item.isActive ? 'text-green-600' : 'text-gray-400'}`}
                          >
                            {item.isActive ? '启用' : '禁用'}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleSetDefault(item)}
                          disabled={item.isDefault}
                          className={`flex items-center gap-1 ${
                            item.isDefault ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'
                          }`}
                          title={item.isDefault ? '当前默认模型' : '点击设为默认'}
                        >
                          <Star
                            className={`w-4 h-4 ${item.isDefault ? 'fill-current' : ''}`}
                          />
                          {item.isDefault && <span className="text-xs">默认</span>}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{item.priority}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(item.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="编辑"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(item._id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 创建/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/30"
            onClick={() => !saving && setShowModal(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? '编辑模型' : '添加模型'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  模型名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="例如：智谱GLM-4-Flash"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  提供商 <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.provider}
                  onChange={(e) =>
                    setForm({ ...form, provider: e.target.value as AIModelProvider })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {PROVIDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key{' '}
                  {editingId ? (
                    <span className="text-xs text-gray-400">（留空表示不修改）</span>
                  ) : (
                    <span className="text-red-500">*</span>
                  )}
                </label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={editingId ? '留空表示不修改原 Key' : '请输入 API Key'}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base URL
                </label>
                <input
                  type="text"
                  value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="例如：https://open.bigmodel.cn/api/paas/v4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  模型 ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.modelId}
                  onChange={(e) => setForm({ ...form, modelId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="例如：glm-4-flash"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    采样温度（0-2）
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={form.temperature}
                    onChange={(e) =>
                      setForm({ ...form, temperature: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最大 Token 数（1-32000）
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="32000"
                    value={form.maxTokens}
                    onChange={(e) =>
                      setForm({ ...form, maxTokens: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  优先级（数值越小优先级越高）
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="默认 99"
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">启用</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">设为默认模型</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/30"
            onClick={() => !deleting && setDeleteConfirmId(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-semibold text-gray-900">确认删除</h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600">
                删除后该模型配置将不可恢复，且主服务将立即不再使用此模型。确认删除吗？
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm ${
            toast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
};

export default AIModelsPage;
