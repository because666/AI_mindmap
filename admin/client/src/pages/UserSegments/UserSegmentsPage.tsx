import React, { useState, useEffect, useCallback } from 'react';
import { userSegmentsApi } from '../../services/api';
import type { UserTag, UserSegment, SegmentRule, SegmentRuleField, SegmentRuleOperator, UserListItem, PaginationResult } from '../../types';
import { Tag, Layers, Plus, Trash2, Play, X, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';

/**
 * 提示消息接口
 */
interface ToastMessage {
  type: 'success' | 'error';
  text: string;
}

/**
 * 创建标签表单数据接口
 */
interface TagFormData {
  name: string;
  color: string;
  description: string;
}

/**
 * 创建分群表单数据接口
 */
interface SegmentFormData {
  name: string;
  description: string;
  ruleField: SegmentRuleField;
  ruleOperator: SegmentRuleOperator;
  ruleValue: string;
  autoUpdate: boolean;
}

/**
 * 规则字段中文映射
 */
const FIELD_LABELS: Record<SegmentRuleField, string> = {
  lastActiveAt: '最后活跃时间',
  messageCount: '消息数量',
  hasOwnApiKey: '是否拥有API密钥',
};

/**
 * 运算符中文映射
 */
const OPERATOR_LABELS: Record<SegmentRuleOperator, string> = {
  gte: '大于等于',
  lte: '小于等于',
  eq: '等于',
};

/**
 * 用户分群与标签管理页面
 * 包含标签管理和分群管理两个标签页
 * 标签管理：标签列表、颜色展示、创建/删除标签
 * 分群管理：分群列表、规则描述、用户数、执行按钮、创建/删除分群
 * 按标签筛选用户功能集成在标签管理标签页中
 */
const UserSegmentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tags' | 'segments'>('tags');
  const [tags, setTags] = useState<UserTag[]>([]);
  const [segments, setSegments] = useState<UserSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [showTagForm, setShowTagForm] = useState(false);
  const [tagForm, setTagForm] = useState<TagFormData>({ name: '', color: '#3B82F6', description: '' });
  const [actionLoading, setActionLoading] = useState(false);

  const [showSegmentForm, setShowSegmentForm] = useState(false);
  const [segmentForm, setSegmentForm] = useState<SegmentFormData>({
    name: '',
    description: '',
    ruleField: 'messageCount',
    ruleOperator: 'gte',
    ruleValue: '',
    autoUpdate: false,
  });

  const [tagUsersModal, setTagUsersModal] = useState<{ tagId: string; tagName: string } | null>(null);
  const [tagUsersData, setTagUsersData] = useState<PaginationResult<UserListItem> | null>(null);
  const [tagUsersPage, setTagUsersPage] = useState(1);
  const [tagUsersLoading, setTagUsersLoading] = useState(false);

  const [segmentUsersModal, setSegmentUsersModal] = useState<{ segmentId: string; segmentName: string } | null>(null);
  const [segmentUsersData, setSegmentUsersData] = useState<PaginationResult<UserListItem> | null>(null);
  const [segmentUsersPage, setSegmentUsersPage] = useState(1);
  const [segmentUsersLoading, setSegmentUsersLoading] = useState(false);

  const [editingTag, setEditingTag] = useState<UserTag | null>(null);
  const [editTagForm, setEditTagForm] = useState<TagFormData>({ name: '', color: '#3B82F6', description: '' });

  const [editingSegment, setEditingSegment] = useState<UserSegment | null>(null);
  const [editSegmentForm, setEditSegmentForm] = useState<SegmentFormData>({
    name: '',
    description: '',
    ruleField: 'messageCount',
    ruleOperator: 'gte',
    ruleValue: '',
    autoUpdate: false,
  });

  /**
   * 显示提示消息，3秒后自动消失
   * @param type - 消息类型
   * @param text - 消息文本
   */
  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const loadTags = useCallback(async () => {
    try {
      const res = await userSegmentsApi.listTags();
      setTags(res.data.data as UserTag[]);
    } catch (error) {
      console.error('加载标签列表失败:', error);
      showToast('error', '加载标签列表失败');
    }
  }, []);

  const loadSegments = useCallback(async () => {
    try {
      const res = await userSegmentsApi.listSegments();
      setSegments(res.data.data as UserSegment[]);
    } catch (error) {
      console.error('加载分群列表失败:', error);
      showToast('error', '加载分群列表失败');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadTags(), loadSegments()]).finally(() => setLoading(false));
  }, [loadTags, loadSegments]);

  const handleCreateTag = async () => {
    if (!tagForm.name.trim()) {
      showToast('error', '标签名称不能为空');
      return;
    }
    setActionLoading(true);
    try {
      await userSegmentsApi.createTag(tagForm.name, tagForm.color, tagForm.description || undefined);
      setShowTagForm(false);
      setTagForm({ name: '', color: '#3B82F6', description: '' });
      showToast('success', '标签创建成功');
      loadTags();
    } catch (error) {
      console.error('创建标签失败:', error);
      showToast('error', '创建标签失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm('确认删除此标签？删除后将从所有用户移除该标签。')) return;
    setActionLoading(true);
    try {
      await userSegmentsApi.deleteTag(id);
      showToast('success', '标签已删除');
      loadTags();
    } catch (error) {
      console.error('删除标签失败:', error);
      showToast('error', '删除标签失败');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * 打开编辑标签弹窗，填充当前标签数据
   * @param tag - 待编辑的标签对象
   */
  const openEditTagModal = (tag: UserTag) => {
    setEditingTag(tag);
    setEditTagForm({ name: tag.name, color: tag.color, description: tag.description || '' });
  };

  /**
   * 提交编辑标签请求
   * 校验名称非空后调用 updateTag 接口
   */
  const handleUpdateTag = async () => {
    if (!editingTag) return;
    if (!editTagForm.name.trim()) {
      showToast('error', '标签名称不能为空');
      return;
    }
    setActionLoading(true);
    try {
      await userSegmentsApi.updateTag(editingTag._id, editTagForm.name, editTagForm.color, editTagForm.description || undefined);
      setEditingTag(null);
      showToast('success', '标签更新成功');
      loadTags();
    } catch (error) {
      console.error('更新标签失败:', error);
      showToast('error', '更新标签失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSegment = async () => {
    if (!segmentForm.name.trim()) {
      showToast('error', '分群名称不能为空');
      return;
    }
    if (!segmentForm.ruleValue.trim()) {
      showToast('error', '规则值不能为空');
      return;
    }

    setActionLoading(true);
    try {
      const rule: SegmentRule = {
        field: segmentForm.ruleField,
        operator: segmentForm.ruleOperator,
        value: parseRuleValue(segmentForm.ruleField, segmentForm.ruleValue),
      };

      await userSegmentsApi.createSegment(
        segmentForm.name,
        segmentForm.description || undefined,
        rule,
        segmentForm.autoUpdate,
      );
      setShowSegmentForm(false);
      setSegmentForm({
        name: '',
        description: '',
        ruleField: 'messageCount',
        ruleOperator: 'gte',
        ruleValue: '',
        autoUpdate: false,
      });
      showToast('success', '分群创建成功');
      loadSegments();
    } catch (error) {
      console.error('创建分群失败:', error);
      showToast('error', '创建分群失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSegment = async (id: string) => {
    if (!confirm('确认删除此分群？')) return;
    setActionLoading(true);
    try {
      await userSegmentsApi.deleteSegment(id);
      showToast('success', '分群已删除');
      loadSegments();
    } catch (error) {
      console.error('删除分群失败:', error);
      showToast('error', '删除分群失败');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * 打开编辑分群弹窗，填充当前分群数据
   * 将分群规则拆解为 field/operator/value 三个字段填入表单
   * @param seg - 待编辑的分群对象
   */
  const openEditSegmentModal = (seg: UserSegment) => {
    setEditingSegment(seg);
    setEditSegmentForm({
      name: seg.name,
      description: seg.description || '',
      ruleField: seg.rule.field,
      ruleOperator: seg.rule.operator,
      ruleValue: String(seg.rule.value),
      autoUpdate: seg.autoUpdate,
    });
  };

  /**
   * 提交编辑分群请求
   * 校验名称和规则值非空后调用 updateSegment 接口
   */
  const handleUpdateSegment = async () => {
    if (!editingSegment) return;
    if (!editSegmentForm.name.trim()) {
      showToast('error', '分群名称不能为空');
      return;
    }
    if (!editSegmentForm.ruleValue.trim()) {
      showToast('error', '规则值不能为空');
      return;
    }
    setActionLoading(true);
    try {
      const rule: SegmentRule = {
        field: editSegmentForm.ruleField,
        operator: editSegmentForm.ruleOperator,
        value: parseRuleValue(editSegmentForm.ruleField, editSegmentForm.ruleValue),
      };
      await userSegmentsApi.updateSegment(
        editingSegment._id,
        editSegmentForm.name,
        editSegmentForm.description || undefined,
        rule,
      );
      setEditingSegment(null);
      showToast('success', '分群更新成功');
      loadSegments();
    } catch (error) {
      console.error('更新分群失败:', error);
      showToast('error', '更新分群失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteSegment = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await userSegmentsApi.executeSegment(id);
      const count = (res.data.data as { userCount: number }).userCount;
      showToast('success', `规则执行完成，匹配用户 ${count} 人`);
      loadSegments();
    } catch (error) {
      console.error('执行分群规则失败:', error);
      showToast('error', '执行分群规则失败');
    } finally {
      setActionLoading(false);
    }
  };

  const loadTagUsers = useCallback(async (tagId: string, page: number) => {
    setTagUsersLoading(true);
    try {
      const res = await userSegmentsApi.getUsersByTag(tagId, page, 20);
      setTagUsersData(res.data.data as PaginationResult<UserListItem>);
    } catch (error) {
      console.error('按标签筛选用户失败:', error);
      showToast('error', '按标签筛选用户失败');
    } finally {
      setTagUsersLoading(false);
    }
  }, []);

  const loadSegmentUsers = useCallback(async (segmentId: string, page: number) => {
    setSegmentUsersLoading(true);
    try {
      const res = await userSegmentsApi.getSegmentUsers(segmentId, page, 20);
      setSegmentUsersData(res.data.data as PaginationResult<UserListItem>);
    } catch (error) {
      console.error('获取分群用户失败:', error);
      showToast('error', '获取分群用户失败');
    } finally {
      setSegmentUsersLoading(false);
    }
  }, []);

  const openTagUsersModal = (tagId: string, tagName: string) => {
    setTagUsersModal({ tagId, tagName });
    setTagUsersPage(1);
    loadTagUsers(tagId, 1);
  };

  const openSegmentUsersModal = (segmentId: string, segmentName: string) => {
    setSegmentUsersModal({ segmentId, segmentName });
    setSegmentUsersPage(1);
    loadSegmentUsers(segmentId, 1);
  };

  /**
   * 解析规则值为正确的类型
   * - hasOwnApiKey 字段转为布尔值
   * - messageCount 字段转为数字
   * - lastActiveAt 字段保留字符串（日期）
   * @param field - 规则字段
   * @param rawValue - 原始字符串值
   * @returns 转换后的值
   */
  const parseRuleValue = (field: SegmentRuleField, rawValue: string): number | string | boolean => {
    if (field === 'hasOwnApiKey') {
      return rawValue === 'true';
    }
    if (field === 'messageCount') {
      return Number(rawValue);
    }
    return rawValue;
  };

  /**
   * 格式化分群规则为可读文本
   * @param rule - 分群规则
   * @returns 格式化后的规则描述字符串
   */
  const formatRule = (rule: SegmentRule): string => {
    const fieldLabel = FIELD_LABELS[rule.field] || rule.field;
    const opLabel = OPERATOR_LABELS[rule.operator] || rule.operator;
    let valueStr = String(rule.value);
    if (rule.field === 'lastActiveAt') {
      try {
        valueStr = new Date(rule.value as string).toLocaleDateString();
      } catch {
        valueStr = String(rule.value);
      }
    }
    return `${fieldLabel} ${opLabel} ${valueStr}`;
  };

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.text}
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-800 mb-6">用户分群与标签</h1>

      {/* 标签页切换 */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('tags')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'tags' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Tag className="w-4 h-4" />
          标签管理
        </button>
        <button
          onClick={() => setActiveTab('segments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'segments' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          分群管理
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">加载中...</div>
      ) : activeTab === 'tags' ? (
        /* 标签管理标签页 */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">共 {tags.length} 个标签</span>
            <button
              onClick={() => setShowTagForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              创建标签
            </button>
          </div>

          {!tags.length ? (
            <div className="p-8 text-center text-gray-400">暂无标签，点击上方按钮创建</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {tags.map((tag) => (
                <div key={tag._id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <div>
                      <span className="font-medium text-gray-800 text-sm">{tag.name}</span>
                      {tag.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{tag.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openTagUsersModal(tag._id, tag.name)}
                      className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                    >
                      查看用户
                    </button>
                    <button
                      onClick={() => openEditTagModal(tag)}
                      disabled={actionLoading}
                      className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-50"
                      title="编辑标签"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag._id)}
                      disabled={actionLoading}
                      className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                      title="删除标签"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* 分群管理标签页 */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">共 {segments.length} 个分群</span>
            <button
              onClick={() => setShowSegmentForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              创建分群
            </button>
          </div>

          {!segments.length ? (
            <div className="p-8 text-center text-gray-400">暂无分群，点击上方按钮创建</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {segments.map((seg) => (
                <div key={seg._id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 text-sm">{seg.name}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                        {seg.userCount} 人
                      </span>
                      {seg.autoUpdate && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">
                          自动更新
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      规则：{formatRule(seg.rule)}
                    </p>
                    {seg.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{seg.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => openSegmentUsersModal(seg._id, seg.name)}
                      className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                    >
                      查看用户
                    </button>
                    <button
                      onClick={() => handleExecuteSegment(seg._id)}
                      disabled={actionLoading}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                      title="执行规则"
                    >
                      <Play className="w-3 h-3" />
                      执行
                    </button>
                    <button
                      onClick={() => openEditSegmentModal(seg)}
                      disabled={actionLoading}
                      className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-50"
                      title="编辑分群"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSegment(seg._id)}
                      disabled={actionLoading}
                      className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                      title="删除分群"
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

      {/* 创建标签弹窗 */}
      {showTagForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">创建标签</h3>
              <button onClick={() => setShowTagForm(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标签名称 *</label>
                <input
                  type="text"
                  value={tagForm.name}
                  onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入标签名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标签颜色 *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={tagForm.color}
                    onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
                    className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={tagForm.color}
                    onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标签描述</label>
                <textarea
                  value={tagForm.description}
                  onChange={(e) => setTagForm({ ...tagForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="可选，描述标签用途"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowTagForm(false)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg">取消</button>
              <button onClick={handleCreateTag} disabled={actionLoading} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">确认创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 创建分群弹窗 */}
      {showSegmentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">创建分群</h3>
              <button onClick={() => setShowSegmentForm(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分群名称 *</label>
                <input
                  type="text"
                  value={segmentForm.name}
                  onChange={(e) => setSegmentForm({ ...segmentForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入分群名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分群描述</label>
                <textarea
                  value={segmentForm.description}
                  onChange={(e) => setSegmentForm({ ...segmentForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="可选，描述分群用途"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">规则字段 *</label>
                  <select
                    value={segmentForm.ruleField}
                    onChange={(e) => setSegmentForm({ ...segmentForm, ruleField: e.target.value as SegmentRuleField })}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="lastActiveAt">最后活跃时间</option>
                    <option value="messageCount">消息数量</option>
                    <option value="hasOwnApiKey">拥有API密钥</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">运算符 *</label>
                  <select
                    value={segmentForm.ruleOperator}
                    onChange={(e) => setSegmentForm({ ...segmentForm, ruleOperator: e.target.value as SegmentRuleOperator })}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="gte">大于等于</option>
                    <option value="lte">小于等于</option>
                    <option value="eq">等于</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">规则值 *</label>
                  {segmentForm.ruleField === 'hasOwnApiKey' ? (
                    <select
                      value={segmentForm.ruleValue}
                      onChange={(e) => setSegmentForm({ ...segmentForm, ruleValue: e.target.value })}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="">请选择</option>
                      <option value="true">是</option>
                      <option value="false">否</option>
                    </select>
                  ) : (
                    <input
                      type={segmentForm.ruleField === 'messageCount' ? 'number' : 'date'}
                      value={segmentForm.ruleValue}
                      onChange={(e) => setSegmentForm({ ...segmentForm, ruleValue: e.target.value })}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                      placeholder={segmentForm.ruleField === 'messageCount' ? '数量' : '日期'}
                    />
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={segmentForm.autoUpdate}
                  onChange={(e) => setSegmentForm({ ...segmentForm, autoUpdate: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">自动更新（预留）</span>
              </label>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowSegmentForm(false)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg">取消</button>
              <button onClick={handleCreateSegment} disabled={actionLoading} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">确认创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑标签弹窗 */}
      {editingTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">编辑标签</h3>
              <button onClick={() => setEditingTag(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标签名称 *</label>
                <input
                  type="text"
                  value={editTagForm.name}
                  onChange={(e) => setEditTagForm({ ...editTagForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入标签名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标签颜色 *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editTagForm.color}
                    onChange={(e) => setEditTagForm({ ...editTagForm, color: e.target.value })}
                    className="w-10 h-10 rounded border border-gray-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editTagForm.color}
                    onChange={(e) => setEditTagForm({ ...editTagForm, color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标签描述</label>
                <textarea
                  value={editTagForm.description}
                  onChange={(e) => setEditTagForm({ ...editTagForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="可选，描述标签用途"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setEditingTag(null)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg">取消</button>
              <button onClick={handleUpdateTag} disabled={actionLoading} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">保存修改</button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑分群弹窗 */}
      {editingSegment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">编辑分群</h3>
              <button onClick={() => setEditingSegment(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分群名称 *</label>
                <input
                  type="text"
                  value={editSegmentForm.name}
                  onChange={(e) => setEditSegmentForm({ ...editSegmentForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入分群名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分群描述</label>
                <textarea
                  value={editSegmentForm.description}
                  onChange={(e) => setEditSegmentForm({ ...editSegmentForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="可选，描述分群用途"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">规则字段 *</label>
                  <select
                    value={editSegmentForm.ruleField}
                    onChange={(e) => setEditSegmentForm({ ...editSegmentForm, ruleField: e.target.value as SegmentRuleField })}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="lastActiveAt">最后活跃时间</option>
                    <option value="messageCount">消息数量</option>
                    <option value="hasOwnApiKey">拥有API密钥</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">运算符 *</label>
                  <select
                    value={editSegmentForm.ruleOperator}
                    onChange={(e) => setEditSegmentForm({ ...editSegmentForm, ruleOperator: e.target.value as SegmentRuleOperator })}
                    className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="gte">大于等于</option>
                    <option value="lte">小于等于</option>
                    <option value="eq">等于</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">规则值 *</label>
                  {editSegmentForm.ruleField === 'hasOwnApiKey' ? (
                    <select
                      value={editSegmentForm.ruleValue}
                      onChange={(e) => setEditSegmentForm({ ...editSegmentForm, ruleValue: e.target.value })}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="">请选择</option>
                      <option value="true">是</option>
                      <option value="false">否</option>
                    </select>
                  ) : (
                    <input
                      type={editSegmentForm.ruleField === 'messageCount' ? 'number' : 'date'}
                      value={editSegmentForm.ruleValue}
                      onChange={(e) => setEditSegmentForm({ ...editSegmentForm, ruleValue: e.target.value })}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm"
                      placeholder={editSegmentForm.ruleField === 'messageCount' ? '数量' : '日期'}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setEditingSegment(null)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg">取消</button>
              <button onClick={handleUpdateSegment} disabled={actionLoading} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">保存修改</button>
            </div>
          </div>
        </div>
      )}

      {/* 按标签筛选用户弹窗 */}
      {tagUsersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">标签「{tagUsersModal.tagName}」下的用户</h3>
              <button onClick={() => { setTagUsersModal(null); setTagUsersData(null); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            {tagUsersLoading ? (
              <div className="p-8 text-center text-gray-400">加载中...</div>
            ) : !tagUsersData?.items.length ? (
              <div className="p-8 text-center text-gray-400">暂无用户使用此标签</div>
            ) : (
              <>
                <div className="overflow-auto flex-1">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">昵称</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">注册时间</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tagUsersData.items.map((user) => (
                        <tr key={user._id} className="border-b border-gray-50">
                          <td className="py-2 px-3 text-sm">{user.nickname}</td>
                          <td className="py-2 px-3 text-sm text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              user.isBanned ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                            }`}>
                              {user.isBanned ? '封禁' : '正常'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {tagUsersData.totalPages > 1 && (
                  <div className="pt-3 flex justify-center gap-2">
                    <button
                      onClick={() => { const p = Math.max(1, tagUsersPage - 1); setTagUsersPage(p); loadTagUsers(tagUsersModal.tagId, p); }}
                      disabled={tagUsersPage === 1}
                      className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-500">{tagUsersPage}/{tagUsersData.totalPages}</span>
                    <button
                      onClick={() => { const p = Math.min(tagUsersData.totalPages, tagUsersPage + 1); setTagUsersPage(p); loadTagUsers(tagUsersModal.tagId, p); }}
                      disabled={tagUsersPage === tagUsersData.totalPages}
                      className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 分群用户弹窗 */}
      {segmentUsersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">分群「{segmentUsersModal.segmentName}」中的用户</h3>
              <button onClick={() => { setSegmentUsersModal(null); setSegmentUsersData(null); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            {segmentUsersLoading ? (
              <div className="p-8 text-center text-gray-400">加载中...</div>
            ) : !segmentUsersData?.items.length ? (
              <div className="p-8 text-center text-gray-400">暂无匹配用户，请先执行分群规则</div>
            ) : (
              <>
                <div className="overflow-auto flex-1">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">昵称</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">注册时间</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segmentUsersData.items.map((user) => (
                        <tr key={user._id} className="border-b border-gray-50">
                          <td className="py-2 px-3 text-sm">{user.nickname}</td>
                          <td className="py-2 px-3 text-sm text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              user.isBanned ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                            }`}>
                              {user.isBanned ? '封禁' : '正常'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {segmentUsersData.totalPages > 1 && (
                  <div className="pt-3 flex justify-center gap-2">
                    <button
                      onClick={() => { const p = Math.max(1, segmentUsersPage - 1); setSegmentUsersPage(p); loadSegmentUsers(segmentUsersModal.segmentId, p); }}
                      disabled={segmentUsersPage === 1}
                      className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-500">{segmentUsersPage}/{segmentUsersData.totalPages}</span>
                    <button
                      onClick={() => { const p = Math.min(segmentUsersData.totalPages, segmentUsersPage + 1); setSegmentUsersPage(p); loadSegmentUsers(segmentUsersModal.segmentId, p); }}
                      disabled={segmentUsersPage === segmentUsersData.totalPages}
                      className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSegmentsPage;
