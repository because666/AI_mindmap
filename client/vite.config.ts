import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // 精确匹配 react/react-dom 核心包（用路径分隔符避免误匹配）
            if ((id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) && !id.includes('@xyflow')) {
              return 'vendor-react';
            }
            if (id.includes('@xyflow')) {
              return 'vendor-flow';
            }
            if (id.includes('react-markdown') || id.includes('/remark') || id.includes('/rehype') || id.includes('/unified') || id.includes('/micromark') || id.includes('/mdast') || id.includes('/hast') || id.includes('/unist')) {
              return 'vendor-markdown';
            }
            if (id.includes('/zustand')) {
              return 'vendor-zustand';
            }
            if (id.includes('/i18next') || id.includes('/react-i18next')) {
              return 'vendor-i18n';
            }
            if (id.includes('@capacitor')) {
              return 'vendor-capacitor';
            }
            return 'vendor';
          }
        },
      },
    },
  },
});
