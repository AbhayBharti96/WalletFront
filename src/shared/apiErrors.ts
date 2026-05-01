import axios from 'axios'

const normalize = (msg: string) => msg.toLowerCase().trim()

export function toUserFriendlyAuthError(raw: string): string {
  const msg = normalize(raw)

  if (
    msg.includes('wallet is blocked') ||
    msg.includes('wallet blocked') ||
    msg.includes('user is blocked') ||
    msg.includes('account is blocked') ||
    msg.includes('account blocked') ||
    msg.includes('blocked by admin')
  ) {
    return 'Wallet is blocked. Transactions are disabled. Please contact support or the admin team.'
  }

  if (msg.includes('invalid credentials') || msg.includes('bad credentials') || msg.includes('invalid username or password')) {
    return 'Incorrect email or password. Please try again.'
  }
  if (msg.includes('user not found') || msg.includes('email not found')) {
    return 'No account was found with this email.'
  }
  if (msg.includes('already exists') || msg.includes('email already')) {
    return 'This email is already registered. Try signing in instead.'
  }
  if (msg.includes('otp') && (msg.includes('invalid') || msg.includes('expired'))) {
    return 'The OTP is invalid or expired. Please request a new OTP.'
  }
  if (msg.includes('temporarily unavailable') || msg.includes('service unavailable') || msg.includes('auth service')) {
    return 'We are unable to process this request right now. Please try again in a few minutes.'
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'The request took too long. Please try again.'
  }
  if (msg.includes('network') || msg.includes('connection refused') || msg.includes('failed to fetch')) {
    return 'Network issue detected. Please check your internet connection and try again.'
  }

  return raw
}

/**
 * Normalizes API / network failures into a single user-facing string.
 * Use from Redux thunks and catch blocks for consistent messaging.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; error?: string } | undefined
    const msg = data?.message ?? data?.error
    if (typeof msg === 'string' && msg.trim()) return toUserFriendlyAuthError(msg.trim())
    const status = error.response?.status
    if (status === 404) return 'The requested resource was not found.'
    if (status === 403) return 'You do not have permission to perform this action.'
    if (status === 401) return 'Your session expired. Please sign in again.'
    if (status != null && status >= 500) return 'The server is unavailable. Please try again later.'
    if (!error.response) return 'Network error. Check your connection and try again.'
  }
  if (error instanceof Error && error.message) return toUserFriendlyAuthError(error.message)
  return toUserFriendlyAuthError(fallback)
}
