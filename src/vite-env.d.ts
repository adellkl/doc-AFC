/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_SUBMIT_FUNCTION?: string
  readonly VITE_SUPABASE_DOCUMENTS_FUNCTION?: string
  readonly VITE_SUPABASE_DELETE_APPLICATION_FUNCTION?: string
  readonly VITE_ADMIN_LOGIN_DOMAIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
