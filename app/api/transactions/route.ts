import { getSession } from '@/lib/auth'
import { asText, runStatement, serviceFailure } from '@/lib/platform-db'

const ACCOUNT_RE = /^\d+$/

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
    const account = asText(searchParams.get('account'))

    if (!account || !ACCOUNT_RE.test(account)) {
      return Response.json(
        { ok: false, message: 'Invalid account number.' },
        { status: 400 }
      )
    }

    if (session.role !== 'admin') {
      const ownershipCheck = await runStatement(
        'SELECT 1 FROM accounts WHERE account_number = $1 AND user_id = $2',
        [account, session.userId]
      )
      if (ownershipCheck.rows.length === 0) {
        return Response.json(
          { ok: false, message: 'You do not own this account.' },
          { status: 403 }
        )
      }
    }

    const sql = `
      SELECT *
      FROM transactions
      WHERE from_account = $1 OR to_account = $1
      ORDER BY created_at DESC
    `
    const result = await runStatement(sql, [account])

    return Response.json({
      ok: true,
      account,
      transactions: result.rows
    })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
