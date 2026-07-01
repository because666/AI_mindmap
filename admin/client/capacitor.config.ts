import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.deepmindmap.admin',
  appName: 'DeepMindMap Admin',
  webDir: 'dist',
  server: {
    url: 'https://admin.deepmindmap.work',
    cleartext: false,
  },
};

export default config;
