'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import { Bell, Search } from '@/components/Icons'

interface Account {
  id: number
  user_id: number
  account_number: string
  account_name: string
  balance: string
  username: string
  full_name: string
}

interface Transaction {
  id: number
  from_account: string
  to_account: string
  amount: string
  description: string
  status: string
  created_at: string
}

type Status = 'loading' | 'ready' | 'error'

export default function SmartSpendPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [fullName, setFullName] = useState('')

  const fetchData = useCallback(async () => {
    try {
      setStatus('loading')

      // 1. Fetch accounts
      const accRes = await fetch('/api/accounts', { credentials: 'include' })
      if (accRes.status === 401) {
        router.replace('/login')
        return
      }
      if (!accRes.ok) {
        setErrorMsg('Failed to load account data.')
        setStatus('error')
        return
      }
      const accData = await accRes.json()
      const accs: Account[] = accData.accounts ?? []
      setAccounts(accs)

      if (accs.length > 0) {
        setFullName(accs[0].full_name ?? '')
      }

      // 2. Fetch transactions for each account
      const allTxns: Transaction[] = []
      for (const acc of accs) {
        const txnRes = await fetch(
          `/api/transactions?account=${encodeURIComponent(acc.account_number)}`,
          { credentials: 'include' }
        )
        if (txnRes.ok) {
          const txnData = await txnRes.json()
          if (Array.isArray(txnData.transactions)) {
            allTxns.push(...txnData.transactions)
          }
        }
      }

      // De-duplicate by id and sort newest first
      const seen = new Set<number>()
      const unique = allTxns.filter((t) => {
        if (seen.has(t.id)) return false
        seen.add(t.id)
        return true
      })
      unique.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      setTransactions(unique)
      setStatus('ready')
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('error')
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Derived spending analytics ──
  const ownAccountNumbers = new Set(accounts.map((a) => a.account_number))

  const totalBalance = accounts.reduce(
    (sum, a) => sum + Number.parseFloat(a.balance || '0'),
    0
  )

  const outgoing = transactions
    .filter((t) => ownAccountNumbers.has(t.from_account))
    .reduce((sum, t) => sum + Number.parseFloat(t.amount || '0'), 0)

  const incoming = transactions
    .filter((t) => ownAccountNumbers.has(t.to_account))
    .reduce((sum, t) => sum + Number.parseFloat(t.amount || '0'), 0)

  const recentTxns = transactions.slice(0, 10)

  // ── Simple spending tips ──
  function getTips() {
    const tips: string[] = []
    if (outgoing > incoming) {
      tips.push(
        'Your outgoing transactions exceed incoming ones. Consider reviewing recurring expenses.'
      )
    }
    if (totalBalance < 10000) {
      tips.push(
        'Your combined balance is below Rs. 10,000. Try to build an emergency fund covering at least 3 months of expenses.'
      )
    }
    if (outgoing > totalBalance * 0.5) {
      tips.push(
        'You have spent more than half your balance recently. Consider budgeting to maintain a healthy savings ratio.'
      )
    }
    if (tips.length === 0) {
      tips.push(
        'You are doing great! Keep maintaining a healthy balance between income and spending.'
      )
    }
    return tips
  }

  // ── Format helpers ──
  const formatCurrency = (n: number) =>
    `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return iso
    }
  }

  const maskAccount = (num: string) =>
    num.length > 4 ? `......${num.slice(-4)}` : num

  // ── Render ──
  if (status === 'loading') {
    return (
      <main className="smart-spend">
        <Sidebar />
        <section className="content">
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading your spending insights…</p>
          </div>
        </section>
        <style jsx>{styles}</style>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="smart-spend">
        <Sidebar />
        <section className="content">
          <div className="error-state">
            <p className="error-icon">⚠</p>
            <p>{errorMsg}</p>
            <button className="retry-btn" onClick={fetchData} type="button">
              Retry
            </button>
          </div>
        </section>
        <style jsx>{styles}</style>
      </main>
    )
  }

  return (
    <main className="smart-spend">
      <Sidebar />

      <section className="content">
        {/* Header */}
        <header className="content-header">
          <h1 className="page-title">Smart Spend</h1>
          <div className="header-actions">
            <Search size={24} />
            <Bell size={24} />
            <img src="/person-logo.png" alt="profile" className="avatar" />
          </div>
        </header>

        {fullName && (
          <p className="greeting">
            Hello, {fullName} — here is your spending overview.
          </p>
        )}

        {/* Summary Cards */}
        <div className="summary-grid">
          <div className="summary-card balance-card">
            <p className="card-label">Total Balance</p>
            <p className="card-value">{formatCurrency(totalBalance)}</p>
          </div>
          <div className="summary-card outgoing-card">
            <p className="card-label">Monthly Spending</p>
            <p className="card-value">{formatCurrency(outgoing)}</p>
          </div>
          <div className="summary-card incoming-card">
            <p className="card-label">Incoming</p>
            <p className="card-value">{formatCurrency(incoming)}</p>
          </div>
        </div>

        {/* Accounts */}
        <section className="section-block">
          <h2 className="section-title">Your Accounts</h2>
          <div className="accounts-grid">
            {accounts.map((a) => (
              <div key={a.id} className="account-chip">
                <span className="chip-name">{a.account_name}</span>
                <span className="chip-number">{maskAccount(a.account_number)}</span>
                <span className="chip-balance">
                  {formatCurrency(Number.parseFloat(a.balance || '0'))}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Transactions */}
        <section className="section-block">
          <h2 className="section-title">Recent Transactions</h2>
          {recentTxns.length === 0 ? (
            <p className="empty-state">No transactions found.</p>
          ) : (
            <div className="txn-table-wrap">
              <table className="txn-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Amount</th>
                    <th>Description</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTxns.map((t) => {
                    const isOutgoing = ownAccountNumbers.has(t.from_account)
                    return (
                      <tr key={t.id}>
                        <td>{formatDate(t.created_at)}</td>
                        <td>{maskAccount(t.from_account)}</td>
                        <td>{maskAccount(t.to_account)}</td>
                        <td className={isOutgoing ? 'amount-out' : 'amount-in'}>
                          {isOutgoing ? '-' : '+'}
                          {formatCurrency(Number.parseFloat(t.amount || '0'))}
                        </td>
                        <td>{t.description || '—'}</td>
                        <td>
                          <span className="status-badge">{t.status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Spending Tips */}
        <section className="section-block tips-block">
          <h2 className="section-title">💡 Spending Tips</h2>
          <ul className="tips-list">
            {getTips().map((tip, i) => (
              <li key={i} className="tip-item">
                {tip}
              </li>
            ))}
          </ul>
        </section>
      </section>

      <style jsx>{styles}</style>
    </main>
  )
}

/* ── Styles ────────────────────────────────────────────────────── */
const styles = `
  .smart-spend {
    width: 100vw;
    min-height: 100vh;
    background: #f1f1f1;
    display: flex;
    gap: 1.5rem;
    overflow: hidden;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .content {
    flex: 1;
    padding: 1.5rem 1.25rem;
    overflow-y: auto;
    min-width: 0;
  }

  /* Header */
  .content-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .page-title {
    font-size: 28px;
    font-weight: 700;
    color: black;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }
  .avatar {
    width: 45px;
    height: 45px;
    border-radius: 50%;
    object-fit: cover;
  }

  .greeting {
    margin-top: 0.5rem;
    font-size: 15px;
    color: #555;
  }

  /* Summary cards */
  .summary-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 1.25rem;
  }
  .summary-card {
    flex: 1;
    min-width: 200px;
    padding: 1.5rem;
    border-radius: 18px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.08);
    color: white;
  }
  .balance-card   { background: linear-gradient(135deg, #450043, #6a1b6a); }
  .outgoing-card  { background: linear-gradient(135deg, #c0392b, #e74c3c); }
  .incoming-card  { background: linear-gradient(135deg, #27ae60, #2ecc71); }

  .card-label {
    font-size: 13px;
    opacity: 0.85;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .card-value {
    font-size: 24px;
    font-weight: 800;
    margin-top: 0.5rem;
  }

  /* Sections */
  .section-block {
    margin-top: 1.5rem;
  }
  .section-title {
    font-size: 18px;
    font-weight: 700;
    color: black;
    margin-bottom: 0.75rem;
  }

  /* Accounts */
  .accounts-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .account-chip {
    background: white;
    border-radius: 14px;
    padding: 1rem 1.25rem;
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 200px;
    flex: 1;
  }
  .chip-name {
    font-weight: 700;
    font-size: 14px;
    color: #333;
  }
  .chip-number {
    font-size: 12px;
    color: #888;
  }
  .chip-balance {
    font-size: 18px;
    font-weight: 800;
    color: #450043;
    margin-top: 0.25rem;
  }

  /* Transactions table */
  .txn-table-wrap {
    background: white;
    border-radius: 18px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.08);
    overflow-x: auto;
  }
  .txn-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  .txn-table th {
    text-align: left;
    padding: 0.75rem 1rem;
    background: #f8f8f8;
    color: #555;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #eee;
  }
  .txn-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f5f5f5;
    color: #333;
  }
  .txn-table tr:last-child td { border-bottom: none; }
  .amount-out { color: #c0392b; font-weight: 700; }
  .amount-in  { color: #27ae60; font-weight: 700; }
  .status-badge {
    background: #d5f1cb;
    padding: 0.2rem 0.75rem;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    color: #333;
  }

  .empty-state {
    color: #888;
    font-size: 14px;
    padding: 1rem 0;
  }

  /* Tips */
  .tips-block {
    background: white;
    border-radius: 18px;
    padding: 1.25rem 1.5rem;
    box-shadow: 0 4px 10px rgba(0,0,0,0.08);
    margin-bottom: 2rem;
  }
  .tips-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .tip-item {
    padding: 0.5rem 0;
    border-bottom: 1px solid #f3f3f3;
    color: #444;
    font-size: 14px;
    line-height: 1.5;
  }
  .tip-item:last-child { border-bottom: none; }

  /* Loading & error */
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 1rem;
    color: #555;
  }
  .spinner {
    width: 36px;
    height: 36px;
    border: 4px solid #ddd;
    border-top-color: #450043;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .error-icon { font-size: 40px; }
  .retry-btn {
    padding: 0.6rem 2rem;
    border: none;
    border-radius: 25px;
    background: #450043;
    color: white;
    font-weight: 700;
    cursor: pointer;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .smart-spend {
      flex-direction: column;
      gap: 0;
    }
    .content { padding: 1rem; }
    .page-title { font-size: 22px; }
    .card-value { font-size: 20px; }
  }
  @media (max-width: 480px) {
    .summary-grid { flex-direction: column; }
    .card-value { font-size: 18px; }
  }
`
