import type { CapacitorConfig } from '@capacitor/cli';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * 手动加载 .env.mobile 文件到 process.env
 * 避免引入 dotenv 第三方依赖，使用 Node.js 内置 fs 模块解析
 * 文件格式：KEY=VALUE，每行一条，# 开头为注释
 */
function loadEnvMobile(): void {
  const envPath = resolve(__dirname, '.env.mobile');
  if (!existsSync(envPath)) {
    return;
  }
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// 加载本地移动端环境变量
loadEnvMobile();

/**
 * 从环境变量读取极光推送 AppKey。
 * @returns {string} 非空的极光推送 AppKey。
 * @throws {Error} 当环境变量 `VITE_JPUSH_APPKEY` 未设置或为空字符串时抛出错误。
 */
function getJPushAppKey(): string {
  const appKey = process.env.VITE_JPUSH_APPKEY ?? '';
  if (appKey.trim().length === 0) {
    throw new Error('环境变量 VITE_JPUSH_APPKEY 未设置，无法配置极光推送 AppKey。请在 .env.mobile 文件中配置。');
  }
  return appKey;
}

/**
 * Capacitor 应用配置
 * 生产环境通过 server.url 加载线上 Web 资源，Web 端更新后 APP 自动同步
 * 所有敏感信息均通过环境变量注入。
 */
const config: CapacitorConfig = {
  appId: 'com.deepmindmap.app',
  appName: 'DeepMindMap',
  webDir: 'dist',
  server: {
    // APP 运行时加载线上 Web 资源，Web 端更新后 APP 无需重新安装即可同步
    url: 'https://deepmindmap.work',
    cleartext: false,
  },
  android: {
    buildOptions: {
      // 发布签名配置占位；真实 keystore 路径与密码需通过环境变量或 CI Secret 注入，切勿硬编码。
      keystorePath: undefined,
      keystoreAlias: undefined,
      keystorePassword: undefined,
      keystoreAliasPassword: undefined,
      releaseType: 'APK',
    },
  },
  plugins: {
    JPush: {
      appKey: getJPushAppKey(),
      channel: 'default',
    },
  },
};

export default config;
