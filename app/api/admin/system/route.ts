import { runStatement, serviceFailure } from '@/lib/platform-db'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    // Verify signed session and require admin role
    const session = getSession(request)
    if (!session || session.role !== 'admin') {
      return Response.json(
        { ok: false, message: 'Forbidden.' },
        { status: 403 }
      )
    }

    const users = await runStatement(
      'SELECT id, username, role, full_name, email, created_at FROM users ORDER BY id'
    )
    const accounts = await runStatement(
      'SELECT id, user_id, account_number, account_name, balance FROM accounts ORDER BY id'
    )
    const logs = await runStatement(
      'SELECT * FROM audit_logs ORDER BY id DESC LIMIT 10'
    )

    return Response.json({
      ok: true,
      message: 'System overview.',
      users: users.rows,
      accounts: accounts.rows,
      auditLogs: logs.rows
    })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
