import { defineConfig } from 'vitest/config';

/**
 * Admin 后台服务端 vitest 配置
 * - include: 仅匹配 src/test 下的测试文件
 * - globals: 启用全局 API（describe/it/expect 等）
 */
export default defineConfig({
  test: {
    globals: true,
    include: ['src/test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        'dist/',
      ],
    },
  },
});
