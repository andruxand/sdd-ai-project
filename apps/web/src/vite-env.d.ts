/// <reference types="vite/client" />

/**
 * Vite environment variables type definitions.
 * Extend ImportMetaEnv to add custom VITE_* variables.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_STAGE?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
