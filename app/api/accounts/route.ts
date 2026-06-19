import { asText, runStatement, serviceFailure } from '@/lib/platform-db'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const session = getSession(request)
    if (!session) {
      return Response.json(
        { ok: false, message: 'Authentication required.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    
    // Admin can query any user; customers can only query their own
    let targetUserId = session.userId
    if (session.role === 'admin') {
      const paramId = searchParams.get('userId')
      if (paramId) {
        targetUserId = Number(paramId) || session.userId
      }
    }

    const sql = `
      SELECT a.id, a.user_id, a.account_number, a.account_name, a.balance,
             u.username, u.full_name
      FROM accounts a
      JOIN users u ON u.id = a.user_id
      WHERE a.user_id = $1
      ORDER BY a.id
    `
    const result = await runStatement(sql, [targetUserId])

    return Response.json({
      ok: true,
      note: 'Account list prepared.',
      accounts: result.rows
    })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
