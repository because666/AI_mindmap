import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { aiModelService } from '../services/aiModelService';
import { notifyAIModelsRefresh } from '../services/cacheNotify';
import { AIModelConfigListItem, AIModelProvider } from '../types';

const router = Router();

/**
 * 合法的服务商类型白名单
 * 用于请求体校验
 */
const VALID_PROVIDERS: AIModelProvider[] = ['zhipu', 'deepseek', 'openai', 'custom'];

/**
 * GET /
 * 获取所有 AI 模型配置列表
 * 返回数据中 apiKey 已做掩码处理，不输出明文
 */
router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const list = await aiModelService.getAll();
    res.json({ success: true, data: list });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取 AI 模型列表失败';
    console.error('获取 AI 模型列表失败:', error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /
 * 创建新的 AI 模型配置
 * 请求体：{ name, provider, apiKey, baseUrl, modelId, temperature?, maxTokens?, isActive?, isDefault?, priority? }
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      name,
      provider,
      apiKey,
      baseUrl,
      modelId,
      temperature,
      maxTokens,
      isActive,
      isDefault,
      priority,
    } = req.body as {
      name?: string;
      provider?: string;
      apiKey?: string;
      baseUrl?: string;
      modelId?: string;
      temperature?: number;
      maxTokens?: number;
      isActive?: boolean;
      isDefault?: boolean;
      priority?: number;
    };

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: '模型名称不能为空' });
      return;
    }
    if (!provider || !VALID_PROVIDERS.includes(provider as AIModelProvider)) {
      res.status(400).json({
        success: false,
        error: `服务商类型无效，允许值：${VALID_PROVIDERS.join('/')}`,
      });
      return;
    }
    if (!apiKey || !apiKey.trim()) {
      res.status(400).json({ success: false, error: 'API Key 不能为空' });
      return;
    }
    if (!modelId || !modelId.trim()) {
      res.status(400).json({ success: false, error: '模型 ID 不能为空' });
      return;
    }

    const id = await aiModelService.create({
      name,
      provider: provider as AIModelProvider,
      apiKey,
      baseUrl: baseUrl || '',
      modelId,
      temperature: typeof temperature === 'number' ? temperature : 0.7,
      maxTokens: typeof maxTokens === 'number' ? maxTokens : 2048,
      isActive: isActive !== false,
      isDefault: isDefault === true,
      priority: typeof priority === 'number' ? priority : 99,
    });

    if (!id) {
      res.status(500).json({ success: false, error: '创建 AI 模型配置失败' });
      return;
    }

    // 异步通知主服务刷新模型配置，不阻塞响应
    void notifyAIModelsRefresh();

    res.json({ success: true, data: { id }, message: 'AI 模型配置已创建' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建 AI 模型配置失败';
    console.error('创建 AI 模型配置失败:', error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * PUT /:id
 * 更新指定 AI 模型配置
 * apiKey 为空字符串或未传时不更新原值
 * 路径参数 id 为文档 ObjectId
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少模型 ID' });
      return;
    }

    const {
      name,
      provider,
      apiKey,
      baseUrl,
      modelId,
      temperature,
      maxTokens,
      isActive,
      isDefault,
      priority,
    } = req.body as {
      name?: string;
      provider?: string;
      apiKey?: string;
      baseUrl?: string;
      modelId?: string;
      temperature?: number;
      maxTokens?: number;
      isActive?: boolean;
      isDefault?: boolean;
      priority?: number;
    };

    if (provider !== undefined && !VALID_PROVIDERS.includes(provider as AIModelProvider)) {
      res.status(400).json({
        success: false,
        error: `服务商类型无效，允许值：${VALID_PROVIDERS.join('/')}`,
      });
      return;
    }

    const success = await aiModelService.update(id, {
      name,
      provider: provider as AIModelProvider | undefined,
      apiKey,
      baseUrl,
      modelId,
      temperature,
      maxTokens,
      isActive,
      isDefault,
      priority,
    });

    if (!success) {
      res.status(404).json({ success: false, error: '模型配置不存在或无更新内容' });
      return;
    }

    // 异步通知主服务刷新模型配置，不阻塞响应
    void notifyAIModelsRefresh();

    res.json({ success: true, message: 'AI 模型配置已更新' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新 AI 模型配置失败';
    console.error('更新 AI 模型配置失败:', error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * DELETE /:id
 * 删除指定 AI 模型配置
 * 物理删除，删除后不可恢复
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少模型 ID' });
      return;
    }

    const success = await aiModelService.delete(id);

    if (!success) {
      res.status(404).json({ success: false, error: '模型配置不存在或删除失败' });
      return;
    }

    // 异步通知主服务刷新模型配置，不阻塞响应
    void notifyAIModelsRefresh();

    res.json({ success: true, message: 'AI 模型配置已删除' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除 AI 模型配置失败';
    console.error('删除 AI 模型配置失败:', error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * PUT /:id/default
 * 将指定模型设置为默认模型
 * 自动取消其他模型的默认标记
 */
router.put('/:id/default', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少模型 ID' });
      return;
    }

    const success = await aiModelService.setDefault(id);

    if (!success) {
      res.status(404).json({ success: false, error: '模型配置不存在或设置默认失败' });
      return;
    }

    // 异步通知主服务刷新模型配置，不阻塞响应
    void notifyAIModelsRefresh();

    res.json({ success: true, message: '已设置为默认模型' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '设置默认模型失败';
    console.error('设置默认模型失败:', error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * PUT /:id/toggle
 * 切换模型启用/禁用状态
 * 请求体：{ isActive: boolean }
 */
router.put('/:id/toggle', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ success: false, error: '缺少模型 ID' });
      return;
    }

    const { isActive } = req.body as { isActive?: boolean };
    if (typeof isActive !== 'boolean') {
      res.status(400).json({ success: false, error: 'isActive 必须为布尔值' });
      return;
    }

    const success = await aiModelService.update(id, { isActive });

    if (!success) {
      res.status(404).json({ success: false, error: '模型配置不存在或更新失败' });
      return;
    }

    // 异步通知主服务刷新模型配置，不阻塞响应
    void notifyAIModelsRefresh();

    res.json({ success: true, data: { isActive }, message: '模型状态已切换' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '切换模型状态失败';
    console.error('切换模型状态失败:', error);
    res.status(500).json({ success: false, error: message });
  }
});

// 显式导出类型，便于其他模块引用
export type { AIModelConfigListItem };

export default router;
