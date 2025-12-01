"use client"

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CreditCard, 
  Plus, 
  Wallet, 
  Trash2, 
  Edit3, 
  ChevronUp,
  CircleDollarSign,
  CalendarDays,
  RefreshCw,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'

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
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedCredit, setExpandedCredit] = useState<string | null>(null)

  useEffect(() => {
    loadCredits()
  }, [])

  useEffect(() => {
    const handler = () => loadCredits()
    try {
      window.addEventListener('credits:changed', handler as EventListener)
    } catch { /* non-browser */ }
    return () => {
      try {
        window.removeEventListener('credits:changed', handler as EventListener)
      } catch { /* ignore */ }
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
      if (creditsRes.ok) {
        const normalized = (creditsData || []).map((d: Record<string, unknown>) => ({
          id: d.id as string,
          amount: typeof d.amount !== 'undefined' ? d.amount as number : d.principal as number,
          outstanding: typeof d.outstanding !== 'undefined' ? d.outstanding as number : (typeof d.principal !== 'undefined' ? d.principal as number : undefined),
          note: (d.note || d.description || null) as string | null,
          title: (d.title || d.name || 'Crédit') as string,
          date: (d.start_date || d.created_at || d.date || new Date().toISOString()) as string,
        }))
        setEntries(normalized)
      }
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
      if (res.ok) {
        await loadCredits()
        try { window.dispatchEvent(new CustomEvent('credits:changed')) } catch { /* ignore */ }
        try { window.dispatchEvent(new CustomEvent('transactions:changed')) } catch { /* ignore */ }
        try { window.dispatchEvent(new CustomEvent('accounts:changed')) } catch { /* ignore */ }
        setAmount('')
        setNote('')
        setTitle('')
        setStartDate(new Date().toISOString().split('T')[0])
        setShowAddForm(false)
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
        alert(data?.error || data?.message || 'Erreur lors du remboursement')
      }
      await loadCredits()
      try { window.dispatchEvent(new CustomEvent('transactions:changed')) } catch { /* ignore */ }
      try { window.dispatchEvent(new CustomEvent('accounts:changed')) } catch { /* ignore */ }
      try { window.dispatchEvent(new CustomEvent('credits:changed')) } catch { /* ignore */ }
    } catch (err) {
      console.error('Erreur repay', err)
      alert('Erreur lors du remboursement')
    } finally {
      setLoading(false)
    }
  }

  const editCredit = async (credit: CreditEntry) => {
    const newTitle = window.prompt('Titre', credit.title || '')
    if (newTitle === null) return
    const newOutstanding = window.prompt('Restant (€)', String(Number(credit.outstanding ?? credit.amount ?? 0).toFixed(2)))
    if (newOutstanding === null) return
    const newNote = window.prompt('Note', credit.note || '')
    if (newNote === null) return
    try {
      setLoading(true)
      const res = await fetch(`/api/credits/${credit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, outstanding: parseFloat(newOutstanding.replace(',', '.')), note: newNote })
      })
      if (res.ok) {
        await loadCredits()
        try { window.dispatchEvent(new CustomEvent('credits:changed')) } catch { /* ignore */ }
        try { window.dispatchEvent(new CustomEvent('accounts:changed')) } catch { /* ignore */ }
      } else {
        const json = await res.json()
        alert(json?.error || 'Erreur mise à jour')
      }
    } catch (err) {
      console.error('Erreur update credit', err)
      alert('Erreur mise à jour')
    } finally { setLoading(false) }
  }

  const deleteCredit = async (creditId: string) => {
    if (!window.confirm('Supprimer ce crédit ? Les transactions resteront mais seront dissociées.')) return
    try {
      setLoading(true)
      const res = await fetch(`/api/credits/${creditId}`, { method: 'DELETE' })
      if (res.ok) {
        await loadCredits()
        try { window.dispatchEvent(new CustomEvent('credits:changed')) } catch { /* ignore */ }
        try { window.dispatchEvent(new CustomEvent('transactions:changed')) } catch { /* ignore */ }
        try { window.dispatchEvent(new CustomEvent('accounts:changed')) } catch { /* ignore */ }
      } else {
        const json = await res.json()
        alert(json?.error || 'Erreur suppression')
      }
    } catch (err) {
      console.error('Erreur delete credit', err)
      alert('Erreur suppression')
    } finally { setLoading(false) }
  }

  // Formulaire de remboursement
  function RepayForm({ credit, onRepay }: { credit: CreditEntry, onRepay: (amount: number, accountId?: string) => void }) {
    const [repayAmount, setRepayAmount] = useState('')
    const [selectedAccount, setSelectedAccount] = useState<string | undefined>(accounts[0]?.id)
    const outstanding = Number(credit.outstanding ?? credit.amount ?? 0)

    useEffect(() => {
      if (accounts.length > 0 && !selectedAccount) setSelectedAccount(accounts[0].id)
    }, [selectedAccount])

    return (
      <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
        <p className="text-xs text-slate-400 mb-2">Rembourser ce crédit</p>
        <div className="flex gap-2">
          <Input
            value={repayAmount}
            onChange={(e) => setRepayAmount(e.target.value)}
            placeholder="Montant €"
            className="flex-1 h-8 text-sm bg-slate-900/50 border-slate-600/50"
          />
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="px-2 py-1 rounded-lg text-sm bg-slate-900/50 border border-slate-600/50 text-white"
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <Button
          onClick={() => {
            const v = parseFloat(repayAmount.replace(',', '.'))
            if (!isNaN(v) && v > 0 && v <= outstanding) {
              onRepay(v, selectedAccount)
              setRepayAmount('')
            }
          }}
          size="sm"
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
          disabled={outstanding <= 0}
        >
          <Wallet className="w-3 h-3 mr-2" />
          Rembourser
        </Button>
      </div>
    )
  }

  const totalOutstanding = entries.reduce((s, e) => s + Number(e.outstanding ?? e.amount ?? 0), 0)
  const totalPrincipal = entries.reduce((s, e) => s + Number(e.amount ?? 0), 0)
  const totalRepaid = totalPrincipal - totalOutstanding

  return (
    <Card className="border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 shadow-xl overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500/20">
              <CreditCard className="w-4 h-4 text-orange-400" />
            </div>
            Crédits en cours
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-slate-600 hover:bg-slate-700/50"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? (
              <ChevronUp className="w-3 h-3 mr-1" />
            ) : (
              <Plus className="w-3 h-3 mr-1" />
            )}
            {showAddForm ? 'Fermer' : 'Ajouter'}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Statistiques */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-center">
            <p className="text-[10px] text-slate-400 uppercase">Total emprunté</p>
            <p className="text-sm font-bold text-slate-200">{totalPrincipal.toFixed(0)} €</p>
          </div>
          <div className="p-2 rounded-lg bg-green-900/20 border border-green-500/20 text-center">
            <p className="text-[10px] text-green-400/70 uppercase">Remboursé</p>
            <p className="text-sm font-bold text-green-400">{totalRepaid.toFixed(0)} €</p>
          </div>
          <div className="p-2 rounded-lg bg-orange-900/20 border border-orange-500/20 text-center">
            <p className="text-[10px] text-orange-400/70 uppercase">Restant</p>
            <p className="text-sm font-bold text-orange-400">{totalOutstanding.toFixed(0)} €</p>
          </div>
        </div>

        {/* Formulaire d'ajout */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
                <p className="text-xs text-slate-400 font-medium mb-2">Nouveau crédit</p>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titre (ex: Prêt voiture)"
                  className="h-8 text-sm bg-slate-900/50 border-slate-600/50"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Montant €"
                    className="h-8 text-sm bg-slate-900/50 border-slate-600/50"
                  />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 text-sm bg-slate-900/50 border-slate-600/50"
                  />
                </div>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (optionnel)"
                  className="h-8 text-sm bg-slate-900/50 border-slate-600/50"
                />
                <Button 
                  onClick={addEntry} 
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Ajouter le crédit
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Liste des crédits */}
        <div className="space-y-2">
          {loading && entries.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-6">
              <CreditCard className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Aucun crédit en cours</p>
              <p className="text-xs text-slate-500 mt-1">Ajoutez un crédit pour commencer le suivi</p>
            </div>
          ) : (
            entries.map((credit, idx) => {
              const outstanding = Number(credit.outstanding ?? credit.amount ?? 0)
              const principal = Number(credit.amount ?? 0)
              const progress = principal > 0 ? ((principal - outstanding) / principal) * 100 : 0
              const isExpanded = expandedCredit === credit.id
              const isPaidOff = outstanding <= 0

              return (
                <motion.div 
                  key={credit.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`rounded-xl border overflow-hidden transition-all ${
                    isPaidOff 
                      ? 'bg-green-900/10 border-green-500/20' 
                      : 'bg-slate-800/50 border-slate-700/50'
                  }`}
                >
                  <div 
                    className="p-3 cursor-pointer"
                    onClick={() => setExpandedCredit(isExpanded ? null : credit.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isPaidOff ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                          )}
                          <span className="font-medium text-sm text-white truncate">{credit.title || 'Crédit'}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <CircleDollarSign className="w-3 h-3" />
                            {principal.toFixed(0)} €
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {new Date(credit.date).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <p className={`text-lg font-bold ${isPaidOff ? 'text-green-400' : 'text-orange-400'}`}>
                          {outstanding.toFixed(0)} €
                        </p>
                        <p className="text-[10px] text-slate-500">restant</p>
                      </div>
                    </div>
                    
                    {/* Barre de progression */}
                    <div className="mt-2">
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.5, delay: idx * 0.05 }}
                          className={`h-full rounded-full ${isPaidOff ? 'bg-green-500' : 'bg-orange-500'}`}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">{progress.toFixed(0)}% remboursé</p>
                    </div>
                  </div>

                  {/* Section étendue */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-3 pb-3 overflow-hidden"
                      >
                        {credit.note && (
                          <p className="text-xs text-slate-400 mb-2 italic">&quot;{credit.note}&quot;</p>
                        )}
                        
                        {/* Actions */}
                        <div className="flex gap-2 mb-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 text-xs border-slate-600 hover:bg-slate-700/50"
                            onClick={(e) => { e.stopPropagation(); editCredit(credit) }}
                          >
                            <Edit3 className="w-3 h-3 mr-1" />
                            Modifier
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 text-xs border-red-600/50 text-red-400 hover:bg-red-900/30"
                            onClick={(e) => { e.stopPropagation(); deleteCredit(credit.id) }}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Supprimer
                          </Button>
                        </div>
                        
                        {/* Formulaire de remboursement */}
                        {!isPaidOff && (
                          <RepayForm credit={credit} onRepay={(amt, accountId) => repay(credit.id, amt, accountId)} />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
