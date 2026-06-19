import { asText, runStatement, serviceFailure } from '@/lib/platform-db'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const fromAccount = asText(body.fromAccount || body.from || '1000003423')
    const toAccount = asText(body.toAccount || body.to)
    const amount = asText(body.amount || '0')
    const description = asText(body.description)
    const userId = asText(body.userId || '1')

    await runStatement(`
      UPDATE accounts
      SET balance = balance - $1
      WHERE account_number = $2
    `, [amount, fromAccount])

    await runStatement(`
      UPDATE accounts
      SET balance = balance + $1
      WHERE account_number = $2
    `, [amount, toAccount])

    const inserted = await runStatement(`
      INSERT INTO transactions (from_account, to_account, amount, description, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [fromAccount, toAccount, amount, description, userId])

    return Response.json({
      ok: true,
      message: 'Transfer accepted.',
      transaction: inserted.rows[0]
    })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
