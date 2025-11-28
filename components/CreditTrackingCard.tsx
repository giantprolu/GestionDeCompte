"use client"

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface CreditEntry {
  id: string
  amount: number
  note?: string
  date: string
  outstanding?: number
  title?: string
}

interface Account {
  id: string
  name: string
}

export default function CreditTrackingCard() {
  const [entries, setEntries] = useState<CreditEntry[]>([])
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadCredits()
  }, [])

  // Reload credits when other parts of the app signal a change (e.g. transaction deleted)
  useEffect(() => {
    const handler = () => {
      loadCredits()
    }
    try {
      window.addEventListener('credits:changed', handler as EventListener)
    } catch (e) {
      // non-browser environment
    }
    return () => {
      try {
        window.removeEventListener('credits:changed', handler as EventListener)
      } catch (e) {
        // ignore
      }
    }
  }, [])

  async function loadCredits() {
    setLoading(true)
    try {
      const [creditsRes, accountsRes] = await Promise.all([
        fetch('/api/credits'),
        fetch('/api/accounts')
      ])

      const creditsData = await creditsRes.json()
      const accountsData = await accountsRes.json()

      if (accountsRes.ok) setAccounts(accountsData || [])
      else console.error('Erreur chargement comptes', accountsData)

      if (creditsRes.ok) {
        // Normalize backend shape (some APIs use `principal`, `outstanding`, `start_date`)
        const normalized = (creditsData || []).map((d: any) => ({
          id: d.id,
          amount: typeof d.amount !== 'undefined' ? d.amount : d.principal,
          outstanding: typeof d.outstanding !== 'undefined' ? d.outstanding : (typeof d.principal !== 'undefined' ? d.principal : undefined),
          note: d.note || d.description || null,
          title: d.title || d.name || 'Crédit',
          date: d.start_date || d.created_at || d.date || new Date().toISOString(),
        }))
        setEntries(normalized)
      } else console.error('Erreur chargement crédits', creditsData)
    } catch (err) {
      console.error('Erreur fetch credits', err)
    } finally {
      setLoading(false)
    }
  }

  const addEntry = async () => {
    const value = parseFloat(amount.replace(',', '.'))
    if (isNaN(value) || value <= 0) return
    try {
      setLoading(true)
      const res = await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ principal: value, title: title || 'Crédit', note, start_date: startDate }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Erreur création crédit', data)
      } else {
        // recharger la liste
        await loadCredits()
        // signaler aux autres composants que les crédits/transactions/comptes ont changé
        try { window.dispatchEvent(new CustomEvent('credits:changed')) } catch (e) {}
        try { window.dispatchEvent(new CustomEvent('transactions:changed')) } catch (e) {}
        try { window.dispatchEvent(new CustomEvent('accounts:changed')) } catch (e) {}
        setAmount('')
        setNote('')
        setTitle('')
        setStartDate(new Date().toISOString().split('T')[0])
      }
    } catch (err) {
      console.error('Erreur create credit', err)
    } finally {
      setLoading(false)
    }
  }

  const repay = async (creditId: string, repayAmount: number, accountId?: string) => {
    if (isNaN(repayAmount) || repayAmount <= 0) return
    try {
      setLoading(true)
      const res = await fetch(`/api/credits/${creditId}/repay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: repayAmount, accountId }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Erreur repay', data)
        alert(data?.error || data?.message || 'Erreur lors du remboursement')
      }
      await loadCredits()
      // notifier les autres composants (comptes, transactions)
      try { window.dispatchEvent(new CustomEvent('transactions:changed')) } catch (e) {}
      try { window.dispatchEvent(new CustomEvent('accounts:changed')) } catch (e) {}
      try { window.dispatchEvent(new CustomEvent('credits:changed')) } catch (e) {}
    } catch (err) {
      console.error('Erreur repay', err)
      alert('Erreur lors du remboursement')
    } finally {
      setLoading(false)
    }
  }

  // Petit formulaire interne pour rembourser un crédit
  function RepayForm({ credit, onRepay }: { credit: CreditEntry, onRepay: (amount: number, accountId?: string) => void }) {
    const [repayAmount, setRepayAmount] = useState('')
    const [selectedAccount, setSelectedAccount] = useState<string | undefined>(accounts[0]?.id)
    const outstanding = Number(credit.outstanding ?? credit.amount ?? 0)

    useEffect(() => {
      if (accounts.length > 0 && !selectedAccount) setSelectedAccount(accounts[0].id)
    }, [accounts, selectedAccount])

    return (
      <div className="flex flex-col gap-2">
        <input
          value={repayAmount}
          onChange={(e) => setRepayAmount(e.target.value)}
          placeholder="€"
          className="px-2 py-1 rounded-md border border-slate-600/50 bg-slate-700/50 text-white text-sm"
        />
        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          className="px-2 py-1 rounded-md border border-slate-600/50 bg-slate-700/50 text-white text-sm"
        >
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <Button
          onClick={() => {
            const v = parseFloat(repayAmount.replace(',', '.'))
            if (!isNaN(v) && v > 0 && v <= outstanding) {
              onRepay(v, selectedAccount)
              setRepayAmount('')
            }
          }}
          size="sm"
          className="w-full"
          disabled={outstanding <= 0}
        >
          Rembourser
        </Button>
      </div>
    )
  }

  const total = entries.reduce((s, e) => s + e.amount, 0)

  return (
    <Card className="border-2 border-slate-700/50 bg-gradient-to-br from-slate-800/95 to-slate-900/95 shadow-xl">
      <CardHeader>
        <CardTitle>Suivi des crédits passés</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre (ex: Crédit restaurant)"
            className="px-2 py-1 rounded-md border border-slate-600/50 bg-slate-700/50 text-white"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Montant (€)"
            className="px-2 py-1 rounded-md border border-slate-600/50 bg-slate-700/50 text-white"
          />
          <div className="flex items-center gap-2">
            <Button onClick={addEntry} className="w-full" disabled={loading}>Ajouter</Button>
          </div>
        </div>

        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun crédit enregistré</p>
          ) : (
            <ul className="space-y-2">
              {entries.map(e => (
                <li key={e.id} className="flex flex-col p-3 rounded-md bg-slate-800/50 border border-slate-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-white">{e.title || 'Crédit'}</div>
                      <div className="text-xs text-slate-400">Principal: {(e.amount ?? 0).toFixed(2)} €</div>
                      <div className="text-xs text-slate-400">Restant: {(Number(e.outstanding ?? e.amount ?? 0)).toFixed(2)} €</div>
                      {e.note && <div className="text-xs text-slate-400">{e.note}</div>}
                      <div className="text-xs text-slate-500 mt-1">{new Date(e.date).toLocaleString('fr-FR')}</div>
                    </div>
                    <div className="ml-4 flex flex-col gap-2 w-36">
                            <RepayForm credit={e} onRepay={(amt, accountId) => repay(e.id, amt, accountId)} />
                            <div className="flex gap-2 mt-2">
                              <button
                                className="px-2 py-1 bg-yellow-600 text-xs rounded"
                                onClick={async () => {
                                  // edition rapide via prompt (titre, outstanding, note)
                                  const newTitle = window.prompt('Titre', e.title || '')
                                  if (newTitle === null) return
                                  const newOutstanding = window.prompt('Restant (€)', String(Number(e.outstanding ?? e.amount ?? 0).toFixed(2)))
                                  if (newOutstanding === null) return
                                  const newNote = window.prompt('Note', e.note || '')
                                  if (newNote === null) return
                                  try {
                                    setLoading(true)
                                    const res = await fetch(`/api/credits/${e.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ title: newTitle, outstanding: parseFloat(newOutstanding.replace(',', '.')), note: newNote })
                                    })
                                    const json = await res.json()
                                    if (!res.ok) {
                                      alert(json?.error || 'Erreur mise à jour')
                                    } else {
                                      await loadCredits()
                                      try { window.dispatchEvent(new CustomEvent('credits:changed')) } catch (e) {}
                                      try { window.dispatchEvent(new CustomEvent('accounts:changed')) } catch (e) {}
                                    }
                                  } catch (err) {
                                    console.error('Erreur update credit', err)
                                    alert('Erreur mise à jour')
                                  } finally { setLoading(false) }
                                }}
                              >Modifier</button>

                              <button
                                className="px-2 py-1 bg-red-700 text-xs rounded"
                                onClick={async () => {
                                  if (!window.confirm('Supprimer ce crédit ? Les transactions resteront mais seront dissociées.')) return
                                  try {
                                    setLoading(true)
                                    const res = await fetch(`/api/credits/${e.id}`, { method: 'DELETE' })
                                    const json = await res.json()
                                    if (!res.ok) {
                                      alert(json?.error || 'Erreur suppression')
                                    } else {
                                      await loadCredits()
                                      try { window.dispatchEvent(new CustomEvent('credits:changed')) } catch (e) {}
                                      try { window.dispatchEvent(new CustomEvent('transactions:changed')) } catch (e) {}
                                      try { window.dispatchEvent(new CustomEvent('accounts:changed')) } catch (e) {}
                                    }
                                  } catch (err) {
                                    console.error('Erreur delete credit', err)
                                    alert('Erreur suppression')
                                  } finally { setLoading(false) }
                                }}
                              >Supprimer</button>
                            </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <div className="w-full flex items-center justify-between">
          <div className="text-sm text-slate-300">Total restant:</div>
          <div className="font-bold text-white">{total.toFixed(2)} €</div>
        </div>
      </CardFooter>
    </Card>
  )
}
