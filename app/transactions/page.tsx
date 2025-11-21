'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Filter, Trash2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import TransactionForm from '@/components/TransactionForm'
import RecurringTransactionForm from '@/components/RecurringTransactionForm'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Account {
  id: string
  name: string
}

interface Category {
  id: string
  name: string
  type: string
  icon: string
  color: string
}

interface Transaction {
  id: string
  amount: number
  type: 'income' | 'expense'
  categoryId: string
  date: string
  note: string | null
  accountId: string
  account: Account
  category: Category
  isRecurring?: boolean
  recurrenceFrequency?: string
  recurrenceDay?: number
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'ponctuel' | 'recurrent'>('ponctuel')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [showUpcoming, setShowUpcoming] = useState(false)
  const [search, setSearch] = useState('')
  const [searchDate, setSearchDate] = useState('')
  const [searchAmount, setSearchAmount] = useState('')
  const [searchCategory, setSearchCategory] = useState('')
  const [searchAccount, setSearchAccount] = useState('')
  const [searchNote, setSearchNote] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [transactionsRes, accountsRes] = await Promise.all([
        fetch(`/api/expenses?includeUpcoming=true`), // Récupérer toutes les transactions y compris futures
        fetch('/api/accounts'),
      ])
      
      const transactionsData = await transactionsRes.json()
      const accountsData = await accountsRes.json()
      
      setTransactions(transactionsData)
      setAccounts(accountsData)
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filtrer les transactions côté client
  const filteredTransactions = transactions.filter(txn => {
    // Filtre par type
    if (typeFilter !== 'all' && txn.type !== typeFilter) {
      return false
    }
    // Filtre par date future
    if (!showUpcoming) {
      const txnDate = new Date(txn.date)
      const now = new Date()
      if (txnDate > now) {
        return false
      }
    }
    // Filtre par recherche texte globale
    if (search.trim() !== '') {
      const lower = search.trim().toLowerCase()
      const fields = [
        txn.category?.name,
        txn.category?.icon,
        txn.account?.name,
        txn.note,
        txn.amount?.toString(),
        txn.date
      ].map(v => (v || '').toString().toLowerCase())
      if (!fields.some(f => f.includes(lower))) {
        return false
      }
    }
    // Filtre par date exacte
    if (searchDate.trim() !== '') {
      const dateStr = new Date(txn.date).toISOString().split('T')[0]
      if (!dateStr.includes(searchDate.trim())) {
        return false
      }
    }
    // Filtre par montant
    if (searchAmount.trim() !== '') {
      if (!txn.amount.toString().includes(searchAmount.trim())) {
        return false
      }
    }
    // Filtre par nom de transaction (catégorie)
    if (searchCategory.trim() !== '') {
      if (!txn.category?.name?.toLowerCase().includes(searchCategory.trim().toLowerCase())) {
        return false
      }
    }
    // Filtre par nom de compte
    if (searchAccount.trim() !== '') {
      if (!txn.account?.name?.toLowerCase().includes(searchAccount.trim().toLowerCase())) {
        return false
      }
    }
    // Filtre par description (note)
    if (searchNote.trim() !== '') {
      if (!txn.note?.toLowerCase().includes(searchNote.trim().toLowerCase())) {
        return false
      }
    }
    return true
  })

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) return

    try {
      await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      setTransactions(transactions.filter(t => t.id !== id))
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
    }
  }

  const handleSuccess = () => {
    fetchData()
    setShowForm(false)
  }

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const balance = totalIncome - totalExpense

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 md:space-y-6 pb-20 md:pb-8"
    >
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">Transactions</h1>
        <Button 
          onClick={() => setShowForm(!showForm)} 
          className={`w-full md:w-auto font-semibold shadow-lg hover:shadow-xl transition-all duration-200 px-6 py-6 text-base ${
            showForm 
              ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700' 
              : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
          }`}
        >
          <Plus className="w-5 h-5 mr-2" />
          {showForm ? 'Annuler' : 'Ajouter'}
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2">
        <Card className="border-green-400/30 bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold text-white">Revenus</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-green-400">
              +{totalIncome.toFixed(2)} €
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-400/30 bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold text-white">Dépenses</CardTitle>
            <TrendingDown className="h-5 w-5 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-red-400">
              -{totalExpense.toFixed(2)} €
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulaire */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4"
        >
          {/* Onglets pour choisir le type de formulaire */}
          <Card className="border-2 border-slate-700/50 bg-gradient-to-br from-slate-800/95 to-slate-900/95 shadow-xl backdrop-blur-sm">
            <CardContent className="pt-6">
              <Tabs value={formType} onValueChange={(v) => setFormType(v as 'ponctuel' | 'recurrent')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-slate-700/50 border border-slate-600/50 p-1.5 h-auto">
                  <TabsTrigger 
                    value="ponctuel" 
                    className="flex items-center gap-1 md:gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 text-slate-300 font-semibold py-2 md:py-3 text-xs md:text-sm"
                  >
                    <Plus className="w-3 h-3 md:w-4 md:h-4" />
                    <span className="hidden sm:inline">Transaction Ponctuelle</span>
                    <span className="sm:hidden">Ponctuelle</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="recurrent" 
                    className="flex items-center gap-1 md:gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200 text-slate-300 font-semibold py-2 md:py-3 text-xs md:text-sm"
                  >
                    <RefreshCw className="w-3 h-3 md:w-4 md:h-4" />
                    <span className="hidden sm:inline">Transaction Récurrente</span>
                    <span className="sm:hidden">Récurrente</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>

          {/* Afficher le bon formulaire selon l'onglet */}
          {formType === 'ponctuel' ? (
            <TransactionForm
              accounts={accounts}
              onSuccess={handleSuccess}
              onCancel={() => setShowForm(false)}
            />
          ) : (
            <RecurringTransactionForm
              accounts={accounts}
              categories={[]} // Les catégories seront chargées dans le composant
              onSuccess={handleSuccess}
            />
          )}
        </motion.div>
      )}

      {/* Filtres */}
      <Card className="border-2 border-slate-700/50 bg-gradient-to-br from-slate-800/95 to-slate-900/95 shadow-xl backdrop-blur-sm">
        <CardHeader className="border-b border-slate-700/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-xl font-bold text-white">Liste des transactions</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <input
                type="date"
                value={searchDate}
                onChange={e => setSearchDate(e.target.value)}
                className="px-3 py-2 rounded-md border border-slate-600/50 bg-slate-700/50 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-sm md:text-base w-full md:w-36"
              />
              <input
                type="number"
                value={searchAmount}
                onChange={e => setSearchAmount(e.target.value)}
                placeholder="Montant (€)"
                className="px-3 py-2 rounded-md border border-slate-600/50 bg-slate-700/50 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-sm md:text-base w-full md:w-28"
              />
              <input
                type="text"
                value={searchCategory}
                onChange={e => setSearchCategory(e.target.value)}
                placeholder="Catégorie"
                className="px-3 py-2 rounded-md border border-slate-600/50 bg-slate-700/50 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-sm md:text-base w-full md:w-32"
              />
              <input
                type="text"
                value={searchAccount}
                onChange={e => setSearchAccount(e.target.value)}
                placeholder="Compte"
                className="px-3 py-2 rounded-md border border-slate-600/50 bg-slate-700/50 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-sm md:text-base w-full md:w-32"
              />
              <input
                type="text"
                value={searchNote}
                onChange={e => setSearchNote(e.target.value)}
                placeholder="Description"
                className="px-3 py-2 rounded-md border border-slate-600/50 bg-slate-700/50 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-sm md:text-base w-full md:w-32"
              />
              <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                <TabsList className="bg-slate-700/50 border border-slate-600/50">
                  <TabsTrigger value="all" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white text-slate-300">Tout</TabsTrigger>
                  <TabsTrigger value="income" className="data-[state=active]:bg-green-500 data-[state=active]:text-white text-slate-300">Revenus</TabsTrigger>
                  <TabsTrigger value="expense" className="data-[state=active]:bg-red-500 data-[state=active]:text-white text-slate-300">Dépenses</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button
                variant={showUpcoming ? "default" : "outline"}
                size="sm"
                onClick={() => setShowUpcoming(!showUpcoming)}
                className={`gap-2 ${
                  showUpcoming 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white' 
                    : 'bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                {showUpcoming ? 'Masquer futures' : 'Voir futures'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Aucune transaction trouvée
            </p>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map((transaction) => {
                const isFuture = new Date(transaction.date) > new Date()
                return (
                <motion.div
                  key={transaction.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all hover:shadow-lg ${
                    isFuture 
                      ? 'bg-gradient-to-br from-blue-900/20 to-blue-800/20 border-blue-500/30 backdrop-blur-sm' 
                      : transaction.type === 'income' 
                        ? 'bg-gradient-to-br from-green-900/20 to-green-800/20 border-green-500/30' 
                        : 'bg-gradient-to-br from-red-900/20 to-red-800/20 border-red-500/30'
                  }`}
                >
                  <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
                    <div 
                      className="w-11 h-11 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-xl md:text-3xl flex-shrink-0 shadow-lg border-2"
                      style={{ 
                        backgroundColor: transaction.category?.color + '30',
                        borderColor: transaction.category?.color + '60'
                      }}
                    >
                      {transaction.category?.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-base md:text-lg text-white mb-1.5">{transaction.category?.name}</p>
                      {transaction.isRecurring && (
                        <div className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-400/30 text-xs font-semibold mb-1.5">
                          <RefreshCw className="w-3 h-3 flex-shrink-0" />
                          <span>
                            {transaction.recurrenceFrequency === 'monthly' && 'Mensuel'}
                            {transaction.recurrenceFrequency === 'yearly' && 'Annuel'}
                            {transaction.recurrenceFrequency === 'weekly' && 'Hebdo'}
                            {transaction.recurrenceDay && ` (le ${transaction.recurrenceDay})`}
                          </span>
                        </div>
                      )}
                      {isFuture && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-medium mb-1.5 ml-1.5">
                          Future
                        </span>
                      )}
                      <p className="text-xs md:text-sm text-slate-400 font-medium">
                        {transaction.account?.name} • {new Date(transaction.date).toLocaleDateString('fr-FR')}
                      </p>
                      {transaction.note && (
                        <p className="text-xs text-slate-500 mt-1 italic">{transaction.note}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                    <span className={`text-base md:text-xl font-bold ${
                      transaction.type === 'income' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{transaction.amount.toFixed(2)} €
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteTransaction(transaction.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-9 w-9 md:h-10 md:w-10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                    </Button>
                  </div>
                </motion.div>
              )})}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
