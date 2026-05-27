import React from 'react';

/**
 * 简洁渐变背景组件
 * 使用纯 CSS 实现深色底色 + 蓝/靛蓝径向渐变光晕 + 点阵网格纹理
 * 零 GPU 开销，无 JS 动画、无 Canvas、无 WebGL
 */
const MinimalBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 -z-10"
      style={{
        background: 'radial-gradient(ellipse at 20% 50%, rgba(14, 165, 233, 0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(99, 102, 241, 0.04) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(14, 165, 233, 0.03) 0%, transparent 50%), #020617',
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
    </div>
  );
};

export default MinimalBackground;
