/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_ALLOW_DEV_SIMULATOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
