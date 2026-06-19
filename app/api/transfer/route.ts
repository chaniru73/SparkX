import { getSession } from '@/lib/auth'
import { asText, serviceFailure, withTransaction } from '@/lib/platform-db'

const ACCOUNT_RE = /^\d+$/

export async function POST(request: Request) {
  try {
    // 1. Require a valid session — derive userId from it, not the body
    const session = getSession(request)
    if (!session) {
      return Response.json(
        { ok: false, message: 'Authentication required.' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const fromAccount = asText(body.fromAccount || body.from)
    const toAccount = asText(body.toAccount || body.to)
    const description = asText(body.description)

    // 2. Validate account number format (digits only)
    if (!fromAccount || !ACCOUNT_RE.test(fromAccount)) {
      return Response.json(
        { ok: false, message: 'Invalid source account number.' },
        { status: 400 }
      )
    }
    if (!toAccount || !ACCOUNT_RE.test(toAccount)) {
      return Response.json(
        { ok: false, message: 'Invalid destination account number.' },
        { status: 400 }
      )
    }
    if (fromAccount === toAccount) {
      return Response.json(
        { ok: false, message: 'Source and destination accounts must differ.' },
        { status: 400 }
      )
    }

    // 3. Validate amount is a positive number
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json(
        { ok: false, message: 'Amount must be a positive number.' },
        { status: 400 }
      )
    }

    // 4. Execute within a database transaction with row locking
    const result = await withTransaction(async (client) => {
      // Lock and verify the source account belongs to the logged-in user
      const srcResult = await client.query(
        `SELECT id, user_id, balance FROM accounts
         WHERE account_number = $1
         FOR UPDATE`,
        [fromAccount]
      )
      const srcAccount = srcResult.rows[0]
      if (!srcAccount) {
        return { error: 'Source account not found.', status: 404 }
      }
      if (srcAccount.user_id !== session.userId) {
        return { error: 'You do not own this account.', status: 403 }
      }

      // Check sufficient balance
      if (Number(srcAccount.balance) < amount) {
        return { error: 'Insufficient balance.', status: 400 }
      }

      // Verify the destination account exists (lock it too)
      const dstResult = await client.query(
        `SELECT id FROM accounts
         WHERE account_number = $1
         FOR UPDATE`,
        [toAccount]
      )
      if (!dstResult.rows[0]) {
        return { error: 'Destination account not found.', status: 404 }
      }

      // Debit source
      await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE account_number = $2`,
        [amount, fromAccount]
      )

      // Credit destination
      await client.query(
        `UPDATE accounts SET balance = balance + $1 WHERE account_number = $2`,
        [amount, toAccount]
      )

      // Record transaction
      const txResult = await client.query(
        `INSERT INTO transactions (from_account, to_account, amount, description, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, from_account, to_account, amount, description, status, created_at`,
        [fromAccount, toAccount, amount, description, session.userId]
      )

      return { transaction: txResult.rows[0] }
    })

    // Handle validation errors returned from inside the transaction
    if ('error' in result) {
      return Response.json(
        { ok: false, message: result.error },
        { status: result.status }
      )
    }

    return Response.json({
      ok: true,
      message: 'Transfer accepted.',
      transaction: result.transaction
    })
  } catch (reason) {
    return serviceFailure(reason)
  }
}
