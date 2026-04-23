/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API origin (no trailing slash), e.g. http://localhost:8080 */
  readonly VITE_API_BASE_URL?: string
  /** Razorpay Checkout key id (safe to expose; never put the secret on the client) */
  readonly VITE_RAZORPAY_KEY_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
