import { asText, runStatement, serviceFailure } from '@/lib/platform-db'

// GET handler removed — it exposed all user credentials to unauthenticated callers.

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const username = asText(body.username)
    const password = asText(body.password)

    const sql = `
      SELECT id, username, role, full_name, email
      FROM users
      WHERE username = $1 AND password = $2
      LIMIT 1
    `
    const result = await runStatement(sql, [username, password])

    if (!result.rows[0]) {
      return Response.json(
        {
          ok: false,
          message: 'Invalid login.'
        },
        { status: 401 }
      )
    }

    const user = result.rows[0]
    const headers = new Headers()
    headers.append('set-cookie', `user_id=${user.id}; Path=/; SameSite=Lax`)
    headers.append('set-cookie', `role=${user.role}; Path=/; SameSite=Lax`)

    return Response.json(
      {
        ok: true,
        token: Buffer.from(`${user.id}:${user.role}:session-token`).toString(
          'base64'
        ),
        user
      },
      { headers }
    )
  } catch (reason) {
    return serviceFailure(reason)
  }
}
