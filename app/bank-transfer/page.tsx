'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import Sidebar from '@/components/sidebar'

interface Account {
  id: number
  account_number: string
  account_name: string
  balance: string
}

type Errors = Partial<{
  amount: string
  fromAccount: string
  toAccount: string
}>

type Step = 'form' | 'confirm' | 'success' | 'failure'

export default function Home() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [fromAccount, setFromAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [toAccount, setToAccount] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [step, setStep] = useState<Step>('form')
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [failureMsg, setFailureMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Fetch source accounts on mount
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
        setFromAccount(accs[0].account_number)
      }
    } catch {
      // fail silently on network error
    }
  }, [router])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  function validate() {
    const e: Errors = {}
    if (!fromAccount) e.fromAccount = 'Select a source account'

    if (!amount) e.amount = 'Amount is required'
    else if (Number(amount) <= 0 || isNaN(Number(amount)))
      e.amount = 'Enter a valid positive amount'

    if (!toAccount) e.toAccount = 'Destination account number is required'
    else if (!/^\d{6,}$/.test(toAccount))
      e.toAccount = 'Enter a valid account number'

    if (fromAccount && toAccount && fromAccount === toAccount)
      e.toAccount = 'Source and destination must differ'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) {
      setStep('confirm')
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFailureMsg('')

    try {
      const res = await fetch('/api/transfer', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAccount,
          toAccount,
          amount: Number(amount),
          description
        })
      })

      if (res.status === 401) {
        router.replace('/login')
        return
      }

      const data = await res.json()

      if (res.ok && data.ok) {
        setConfirmation(data.transaction?.id?.toString() || 'OK')
        setStep('success')
      } else {
        // Show the backend error message
        setFailureMsg(data.message || 'Transfer failed.')
        setStep('failure')
      }
    } catch {
      setFailureMsg('Unable to reach the server. Please try again.')
      setStep('failure')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setAmount('')
    setToAccount('')
    setDescription('')
    setErrors({})
    setConfirmation(null)
    setFailureMsg('')
    setStep('form')
    // Re-fetch accounts to get updated balances
    fetchAccounts()
  }

  // Get the selected source account details
  const selectedAccount = accounts.find((a) => a.account_number === fromAccount)
  const formatBalance = (b: string) => {
    const num = parseFloat(b || '0')
    return `Rs. ${num.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="min-h-screen bg-bg-light font-geist p-0">
      <div className="flex min-h-screen">
        <Sidebar />

        <main className="flex-1 p-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Bank Transfer</h2>
            <div className="flex items-center gap-3">
              <button className="topbar-icon" aria-label="search">
                <img src="/search.png" alt="search" />
              </button>
              <button className="topbar-icon" aria-label="notifications">
                <img src="/notification.png" alt="notifications" />
              </button>
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200">
                <img
                  src="/avatar.png"
                  alt="avatar"
                  className="w-full h-full object-cover bg-white"
                />
              </div>
            </div>
          </div>
          {step === 'form' ? (
            <form onSubmit={handleNext} className="transfer-card p-8">
              <div className="grid grid-cols-12 gap-y-6 gap-x-8 items-center">
                <label className="col-span-3 text-gray-700">
                  From Account :
                </label>
                <div className="col-span-9">
                  <select
                    value={fromAccount}
                    onChange={(e) => setFromAccount(e.target.value)}
                    className="underline-input bg-transparent"
                  >
                    {accounts.length === 0 && (
                      <option value="">Loading accounts…</option>
                    )}
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.account_number}>
                        {acc.account_name} — {acc.account_number} (
                        {formatBalance(acc.balance)})
                      </option>
                    ))}
                  </select>
                  {errors.fromAccount && (
                    <div className="text-sm text-red-600 mt-1">
                      {errors.fromAccount}
                    </div>
                  )}
                </div>

                <label className="col-span-3 text-gray-700">Amount :</label>
                <div className="col-span-9">
                  <input
                    aria-label="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="underline-input"
                    placeholder="Enter amount"
                  />
                  {errors.amount && (
                    <div className="text-sm text-red-600 mt-1">
                      {errors.amount}
                    </div>
                  )}
                </div>

                <label className="col-span-3 text-gray-700">
                  To Account Number :
                </label>
                <div className="col-span-9">
                  <input
                    value={toAccount}
                    onChange={(e) => setToAccount(e.target.value)}
                    className="underline-input"
                    placeholder="Enter destination account number"
                  />
                  {errors.toAccount && (
                    <div className="text-sm text-red-600 mt-1">
                      {errors.toAccount}
                    </div>
                  )}
                </div>

                <label className="col-span-3 text-gray-700">
                  Description :
                </label>
                <div className="col-span-9">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="description-box"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex justify-center mt-10">
                <button type="submit" className="next-btn">
                  NEXT
                </button>
              </div>
            </form>
          ) : step === 'confirm' ? (
            <div className="transfer-card p-8">
              <h3 className="text-center text-2xl font-semibold mb-6">
                Confirm Transfer
              </h3>
              <div className="bg-white rounded-lg p-6 shadow-lg max-w-xl mx-auto text-center">
                <p className="mb-2">
                  From:{' '}
                  <strong>
                    {selectedAccount?.account_name ?? fromAccount}
                  </strong>
                </p>
                <p className="mb-4">
                  Transfer{' '}
                  <strong>
                    Rs.{' '}
                    {Number(amount).toLocaleString('en-LK', {
                      minimumFractionDigits: 2
                    })}
                  </strong>{' '}
                  to account <strong>{toAccount}</strong>
                </p>
                {description && (
                  <p className="text-sm text-gray-500 mb-4">
                    Description: {description}
                  </p>
                )}
                <div className="mb-6">
                  <img
                    src="/transfer-illustration.png"
                    alt="illustration"
                    className="mx-auto"
                  />
                </div>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => setStep('form')}
                    className="next-btn"
                    aria-label="back"
                  >
                    BACK
                  </button>
                  <button
                    onClick={handleTransfer}
                    className="next-btn transfer-btn"
                    disabled={submitting}
                  >
                    {submitting ? 'TRANSFERRING…' : 'TRANSFER'}
                  </button>
                </div>
              </div>
            </div>
          ) : step === 'success' ? (
            // success page
            <div className="transfer-card p-8">
              <div className="relative">
                <div className="success-check inside-check">
                  <svg
                    viewBox="0 0 120 120"
                    width="100"
                    height="100"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <radialGradient id="g" cx="50%" cy="50%">
                        <stop offset="0%" stopColor="#28a745" />
                        <stop offset="100%" stopColor="#138a3e" />
                      </radialGradient>
                    </defs>
                    <circle cx="60" cy="60" r="50" fill="#dff7e7" />
                    <circle cx="60" cy="60" r="40" fill="#10a654" />
                    <path
                      d="M38 62 L54 78 L82 42"
                      stroke="#fff"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </div>

                <h3 className="text-center text-2xl font-semibold mb-4">
                  Transfer Successful!
                </h3>
                <p className="text-center text-sm text-gray-500 mb-10">
                  Transaction ID : {confirmation}
                </p>

                <div className="flex justify-center">
                  <button
                    onClick={resetForm}
                    className="transfer-btn success-btn"
                  >
                    <span className="mr-3">‹</span> BACK TO HOME
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // failure page
            <div className="transfer-card p-8">
              <div className="relative">
                <div className="success-check inside-check">
                  <svg
                    viewBox="0 0 120 120"
                    width="220"
                    height="220"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="60" cy="60" r="50" fill="#ffdede" />
                    <circle cx="60" cy="60" r="40" fill="#ffb6b6" />
                    <path
                      d="M60 30 L93 86 L27 86 Z"
                      fill="#ff4d4f"
                      stroke="#fff"
                      strokeWidth="4"
                      strokeLinejoin="round"
                    />
                    <text
                      x="60"
                      y="78"
                      textAnchor="middle"
                      fontSize="36"
                      fill="#fff"
                      fontWeight="700"
                    >
                      !
                    </text>
                  </svg>
                </div>

                <h3 className="text-center text-2xl font-semibold mb-4">
                  Transaction Failed!
                </h3>
                <p className="text-center text-sm text-gray-500 mb-6">
                  {failureMsg || 'An unexpected error occurred.'}
                </p>

                <div className="flex justify-center">
                  <button
                    onClick={resetForm}
                    className="transfer-btn success-btn"
                  >
                    <span className="mr-3">‹</span> BACK TO HOME
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
