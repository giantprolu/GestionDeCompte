"use client"

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { getBaseInitial, sumBalances } from '@/lib/balances'
import { getMonthClosure } from '@/lib/utils'
import { useSelectedMonth, getCurrentMonth } from '@/lib/useSelectedMonth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Wallet, TrendingUp, Calendar, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useUserSettings } from '@/components/AppWrapper'
import { supabase } from '@/lib/db'
import ExpenseChart from '@/components/ExpenseChart'

interface Account {
  id: string
  name: string
  type: string
  initialBalance: number
  currentBalance: number
  isOwner?: boolean
  permission?: 'view' | 'edit'
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
  accountId: string
  category: Category
  archived?: boolean
}

// Nouvelle interface pour la clôture
interface MonthClosure {
  month_year: string;
  start_date: string;
  end_date: string;
}

export default function Home() {
  const { isSignedIn, isLoaded, user } = useUser()
  const router = useRouter()
  const { userType, isLoading: isLoadingSettings } = useUserSettings()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [closures, setClosures] = useState<MonthClosure[]>([])
  const [loading, setLoading] = useState(true)

  // Rediriger les visionneurs vers la page partage
  useEffect(() => {
    if (!isLoadingSettings && userType === 'viewer') {
      router.replace('/partage')
    }
  }, [userType, isLoadingSettings, router])

  // Récupérer toutes les clôtures de l'utilisateur dès que l'utilisateur est connecté
  useEffect(() => {
    async function fetchClosures() {
      // Utilise le hook useUser pour récupérer l'id utilisateur
      const userId = user?.id;
      // Fallback sur accounts si user n'est pas dispo
      const fallbackId = accounts.find(acc => acc.ownerUserId)?.ownerUserId;
      const finalUserId = userId || fallbackId;
      if (!finalUserId) return;
      const { data, error } = await supabase
        .from('month_closures')
        .select('month_year, start_date, end_date')
        .eq('user_id', finalUserId)
        .order('start_date', { ascending: false });
      if (!error && Array.isArray(data)) {
        setClosures(data);
      }
    }
    if (isLoaded && isSignedIn && (user || accounts.length > 0)) {
      fetchClosures();
    }
  }, [isLoaded, isSignedIn, accounts, user])

  // Générer la liste des périodes à partir des clôtures
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    // Prend uniquement la partie date si le format est ISO
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
  }))

  // Utiliser le hook partagé pour la période sélectionnée
  const { selectedMonth, toggleMonth, isCurrentMonth } = useSelectedMonth()
  const [selectedPeriod, setSelectedPeriod] = useState<string>(allPeriods[0]?.key || '')
  const currentMonth = getCurrentMonth();
  const [showCurrent, setShowCurrent] = useState(true);

  // Filtrer les transactions selon la période sélectionnée
  const currentClosure = allPeriods.find(p => p.key === selectedPeriod)
  const periodTransactions = currentClosure
    ? transactions.filter(txn => txn.date >= currentClosure.start_date && txn.date <= currentClosure.end_date && txn.archived === true)
    : []

  // Transactions pour la période sélectionnée ou la période actuelle
  // La période actuelle = depuis le jour après la dernière clôture jusqu'à aujourd'hui
  const isCurrentSelected = showCurrent;
  const lastClosureEndDate = allPeriods.length > 0 ? allPeriods[0].end_date : null;
  const filteredTransactions = isCurrentSelected
    ? transactions.filter(txn => {
      if (txn.archived) return false;
      // Si on a une clôture, on prend les transactions après la date de fin de la dernière clôture
      if (lastClosureEndDate) {
        return txn.date > lastClosureEndDate;
      }
      // Sinon, on prend toutes les transactions non archivées
      return true;
    })
    : periodTransactions;

  // Reset des indicateurs selon le mois sélectionné
  const totalMonthIncome = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const totalMonthExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const expensesByCategory = filteredTransactions.filter(t => t.type === 'expense').reduce((acc: Record<string, { amount: number, category: Category }>, txn) => {
    if (!acc[txn.categoryId]) {
      acc[txn.categoryId] = { amount: 0, category: txn.category }
    }
    acc[txn.categoryId].amount += txn.amount
    return acc
  }, {})
  const pieData = Object.values(expensesByCategory).map(item => ({
    name: item.category.name,
    value: item.amount,
    color: item.category.color,
    icon: item.category.icon,
  })).sort((a, b) => b.value - a.value).slice(0, 5)
  const recentTransactions = [...filteredTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      // Traiter les transactions récurrentes du jour au chargement
      processRecurringTransactions().then(() => {
        fetchData()
      })
    } else if (isLoaded && !isSignedIn) {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn])

  // Traiter les transactions récurrentes dont la date est arrivée
  const processRecurringTransactions = async () => {
    try {
      const res = await fetch('/api/process-recurring', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
      }
    } catch (error) {
      console.error('Erreur traitement récurrences:', error)
    }
  }

  const fetchData = async () => {
    try {
      const [accountsRes, transactionsRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/expenses'),
      ])

      if (!accountsRes.ok || !transactionsRes.ok) {
        console.error('Erreur API:', accountsRes.status, transactionsRes.status)
        setLoading(false)
        return
      }

      const accountsData = await accountsRes.json()
      const transactionsData = await transactionsRes.json()
      setAccounts(Array.isArray(accountsData) ? accountsData : [])
      setTransactions(Array.isArray(transactionsData) ? transactionsData : [])
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fonction utilitaire pour récupérer le solde initial d'un compte (via utilitaire centralisé)
  const getInitialBalance = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId)
    return account ? getBaseInitial(account, null) : 0
  }

  // Calculer le solde courant d'un compte en appliquant ses transactions
  // Calculer le total uniquement des comptes propres (pas les partagés)
  const ownAccounts = accounts.filter(acc => acc.isOwner !== false)
  const totalBalance = sumBalances(ownAccounts, transactions, null, { useCurrent: false, onlyOwn: true })

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  // Fonction pour appliquer le changement de mois
  const handleChangeMonth = async () => {
    try {
      const res = await fetch('/api/change-month', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        // Recharger les données pour mettre à jour l'affichage
        await fetchData()
        alert('Changement de mois appliqué !')
      } else {
        alert('Erreur : ' + (data.error || 'Impossible d’archiver les transactions'))
      }
    } catch (error) {
      alert('Erreur serveur : ' + error)
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8 px-3 sm:px-4 md:px-6 pt-4">
      {/* En-tête avec titre et sélecteur de période */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Titre et boutons d'action */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">Tableau de bord</h1>
            <p className="text-slate-200 mt-2 text-base md:text-lg font-medium">Vue d&apos;ensemble de vos finances</p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Button
              className="w-full md:w-auto bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 px-6 py-6 text-base"
              onClick={handleChangeMonth}
            >
              <Calendar className="w-5 h-5 mr-2" />
              Débit d'un nouveau mois
            </Button>
            <Link href="/transactions">
              <Button className="w-full md:w-auto bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 px-6 py-6 text-base">
                <TrendingUp className="w-5 h-5 mr-2" />
                Voir les transactions
              </Button>
            </Link>
          </div>
        </div>

        {/* Sélecteur de période compact */}
        <Card className="border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 shadow-lg overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
                  <Calendar className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-sm font-medium text-slate-300 hidden sm:inline">Période :</span>
              </div>

              <div className="flex gap-2 overflow-x-auto flex-1 pb-1 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
                <motion.button
                  key="current"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0 }}
                  onClick={() => { setShowCurrent(true); setSelectedPeriod(''); }}
                  className={`relative flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${showCurrent
                    ? 'bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg shadow-green-500/25'
                    : 'bg-slate-700/40 hover:bg-slate-700/70 text-slate-300 hover:text-white border border-slate-600/30 hover:border-slate-500/50'
                    }`}
                >
                  <span className={`text-sm font-semibold`}>Période actuelle</span>
                </motion.button>
                {allPeriods.map((period, idx) => (
                  <motion.button
                    key={period.key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (idx + 1) * 0.03 }}
                    onClick={() => { setShowCurrent(false); setSelectedPeriod(period.key); }}
                    className={`relative flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${!showCurrent && selectedPeriod === period.key
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                      : 'bg-slate-700/40 hover:bg-slate-700/70 text-slate-300 hover:text-white border border-slate-600/30 hover:border-slate-500/50'
                      }`}
                  >
                    <span className={`text-sm font-semibold`}>
                      {period.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

          </CardContent>
        </Card>
      </motion.div>

      {/* Cards des comptes - Affichage dynamique */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {ownAccounts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="col-span-full"
          >
            <Card className="border-slate-600/50 bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl">
              <CardContent className="py-8 text-center">
                <Wallet className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-300 mb-4">Aucun compte configuré</p>
                <Link href="/comptes">
                  <Button className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-semibold">
                    Créer votre premier compte
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <>
            {ownAccounts.slice(0, 2).map((account, index) => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * (index + 1) }}
              >
                <Card className={`border-${index === 0 ? 'blue' : 'green'}-400/30 bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl hover:shadow-2xl transition-all duration-300`}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-300">
                      {account.name}
                    </CardTitle>
                    <Wallet className={`w-5 h-5 text-${index === 0 ? 'blue' : 'green'}-400`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl md:text-3xl font-bold text-white">
                      {getInitialBalance(account.id).toFixed(2)} €
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {account.type === 'obligatoire' ? 'Dépenses obligatoires' : 'Dépenses occasionnelles'}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-purple-400/30 bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl hover:shadow-2xl transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-300">
                    Total disponible
                  </CardTitle>
                  <Wallet className="w-5 h-5 text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl md:text-3xl font-bold text-purple-300">
                    {totalBalance.toFixed(2)} €
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {ownAccounts.length} compte{ownAccounts.length > 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>

      {/* Revenus et Dépenses */}
      <div className="flex gap-4 md:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex-1 min-w-0"
        >
          <Card className="border-green-100 w-full max-w-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-100 whitespace-nowrap">
                Revenus du mois
              </CardTitle>
              <ArrowUpCircle className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 whitespace-nowrap overflow-x-auto">
                +{totalMonthIncome.toFixed(2)} €
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {filteredTransactions.filter(t => t.type === 'income').length} transaction(s)
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex-1 min-w-0"
        >
          <Card className="border-red-100 w-full max-w-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-100 whitespace-nowrap">
                Dépenses du mois
              </CardTitle>
              <ArrowDownCircle className="w-5 h-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 whitespace-nowrap overflow-x-auto">
                -{totalMonthExpenses.toFixed(2)} €
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {filteredTransactions.filter(t => t.type === 'expense').length} transaction(s)
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Graphique et transactions récentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="border-2 border-slate-700/50 bg-gradient-to-br from-slate-800/95 to-slate-900/95 shadow-xl backdrop-blur-sm" data-tutorial="expense-chart">
            <CardHeader className="border-b border-slate-700/50">
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-white">
                <Calendar className="w-5 h-5 text-blue-400" />
                Top 5 catégories de dépenses
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        label={(props) => {
                          const item = pieData[props.index]
                          return item.icon
                        }}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                        contentStyle={{ backgroundColor: '#ffffffff', border: 'none', borderRadius: '8px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {pieData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs md:text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                          <span className="text-slate-300">{item.icon} {item.name}</span>
                        </div>
                        <span className="font-medium text-white">{item.value.toFixed(2)} €</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-center text-slate-400 py-12">
                  Aucune dépense ce mois-ci
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="border-2 border-slate-700/50 bg-gradient-to-br from-slate-800/95 to-slate-900/95 shadow-xl backdrop-blur-sm">
            <CardHeader className="border-b border-slate-700/50">
              <CardTitle className="text-lg font-bold text-white">Dernières transactions</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {recentTransactions.length > 0 ? (
                <div className="space-y-3">
                  {recentTransactions.map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between py-3 px-3 rounded-lg bg-slate-700/30 border border-slate-600/30 hover:bg-slate-700/50 transition-all">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-md"
                          style={{ backgroundColor: txn.category?.color + '30' }}
                        >
                          {txn.category?.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-white">{txn.category?.name}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(txn.date).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      <span className={`font-bold text-base ${txn.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                        {txn.type === 'income' ? '+' : '-'}{txn.amount.toFixed(2)} €
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-400 py-8">
                  Aucune transaction
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Visualisation par catégorie - Composant complet */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
      >
        <ExpenseChart />
      </motion.div>
    </div>
  )
}