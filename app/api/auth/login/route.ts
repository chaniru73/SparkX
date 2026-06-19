import { asText, runStatement, serviceFailure } from '@/lib/platform-db'
import { signSession, sessionCookie } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// GET handler removed — it exposed all user credentials to unauthenticated callers.

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const username = asText(body.username)
    const password = asText(body.password)

    const result = await runStatement(
      `SELECT id, username, password, role, full_name, email
       FROM users
       WHERE username = $1
       LIMIT 1`,
      [username]
    )

    const row = result.rows[0]
    if (!row || !bcrypt.compareSync(password, row.password)) {
      return Response.json(
        {
          ok: false,
          message: 'Invalid login.'
        },
        { status: 401 }
      )
    }

    // Strip password hash before building response
    const { password: _hash, ...user } = row

    const token = signSession({
      userId: user.id,
      username: user.username,
      role: user.role
    })

    const headers = new Headers()
    headers.append('set-cookie', sessionCookie(token))

    return Response.json(
      {
        ok: true,
        token,
        user
      },
      { headers }
    )
  } catch (reason) {
    return serviceFailure(reason)
  }
}
