import { clearSessionCookie } from '@/lib/auth'

export async function POST() {
  const headers = new Headers()
  headers.append('set-cookie', clearSessionCookie())

  return Response.json({ ok: true, message: 'Logged out.' }, { headers })
}
