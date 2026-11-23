export interface Env {
  DB: D1Database
  FAUCETPAY_API_KEY?: string
  ADMIN_SECRET?: string
  FREELLM_API_KEY?: string
  FREELLM_MODEL?: string
  FREELLM_SYSTEM_API_KEY?: string
  // Deprecated - fallback for apps migrating from Mistral
  MISTRAL_API_KEY?: string
  MISTRAL_MODEL?: string
}
