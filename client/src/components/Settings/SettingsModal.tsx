import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Settings as SettingsIcon, Sliders, Key, BookOpen } from 'lucide-react';
import APIConfigPanel from './APIConfigPanel';
import UISettingsPanel from './UISettingsPanel';
import OnboardingGuide from '../Onboarding/OnboardingGuide';
import useIsMobile from '../../hooks/useIsMobile';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

type SettingsTab = 'api' | 'ui' | 'guide';

/**
 * 设置弹窗组件
 * 支持桌面端居中弹窗和移动端全屏显示
 */
const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialTab }) => {
  const { t } = useTranslation('settings');
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'ui');
  const [showGuide, setShowGuide] = useState(false);
  const isMobile = useIsMobile();

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'ui', label: t('uiSettings'), icon: <Sliders className="w-4 h-4" /> },
    { id: 'api', label: t('apiConfiguration'), icon: <Key className="w-4 h-4" /> },
    { id: 'guide', label: t('onboardingGuide'), icon: <BookOpen className="w-4 h-4" /> }
  ];

  const modalContent = (
    <>
      <div className={`flex items-center justify-between px-6 py-4 border-b border-dark-700 ${isMobile ? 'h-14' : ''}`}>
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white">{t('settings')}</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex border-b border-dark-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors min-h-[44px] ${
              activeTab === tab.id
                ? 'text-primary-400 border-b-2 border-primary-400 bg-dark-800/50'
                : 'text-dark-400 hover:text-white hover:bg-dark-800/30'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className={`p-6 overflow-y-auto ${isMobile ? 'flex-1' : 'max-h-[70vh]'}`}>
        {activeTab === 'ui' && <UISettingsPanel />}
        {activeTab === 'api' && <APIConfigPanel />}
        {activeTab === 'guide' && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <BookOpen className="w-16 h-16 text-primary-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">{t('onboardingGuide')}</h3>
              <p className="text-dark-400 text-sm mb-6 max-w-md mx-auto">
                {t('guideDescription')}
              </p>
              <button
                onClick={() => setShowGuide(true)}
                className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors shadow-lg"
              >
                {t('openGuide')}
              </button>
            </div>
            
            <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
              <h4 className="text-sm font-medium text-white mb-3">{t('guideContentIncludes')}</h4>
              <ul className="space-y-2 text-xs text-dark-400">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                  {t('guideProjectIntro')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                  {t('guideCanvasUsage')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                  {t('guideAiChat')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                  {t('guideNodeManagement')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                  {t('guideTools')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                  {t('guideWorkspaceCollab')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                  {t('guideSettingsConfig')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                  {t('guideTipsShortcuts')}
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col">
        {modalContent}
        <OnboardingGuide
          isOpen={showGuide}
          onClose={() => setShowGuide(false)}
          isForced={false}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl mx-4 bg-dark-900 rounded-2xl shadow-2xl overflow-hidden">
        {modalContent}
      </div>

      <OnboardingGuide
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        isForced={false}
      />
    </div>
  );
};

export default SettingsModal;
