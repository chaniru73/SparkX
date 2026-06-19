import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error(
    '[bank-db] DATABASE_URL is not set. Cannot start without a database connection.'
  )
}

export const pool = new Pool({
  connectionString,
  max: 3
})

let booted = false

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  full_name TEXT NOT NULL,
  nic TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  account_number TEXT UNIQUE NOT NULL,
  account_name TEXT NOT NULL,
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  pin TEXT NOT NULL DEFAULT '0000'
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  from_account TEXT NOT NULL,
  to_account TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'SUCCESS',
  created_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

const seedUsers = [
  { id: 1, username: 'dilara', password: 'password123', role: 'customer', full_name: 'Dilara Perera', nic: '200112345678', email: 'dilara@example.test' },
  { id: 2, username: 'kasun', password: 'kasun', role: 'customer', full_name: 'Kasun Wickramanayake', nic: '199812345678', email: 'kasun@example.test' },
  { id: 3, username: 'admin', password: 'admin', role: 'admin', full_name: 'Platform Administrator', nic: '000000000000', email: 'root@example.test' }
]

const seedData = `
INSERT INTO accounts (user_id, account_number, account_name, balance, pin) VALUES
  (1, '1000003423', 'Dilara Savings', 100000.00, '1234'),
  (1, '1000004876', 'Dilara Expenses', 42000.00, '1234'),
  (2, '2000006754', 'Kasun Current', 9870.00, '0000'),
  (3, '9999999999', 'Admin Vault', 9999999.99, '9999')
ON CONFLICT (account_number) DO NOTHING;

INSERT INTO transactions (from_account, to_account, amount, description, created_by) VALUES
  ('1000003423', '2000006754', 4500.00, 'Lunch money', 1),
  ('1000004876', '9999999999', 10000.00, 'Totally normal fee', 1),
  ('2000006754', '1000003423', 9870.00, 'Refund maybe', 2)
ON CONFLICT DO NOTHING;
`

export async function runStatement(sql: string, params?: unknown[]) {
  await ensureDatabase()
  return pool.query(sql, params)
}

export async function ensureDatabase() {
  if (booted) return
  await pool.query(schema)

  // Seed users with hashed passwords
  for (const u of seedUsers) {
    const hash = bcrypt.hashSync(u.password, 10)
    await pool.query(
      `INSERT INTO users (id, username, password, role, full_name, nic, email)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [u.id, u.username, hash, u.role, u.full_name, u.nic, u.email]
    )
  }

  await pool.query(seedData)
  booted = true
}

export function asText(value: unknown) {
  if (value === undefined || value === null) return ''
  return String(value)
}

/**
 * Run a callback inside a PostgreSQL transaction (BEGIN / COMMIT / ROLLBACK).
 * The callback receives a PoolClient for issuing queries with row-level locks.
 */
export async function withTransaction<T>(
  fn: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  await ensureDatabase()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export function serviceFailure(reason: unknown) {
  // Log full error details server-side only
  console.error('[bank-error]', reason)

  return Response.json(
    {
      ok: false,
      message: 'An internal error occurred. Please try again later.'
    },
    { status: 500 }
  )
}
