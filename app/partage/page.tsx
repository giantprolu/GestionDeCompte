'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Wallet, TrendingDown, TrendingUp, Settings, ArrowUpCircle, ArrowDownCircle, Eye, Edit } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

interface Account {
  id: string
  name: string
  type: string
  currentBalance: number
  icon: string
  color: string
}

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
  account_name: string
  is_recurring: boolean
  category_icon?: string
}

interface DashboardData {
  ownerUserId: string
  ownerUsername: string
  permission: 'view' | 'edit'
  shareId: string
  accounts: Account[]
  transactions: Transaction[]
  totalBalance: number
  monthlyIncome: number
  monthlyExpense: number
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function PartagePage() {
  const [dashboards, setDashboards] = useState<DashboardData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboards()
  }, [])

  const fetchDashboards = async () => {
    try {
      const response = await fetch('/api/shared-dashboards')
      if (response.ok) {
        const data = await response.json()
        setDashboards(data)
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des dashboards:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl md:text-3xl font-bold">Dashboards Partagés</h1>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    )
  }

  if (dashboards.length === 0) {
    return (
      <div className="p-4 md:p-6 space-y-6 pb-20 md:pb-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <h1 className="text-2xl md:text-3xl font-bold">Dashboards Partagés</h1>
          <Link href="/partage/gerer">
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Gérer les partages
            </Button>
          </Link>
        </div>
        <Card className="border-dashed border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun dashboard partagé</h3>
            <p className="text-muted-foreground text-center max-w-md text-sm">
              Vous n'avez pas encore accès à des dashboards partagés. Demandez à quelqu'un de partager son dashboard avec vous.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboards Partagés</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {dashboards.length} dashboard{dashboards.length > 1 ? 's' : ''} partagé{dashboards.length > 1 ? 's' : ''} avec vous
          </p>
        </div>
        <Link href="/partage/gerer">
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Gérer
          </Button>
        </Link>
      </div>

      {dashboards.map((dashboard, dashIndex) => {
        // Préparer les données pour le graphique en secteurs (dépenses par catégorie du mois)
        const now = new Date()
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        
        const monthTransactions = dashboard.transactions.filter(txn => {
          const txnDate = new Date(txn.date)
          return txnDate >= firstDayOfMonth && txnDate <= now
        })

        const expensesByCategory = monthTransactions
          .filter(t => t.type === 'expense')
          .reduce((acc: Record<string, { amount: number, category: string, icon: string }>, txn) => {
            const catKey = txn.category || 'Autre'
            if (!acc[catKey]) {
              acc[catKey] = { amount: 0, category: catKey, icon: txn.category_icon || '📦' }
            }
            acc[catKey].amount += txn.amount
            return acc
          }, {})

        const pieData = Object.values(expensesByCategory)
          .map((item, idx) => ({
            name: item.category,
            value: parseFloat(item.amount.toFixed(2)),
            color: COLORS[idx % COLORS.length],
            icon: item.icon
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)

        // Préparer les données pour le graphique des dépenses (7 derniers jours)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = new Date()
          date.setDate(date.getDate() - (6 - i))
          return date.toISOString().split('T')[0]
        })

        const expensesByDay = last7Days.map(dateStr => {
          const dayTransactions = dashboard.transactions.filter(t => {
            return t.date.split('T')[0] === dateStr && t.type === 'expense'
          })
          return {
            date: new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short' }),
            amount: dayTransactions.reduce((sum, t) => sum + t.amount, 0)
          }
        })

        // Trouver les comptes spécifiques
        const boursoAccount = dashboard.accounts.find(acc => acc.type === 'ponctuel')
        const caisseAccount = dashboard.accounts.find(acc => acc.type === 'obligatoire')

        return (
          <motion.div
            key={dashboard.ownerUserId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: dashIndex * 0.1 }}
            className="space-y-6"
          >
            {/* Header du dashboard */}
            <Card className="border-2 border-purple-400/30 bg-gradient-to-br from-purple-900/20 to-slate-900 shadow-xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
                      <Wallet className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
                      Dashboard de {dashboard.ownerUsername}
                    </CardTitle>
                    <p className="text-xs md:text-sm text-muted-foreground mt-1 flex items-center gap-2">
                      {dashboard.permission === 'view' ? (
                        <>
                          <Eye className="w-3 h-3 md:w-4 md:h-4" />
                          Accès en lecture seule
                        </>
                      ) : (
                        <>
                          <Edit className="w-3 h-3 md:w-4 md:h-4" />
                          Accès complet
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Cards des comptes - Bourso et Caisse côte à côte sur mobile, Total seul */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dashIndex * 0.1 + 0.1 }}
              >
                <Card className="border-blue-400/30 bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl hover:shadow-2xl transition-all duration-300">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium text-slate-300">
                      Compte Bourso
                    </CardTitle>
                    <Wallet className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-3xl font-bold text-white">
                      {boursoAccount ? `${boursoAccount.currentBalance.toFixed(2)} €` : '0.00 €'}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Dépenses occasionnelles</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dashIndex * 0.1 + 0.2 }}
              >
                <Card className="border-green-400/30 bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl hover:shadow-2xl transition-all duration-300">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium text-slate-300">
                      Compte CEP
                    </CardTitle>
                    <Wallet className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-3xl font-bold text-white">
                      {caisseAccount ? `${caisseAccount.currentBalance.toFixed(2)} €` : '0.00 €'}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Dépenses obligatoires</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dashIndex * 0.1 + 0.3 }}
                className="col-span-2 lg:col-span-1"
              >
                <Card className="border-purple-400/30 bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl hover:shadow-2xl transition-all duration-300">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xs md:text-sm font-medium text-slate-300">
                      Total disponible
                    </CardTitle>
                    <Wallet className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl md:text-3xl font-bold text-purple-300">
                      {dashboard.totalBalance.toFixed(2)} €
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Tous les comptes</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Cards revenus et dépenses - côte à côte sur mobile */}
            <div className="grid grid-cols-2 gap-4 md:gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dashIndex * 0.1 + 0.4 }}
              >
                <Card className="border-green-500/30 bg-gradient-to-br from-green-900/20 to-slate-900 shadow-xl">
                  <CardHeader className="border-b border-green-700/50">
                    <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                      <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
                      Revenus du mois
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="text-2xl md:text-4xl font-bold text-green-400">
                      +{dashboard.monthlyIncome.toFixed(2)} €
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dashIndex * 0.1 + 0.5 }}
              >
                <Card className="border-red-500/30 bg-gradient-to-br from-red-900/20 to-slate-900 shadow-xl">
                  <CardHeader className="border-b border-red-700/50">
                    <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                      <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-red-400" />
                      Dépenses du mois
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="text-2xl md:text-4xl font-bold text-red-400">
                      -{dashboard.monthlyExpense.toFixed(2)} €
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Toutes les transactions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: dashIndex * 0.1 + 0.6 }}
            >
              <Card className="bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl">
                <CardHeader className="border-b border-slate-700/50">
                  <CardTitle className="text-sm md:text-base">Toutes les transactions</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {dashboard.transactions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8 text-sm">Aucune transaction</p>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {dashboard.transactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between py-3 px-3 rounded-lg bg-slate-700/30 border border-slate-600/30 hover:bg-slate-700/50 transition-all"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-md flex-shrink-0"
                              style={{ backgroundColor: (transaction.category_icon ? '#3b82f6' : '#6b7280') + '30' }}
                            >
                              {transaction.category_icon || '📦'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-white truncate">{transaction.description}</p>
                              <div className="flex flex-wrap items-center gap-1 md:gap-2 text-xs text-slate-400 mt-1">
                                <span className="truncate">{transaction.category}</span>
                                <span className="hidden md:inline">•</span>
                                <span className="truncate">{transaction.account_name}</span>
                                <span className="hidden sm:inline">•</span>
                                <span className="whitespace-nowrap">{new Date(transaction.date).toLocaleDateString('fr-FR')}</span>
                                {transaction.is_recurring && (
                                  <>
                                    <span className="hidden sm:inline">•</span>
                                    <span className="text-blue-400 whitespace-nowrap">↻ Récurrent</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right ml-3 flex-shrink-0">
                            <p className={`font-bold text-sm md:text-base ${transaction.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                              {transaction.type === 'income' ? '+' : '-'}{Math.abs(transaction.amount).toFixed(2)} €
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Graphiques */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {/* Répartition des dépenses par catégorie */}
              {pieData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: dashIndex * 0.1 + 0.7 }}
                >
                  <Card className="bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl">
                    <CardHeader className="border-b border-slate-700/50">
                      <CardTitle className="text-sm md:text-base">Dépenses par catégorie</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ResponsiveContainer width="100%" height={200} className="md:hidden">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                            label={(props) => {
                              const data = pieData[props.index]
                              return data.icon
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
                      <ResponsiveContainer width="100%" height={250} className="hidden md:block">
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
                              const data = pieData[props.index]
                              return data.icon
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
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Évolution des dépenses */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dashIndex * 0.1 + 0.8 }}
              >
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl">
                  <CardHeader className="border-b border-slate-700/50">
                    <CardTitle className="text-sm md:text-base">Dépenses (7 derniers jours)</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <ResponsiveContainer width="100%" height={200} className="md:hidden">
                      <LineChart data={expensesByDay}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#9ca3af" 
                          style={{ fontSize: '10px' }}
                        />
                        <YAxis 
                          stroke="#9ca3af" 
                          style={{ fontSize: '10px' }}
                          width={40}
                        />
                        <Tooltip
                          formatter={(value: number) => value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                        />
                        <Line type="monotone" dataKey="amount" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                    <ResponsiveContainer width="100%" height={250} className="hidden md:block">
                      <LineChart data={expensesByDay}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#9ca3af" 
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis 
                          stroke="#9ca3af" 
                          style={{ fontSize: '12px' }}
                        />
                        <Tooltip
                          formatter={(value: number) => value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                        />
                        <Line type="monotone" dataKey="amount" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
