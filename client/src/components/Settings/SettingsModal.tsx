import React, { useState } from 'react';
import { X, Settings as SettingsIcon, Sliders, Key, BookOpen } from 'lucide-react';
import APIConfigPanel from './APIConfigPanel';
import UISettingsPanel from './UISettingsPanel';
import OnboardingGuide from '../Onboarding/OnboardingGuide';
import useIsMobile from '../../hooks/useIsMobile';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'api' | 'ui' | 'guide';

/**
 * 设置弹窗组件
 * 支持桌面端居中弹窗和移动端全屏显示
 */
const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('ui');
  const [showGuide, setShowGuide] = useState(false);
  const isMobile = useIsMobile();

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'ui', label: '界面设置', icon: <Sliders className="w-4 h-4" /> },
    { id: 'api', label: 'API配置', icon: <Key className="w-4 h-4" /> },
    { id: 'guide', label: '新手引导', icon: <BookOpen className="w-4 h-4" /> }
  ];

  const modalContent = (
    <>
      <div className={`flex items-center justify-between px-6 py-4 border-b border-dark-700 ${isMobile ? 'h-14' : ''}`}>
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white">设置</h2>
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
              <h3 className="text-xl font-semibold text-white mb-2">新手引导</h3>
              <p className="text-dark-400 text-sm mb-6 max-w-md mx-auto">
                查看完整的新手引导文档，了解DeepMindMap的所有功能和使用方法
              </p>
              <button
                onClick={() => setShowGuide(true)}
                className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors shadow-lg"
              >
                打开新手引导
              </button>
            </div>
            
            <div className="bg-dark-800 rounded-xl p-4 border border-dark-700">
              <h4 className="text-sm font-medium text-white mb-3">引导内容包含</h4>
              <ul className="space-y-2 text-xs text-dark-400">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                  项目介绍与核心定位
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                  思维画布使用指南
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                  AI对话系统详解
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                  节点管理与关系连接
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                  工作区协作功能
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                  设置与个性化配置
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                  使用技巧与快捷键
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
