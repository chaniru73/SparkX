import { createHmac } from 'crypto'

const _rawSecret = process.env.SESSION_SECRET

if (!_rawSecret || _rawSecret.length < 32) {
  throw new Error(
    '[auth] SESSION_SECRET must be set as an environment variable and be at least 32 characters long. ' +
    'Generate one with: openssl rand -base64 48'
  )
}

const SESSION_SECRET: string = _rawSecret

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

/**
 * Extract and verify the session from a Request's cookie header.
 * Returns the verified payload or null if missing/invalid/tampered.
 */
export function getSession(request: Request): SessionPayload | null {
  const cookies = request.headers.get('cookie') || ''
  const match = cookies.split(';').find((c) => c.trim().startsWith('session='))
  if (!match) return null
  const token = match.split('=').slice(1).join('=').trim()
  return verifySession(token)
}
