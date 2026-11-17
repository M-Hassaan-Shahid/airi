/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DISTRIBUTION?: 'direct' | 'steam'
  /** `true` turns the over-the-air updater off, for a patched build that must not take upstream bundles. */
  readonly VITE_DISABLE_UPDATES?: string
  readonly VITE_DISABLE_FLUX_PURCHASE?: string
  readonly VITE_DISABLE_CUSTOM_PROVIDERS?: string
  readonly VITE_ENABLE_ANALYTICS?: string
  readonly VITE_REVENUECAT_WEB_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
