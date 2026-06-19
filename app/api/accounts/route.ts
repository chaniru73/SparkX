import { asText, runStatement, serviceFailure } from '@/lib/platform-db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = asText(searchParams.get('userId') || '1')

    const sql = `
      SELECT a.id, a.user_id, a.account_number, a.account_name, a.balance,
             u.username, u.full_name
      FROM accounts a
      JOIN users u ON u.id = a.user_id
      WHERE a.user_id = $1
      ORDER BY a.id
    `
    const result = await runStatement(sql, [userId])

    return Response.json({
      ok: true,
      note: 'Account list prepared.',
      accounts: result.rows
    })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
