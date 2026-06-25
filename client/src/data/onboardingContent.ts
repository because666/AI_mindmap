/**
 * 新手引导内容配置
 * 定义引导文档的所有页面结构和 i18n 翻译键
 */

/**
 * 引导页面接口
 *
 * 每个页面对应一个独立的功能模块，所有文本内容均通过 i18n 翻译键获取，
 * 避免在该配置文件中硬编码具体文案。
 */
export interface GuidePage {
  /**
   * 页面唯一标识
   */
  id: string;

  /**
   * 页面图标（emoji）
   */
  icon: string;

  /**
   * 页面标题的 i18n 翻译键
   */
  titleKey: string;

  /**
   * 页面正文（字符串数组）的 i18n 翻译键
   */
  contentKey: string;

  /**
   * 页面底部高亮标签（字符串数组）的 i18n 翻译键
   */
  highlightsKey: string;
}

/**
 * 引导配置接口
 *
 * 定义欢迎页的标题、副标题、强制倒计时秒数以及所有引导页面。
 */
export interface GuideConfig {
  /**
   * 欢迎标题的 i18n 翻译键
   */
  titleKey: string;

  /**
   * 欢迎副标题的 i18n 翻译键
   */
  subtitleKey: string;

  /**
   * 强制模式倒计时秒数
   */
  countdownSeconds: number;

  /**
   * 引导页面数组
   */
  pages: GuidePage[];
}

/**
 * 新手引导完整内容配置
 *
 * 所有文本均使用 `onboarding:` 命名空间的翻译键，具体文案请在 i18n 资源文件中维护。
 */
export const onboardingGuideConfig: GuideConfig = {
  titleKey: 'onboarding:welcomeTitle',
  subtitleKey: 'onboarding:welcomeSubtitle',
  countdownSeconds: 3,
  pages: [
    {
      id: 'intro',
      icon: '🧠',
      titleKey: 'onboarding:pages.intro.title',
      contentKey: 'onboarding:pages.intro.content',
      highlightsKey: 'onboarding:pages.intro.highlights'
    },
    {
      id: 'canvas',
      icon: '🎨',
      titleKey: 'onboarding:pages.canvas.title',
      contentKey: 'onboarding:pages.canvas.content',
      highlightsKey: 'onboarding:pages.canvas.highlights'
    },
    {
      id: 'chat',
      icon: '💬',
      titleKey: 'onboarding:pages.chat.title',
      contentKey: 'onboarding:pages.chat.content',
      highlightsKey: 'onboarding:pages.chat.highlights'
    },
    {
      id: 'nodes',
      icon: '📝',
      titleKey: 'onboarding:pages.nodes.title',
      contentKey: 'onboarding:pages.nodes.content',
      highlightsKey: 'onboarding:pages.nodes.highlights'
    },
    {
      id: 'tools',
      icon: '🧰',
      titleKey: 'onboarding:pages.tools.title',
      contentKey: 'onboarding:pages.tools.content',
      highlightsKey: 'onboarding:pages.tools.highlights'
    },
    {
      id: 'workspace',
      icon: '🏢',
      titleKey: 'onboarding:pages.workspace.title',
      contentKey: 'onboarding:pages.workspace.content',
      highlightsKey: 'onboarding:pages.workspace.highlights'
    },
    {
      id: 'settings',
      icon: '⚙️',
      titleKey: 'onboarding:pages.settings.title',
      contentKey: 'onboarding:pages.settings.content',
      highlightsKey: 'onboarding:pages.settings.highlights'
    },
    {
      id: 'tips',
      icon: '💡',
      titleKey: 'onboarding:pages.tips.title',
      contentKey: 'onboarding:pages.tips.content',
      highlightsKey: 'onboarding:pages.tips.highlights'
    }
  ]
};
