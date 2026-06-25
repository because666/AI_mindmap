/**
 * i18n 国际化初始化配置
 * 使用 i18next + react-i18next + i18next-browser-languagedetector
 * 支持中文(zh)和英文(en)，默认语言为中文
 * 所有 namespace 的翻译资源通过静态 import 导入
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

/* 通用文本 */
import commonZh from './locales/common/zh.json';
import commonEn from './locales/common/en.json';

/* 导航文本 */
import navZh from './locales/nav/zh.json';
import navEn from './locales/nav/en.json';

/* 画布文本 */
import canvasZh from './locales/canvas/zh.json';
import canvasEn from './locales/canvas/en.json';

/* 对话文本 */
import chatZh from './locales/chat/zh.json';
import chatEn from './locales/chat/en.json';

/* 工作区文本 */
import workspaceZh from './locales/workspace/zh.json';
import workspaceEn from './locales/workspace/en.json';

/* 设置文本 */
import settingsZh from './locales/settings/zh.json';
import settingsEn from './locales/settings/en.json';

/* 搜索文本 */
import searchZh from './locales/search/zh.json';
import searchEn from './locales/search/en.json';

/* 反馈文本 */
import feedbackZh from './locales/feedback/zh.json';
import feedbackEn from './locales/feedback/en.json';

/* 消息文本 */
import messageZh from './locales/message/zh.json';
import messageEn from './locales/message/en.json';

/* 历史文本 */
import historyZh from './locales/history/zh.json';
import historyEn from './locales/history/en.json';

/* 文件文本 */
import fileZh from './locales/file/zh.json';
import fileEn from './locales/file/en.json';

/* 新手引导文本 */
import onboardingZh from './locales/onboarding/zh.json';
import onboardingEn from './locales/onboarding/en.json';

/* 公告文本 */
import announcementZh from './locales/announcement/zh.json';
import announcementEn from './locales/announcement/en.json';

/**
 * 翻译资源对象
 * 键为语言代码，值为各 namespace 的翻译键值对
 */
const resources = {
  zh: {
    common: commonZh,
    nav: navZh,
    canvas: canvasZh,
    chat: chatZh,
    workspace: workspaceZh,
    settings: settingsZh,
    search: searchZh,
    feedback: feedbackZh,
    message: messageZh,
    history: historyZh,
    file: fileZh,
    onboarding: onboardingZh,
    announcement: announcementZh,
  },
  en: {
    common: commonEn,
    nav: navEn,
    canvas: canvasEn,
    chat: chatEn,
    workspace: workspaceEn,
    settings: settingsEn,
    search: searchEn,
    feedback: feedbackEn,
    message: messageEn,
    history: historyEn,
    file: fileEn,
    onboarding: onboardingEn,
    announcement: announcementEn,
  },
};

/**
 * 初始化 i18next
 * - 使用 BrowserLanguageDetector 检测浏览器语言
 * - 默认语言和回退语言均为中文
 * - namespace 列表涵盖所有功能模块
 * - 语言检测结果存储在 localStorage 的 i18n_lang 键中
 * - React 已自带 XSS 防护，因此关闭 interpolation 的 escapeValue
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh',
    defaultNS: 'common',
    ns: [
      'common',
      'nav',
      'canvas',
      'chat',
      'workspace',
      'settings',
      'search',
      'feedback',
      'message',
      'history',
      'file',
      'onboarding',
      'announcement',
    ],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18n_lang',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

/**
 * 更新页面 SEO 元信息
 * 根据当前语言动态设置 document.title 和 meta description
 */
function updatePageMeta(): void {
  const lng = i18n.language?.startsWith('en') ? 'en' : 'zh';
  const title = i18n.getResource(lng, 'common', 'pageTitle') as string;
  const description = i18n.getResource(lng, 'common', 'pageDescription') as string;

  if (title) {
    document.title = title;
  }

  let descriptionMeta = document.querySelector('meta[name="description"]');
  if (!descriptionMeta) {
    descriptionMeta = document.createElement('meta');
    descriptionMeta.setAttribute('name', 'description');
    document.head.appendChild(descriptionMeta);
  }
  if (description) {
    descriptionMeta.setAttribute('content', description);
  }

  // 同步更新 html lang 属性
  document.documentElement.lang = lng === 'en' ? 'en' : 'zh-CN';
}

/**
 * 监听语言变化事件，动态更新页面标题和描述
 */
i18n.on('languageChanged', () => {
  updatePageMeta();
});

// 初始化时执行一次，确保首次加载正确
if (typeof document !== 'undefined') {
  updatePageMeta();
}

export default i18n;
