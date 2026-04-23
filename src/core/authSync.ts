/** Avoids importing the Redux store from `api.ts` (circular dependency). */
export type AuthTokens = { accessToken: string; refreshToken: string }

let onTokensRefreshed: ((t: AuthTokens) => void) | null = null

export function registerAuthTokenSync(cb: (t: AuthTokens) => void): void {
  onTokensRefreshed = cb
}

export function notifyTokensRefreshed(tokens: AuthTokens): void {
  onTokensRefreshed?.(tokens)
}
