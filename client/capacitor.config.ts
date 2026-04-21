import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.deepmindmap.app',
  appName: 'DeepMindMap',
  webDir: 'dist',
  server: {
    url: 'http://43.139.43.112',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
      keystorePassword: undefined,
      keystoreAliasPassword: undefined,
      releaseType: 'APK'
    }
  },
  plugins: {
    JPush: {
      appKey: 'cbba9b691fdd44462072311d',
      channel: 'default',
    },
  },
};

export default config;
