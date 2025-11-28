'use client'

import { useEffect, useState } from 'react'
import { getBaseInitial, getCurrentBalance as getCurrentBalanceUtil } from '@/lib/balances'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Save, Pencil, X, Share2 } from 'lucide-react'
import { motion } from 'framer-motion'

interface Account {
  id: string
  name: string
  type: string
  initialBalance: number
  currentBalance?: number
  isOwner?: boolean
  permission?: 'view' | 'edit'
  shareId?: string
  ownerUserId?: string
}
interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  accountId: string;
}

export default function ComptesPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
    const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    fetchAccounts()
      fetchTransactions()
  }, [])

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts')
      const data = await response.json()
      setAccounts(data)
      
      // Initialiser les balances
      const initialBalances: Record<string, number> = {}
      data.forEach((acc: Account) => {
        initialBalances[acc.id] = acc.initialBalance
      })
      setBalances(initialBalances)
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
    } finally {
      setLoading(false)
    }
  }

    const fetchTransactions = async () => {
      try {
        const response = await fetch('/api/transactions')
        const data = await response.json()
        setTransactions(data)
      } catch (error) {
        console.error('Erreur lors du chargement des transactions:', error)
      }
    }

    // Calculer le solde courant pour chaque compte (utilise l'utilitaire centralisé)
    const getCurrentBalance = (accountId: string) => {
      const account = accounts.find(acc => acc.id === accountId)
      if (!account) return 0
      return getBaseInitial(account, balances)
    }

  const handleUpdateBalance = async (accountId: string) => {
    try {
      const response = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: accountId,
          initialBalance: balances[accountId],
        }),
      })

      if (response.ok) {
        fetchAccounts()
        setEditingId(null)
        alert('Solde mis à jour avec succès !')
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error)
      alert('Erreur lors de la mise à jour')
    }
  }

  const handleCreateDefaultAccounts = async () => {
    try {
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Bourso',
          type: 'ponctuel',
          initialBalance: 0,
        }),
      })

      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Caisse EP',
          type: 'obligatoire',
          initialBalance: 0,
        }),
      })

      fetchAccounts()
    } catch (error) {
      console.error('Erreur lors de la création:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">Comptes</h1>
        <p className="text-slate-200 mt-2 text-base md:text-lg font-medium">Gérez vos soldes initiaux</p>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500 mb-4">Aucun compte configuré</p>
            <Button onClick={handleCreateDefaultAccounts} className="w-full md:w-auto">
              Créer les comptes par défaut
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {accounts.map((account, index) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`border-2 bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl hover:shadow-2xl transition-all duration-300 ${
                account.type === 'ponctuel' 
                  ? 'border-blue-400/30' 
                  : 'border-green-400/30'
              }`}>
                <CardHeader className="border-b border-slate-700/50">
                  <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2 text-white flex-wrap">
                      <Settings className="w-5 h-5" />
                      {account.name}
                      {!account.isOwner && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-400/30 text-xs font-semibold">
                          <Share2 className="w-3 h-3" />
                          Dashboard partagé ({account.permission === 'view' ? 'Lecture' : 'Édition'})
                        </span>
                      )}
                    </div>
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full w-fit ${
                      account.type === 'ponctuel'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                        : 'bg-green-500/20 text-green-300 border border-green-400/30'
                    }`}>
                      {account.type === 'ponctuel' ? 'Occasionnel' : 'Obligatoire'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {editingId === account.id ? (
                    // Mode édition
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-200">Modifier le solde initial</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={balances[account.id] || 0}
                          onChange={(e) =>
                            setBalances({
                              ...balances,
                              [account.id]: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 h-12 text-lg font-semibold"
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleUpdateBalance(account.id)}
                          className="gap-2 flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 h-11"
                        >
                          <Save className="w-4 h-4" />
                          Enregistrer
                        </Button>
                        <Button
                          onClick={() => {
                            setEditingId(null)
                            // Réinitialiser la valeur
                            setBalances({
                              ...balances,
                              [account.id]: account.initialBalance,
                            })
                          }}
                          variant="outline"
                          className="gap-2 bg-slate-700/50 border-slate-600/50 text-white hover:bg-slate-700 hover:border-slate-600 h-11 px-4"
                        >
                          <X className="w-4 h-4" />
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Mode affichage
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm font-medium text-slate-400">Solde actuel</Label>
                            <div className={`text-3xl md:text-4xl font-bold mt-1 ${
                              getCurrentBalance(account.id) >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {getCurrentBalance(account.id).toFixed(2)} €
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Initial: {(typeof balances[account.id] === 'number' ? balances[account.id] : account.initialBalance).toFixed(2)} €
                            </p>
                          </div>
                        {(account.isOwner || account.permission === 'edit') && (
                        <Button
                          onClick={() => setEditingId(account.id)}
                          variant="ghost"
                          size="icon"
                          className="h-12 w-12 rounded-full bg-slate-700/30 hover:bg-slate-700 border-2 border-slate-600/30 hover:border-blue-500/50 transition-all"
                        >
                          <Pencil className="w-5 h-5 text-slate-300" />
                        </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-blue-400/30 shadow-xl">
        <CardContent className="py-6">
          <div className="flex items-start gap-3">
            <div className="text-blue-400 text-2xl">💡</div>
            <div>
              <h3 className="font-semibold text-blue-300 mb-1">
                Comment ça fonctionne ?
              </h3>
              <p className="text-sm text-slate-300">
                Le <strong className="text-blue-300">solde initial</strong> représente l'argent disponible au début.
                Le <strong className="text-green-300">solde actuel</strong> est calculé automatiquement en soustrayant
                toutes vos dépenses du solde initial.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
