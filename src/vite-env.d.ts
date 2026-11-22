/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** Supabase project URL, read from config.js at build time. */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase public anon key, read from config.js at build time. */
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Navigator {
  /** iOS Safari: true when running as a home-screen app. */
  readonly standalone?: boolean;
}
