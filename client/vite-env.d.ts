/**
 * Vite 客户端环境变量类型声明
 * 此处补充极光推送相关的构建时环境变量，避免在业务代码中使用 `any` 类型。
 */
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 极光推送 AppKey，构建时通过环境变量注入，禁止在代码中硬编码。 */
  readonly VITE_JPUSH_APPKEY: string;
  /** 极光推送渠道，默认使用 `default`，与 Android Gradle 配置保持一致。 */
  readonly VITE_JPUSH_CHANNEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
