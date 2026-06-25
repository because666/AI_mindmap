import React from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, RotateCcw, PanelRight, Zap, Languages } from 'lucide-react';
import { useUISettingsStore } from '../../stores/uiSettingsStore';

/**
 * UI设置面板组件
 * 提供用户界面相关的配置选项
 */
const UISettingsPanel: React.FC = () => {
  const { t, i18n } = useTranslation('settings');
  const {
    autoOpenChatOnLoad,
    chatPanelWidth,
    showWelcomeMessage,
    performanceMode,
    setAutoOpenChatOnLoad,
    setChatPanelWidth,
    setShowWelcomeMessage,
    setPerformanceMode,
    resetSettings
  } = useUISettingsStore();

  /**
   * 切换界面语言
   * @param lng - 目标语言代码（'zh' 或 'en'）
   */
  const handleLanguageChange = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="space-y-6">
      {/* 语言设置 */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-dark-300 uppercase tracking-wider flex items-center gap-2">
          <Languages className="w-4 h-4 text-primary-400" />
          {t('language')}
        </h3>

        <div className="bg-dark-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-white font-medium text-sm">
                {t('language')}
              </label>
              <p className="text-dark-400 text-xs mt-1">
                {t('languageDesc')}
              </p>
            </div>
            <select
              value={i18n.language?.startsWith('zh') ? 'zh' : i18n.language?.startsWith('en') ? 'en' : 'zh'}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-dark-700 text-white text-sm rounded-lg px-3 py-2 border border-dark-600 focus:border-primary-500 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>

      {/* 对话窗口设置 */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-dark-300 uppercase tracking-wider flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary-400" />
          {t('chatPanel')}
        </h3>
        
        <div className="bg-dark-800 rounded-lg p-4 space-y-4">
          {/* 自动打开对话窗口 */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-white font-medium text-sm">
                {t('autoOpenChatOnLoad')}
              </label>
              <p className="text-dark-400 text-xs mt-1">
                {t('autoOpenChatDesc')}
              </p>
            </div>
            <button
              onClick={() => setAutoOpenChatOnLoad(!autoOpenChatOnLoad)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                autoOpenChatOnLoad ? 'bg-primary-600' : 'bg-dark-600'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                  autoOpenChatOnLoad ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 显示欢迎消息 */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-white font-medium text-sm">
                {t('showWelcomeMessage')}
              </label>
              <p className="text-dark-400 text-xs mt-1">
                {t('showWelcomeMessageDesc')}
              </p>
            </div>
            <button
              onClick={() => setShowWelcomeMessage(!showWelcomeMessage)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                showWelcomeMessage ? 'bg-primary-600' : 'bg-dark-600'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                  showWelcomeMessage ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 面板设置 */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-dark-300 uppercase tracking-wider flex items-center gap-2">
          <PanelRight className="w-4 h-4 text-primary-400" />
          {t('panelLayout')}
        </h3>
        
        <div className="bg-dark-800 rounded-lg p-4 space-y-4">
          {/* 对话面板宽度 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-white font-medium text-sm">
                {t('chatPanelWidth')}
              </label>
              <span className="text-primary-400 text-sm font-mono">
                {chatPanelWidth}px
              </span>
            </div>
            <input
              type="range"
              min={280}
              max={600}
              step={20}
              value={chatPanelWidth}
              onChange={(e) => setChatPanelWidth(Number(e.target.value))}
              className="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <div className="flex justify-between text-xs text-dark-400">
              <span>{t('compact')}</span>
              <span>{t('spacious')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 性能设置 */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-dark-300 uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary-400" />
          {t('performanceOptimization')}
        </h3>

        <div className="bg-dark-800 rounded-lg p-4 space-y-4">
          {/* 性能模式开关 */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-white font-medium text-sm">
                {t('performanceMode')}
              </label>
              <p className="text-dark-400 text-xs mt-1">
                {t('performanceModeDesc')}
              </p>
            </div>
            <button
              onClick={() => setPerformanceMode(!performanceMode)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                performanceMode ? 'bg-primary-600' : 'bg-dark-600'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                  performanceMode ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 重置按钮 */}
      <div className="pt-4 border-t border-dark-700">
        <button
          onClick={resetSettings}
          className="flex items-center gap-2 px-4 py-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          {t('resetToDefault')}
        </button>
      </div>
    </div>
  );
};

export default UISettingsPanel;
