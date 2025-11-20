'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Wallet, TrendingDown, TrendingUp, Calendar, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

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
}

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [accountsRes, transactionsRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/expenses'),
      ])
      
      const accountsData = await accountsRes.json()
      const transactionsData = await transactionsRes.json()
      
      setAccounts(accountsData)
      setTransactions(transactionsData)
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calcul des transactions du mois en cours
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  
  const monthTransactions = transactions.filter(txn => {
    const txnDate = new Date(txn.date)
    return txnDate >= firstDayOfMonth
  })

  const totalMonthIncome = monthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalMonthExpenses = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const monthBalance = totalMonthIncome - totalMonthExpenses

  // Données pour le graphique des dépenses par catégorie
  const expensesByCategory = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc: Record<string, { amount: number, category: Category }>, txn) => {
      if (!acc[txn.categoryId]) {
        acc[txn.categoryId] = { amount: 0, category: txn.category }
      }
      acc[txn.categoryId].amount += txn.amount
      return acc
    }, {})

  const pieData = Object.values(expensesByCategory)
    .map(item => ({
      name: item.category.name,
      value: parseFloat(item.amount.toFixed(2)),
      color: item.category.color,
      icon: item.category.icon
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5) // Top 5 catégories

  // Dernières transactions
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  const boursoAccount = accounts.find(acc => acc.type === 'ponctuel' && acc.isOwner !== false)
  const caisseAccount = accounts.find(acc => acc.type === 'obligatoire' && acc.isOwner !== false)
  
  // Calculer le total uniquement des comptes propres (pas les partagés)
  const ownAccounts = accounts.filter(acc => acc.isOwner !== false)
  const totalBalance = ownAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0)

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">Tableau de bord</h1>
          <p className="text-slate-200 mt-2 text-base md:text-lg font-medium">Vue d'ensemble de vos finances</p>
        </div>
        <Link href="/transactions">
          <Button className="w-full md:w-auto bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 px-6 py-6 text-base">
            <TrendingUp className="w-5 h-5 mr-2" />
            Voir les transactions
          </Button>
        </Link>
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
                {boursoAccount ? `${boursoAccount.currentBalance.toFixed(2)} €` : '0.00 €'}
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
                {caisseAccount ? `${caisseAccount.currentBalance.toFixed(2)} €` : '0.00 €'}
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
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-green-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Revenus du mois
              </CardTitle>
              <ArrowUpCircle className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                +{totalMonthIncome.toFixed(2)} €
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {monthTransactions.filter(t => t.type === 'income').length} transaction(s)
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="border-red-100">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Dépenses du mois
              </CardTitle>
              <ArrowDownCircle className="w-5 h-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                -{totalMonthExpenses.toFixed(2)} €
              </div>
              <p className="text-xs text-slate-500 mt-1">
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
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props) => {
                        const item = pieData[props.index]
                        return `${item.icon} ${props.value}€`
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value.toFixed(2)} €`} />
                  </PieChart>
                </ResponsiveContainer>
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
