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

export default function Home() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const { userType, isLoading: isLoadingSettings } = useUserSettings()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // Rediriger les visionneurs vers la page partage
  useEffect(() => {
    if (!isLoadingSettings && userType === 'viewer') {
      router.replace('/partage')
    }
  }, [userType, isLoadingSettings, router])

  // Générer la liste des mois disponibles à partir des transactions
  const allMonths = Array.from(new Set(transactions.map(txn => {
    const d = new Date(txn.date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }))).sort().reverse()

  // Utiliser le hook partagé pour le mois sélectionné
  const { selectedMonth, toggleMonth, isCurrentMonth } = useSelectedMonth()

  // Filtrer les transactions selon la période de clôture du mois sélectionné
  const [monthClosure, setMonthClosureState] = useState<{ start_date: string, end_date: string } | null>(null)

  // Mois courant
  const currentMonth = getCurrentMonth()

  useEffect(() => {
    async function fetchClosure() {
      // Récupérer l'utilisateur courant
      const userId = accounts.find(acc => acc.ownerUserId)?.ownerUserId
      if (!userId) return
      
      // Ne chercher la clôture que pour les mois passés
      if (selectedMonth !== currentMonth) {
        const closure = await getMonthClosure(userId, selectedMonth)
        setMonthClosureState(closure)
      } else {
        setMonthClosureState(null)
      }
    }
    fetchClosure()
  }, [selectedMonth, accounts, currentMonth])

  // Filtrer les transactions selon le mois sélectionné
  const monthTransactions = (() => {
    const today = new Date().toISOString().split('T')[0] // Date d'aujourd'hui au format YYYY-MM-DD
    
    // Pour le mois courant : transactions NON archivées ET pas dans le futur
    if (selectedMonth === currentMonth) {
      return transactions.filter(txn => !txn.archived && txn.date <= today)
    }
    
    // Pour les mois passés avec une période de clôture
    if (monthClosure) {
      return transactions.filter(txn => 
        txn.date >= monthClosure.start_date && 
        txn.date <= monthClosure.end_date &&
        txn.archived === true
      )
    }
    
    // Fallback : transactions archivées du mois sélectionné
    return transactions.filter(txn => {
      const txnMonth = txn.date ? txn.date.substring(0, 7) : ''
      return txnMonth === selectedMonth && txn.archived === true
    })
  })()

  // Reset des indicateurs selon le mois sélectionné
  const totalMonthIncome = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const totalMonthExpenses = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const expensesByCategory = monthTransactions.filter(t => t.type === 'expense').reduce((acc: Record<string, { amount: number, category: Category }>, txn) => {
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
  const recentTransactions = [...monthTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5)

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchData()
    } else if (isLoaded && !isSignedIn) {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn])

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
  // Utiliser le nom du compte pour éviter les confusions (Bourso vs Carte Restaurant)
  const boursoAccount = accounts.find(acc => acc.name.toLowerCase().includes('bourso') && acc.isOwner !== false)
  const caisseAccount = accounts.find(acc => (acc.name.toLowerCase().includes('caisse') || acc.type === 'obligatoire') && acc.isOwner !== false)

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
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8">
      {/* Sélecteur de période modernisé */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-sm font-medium text-slate-300">Période</span>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
          {allMonths.map((month, idx) => {
            const isSelected = month === selectedMonth
            const isCurrent = month === currentMonth
            const monthDate = new Date(month + '-01')
            const monthName = monthDate.toLocaleString('fr-FR', { month: 'short' })
            const year = monthDate.getFullYear()
            
            return (
              <motion.button
                key={month}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => toggleMonth(month)}
                className={`relative flex flex-col items-center min-w-[70px] px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  isSelected 
                    ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25 scale-105' 
                    : 'bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/50 hover:border-slate-600'
                }`}
              >
                {isCurrent && (
                  <span className={`absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full ${
                    isSelected ? 'bg-green-400' : 'bg-green-500'
                  } ring-2 ring-slate-900`} />
                )}
                <span className="text-xs font-medium uppercase tracking-wide opacity-70">
                  {year}
                </span>
                <span className="text-sm font-bold capitalize">
                  {monthName}
                </span>
              </motion.button>
            )
          })}
        </div>
        
        {!isCurrentMonth && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg"
          >
            <Calendar className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-300">
              Données archivées de <span className="font-semibold">{new Date(selectedMonth + '-01').toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}</span>
              <span className="text-amber-400/70 ml-1">• Cliquez à nouveau pour revenir au mois actuel</span>
            </p>
          </motion.div>
        )}
      </motion.div>
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
            Débit d’un nouveau mois
          </Button>
          <Link href="/transactions">
            <Button className="w-full md:w-auto bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 px-6 py-6 text-base">
              <TrendingUp className="w-5 h-5 mr-2" />
              Voir les transactions
            </Button>
          </Link>
        </div>
      </div>
      {/* Cards des comptes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-blue-400/30 bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Compte Bourso
              </CardTitle>
              <Wallet className="w-5 h-5 text-blue-400" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl md:text-3xl font-bold text-white">
                  {boursoAccount ? `${getInitialBalance(boursoAccount.id).toFixed(2)} €` : '0.00 €'}
                </div>
              <p className="text-xs text-slate-400 mt-1">Dépenses occasionnelles</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-green-400/30 bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Compte Caisse EP
              </CardTitle>
              <Wallet className="w-5 h-5 text-green-400" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl md:text-3xl font-bold text-white">
                  {caisseAccount ? `${getInitialBalance(caisseAccount.id).toFixed(2)} €` : '0.00 €'}
                </div>
              <p className="text-xs text-slate-400 mt-1">Dépenses obligatoires</p>
            </CardContent>
          </Card>
        </motion.div>
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
              <p className="text-xs text-slate-400 mt-1">Tous les comptes</p>
            </CardContent>
          </Card>
        </motion.div>
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
                {monthTransactions.filter(t => t.type === 'income').length} transaction(s)
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
                {monthTransactions.filter(t => t.type === 'expense').length} transaction(s)
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
          <Card className="border-2 border-slate-700/50 bg-gradient-to-br from-slate-800/95 to-slate-900/95 shadow-xl backdrop-blur-sm">
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
    </div>
  )
}