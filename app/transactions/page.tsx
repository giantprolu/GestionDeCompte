'use client'

import { useEffect, useState, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Filter, Trash2, TrendingUp, TrendingDown, RefreshCw, Pencil, X, Clock } from 'lucide-react'
import { useSelectedMonth, getCurrentMonth } from '@/lib/useSelectedMonth'
import { getMonthClosure } from '@/lib/utils'
import { motion } from 'framer-motion'
import TransactionForm from '@/components/TransactionForm'
import RecurringTransactionForm from '@/components/RecurringTransactionForm'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Wallet } from "lucide-react";
import { useUserSettings } from '@/components/AppWrapper'
import { supabase } from '@/lib/db'

interface Account {
  id: string
  name: string
  ownerUserId?: string
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
  archived?: boolean
}

// Interface pour la clôture
interface MonthClosure {
  month_year: string;
  start_date: string;
  end_date: string;
}

export default function TransactionsPage() {
  const { isSignedIn, isLoaded, user } = useUser()
  const router = useRouter()
  const { userType, isLoading: isLoadingSettings } = useUserSettings()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const { selectedMonth, isCurrentMonth } = useSelectedMonth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'ponctuel' | 'recurrent'>('ponctuel')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [showUpcoming, setShowUpcoming] = useState(false)

  useEffect(() => {
  }, [showUpcoming]);
  const [showAllMonths, setShowAllMonths] = useState(false)
  const [search, setSearch] = useState('')
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [searchDate, setSearchDate] = useState('')
  const [searchAmount, setSearchAmount] = useState('')
  const [searchCategory, setSearchCategory] = useState('')
  const [searchAccount, setSearchAccount] = useState('')
  const [searchNote, setSearchNote] = useState('')
  const [closures, setClosures] = useState<MonthClosure[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current');
  const [showCurrent, setShowCurrent] = useState(true);

  // Rediriger les visionneurs vers la page partage
  useEffect(() => {
    if (!isLoadingSettings && userType === 'viewer') {
      router.replace('/partage')
    }
  }, [userType, isLoadingSettings, router])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchData()
    } else if (isLoaded && !isSignedIn) {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn])

  // Vérifie périodiquement si le mois a changé et recharge les données si nécessaire
  const currentMonthRef = useRef(`${new Date().getMonth()}-${new Date().getFullYear()}`)
  useEffect(() => {
    const interval = setInterval(() => {
      const key = `${new Date().getMonth()}-${new Date().getFullYear()}`
      if (key !== currentMonthRef.current) {
        currentMonthRef.current = key
        fetchData()
      }
    }, 60_000) // vérifie chaque minute

    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [transactionsRes, accountsRes] = await Promise.all([
        fetch(`/api/expenses?includeUpcoming=true`), // Récupérer toutes les transactions y compris futures
        fetch('/api/accounts'),
      ])
      
      if (!transactionsRes.ok || !accountsRes.ok) {
        setLoading(false)
        return
      }
      
      const transactionsData = await transactionsRes.json()
      const accountsData = await accountsRes.json()
      // Affiche uniquement les transactions à venir (upcoming)
      const upcoming = Array.isArray(transactionsData)
        ? transactionsData.filter(txn => !txn.archived && new Date(txn.date) > new Date())
        : [];
      setTransactions(Array.isArray(transactionsData) ? transactionsData : [])
      setAccounts(accountsData)
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error)
    } finally {
      setLoading(false)
    }
  }

  // Charger toutes les clôtures pour l'utilisateur
  useEffect(() => {
    async function fetchClosures() {
      // Utilise le hook useUser pour récupérer l'id utilisateur
      const userId = user?.id;
      if (!userId) return;
      const { data, error } = await supabase
        .from('month_closures')
        .select('month_year, start_date, end_date')
        .eq('user_id', userId)
        .order('start_date', { ascending: false });
      if (!error && Array.isArray(data)) {
        setClosures(data);
      }
    }
    if (isLoaded && isSignedIn && user) {
      fetchClosures();
    }
  }, [isLoaded, isSignedIn, user]);

  // Liste des périodes
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const baseDate = dateStr.split('T')[0];
    const d = new Date(baseDate);
    if (isNaN(d.getTime())) return baseDate;
    return d.toLocaleDateString('fr-FR');
  };
  const allPeriods = closures.map(c => ({
    key: c.month_year,
    label: `${formatDate(c.start_date)} - ${formatDate(c.end_date)}`,
    start_date: c.start_date,
    end_date: c.end_date
  }));

  // Filtrer les transactions selon la période sélectionnée
  const currentMonth = getCurrentMonth();
  const currentClosure = allPeriods.find(p => p.key === selectedPeriod);
  // La période actuelle = depuis le jour après la dernière clôture jusqu'à aujourd'hui (ou futures si showUpcoming)
  const lastClosureEndDate = allPeriods.length > 0 ? allPeriods[0].end_date : null;
  const filteredTransactions = showCurrent
    ? transactions.filter(txn => {
        if (txn.archived) return false;
        // Si showUpcoming est activé, on inclut toutes les transactions à venir (date future)
        if (showUpcoming && new Date(txn.date) > new Date()) return true;
        // Si on a une clôture, on prend les transactions après la date de fin de la dernière clôture
        if (lastClosureEndDate) {
          // Transaction doit être après la dernière clôture
          if (txn.date <= lastClosureEndDate) return false;
          // Si pas showUpcoming, exclure les transactions futures
          if (!showUpcoming && new Date(txn.date) > new Date()) return false;
          return true;
        }
        // Sinon (pas de clôture), on prend toutes les transactions non archivées jusqu'à aujourd'hui
        if (!showUpcoming && new Date(txn.date) > new Date()) return false;
        return true;
      })
    : currentClosure
      ? transactions.filter(txn => txn.date >= currentClosure.start_date && txn.date <= currentClosure.end_date && txn.archived === true)
      : [];

  // Filtrer les transactions côté client
  // Filtrage selon la période de clôture du mois sélectionné
  const [monthClosure, setMonthClosureState] = useState<{ start_date: string, end_date: string } | null>(null)
  const currentMonthCheck = getCurrentMonth()

  useEffect(() => {
    async function fetchClosure() {
      const userId = accounts.find(acc => acc.ownerUserId)?.ownerUserId
      if (!userId) return
      
      // Ne chercher la clôture que pour les mois passés
      if (selectedMonth !== currentMonthCheck) {
        const closure = await getMonthClosure(userId, selectedMonth)
        setMonthClosureState(closure)
      } else {
        setMonthClosureState(null)
      }
    }
    fetchClosure()
  }, [selectedMonth, accounts, currentMonthCheck])

  // Appliquer les filtres supplémentaires
  const finalFilteredTransactions = filteredTransactions.filter(txn => {
    if (typeFilter !== 'all' && txn.type !== typeFilter) return false;
    if (search.trim() !== '') {
      const lower = search.trim().toLowerCase();
      const fields = [
        txn.category?.name,
        txn.category?.icon,
        txn.account?.name,
        txn.note,
        txn.amount?.toString(),
        txn.date
      ].map(v => (v || '').toString().toLowerCase());
      if (!fields.some(f => f.includes(lower))) return false;
    }
    if (searchDate.trim() !== '') {
      const dateStr = new Date(txn.date).toISOString().split('T')[0];
      if (!dateStr.includes(searchDate.trim())) return false;
    }
    if (searchAmount.trim() !== '') {
      if (!txn.amount.toString().includes(searchAmount.trim())) return false;
    }
    if (searchCategory.trim() !== '') {
      if (!txn.category?.name?.toLowerCase().includes(searchCategory.trim().toLowerCase())) return false;
    }
    if (searchAccount.trim() !== '') {
      if (!txn.account?.name?.toLowerCase().includes(searchAccount.trim().toLowerCase())) return false;
    }
    if (searchNote.trim() !== '') {
      if (!txn.note?.toLowerCase().includes(searchNote.trim().toLowerCase())) return false;
    }
    return true;
  });

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) return

    try {
      await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      setTransactions(transactions.filter(t => t.id !== id))
      // Notify other components (eg. CreditTrackingCard) that credits changed
      try {
        window.dispatchEvent(new CustomEvent('credits:changed'))
      } catch {
        // ignore in non-browser env
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
    }
  }

  // Charger les catégories pour l'édition
  const fetchCategories = async (type: 'income' | 'expense') => {
    try {
      const res = await fetch(`/api/categories?type=${type}`)
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Erreur chargement catégories:', error)
    }
  }

  // Ouvrir le modal d'édition
  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    fetchCategories(transaction.type)
  }

  // Sauvegarder les modifications
  const handleSaveEdit = async (updatedData: Partial<Transaction>) => {
    if (!editingTransaction) return

    try {
      const res = await fetch(`/api/expenses/${editingTransaction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      })

      if (res.ok) {
        await fetchData()
        setEditingTransaction(null)
        try {
          window.dispatchEvent(new CustomEvent('transactions:changed'))
          window.dispatchEvent(new CustomEvent('accounts:changed'))
        } catch {
          // ignore
        }
      } else {
        const error = await res.json()
        alert('Erreur: ' + (error.error || 'Impossible de modifier'))
      }
    } catch (error) {
      console.error('Erreur modification:', error)
      alert('Erreur lors de la modification')
    }
  }

  const handleSuccess = () => {
    fetchData()
    setShowForm(false)
  }

  // Date d'aujourd'hui pour filtrer les transactions futures
  const today = new Date().toISOString().split('T')[0]

  // Calculer les totaux en excluant les transactions futures

  // Calcul des totaux sur la liste affichée (comme sur le Dashboard)
  const totalIncome = finalFilteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpense = finalFilteredTransactions
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
      className="space-y-4 md:space-y-6 pb-20 md:pb-8 px-3 sm:px-4 md:px-6 pt-4"
    >
      {/* Sélecteur de période */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-3">
        <motion.button
          key="current"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0 }}
          onClick={() => { setShowCurrent(true); setSelectedPeriod('current'); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
            showCurrent
              ? 'bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg shadow-green-500/25'
              : 'bg-slate-700/40 hover:bg-slate-700/70 text-slate-300 hover:text-white border border-slate-600/30 hover:border-slate-500/50'
          }`}
        >
          <span className="text-sm font-semibold">Période actuelle</span>
        </motion.button>
        {allPeriods.map((period, idx) => (
          <motion.button
            key={period.key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: (idx + 1) * 0.03 }}
            onClick={() => { setShowCurrent(false); setSelectedPeriod(period.key); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
              !showCurrent && selectedPeriod === period.key
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-slate-700/40 hover:bg-slate-700/70 text-slate-300 hover:text-white border border-slate-600/30 hover:border-slate-500/50'
            }`}
          >
            <span className="text-sm font-semibold">{period.label}</span>
          </motion.button>
        ))}
      </div>

      
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
          <div className="flex flex-col gap-2 w-full">
            <CardTitle className="text-xl font-bold text-white mb-2">Liste des transactions</CardTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 w-full">
              <div className="flex items-center gap-1">
                <Filter className="w-4 h-4 text-blue-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Recherche..."
                  className="px-2 py-1 rounded-md border border-slate-600/50 bg-slate-700/50 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-xs w-full"
                />
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <input
                  type="number"
                  value={searchAmount}
                  onChange={e => setSearchAmount(e.target.value)}
                  placeholder="Montant (€)"
                  className="px-2 py-1 rounded-md border border-slate-600/50 bg-slate-700/50 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-xs w-full"
                />
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-blue-400" />
                <input
                  type="date"
                  value={searchDate}
                  onChange={e => setSearchDate(e.target.value)}
                  className="px-2 py-1 rounded-md border border-slate-600/50 bg-slate-700/50 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-xs w-full"
                />
              </div>
              <div className="flex items-center gap-1">
                <Plus className="w-4 h-4 text-purple-400" />
                <input
                  type="text"
                  value={searchCategory}
                  onChange={e => setSearchCategory(e.target.value)}
                  placeholder="Catégorie"
                  className="px-2 py-1 rounded-md border border-slate-600/50 bg-slate-700/50 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-xs w-full"
                />
              </div>
              <div className="flex items-center gap-1">
                <Wallet className="w-4 h-4 text-blue-400" />
                <input
                  type="text"
                  value={searchAccount}
                  onChange={e => setSearchAccount(e.target.value)}
                  placeholder="Compte"
                  className="px-2 py-1 rounded-md border border-slate-600/50 bg-slate-700/50 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-xs w-full"
                />
              </div>
              <div className="flex items-center gap-1">
                <Filter className="w-4 h-4 text-blue-400" />
                <input
                  type="text"
                  value={searchNote}
                  onChange={e => setSearchNote(e.target.value)}
                  placeholder="Description"
                  className="px-2 py-1 rounded-md border border-slate-600/50 bg-slate-700/50 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-xs w-full"
                />
              </div>
              <div className="col-span-2 sm:col-span-3 md:col-span-6 flex gap-2 mt-2">
                <div className="w-full flex flex-col sm:flex-row gap-2 sm:gap-4 overflow-x-auto pb-1">
                  <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                    <TabsList className="flex bg-slate-700/50 border border-slate-600/50 rounded-lg overflow-x-auto">
                      <TabsTrigger value="all" className="min-w-[70px] px-2 py-1 text-xs sm:text-sm data-[state=active]:bg-slate-600 data-[state=active]:text-white text-slate-300">Tout</TabsTrigger>
                      <TabsTrigger value="income" className="min-w-[90px] px-2 py-1 text-xs sm:text-sm data-[state=active]:bg-green-500 data-[state=active]:text-white text-slate-300">Revenus</TabsTrigger>
                      <TabsTrigger value="expense" className="min-w-[90px] px-2 py-1 text-xs sm:text-sm data-[state=active]:bg-red-500 data-[state=active]:text-white text-slate-300">Dépenses</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button
                    variant={showUpcoming ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowUpcoming(!showUpcoming)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs sm:text-sm rounded-lg transition-all duration-200 ${
                      showUpcoming 
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white' 
                        : 'bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span className="hidden xs:inline">{showUpcoming ? 'Masquer futures' : 'Voir futures'}</span>
                  </Button>
                  <Button
                    variant={showAllMonths ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowAllMonths(!showAllMonths)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs sm:text-sm rounded-lg transition-all duration-200 ${
                      showAllMonths
                        ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white'
                        : 'bg-slate-700/50 border-slate-600/50 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="hidden xs:inline">{showAllMonths ? 'Tous mois' : 'Mois sélectionné'}</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Aucune transaction trouvée
            </p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
              {finalFilteredTransactions.map((transaction) => {
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
                      onClick={() => handleEditTransaction(transaction)}
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 h-9 w-9 md:h-10 md:w-10 rounded-lg transition-all"
                    >
                      <Pencil className="w-4 h-4 md:w-5 md:h-5" />
                    </Button>
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
          
      {/* Modal d'édition */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md"
          >
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-2xl">
              <CardHeader className="border-b border-slate-700 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold text-white">Modifier la transaction</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingTransaction(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {/* Type (non modifiable visuellement) */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50">
                  <span className={`text-sm font-medium ${editingTransaction.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                    {editingTransaction.type === 'income' ? '💰 Revenu' : '💸 Dépense'}
                  </span>
                  {editingTransaction.isRecurring && (
                    <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded-md">
                      <RefreshCw className="w-3 h-3 inline mr-1" />
                      Récurrent
                    </span>
                  )}
                </div>

                {/* Montant */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Montant (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={editingTransaction.amount}
                    onChange={(e) => setEditingTransaction({
                      ...editingTransaction,
                      amount: parseFloat(e.target.value) || 0
                    })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Catégorie */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Catégorie</label>
                  <select
                    value={editingTransaction.categoryId}
                    onChange={(e) => setEditingTransaction({
                      ...editingTransaction,
                      categoryId: e.target.value
                    })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:border-blue-500"
                  >
                    <option value={editingTransaction.categoryId}>
                      {editingTransaction.category?.icon} {editingTransaction.category?.name}
                    </option>
                    {categories.filter(c => c.id !== editingTransaction.categoryId).map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Compte */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Compte</label>
                  <select
                    value={editingTransaction.accountId}
                    onChange={(e) => setEditingTransaction({
                      ...editingTransaction,
                      accountId: e.target.value
                    })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:border-blue-500"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Date</label>
                  <input
                    type="date"
                    defaultValue={editingTransaction.date.split('T')[0]}
                    onChange={(e) => setEditingTransaction({
                      ...editingTransaction,
                      date: e.target.value
                    })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:border-blue-500"
                  />
                </div>

                {/* Note */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Note (optionnel)</label>
                  <input
                    type="text"
                    defaultValue={editingTransaction.note || ''}
                    onChange={(e) => setEditingTransaction({
                      ...editingTransaction,
                      note: e.target.value || null
                    })}
                    placeholder="Ajouter une note..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500"
                  />
                </div>

                {/* Récurrence (si récurrent) */}
                {editingTransaction.isRecurring && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Jour de récurrence</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      defaultValue={editingTransaction.recurrenceDay || 1}
                      onChange={(e) => setEditingTransaction({
                        ...editingTransaction,
                        recurrenceDay: parseInt(e.target.value) || 1
                      })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Boutons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => handleSaveEdit({
                      amount: editingTransaction.amount,
                      category_id: editingTransaction.categoryId,
                      account_id: editingTransaction.accountId,
                      date: editingTransaction.date,
                      note: editingTransaction.note
                    } as any)}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                  >
                    Enregistrer
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingTransaction(null)}
                    className="bg-slate-700/50 border-slate-600 hover:bg-slate-700"
                  >
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}