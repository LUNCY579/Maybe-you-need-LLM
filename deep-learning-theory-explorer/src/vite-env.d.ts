/// <reference types="vite/client" />

/**
 * The Vite environment.
 *
 * `import.meta.env.PROD` tells the application whether it is running from a
 * build or from the development server, which is what decides whether the
 * service worker — a cache-first worker — is allowed to register.
 */
interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
