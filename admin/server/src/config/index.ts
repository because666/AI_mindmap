import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3002', 10),
    host: process.env.HOST || '0.0.0.0',
  },

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    database: process.env.MONGODB_DATABASE || 'deepmindmap',
  },

  jpush: {
    appKey: process.env.JPUSH_APPKEY || '',
    masterSecret: process.env.JPUSH_MASTER_SECRET || '',
  },

  session: {
    secret: process.env.SESSION_SECRET || 'deepmindmap-admin-session-secret',
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10),
  },

  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    loginAttemptsWindow: parseInt(process.env.LOGIN_ATTEMPTS_WINDOW || '300000', 10),
    loginAttemptsMax: parseInt(process.env.LOGIN_ATTEMPTS_MAX || '5', 10),
    loginLockDuration: parseInt(process.env.LOGIN_LOCK_DURATION || '900000', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3002',
  },
};

export type Config = typeof config;
