import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Clock, BookOpen, Sparkles } from 'lucide-react';
import { onboardingGuideConfig, type GuidePage } from '../../data/onboardingContent';
import { markOnboardingCompleted } from '../../utils/onboardingStorage';
import MarkdownRenderer from '../Chat/MarkdownRenderer';
import useIsMobile from '../../hooks/useIsMobile';

interface OnboardingGuideProps {
  isOpen: boolean;
  onClose: () => void;
  isForced?: boolean;
}

/**
 * 新手引导模态窗口组件
 * 支持分页展示、倒计时、首次强制阅读等功能
 */
const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ 
  isOpen, 
  onClose,
  isForced = false 
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [countdown, setCountdown] = useState(onboardingGuideConfig.countdownSeconds);
  const [canClose, setCanClose] = useState(!isForced);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const isMobile = useIsMobile();
  const pages = onboardingGuideConfig.pages;
  const totalPages = pages.length;
  const currentPageData: GuidePage = pages[currentPage];

  /**
   * 倒计时逻辑
   * 仅在强制模式下启用，用户必须等待指定时间才能关闭
   */
  useEffect(() => {
    if (!isOpen || !isForced || canClose) return;

    setCountdown(onboardingGuideConfig.countdownSeconds);
    
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
          }
          setCanClose(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [isOpen, isForced]);

  /**
   * 重置状态当打开时
   */
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(0);
      if (isForced) {
        setCountdown(onboardingGuideConfig.countdownSeconds);
        setCanClose(false);
      } else {
        setCanClose(true);
      }
    }
  }, [isOpen, isForced]);

  /**
   * 滚动到内容顶部当切换页面
   */
  useEffect(() => {
    if (contentRef.current && isOpen) {
      contentRef.current.scrollTop = 0;
    }
  }, [currentPage, isOpen]);

  /**
   * 处理关闭操作
   */
  const handleClose = useCallback(() => {
    if (!canClose && isForced) return;
    
    if (isForced) {
      markOnboardingCompleted();
    }
    
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    onClose();
  }, [canClose, isForced, onClose]);

  /**
   * 上一页
   */
  const handlePrevious = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage]);

  /**
   * 下一页
   */
  const handleNext = useCallback(() => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, totalPages]);

  /**
   * 格式化倒计时显示
   */
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  /**
   * 渲染Markdown内容
   */
  const renderContent = (content: string[]) => {
    return content.map((paragraph, index) => (
      <div key={index} className="mb-3 last:mb-0">
        <MarkdownRenderer content={paragraph} />
      </div>
    ));
  };

  /**
   * 渲染高亮标签
   */
  const renderHighlights = () => {
    if (!currentPageData.highlights || currentPageData.highlights.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-dark-700">
        {currentPageData.highlights.map((highlight, index) => (
          <span
            key={index}
            className="px-3 py-1 bg-primary-600/20 text-primary-300 rounded-full text-xs font-medium border border-primary-500/30"
          >
            {highlight}
          </span>
        ))}
      </div>
    );
  };

  /**
   * 渲染页面指示器
   */
  const renderPageIndicators = () => (
    <div className="flex items-center justify-center gap-2">
      {pages.map((_, index) => (
        <button
          key={index}
          onClick={() => setCurrentPage(index)}
          className={`w-2 h-2 rounded-full transition-all duration-300 ${
            index === currentPage
              ? 'bg-primary-400 w-6'
              : 'bg-dark-600 hover:bg-dark-500'
          }`}
          aria-label={`跳转到第${index + 1}页`}
        />
      ))}
    </div>
  );

  const modalContent = (
    <>
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700 bg-dark-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl flex items-center justify-center text-xl shadow-lg">
            {currentPageData.icon}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{currentPageData.title}</h2>
            <p className="text-xs text-dark-400">
              第 {currentPage + 1} 页，共 {totalPages} 页
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 强制模式倒计时 */}
          {isForced && !canClose && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-lg text-sm font-medium animate-pulse">
              <Clock className="w-4 h-4" />
              <span>{formatCountdown(countdown)}</span>
            </div>
          )}

          <button
            onClick={handleClose}
            disabled={!canClose && isForced}
            className={`p-2 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center ${
              canClose || !isForced
                ? 'text-dark-400 hover:text-white hover:bg-dark-700'
                : 'text-dark-600 cursor-not-allowed opacity-50'
            }`}
            title={canClose || !isForced ? "关闭引导" : `请等待 ${formatCountdown(countdown)} 后关闭`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div 
        ref={contentRef}
        className={`overflow-y-auto ${
          isMobile ? 'flex-1' : 'max-h-[60vh]'
        } p-6`}
      >
        {/* 欢迎标题（仅第一页显示） */}
        {currentPage === 0 && (
          <div className="text-center mb-6 pb-6 border-b border-dark-700">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600/20 rounded-full text-primary-300 text-sm mb-3">
              <Sparkles className="w-4 h-4" />
              <span>欢迎使用</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {onboardingGuideConfig.title}
            </h1>
            <p className="text-dark-400 text-sm">
              {onboardingGuideConfig.subtitle}
            </p>
          </div>
        )}

        {/* 主要内容 */}
        <div className="prose prose-invert max-w-none prose-sm prose-headings:text-white prose-p:text-dark-300 prose-li:text-dark-300 prose-strong:text-white prose-code:text-primary-300 prose-pre:bg-dark-800 prose-table:border-dark-700">
          {renderContent(currentPageData.content)}
        </div>

        {/* 高亮标签 */}
        {renderHighlights()}

        {/* 结束提示（最后一页） */}
        {currentPage === totalPages - 1 && (
          <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
            <BookOpen className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-green-300 font-medium">🎉 恭喜！您已了解所有核心功能</p>
            <p className="text-dark-400 text-xs mt-1">
              现在可以开始您的 DeepMindMap 之旅了
            </p>
          </div>
        )}
      </div>

      {/* 底部导航 */}
      <div className="px-6 py-4 border-t border-dark-700 bg-dark-800/30">
        <div className="flex items-center justify-between">
          {/* 上一步按钮 */}
          <button
            onClick={handlePrevious}
            disabled={currentPage === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              currentPage === 0
                ? 'text-dark-600 cursor-not-allowed'
                : 'text-dark-300 hover:text-white hover:bg-dark-700'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>上一步</span>
          </button>

          {/* 页面指示器 */}
          {renderPageIndicators()}

          {/* 下一步按钮 */}
          <button
            onClick={handleNext}
            disabled={currentPage === totalPages - 1}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              currentPage === totalPages - 1
                ? 'text-dark-600 cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            <span>下一步</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  // 移动端全屏展示
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[100] bg-dark-950 flex flex-col animate-fade-in">
        {modalContent}
      </div>
    );
  }

  // 桌面端居中弹窗
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
      />

      {/* 弹窗主体 */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-dark-900 rounded-2xl shadow-2xl overflow-hidden border border-dark-700 flex flex-col">
        {modalContent}
      </div>
    </div>
  );
};

export default OnboardingGuide;
