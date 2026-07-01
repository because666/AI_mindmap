import { defineConfig } from 'vitest/config';

/**
 * Admin 后台服务端 vitest 配置
 * - include: 匹配 src/test、src/utils、src/services 下的测试文件
 *   （src/utils 与 src/services 下放置与工具/服务实现同目录的单元测试，便于就近维护）
 * - globals: 启用全局 API（describe/it/expect 等）
 */
export default defineConfig({
  test: {
    globals: true,
    include: [
      'src/test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
      'src/utils/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
      'src/services/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        'src/utils/**/*.test.ts',
        'src/utils/**/*.spec.ts',
        'dist/',
      ],
    },
  },
});
