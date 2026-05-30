import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MessageCircle, X, Loader2, CheckCircle, Send } from 'lucide-react';
import useIsMobile from '../../hooks/useIsMobile';
import api from '../../services/api';

/**
 * 反馈弹窗组件属性接口
 * @property isOpen - 弹窗是否打开
 * @property onClose - 关闭弹窗的回调函数
 */
interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 问题类型选项
 * 定义反馈表单中可选的问题类型
 */
type FeedbackType = '功能异常' | '界面问题' | '建议' | '其他';

/**
 * 表单验证错误映射类型
 * 键为字段名，值为错误信息
 */
type ValidationErrors = Record<string, string>;

/**
 * 反馈提交请求体类型
 * @property title - 问题标题
 * @property description - 问题详细描述
 * @property type - 问题类型
 * @property contact - 联系方式（选填）
 */
interface FeedbackRequestBody {
  title: string;
  description: string;
  type: FeedbackType;
  contact: string;
}

/**
 * 反馈提交响应类型
 * @property success - 是否提交成功
 * @property error - 错误信息（失败时返回）
 */
interface FeedbackResponse {
  success: boolean;
  error?: string;
}

/** 问题类型选项列表 */
const FEEDBACK_TYPE_OPTIONS: FeedbackType[] = ['功能异常', '界面问题', '建议', '其他'];

/** 提交成功后自动关闭弹窗的延迟时间（毫秒） */
const AUTO_CLOSE_DELAY_MS = 2000;

/**
 * 反馈弹窗组件
 * 提供用户反馈表单，支持桌面端居中弹窗和移动端全屏显示
 * 包含表单验证、提交状态管理、成功/失败提示等功能
 */
const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const isMobile = useIsMobile();
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [type, setType] = useState<FeedbackType>('功能异常');
  const [contact, setContact] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  /**
   * 重置所有表单状态
   * 关闭弹窗时调用，确保下次打开时表单为初始状态
   */
  const resetState = useCallback(() => {
    setTitle('');
    setDescription('');
    setType('功能异常');
    setContact('');
    setIsSubmitting(false);
    setSubmitSuccess(false);
    setSubmitError(null);
    setValidationErrors({});
  }, []);

  /**
   * 验证表单必填字段
   * 检查 title 和 description 是否已填写
   * @returns 验证是否通过
   */
  const validateForm = useCallback((): boolean => {
    const errors: ValidationErrors = {};

    if (!title.trim()) {
      errors.title = '请输入问题标题';
    }

    if (!description.trim()) {
      errors.description = '请输入问题详细描述';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [title, description]);

  /**
   * 处理表单提交
   * 验证表单 -> 调用API -> 处理成功/失败状态
   */
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const requestBody: FeedbackRequestBody = {
        title: title.trim(),
        description: description.trim(),
        type,
        contact: contact.trim(),
      };

      const response = await api.post<FeedbackResponse>('/feedback', requestBody);

      if (response.data.success) {
        setSubmitSuccess(true);
        autoCloseTimerRef.current = setTimeout(() => {
          onClose();
        }, AUTO_CLOSE_DELAY_MS);
      } else {
        setSubmitError(response.data.error || '提交失败，请稍后重试');
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : '网络错误，请检查网络连接后重试';
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [title, description, type, contact, validateForm, onClose]);

  /**
   * 处理关闭弹窗
   * 清除自动关闭定时器并重置状态
   */
  const handleClose = useCallback(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    resetState();
    onClose();
  }, [onClose, resetState]);

  /**
   * 监听弹窗关闭，重置状态
   * 当 isOpen 从 true 变为 false 时执行清理
   */
  useEffect(() => {
    if (!isOpen) {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
      resetState();
    }
  }, [isOpen, resetState]);

  /**
   * 组件卸载时清除定时器，防止内存泄漏
   */
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  /**
   * 渲染提交成功状态页面
   * 显示绿色勾号和感谢文字
   */
  const renderSuccessContent = () => (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
      <h3 className="text-xl font-semibold text-white mb-2">感谢您的反馈！</h3>
      <p className="text-dark-400 text-sm">我们会认真处理您的反馈，持续改进产品体验</p>
    </div>
  );

  /**
   * 渲染表单内容
   * 包含所有表单字段、验证错误提示、提交/取消按钮
   */
  const renderFormContent = () => (
    <div className="p-6 space-y-4">
      {/* 问题标题 */}
      <div>
        <label className="block text-sm text-dark-300 mb-1">
          问题标题 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (validationErrors.title) {
              setValidationErrors((prev) => {
                const next = { ...prev };
                delete next.title;
                return next;
              });
            }
          }}
          placeholder="请简要描述问题"
          className="input-field w-full"
          maxLength={100}
          disabled={isSubmitting}
        />
        {validationErrors.title && (
          <p className="text-red-400 text-xs mt-1">{validationErrors.title}</p>
        )}
      </div>

      {/* 问题详细描述 */}
      <div>
        <label className="block text-sm text-dark-300 mb-1">
          问题详细描述 <span className="text-red-400">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (validationErrors.description) {
              setValidationErrors((prev) => {
                const next = { ...prev };
                delete next.description;
                return next;
              });
            }
          }}
          placeholder="请详细描述您遇到的问题或建议..."
          className="input-field w-full resize-none"
          rows={4}
          maxLength={1000}
          disabled={isSubmitting}
        />
        {validationErrors.description && (
          <p className="text-red-400 text-xs mt-1">{validationErrors.description}</p>
        )}
      </div>

      {/* 问题类型 */}
      <div>
        <label className="block text-sm text-dark-300 mb-1">问题类型</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as FeedbackType)}
          className="input-field w-full"
          disabled={isSubmitting}
        >
          {FEEDBACK_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {/* 联系方式 */}
      <div>
        <label className="block text-sm text-dark-300 mb-1">联系方式</label>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="选填，方便我们联系您"
          className="input-field w-full"
          maxLength={100}
          disabled={isSubmitting}
        />
      </div>

      {/* 提交错误提示 */}
      {submitError && (
        <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-xl text-red-400 text-sm">
          {submitError}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="btn-primary w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              提交中...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              提交反馈
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          className="btn-ghost w-full"
        >
          取消
        </button>
      </div>
    </div>
  );

  /**
   * 渲染弹窗主体内容
   * 包含头部（图标+标题+关闭按钮）和表单/成功状态
   */
  const modalContent = (
    <>
      <div className={`flex items-center justify-between px-6 py-4 border-b border-dark-700 ${isMobile ? 'h-14' : ''}`}>
        <div className="flex items-center gap-3">
          <MessageCircle className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white">反馈</h2>
        </div>
        <button
          onClick={handleClose}
          className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className={isMobile ? 'flex-1 overflow-y-auto' : 'max-h-[70vh] overflow-y-auto'}>
        {submitSuccess ? renderSuccessContent() : renderFormContent()}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col">
        {modalContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-lg mx-4 bg-dark-900 rounded-2xl border border-dark-600/30 shadow-2xl overflow-hidden">
        {modalContent}
      </div>
    </div>
  );
};

export default FeedbackModal;
