import { createHmac } from 'crypto'

const SESSION_SECRET =
  process.env.SESSION_SECRET || '__dev-only-fallback-secret__'

interface SessionPayload {
  userId: number
  username: string
  role: string
}

/**
 * Create a signed session token: base64url(JSON) + '.' + HMAC signature.
 * The payload is readable but tamper-proof — any modification invalidates the signature.
 */
export function signSession(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', SESSION_SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

/**
 * Verify and decode a signed session token.
 * Returns the payload if the signature is valid, or null if tampered/invalid.
 */
export function verifySession(token: string): SessionPayload | null {
  const dotIndex = token.indexOf('.')
  if (dotIndex === -1) return null

  const data = token.slice(0, dotIndex)
  const sig = token.slice(dotIndex + 1)

  const expected = createHmac('sha256', SESSION_SECRET).update(data).digest('base64url')
  if (sig !== expected) return null

  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString()) as SessionPayload
  } catch {
    return null
  }
}

/**
 * Build Set-Cookie header value for the session cookie.
 */
export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : ''
  return `session=${token}; Path=/; HttpOnly; SameSite=Strict;${secure}`
}

/**
 * Build Set-Cookie header that clears the session cookie.
 */
export function clearSessionCookie(): string {
  return 'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
}
