import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Network } from '@capacitor/network';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { App as AppPlugin } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * 移动端原生功能服务
 * 封装 Capacitor 原生插件，提供触觉反馈、网络检测、屏幕常亮、返回键处理、状态栏控制等功能
 * 在非移动端环境（Web浏览器）中自动降级为空操作
 */

/** 触觉反馈强度类型 */
export type HapticImpact = 'light' | 'medium' | 'heavy';

/** 网络连接状态 */
export type NetworkStatus = {
  connected: boolean;
  connectionType: string;
};

/** 网络状态变化回调类型 */
type NetworkStatusCallback = (status: NetworkStatus) => void;

/** 返回键处理器回调类型，返回 true 表示已消费事件，阻止默认行为 */
type BackButtonHandler = () => boolean | Promise<boolean>;

class MobileService {
  private isNative: boolean = false;
  private networkListeners: NetworkStatusCallback[] = [];
  private isKeepAwake: boolean = false;
  private backButtonHandlers: BackButtonHandler[] = [];

  constructor() {
    this.detectPlatform();
    this.initNetworkListener();
    this.initBackButtonListener();
  }

  /**
   * 检测当前运行平台
   * @private
   */
  private detectPlatform(): void {
    this.isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  }

  /**
   * 初始化网络监听器
   * @private
   */
  private async initNetworkListener(): Promise<void> {
    try {
      await Network.addListener('networkStatusChange', (status: any) => {
        const normalizedStatus: NetworkStatus = {
          connected: status.connected,
          connectionType: status.connectionType,
        };
        this.networkListeners.forEach((cb) => cb(normalizedStatus));
      });
    } catch (error) {
      console.warn('[MobileService] 网络监听器初始化失败:', error);
    }
  }

  // ==================== 触觉反馈 ====================

  /**
   * 触发触觉反馈（冲击式震动）
   * @param impact - 震动强度，可选 'light'(轻)、'medium'(中)、'heavy'(重)
   */
  async haptic(impact: HapticImpact = 'medium'): Promise<void> {
    if (!this.isNative) return;

    const styleMap: Record<HapticImpact, ImpactStyle> = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };

    try {
      await Haptics.impact({ style: styleMap[impact] });
    } catch (error) {
      console.warn('[MobileService] 触觉反馈失败:', error);
    }
  }

  /**
   * 触发通知式振动（用于成功/失败/警告提示）
   * @param type - 通知类型：'success'(成功双击)、'warning'(警告)、'error'(错误长振)
   */
  async notify(type: 'success' | 'warning' | 'error' = 'success'): Promise<void> {
    if (!this.isNative) return;

    const typeMap = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    };

    try {
      await Haptics.notification({ type: typeMap[type] });
    } catch (error) {
      console.warn('[MobileService] 通知振动失败:', error);
    }
  }

  /**
   * 选择变化时的微弱反馈（如选择列表项）
   */
  async selectionStart(): Promise<void> {
    if (!this.isNative) return;

    try {
      await Haptics.selectionStart();
    } catch (error) {
      console.warn('[MobileService] 选择开始反馈失败:', error);
    }
  }

  /**
   * 选择结束时的微弱反馈（配合 selectionStart 使用）
   */
  async selectionChanged(): Promise<void> {
    if (!this.isNative) return;

    try {
      await Haptics.selectionChanged();
    } catch (error) {
      console.warn('[MobileService] 选择变更反馈失败:', error);
    }
  }

  /**
   * 选择完成后的确认反馈
   */
  async selectionEnd(): Promise<void> {
    if (!this.isNative) return;

    try {
      await Haptics.selectionEnd();
    } catch (error) {
      console.warn('[MobileService] 选择结束反馈失败:', error);
    }
  }

  // ==================== 网络状态 ====================

  /**
   * 获取当前网络连接状态
   * @returns 网络状态对象，包含 connected 和 connectionType
   */
  async getNetworkStatus(): Promise<NetworkStatus> {
    try {
      const status = await Network.getStatus();
      return { connected: status.connected, connectionType: status.connectionType };
    } catch (error) {
      console.warn('[MobileService] 获取网络状态失败:', error);
      return { connected: navigator.onLine, connectionType: 'unknown' };
    }
  }

  /**
   * 注册网络状态变化监听器
   * @param callback - 状态变化回调函数
   * @returns 取消注册的函数，调用后移除此监听器
   */
  onNetworkChange(callback: NetworkStatusCallback): () => void {
    this.networkListeners.push(callback);

    return () => {
      this.networkListeners = this.networkListeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * 检查是否已联网
   * @returns 是否在线
   */
  async isOnline(): Promise<boolean> {
    const status = await this.getNetworkStatus();
    return status.connected;
  }

  // ==================== 屏幕常亮 ====================

  /**
   * 开启屏幕常亮模式（防止屏幕熄灭）
   * 适用于 AI 对话、演示等需要长时间显示的场景
   */
  async keepAwake(): Promise<void> {
    if (!this.isNative || this.isKeepAwake) return;

    try {
      await KeepAwake.keepAwake();
      this.isKeepAwake = true;
      console.log('[MobileService] 屏幕常亮已开启');
    } catch (error) {
      console.warn('[MobileService] 开启屏幕常亮失败:', error);
    }
  }

  /**
   * 关闭屏幕常亮模式（恢复正常屏幕超时）
   */
  async allowSleep(): Promise<void> {
    if (!this.isNative || !this.isKeepAwake) return;

    try {
      await KeepAwake.allowSleep();
      this.isKeepAwake = false;
      console.log('[MobileService] 屏幕常亮已关闭');
    } catch (error) {
      console.warn('[MobileService] 关闭屏幕常亮失败:', error);
    }
  }

  /**
   * 获取当前屏幕常亮状态
   * @returns 是否处于常亮模式
   */
  getIsKeepAwake(): boolean {
    return this.isKeepAwake;
  }

  // ==================== 返回键处理 ====================

  /**
   * 初始化返回键监听器
   * 使用优先级队列模式，后注册的处理器先执行
   * @private
   */
  private async initBackButtonListener(): Promise<void> {
    if (!this.isNative) return;

    try {
      await AppPlugin.addListener('backButton', () => {
        this.handleBackButton();
      });
      console.log('[MobileService] 返回键监听器已初始化');
    } catch (error) {
      console.warn('[MobileService] 返回键监听器初始化失败:', error);
    }
  }

  /**
   * 处理返回键事件
   * 按照注册顺序的逆序（后注册的先执行）调用处理器
   * 如果有处理器返回 true，则停止后续处理
   * @private
   */
  private async handleBackButton(): Promise<void> {
    for (let i = this.backButtonHandlers.length - 1; i >= 0; i--) {
      const handler = this.backButtonHandlers[i];
      try {
        const consumed = await handler();
        if (consumed) return;
      } catch (error) {
        console.warn('[MobileService] 返回键处理器执行失败:', error);
      }
    }

    // 所有处理器都未消费事件，执行默认行为
    await AppPlugin.exitApp();
  }

  /**
   * 注册返回键处理器
   * 后注册的处理器会先执行（栈式结构）
   * @param handler - 处理函数，返回 true 表示已消费事件
   * @returns 取消注册函数
   */
  registerBackButtonHandler(handler: BackButtonHandler): () => void {
    this.backButtonHandlers.push(handler);

    return () => {
      this.backButtonHandlers = this.backButtonHandlers.filter((h) => h !== handler);
    };
  }

  /**
   * 清除所有返回键处理器
   */
  clearBackButtonHandlers(): void {
    this.backButtonHandlers = [];
  }

  // ==================== 状态栏控制 ====================

  /**
   * 设置状态栏为深色主题（白色文字 + 深色背景）
   * 适用于深色主题应用
   * @param color - 状态栏背景颜色，默认为 #0a0a12
   */
  async setStatusBarDark(color: string = '#0a0a12'): Promise<void> {
    if (!this.isNative) return;

    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color });
      console.log('[MobileService] 状态栏已设置为深色主题');
    } catch (error) {
      console.warn('[MobileService] 设置状态栏失败:', error);
    }
  }

  /**
   * 设置状态栏为浅色主题（深色文字 + 浅色背景）
   * 适用于浅色主题应用
   * @param color - 状态栏背景颜色
   */
  async setStatusBarLight(color: string = '#ffffff'): Promise<void> {
    if (!this.isNative) return;

    try {
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color });
      console.log('[MobileService] 状态栏已设置为浅色主题');
    } catch (error) {
      console.warn('[MobileService] 设置状态栏失败:', error);
    }
  }

  /**
   * 隐藏状态栏（全屏模式）
   */
  async hideStatusBar(): Promise<void> {
    if (!this.isNative) return;

    try {
      await StatusBar.hide();
      console.log('[MobileService] 状态栏已隐藏');
    } catch (error) {
      console.warn('[MobileService] 隐藏状态栏失败:', error);
    }
  }

  /**
   * 显示状态栏
   */
  async showStatusBar(): Promise<void> {
    if (!this.isNative) return;

    try {
      await StatusBar.show();
      console.log('[MobileService] 状态栏已显示');
    } catch (error) {
      console.warn('[MobileService] 显示状态栏失败:', error);
    }
  }

  // ==================== 平台信息 ====================

  /**
   * 检查是否运行在原生移动端平台
   * @returns 是否为原生平台
   */
  isNativePlatform(): boolean {
    return this.isNative;
  }
}

const mobileService = new MobileService();

export default mobileService;
