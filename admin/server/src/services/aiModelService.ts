import { ObjectId } from 'mongodb';
import { adminDB } from '../config/database';
import { AIModelConfig, AIModelConfigListItem, AIModelProvider } from '../types';

/**
 * 创建模型配置请求体接口
 * 由路由层传入，apiKey 为必填项
 */
export interface CreateAIModelData {
  name: string;
  provider: AIModelProvider;
  apiKey: string;
  baseUrl: string;
  modelId: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
}

/**
 * 更新模型配置请求体接口
 * apiKey 可选，为空字符串或 undefined 时不更新原值
 */
export interface UpdateAIModelData {
  name?: string;
  provider?: AIModelProvider;
  apiKey?: string;
  baseUrl?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  isActive?: boolean;
  isDefault?: boolean;
  priority?: number;
}

/**
 * 合法的 AI 服务商类型白名单
 * 用于校验请求体中 provider 字段
 */
const VALID_PROVIDERS: AIModelProvider[] = ['zhipu', 'deepseek', 'openai', 'custom'];

/**
 * 默认采样温度，请求体未提供或越界时使用
 */
const DEFAULT_TEMPERATURE = 0.7;

/**
 * 默认最大输出 token 数，请求体未提供或越界时使用
 */
const DEFAULT_MAX_TOKENS = 2048;

/**
 * AI 模型管理服务
 * 提供 AI 模型配置的增删改查与默认模型设置功能
 * 操作 ai_model_configs 集合，由后台管理员通过界面维护
 */
class AIModelService {
  /** 集合名称常量 */
  private readonly COLLECTION = 'ai_model_configs';

  /**
   * 将 apiKey 转为掩码字符串
   * 保留前 3 位和后 4 位，中间用 *** 替换；过短时全部掩码
   * @param apiKey - 原始 API 密钥
   * @returns 掩码后的字符串，如 "sk-***abcd"
   */
  private maskApiKey(apiKey: string): string {
    if (!apiKey) return '';
    if (apiKey.length <= 7) {
      return '***';
    }
    const prefix = apiKey.substring(0, 3);
    const suffix = apiKey.substring(apiKey.length - 4);
    return `${prefix}***${suffix}`;
  }

  /**
   * 将 AIModelConfig 文档转换为列表项
   * 主要工作是将 apiKey 转为掩码并将日期字段转为字符串
   * @param doc - 数据库文档
   * @returns 列表项对象
   */
  private toListItem(doc: AIModelConfig): AIModelConfigListItem {
    return {
      _id: (doc._id as ObjectId).toString(),
      name: doc.name,
      provider: doc.provider,
      apiKeyMasked: this.maskApiKey(doc.apiKey),
      baseUrl: doc.baseUrl,
      modelId: doc.modelId,
      temperature: doc.temperature,
      maxTokens: doc.maxTokens,
      isActive: doc.isActive,
      isDefault: doc.isDefault,
      priority: doc.priority,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  /**
   * 校验 provider 字段是否合法
   * @param provider - 待校验的服务商类型
   * @returns 合法返回 true，否则返回 false
   */
  isValidProvider(provider: string): provider is AIModelProvider {
    return VALID_PROVIDERS.includes(provider as AIModelProvider);
  }

  /**
   * 获取所有模型配置列表
   * 按 priority 升序、createdAt 降序排列
   * 返回数据中 apiKey 已做掩码处理，不输出明文
   * @returns AIModelConfigListItem 数组，数据库不可用时返回空数组
   * @throws 数据库操作异常时向上抛出
   */
  async getAll(): Promise<AIModelConfigListItem[]> {
    const docs = await adminDB.find<AIModelConfig>(
      this.COLLECTION,
      {} as never,
      { sort: { priority: 1, createdAt: -1 } }
    );
    return docs.map((doc) => this.toListItem(doc));
  }

  /**
   * 根据 ID 获取单个模型配置
   * @param id - 文档 ObjectId 字符串
   * @returns AIModelConfig 或 null，id 非法时返回 null
   * @throws 数据库操作异常时向上抛出
   */
  async getById(id: string): Promise<AIModelConfig | null> {
    if (!ObjectId.isValid(id)) return null;
    return await adminDB.findOne<AIModelConfig>(this.COLLECTION, {
      _id: new ObjectId(id),
    } as never);
  }

  /**
   * 创建新的模型配置
   * 校验必填字段、归一化 temperature 和 maxTokens
   * 若 isDefault 为 true，会先取消其他模型默认标记，确保全局仅一个默认
   * @param data - 创建请求体
   * @returns 新创建文档的 _id 字符串，失败返回 null
   * @throws 数据库操作异常时向上抛出
   */
  async create(data: CreateAIModelData): Promise<string | null> {
    if (!data.name || !data.name.trim()) {
      throw new Error('模型名称不能为空');
    }
    if (!data.apiKey || !data.apiKey.trim()) {
      throw new Error('API Key 不能为空');
    }
    if (!data.modelId || !data.modelId.trim()) {
      throw new Error('模型 ID 不能为空');
    }
    if (!this.isValidProvider(data.provider)) {
      throw new Error(`服务商类型无效，允许值：${VALID_PROVIDERS.join('/')}`);
    }

    const temperature = this.normalizeTemperature(data.temperature);
    const maxTokens = this.normalizeMaxTokens(data.maxTokens);

    if (data.isDefault) {
      await this.clearOtherDefaults();
    }

    const now = new Date();
    const doc: Omit<AIModelConfig, '_id'> = {
      name: data.name.trim(),
      provider: data.provider,
      apiKey: data.apiKey.trim(),
      baseUrl: (data.baseUrl || '').trim(),
      modelId: data.modelId.trim(),
      temperature,
      maxTokens,
      isActive: data.isActive !== false,
      isDefault: data.isDefault === true,
      priority: Number.isFinite(data.priority) ? data.priority : 99,
      createdAt: now,
      updatedAt: now,
    };
    return await adminDB.insertOne<AIModelConfig>(this.COLLECTION, doc);
  }

  /**
   * 更新指定模型配置
   * apiKey 为空字符串或 undefined 时不更新原值，避免误清空
   * 若 isDefault 设为 true，会先取消其他模型默认标记
   * @param id - 文档 ObjectId 字符串
   * @param data - 更新请求体
   * @returns 是否更新成功，id 非法或文档不存在时返回 false
   * @throws 数据库操作异常时向上抛出
   */
  async update(id: string, data: UpdateAIModelData): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;

    const updateFields: Record<string, unknown> = {};

    if (data.name !== undefined) {
      if (!data.name.trim()) {
        throw new Error('模型名称不能为空');
      }
      updateFields.name = data.name.trim();
    }
    if (data.provider !== undefined) {
      if (!this.isValidProvider(data.provider)) {
        throw new Error(`服务商类型无效，允许值：${VALID_PROVIDERS.join('/')}`);
      }
      updateFields.provider = data.provider;
    }
    // apiKey 为非空字符串时才更新
    if (data.apiKey !== undefined && data.apiKey.trim() !== '') {
      updateFields.apiKey = data.apiKey.trim();
    }
    if (data.baseUrl !== undefined) {
      updateFields.baseUrl = data.baseUrl.trim();
    }
    if (data.modelId !== undefined) {
      if (!data.modelId.trim()) {
        throw new Error('模型 ID 不能为空');
      }
      updateFields.modelId = data.modelId.trim();
    }
    if (data.temperature !== undefined) {
      updateFields.temperature = this.normalizeTemperature(data.temperature);
    }
    if (data.maxTokens !== undefined) {
      updateFields.maxTokens = this.normalizeMaxTokens(data.maxTokens);
    }
    if (data.isActive !== undefined) {
      updateFields.isActive = data.isActive;
    }
    if (data.priority !== undefined) {
      updateFields.priority = Number.isFinite(data.priority) ? data.priority : 99;
    }

    if (data.isDefault !== undefined) {
      if (data.isDefault) {
        await this.clearOtherDefaults(id);
        updateFields.isDefault = true;
      } else {
        updateFields.isDefault = false;
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return false;
    }

    updateFields.updatedAt = new Date();

    return await adminDB.updateOne(
      this.COLLECTION,
      { _id: new ObjectId(id) } as never,
      { $set: updateFields }
    );
  }

  /**
   * 删除指定模型配置
   * 物理删除，删除后不可恢复
   * @param id - 文档 ObjectId 字符串
   * @returns 是否删除成功，id 非法时返回 false
   * @throws 数据库操作异常时向上抛出
   */
  async delete(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    return await adminDB.deleteOne(this.COLLECTION, {
      _id: new ObjectId(id),
    } as never);
  }

  /**
   * 将指定模型设为默认
   * 先取消其他模型的默认标记，再将目标模型标记为默认
   * @param id - 文档 ObjectId 字符串
   * @returns 是否设置成功，文档不存在时返回 false
   * @throws 数据库操作异常时向上抛出
   */
  async setDefault(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;

    const target = await this.getById(id);
    if (!target) return false;

    await this.clearOtherDefaults(id);

    return await adminDB.updateOne(
      this.COLLECTION,
      { _id: new ObjectId(id) } as never,
      { $set: { isDefault: true, updatedAt: new Date() } }
    );
  }

  /**
   * 取消除指定 ID 外其他模型的默认标记
   * 不传 excludeId 时取消所有模型的默认标记
   * @param excludeId - 需要保留默认标记的文档 ID
   */
  private async clearOtherDefaults(excludeId?: string): Promise<void> {
    const filter: Record<string, unknown> = { isDefault: true };
    if (excludeId && ObjectId.isValid(excludeId)) {
      filter._id = { $ne: new ObjectId(excludeId) };
    }
    await adminDB.updateMany(this.COLLECTION, filter as never, {
      $set: { isDefault: false, updatedAt: new Date() },
    });
  }

  /**
   * 归一化采样温度
   * 限制在 [0, 2] 区间，非数字时使用默认值
   * @param value - 原始温度值
   * @returns 归一化后的温度
   */
  private normalizeTemperature(value: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return DEFAULT_TEMPERATURE;
    }
    return Math.max(0, Math.min(2, value));
  }

  /**
   * 归一化最大输出 token 数
   * 限制在 [1, 32000] 区间，非数字时使用默认值
   * @param value - 原始 maxTokens 值
   * @returns 归一化后的 maxTokens
   */
  private normalizeMaxTokens(value: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return DEFAULT_MAX_TOKENS;
    }
    return Math.max(1, Math.min(32000, Math.floor(value)));
  }
}

export const aiModelService = new AIModelService();
