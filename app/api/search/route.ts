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
    const q = asText(searchParams.get('q'))

    let sql = ''
    let params: unknown[] = []

    if (session.role === 'admin') {
      sql = `
        SELECT 'user' AS type, id::text, username AS label, email AS detail FROM users
        WHERE username ILIKE '%' || $1 || '%' OR full_name ILIKE '%' || $1 || '%'
        UNION ALL
        SELECT 'account' AS type, id::text, account_number AS label, account_name AS detail FROM accounts
        WHERE account_number ILIKE '%' || $1 || '%' OR account_name ILIKE '%' || $1 || '%'
        UNION ALL
        SELECT 'transaction' AS type, id::text, from_account || ' -> ' || to_account AS label, description AS detail FROM transactions
        WHERE description ILIKE '%' || $1 || '%'
        LIMIT 25
      `
      params = [q]
    } else {
      // Customer search is strictly scoped to their own accounts and transactions
      sql = `
        SELECT 'account' AS type, id::text, account_number AS label, account_name AS detail FROM accounts
        WHERE user_id = $2 AND (account_number ILIKE '%' || $1 || '%' OR account_name ILIKE '%' || $1 || '%')
        UNION ALL
        SELECT 'transaction' AS type, t.id::text, t.from_account || ' -> ' || t.to_account AS label, t.description AS detail 
        FROM transactions t
        WHERE t.description ILIKE '%' || $1 || '%' 
          AND EXISTS (
            SELECT 1 FROM accounts a 
            WHERE a.user_id = $2 
              AND (a.account_number = t.from_account OR a.account_number = t.to_account)
          )
        LIMIT 25
      `
      params = [q, session.userId]
    }

    const result = await runStatement(sql, params)

    return Response.json({
      ok: true,
      query: q,
      results: result.rows
    })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
