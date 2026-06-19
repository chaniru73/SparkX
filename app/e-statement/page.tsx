'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import Sidebar from '@/components/sidebar'

interface Account {
  id: number
  account_number: string
  account_name: string
  balance: string
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
  created_by?: number
}

export default function EStatementPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [accountHolder, setAccountHolder] = useState('')

  // Fetch user's accounts on mount
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts', { credentials: 'include' })
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok) return
      const data = await res.json()
      const accs: Account[] = data.accounts ?? []
      setAccounts(accs)
      if (accs.length > 0) {
        setAccountHolder(accs[0].full_name ?? '')
      }
    } catch {
      // fail silently
    }
  }, [router])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  // Fetch transactions for selected account
  const fetchTransactions = useCallback(
    async (accountNumber: string) => {
      if (!accountNumber) return
      setLoading(true)
      setErrorMsg('')
      setTransactions([])

      try {
        const res = await fetch(
          `/api/transactions?account=${encodeURIComponent(accountNumber)}`,
          { credentials: 'include' }
        )
        if (res.status === 401) {
          router.replace('/login')
          return
        }
        if (res.status === 403) {
          setErrorMsg('You do not have access to this account.')
          return
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setErrorMsg(data.message || 'Failed to load transactions.')
          return
        }
        const data = await res.json()
        setTransactions(data.transactions ?? [])
      } catch {
        setErrorMsg('Unable to reach the server.')
      } finally {
        setLoading(false)
      }
    },
    [router]
  )

  function handleAccountSelect(accNum: string) {
    setSelectedAccount(accNum)
    if (accNum) {
      fetchTransactions(accNum)
    } else {
      setTransactions([])
      setErrorMsg('')
    }
  }

  // Derive statement data
  const currentAccount = accounts.find(
    (a) => a.account_number === selectedAccount
  )
  const balance = parseFloat(currentAccount?.balance || '0')

  // Calculate totals
  const totalCredits = transactions
    .filter((t) => t.to_account === selectedAccount)
    .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0)

  const totalDebits = transactions
    .filter((t) => t.from_account === selectedAccount)
    .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0)

  const formatCurrency = (n: number) =>
    n.toLocaleString('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })

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

  return (
    <div className="min-h-screen bg-bg-light font-geist p-0">
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="flex-1 p-12 text-black">
          <div className="mb-10 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">E-Statement</h2>
            <div className="flex items-center gap-3">
              <button className="topbar-icon" aria-label="search">
                <img src="/search.png" alt="search" />
              </button>
              <button className="topbar-icon" aria-label="notifications">
                <img src="/notification.png" alt="notifications" />
              </button>
              <div className="size-12 overflow-hidden rounded-full border-2 border-gray-200">
                <img
                  src="/avatar.png"
                  alt="avatar"
                  className="size-full bg-white object-cover"
                />
              </div>
            </div>
          </div>

          <div className="rounded-[32px] bg-white px-10 py-8 text-black shadow-[0_1px_3px_0_rgba(0,0,0,0.30),0_4px_8px_3px_rgba(0,0,0,0.15)]">
            <label
              htmlFor="statement-account-number"
              className="grid items-end gap-6 text-xl md:grid-cols-[auto_1fr]"
            >
              <span>Select account:</span>
              <select
                id="statement-account-number"
                value={selectedAccount}
                onChange={(e) => handleAccountSelect(e.target.value)}
                className="min-w-0 border-0 border-b border-black bg-transparent px-2 py-1 text-xl text-black outline-none"
              >
                <option value="">— Choose account —</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.account_number}>
                    {acc.account_name} — {acc.account_number}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-lg bg-red-50 px-6 py-4 text-red-700 text-sm">
              {errorMsg}
            </div>
          )}

          <section
            aria-label="Bank statement preview"
            className="mt-6 min-h-[560px] bg-[#e7e7e7] px-7 py-9 text-black"
          >
            <div className="max-w-full">
              <img
                src="/loginlogo.png"
                alt="Nova Bank"
                className="size-[86px] rounded-full object-cover"
              />

              <div className="mt-5 text-sm leading-tight">
                <h2 className="font-bold">Bank Statement</h2>
                <dl>
                  <div>
                    <dt className="inline">Account Holder: </dt>
                    <dd className="inline">{accountHolder || '—'}</dd>
                  </div>
                  <div>
                    <dt className="inline">Account Number: </dt>
                    <dd className="inline">{selectedAccount || '—'}</dd>
                  </div>
                  <div>
                    <dt className="inline">Account Name: </dt>
                    <dd className="inline">
                      {currentAccount?.account_name || '—'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-9 text-sm">
                <h3 className="font-bold">Account Summary</h3>
                <table className="mt-9 w-full table-fixed border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="pr-4 font-normal">Current Balance</th>
                      <th className="pr-4 font-normal">Total Credits</th>
                      <th className="pr-4 font-normal">Total Debits</th>
                    </tr>
                  </thead>
                  {selectedAccount && (
                    <tbody>
                      <tr>
                        <td className="h-8 font-semibold">
                          {formatCurrency(balance)}
                        </td>
                        <td className="h-8 text-green-700 font-semibold">
                          +{formatCurrency(totalCredits)}
                        </td>
                        <td className="h-8 text-red-700 font-semibold">
                          -{formatCurrency(totalDebits)}
                        </td>
                      </tr>
                    </tbody>
                  )}
                </table>
              </div>

              <div className="mt-10 border-t border-black pt-9">
                <h3 className="text-sm font-bold">Transaction Details</h3>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-black">
                        <th className="w-[13%] pb-3 font-normal">Date</th>
                        <th className="w-[22%] pb-3 font-normal">
                          Description
                        </th>
                        <th className="w-[18%] pb-3 font-normal">
                          Reference ID
                        </th>
                        <th className="w-[15%] pb-3 font-normal">Debit</th>
                        <th className="w-[16%] pb-3 font-normal">Credit</th>
                        <th className="w-[16%] pb-3 font-normal">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td className="h-10 pt-3 text-gray-500" colSpan={6}>
                            Loading transactions…
                          </td>
                        </tr>
                      ) : transactions.length === 0 ? (
                        <tr>
                          <td className="h-10 pt-3 text-gray-400" colSpan={6}>
                            {selectedAccount
                              ? 'No transactions found for this account.'
                              : 'Select an account to view transactions.'}
                          </td>
                        </tr>
                      ) : (
                        transactions.map((txn) => {
                          const isDebit = txn.from_account === selectedAccount
                          return (
                            <tr key={txn.id}>
                              <td className="h-10 pt-3">
                                {formatDate(txn.created_at)}
                              </td>
                              <td className="h-10 pt-3">
                                {txn.description || '—'}
                              </td>
                              <td className="h-10 pt-3">TXN-{txn.id}</td>
                              <td className="h-10 pt-3 text-red-700">
                                {isDebit
                                  ? `-${formatCurrency(parseFloat(txn.amount))}`
                                  : ''}
                              </td>
                              <td className="h-10 pt-3 text-green-700">
                                {!isDebit
                                  ? `+${formatCurrency(parseFloat(txn.amount))}`
                                  : ''}
                              </td>
                              <td className="h-10 pt-3">{txn.status}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
