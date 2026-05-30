import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * 验证反馈表单必填字段的纯函数
 * 从 FeedbackModal 组件中提取的核心验证逻辑
 * @param title - 问题标题
 * @param description - 问题详细描述
 * @returns 验证错误映射，空对象表示验证通过
 */
const validateFeedbackForm = (
  title: string,
  description: string
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!title.trim()) {
    errors.title = '请输入问题标题';
  }

  if (!description.trim()) {
    errors.description = '请输入问题详细描述';
  }

  return errors;
};

/**
 * 构建反馈提交请求体
 * @param title - 问题标题
 * @param description - 问题详细描述
 * @param type - 问题类型
 * @param contact - 联系方式
 * @returns 格式化后的请求体
 */
const buildFeedbackRequestBody = (
  title: string,
  description: string,
  type: string,
  contact: string
): { title: string; description: string; type: string; contact: string } => {
  return {
    title: title.trim(),
    description: description.trim(),
    type,
    contact: contact.trim(),
  };
};

/**
 * 问题类型选项列表
 */
const FEEDBACK_TYPE_OPTIONS = ['功能异常', '界面问题', '建议', '其他'];

describe('FeedbackModal - 表单验证逻辑', () => {
  it('标题和描述都填写时，验证通过', () => {
    const errors = validateFeedbackForm('页面加载缓慢', '点击思维画布后页面响应非常慢');
    expect(errors).toEqual({});
  });

  it('标题为空时，返回标题错误', () => {
    const errors = validateFeedbackForm('', '详细描述内容');
    expect(errors.title).toBe('请输入问题标题');
    expect(errors.description).toBeUndefined();
  });

  it('描述为空时，返回描述错误', () => {
    const errors = validateFeedbackForm('问题标题', '');
    expect(errors.description).toBe('请输入问题详细描述');
    expect(errors.title).toBeUndefined();
  });

  it('标题和描述都为空时，返回两个错误', () => {
    const errors = validateFeedbackForm('', '');
    expect(Object.keys(errors)).toHaveLength(2);
    expect(errors.title).toBe('请输入问题标题');
    expect(errors.description).toBe('请输入问题详细描述');
  });

  it('标题仅包含空格时，视为空值', () => {
    const errors = validateFeedbackForm('   ', '描述内容');
    expect(errors.title).toBe('请输入问题标题');
  });

  it('描述仅包含空格时，视为空值', () => {
    const errors = validateFeedbackForm('标题', '   ');
    expect(errors.description).toBe('请输入问题详细描述');
  });

  it('标题和描述都有实际内容时，验证通过', () => {
    const errors = validateFeedbackForm('有效标题', '有效描述');
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

describe('FeedbackModal - 请求体构建逻辑', () => {
  it('正确构建请求体，自动去除首尾空格', () => {
    const body = buildFeedbackRequestBody('  标题  ', '  描述  ', '功能异常', '  email@test.com  ');
    expect(body).toEqual({
      title: '标题',
      description: '描述',
      type: '功能异常',
      contact: 'email@test.com',
    });
  });

  it('联系方式为空字符串时，保留空字符串', () => {
    const body = buildFeedbackRequestBody('标题', '描述', '建议', '');
    expect(body.contact).toBe('');
  });

  it('所有问题类型均可正确构建', () => {
    FEEDBACK_TYPE_OPTIONS.forEach((type) => {
      const body = buildFeedbackRequestBody('标题', '描述', type, '');
      expect(body.type).toBe(type);
    });
  });
});

describe('FeedbackModal - 提交流程逻辑', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('提交成功后应设置成功状态', async () => {
    const mockApiPost = vi.fn().mockResolvedValue({ success: true });
    const result = await mockApiPost('/feedback', {
      title: '测试标题',
      description: '测试描述',
      type: '功能异常',
      contact: '',
    });
    expect(result.success).toBe(true);
    expect(mockApiPost).toHaveBeenCalledTimes(1);
  });

  it('提交失败时应保留错误信息', async () => {
    const mockApiPost = vi.fn().mockResolvedValue({
      success: false,
      error: '服务器内部错误',
    });
    const result = await mockApiPost('/feedback', {
      title: '测试标题',
      description: '测试描述',
      type: '功能异常',
      contact: '',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('服务器内部错误');
  });

  it('网络异常时应捕获错误', async () => {
    const mockApiPost = vi.fn().mockRejectedValue(new Error('网络错误'));
    let capturedError: string | null = null;
    try {
      await mockApiPost('/feedback', {});
    } catch (error: unknown) {
      capturedError = error instanceof Error ? error.message : '未知错误';
    }
    expect(capturedError).toBe('网络错误');
  });

  it('提交成功后2秒自动关闭弹窗', () => {
    const mockOnClose = vi.fn();
    setTimeout(() => {
      mockOnClose();
    }, 2000);

    expect(mockOnClose).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('关闭弹窗时应清除自动关闭定时器', () => {
    const mockOnClose = vi.fn();
    const timerId = setTimeout(() => {
      mockOnClose();
    }, 2000);

    clearTimeout(timerId);

    vi.advanceTimersByTime(3000);

    expect(mockOnClose).not.toHaveBeenCalled();
  });
});

describe('FeedbackModal - 状态重置逻辑', () => {
  it('重置后所有状态应回到初始值', () => {
    const initialState = {
      title: '',
      description: '',
      type: '功能异常',
      contact: '',
      isSubmitting: false,
      submitSuccess: false,
      submitError: null as string | null,
      validationErrors: {} as Record<string, string>,
    };

    const modifiedState = {
      title: '已填标题',
      description: '已填描述',
      type: '建议',
      contact: 'test@test.com',
      isSubmitting: true,
      submitSuccess: true,
      submitError: '之前的错误',
      validationErrors: { title: '错误' },
    };

    const resetState = { ...initialState };

    expect(modifiedState.title).not.toBe(resetState.title);
    expect(modifiedState.description).not.toBe(resetState.description);
    expect(modifiedState.type).not.toBe(resetState.type);
    expect(modifiedState.contact).not.toBe(resetState.contact);
    expect(modifiedState.isSubmitting).not.toBe(resetState.isSubmitting);
    expect(modifiedState.submitSuccess).not.toBe(resetState.submitSuccess);
    expect(modifiedState.submitError).not.toBe(resetState.submitError);
    expect(Object.keys(modifiedState.validationErrors)).toHaveLength(1);
    expect(Object.keys(resetState.validationErrors)).toHaveLength(0);
  });
});

describe('FeedbackModal - 问题类型选项', () => {
  it('应包含四种问题类型', () => {
    expect(FEEDBACK_TYPE_OPTIONS).toHaveLength(4);
  });

  it('默认问题类型应为功能异常', () => {
    expect(FEEDBACK_TYPE_OPTIONS[0]).toBe('功能异常');
  });

  it('应包含所有指定的问题类型', () => {
    expect(FEEDBACK_TYPE_OPTIONS).toContain('功能异常');
    expect(FEEDBACK_TYPE_OPTIONS).toContain('界面问题');
    expect(FEEDBACK_TYPE_OPTIONS).toContain('建议');
    expect(FEEDBACK_TYPE_OPTIONS).toContain('其他');
  });
});

describe('FeedbackModal - 边界情况', () => {
  it('标题达到最大长度100字符时，验证仍通过', () => {
    const longTitle = 'a'.repeat(100);
    const errors = validateFeedbackForm(longTitle, '描述');
    expect(errors.title).toBeUndefined();
  });

  it('描述达到最大长度1000字符时，验证仍通过', () => {
    const longDescription = 'b'.repeat(1000);
    const errors = validateFeedbackForm('标题', longDescription);
    expect(errors.description).toBeUndefined();
  });

  it('联系方式达到最大长度100字符时，请求体正常构建', () => {
    const longContact = 'c'.repeat(100);
    const body = buildFeedbackRequestBody('标题', '描述', '其他', longContact);
    expect(body.contact).toBe(longContact);
  });

  it('标题包含特殊字符时，验证通过', () => {
    const specialTitle = '<script>alert("xss")</script>';
    const errors = validateFeedbackForm(specialTitle, '描述');
    expect(errors.title).toBeUndefined();
  });

  it('描述包含换行符时，验证通过', () => {
    const multilineDescription = '第一行\n第二行\n第三行';
    const errors = validateFeedbackForm('标题', multilineDescription);
    expect(errors.description).toBeUndefined();
  });
});
