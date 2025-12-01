'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Wallet, TrendingDown, TrendingUp, Settings, Eye, Edit, Filter, X, Search, Calculator, Target, CreditCard, CircleDollarSign } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'

interface Account {
  id: string
  name: string
  type: string
  currentBalance: number
  initialBalance?: number
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
  note?: string | null
  is_recurring: boolean
  category_icon?: string
  archived?: boolean
}

interface MonthClosure {
  month_year: string
  start_date: string
  end_date: string
}

interface CreditEntry {
  id: string
  title: string
  principal: number
  outstanding: number
  note?: string
  start_date: string
}

interface DashboardData {
  ownerUserId: string
  ownerUsername: string
  permission: 'view' | 'edit'
  shareId: string
  accounts: Account[]
  transactions: Transaction[]
  credits: CreditEntry[]
  totalBalance: number
  monthlyIncome: number
  monthlyExpense: number
  monthClosures?: MonthClosure[]
  currentMonthStart?: string
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

interface PrevisionnelData {
  totals: { category: string; total: number; avgPerMonth: number }[]
  targets: Record<string, number>
}

export default function PartagePage() {
  const { isSignedIn, isLoaded } = useUser()
  const [dashboards, setDashboards] = useState<DashboardData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({})
  
  // Filtres pour les transactions
  const [filters, setFilters] = useState<Record<string, {
    search: string
    category: string
    type: string
    account: string
    showFilters: boolean
  }>>({})

  // Sélection du mois par dashboard
  const [selectedMonths, setSelectedMonths] = useState<Record<string, string>>({})
  
  // Mode d'affichage du graphique (7jours, mois, année)
  const [chartMode, setChartMode] = useState<Record<string, 'week' | 'month' | 'year'>>({})
  
  // Vue active par dashboard (transactions ou previsionnel)
  const [activeView, setActiveView] = useState<Record<string, 'transactions' | 'previsionnel' | 'credits'>>({})
  
  // Données prévisionnelles par dashboard
  const [previsionnelData, setPrevisionnelData] = useState<Record<string, PrevisionnelData>>({})
  const [previsionnelLoading, setPrevisionnelLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchDashboards()
    } else if (isLoaded && !isSignedIn) {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn])

  const fetchDashboards = async () => {
    try {
      const response = await fetch('/api/shared-dashboards')
      if (response.ok) {
        const data = await response.json()
        setDashboards(data)
        
        // Initialiser les filtres et mois sélectionnés pour chaque dashboard
        const initialFilters: Record<string, { search: string; category: string; type: string; account: string; showFilters: boolean }> = {}
        const initialMonths: Record<string, string> = {}
        const initialChartModes: Record<string, 'week' | 'month' | 'year'> = {}
        
        data.forEach((d: DashboardData) => {
          initialFilters[d.ownerUserId] = {
            search: '',
            category: '',
            type: '',
            account: '',
            showFilters: false
          }
          initialMonths[d.ownerUserId] = 'current'
          initialChartModes[d.ownerUserId] = 'month'
        })
        
        setFilters(initialFilters)
        setSelectedMonths(initialMonths)
        setChartMode(initialChartModes)
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des dashboards:', error)
    } finally {
      setLoading(false)
    }
  }

  // Charger les données prévisionnelles pour un dashboard
  const fetchPrevisionnel = async (ownerUserId: string, selectedMonth: string) => {
    setPrevisionnelLoading(prev => ({ ...prev, [ownerUserId]: true }))
    try {
      const monthParam = selectedMonth === 'current' ? '' : `&selectedMonth=${selectedMonth}`
      const res = await fetch(`/api/shared-dashboards/previsionnel?ownerUserId=${ownerUserId}${monthParam}`)
      if (res.ok) {
        const data = await res.json()
        setPrevisionnelData(prev => ({
          ...prev,
          [ownerUserId]: {
            totals: data.totals || [],
            targets: data.targets || {} // Utiliser les objectifs du propriétaire
          }
        }))
      }
    } catch (error) {
      console.error('Erreur lors du chargement du prévisionnel:', error)
    } finally {
      setPrevisionnelLoading(prev => ({ ...prev, [ownerUserId]: false }))
    }
  }

  // Mettre à jour un objectif de dépenses
  const updateTarget = async (ownerUserId: string, category: string, value: number) => {
    const newTargets = {
      ...previsionnelData[ownerUserId]?.targets,
      [category]: value
    }
    
    setPrevisionnelData(prev => ({
      ...prev,
      [ownerUserId]: {
        ...prev[ownerUserId],
        targets: newTargets
      }
    }))

    // Sauvegarder sur le serveur
    try {
      await fetch('/api/shared-dashboards/previsionnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerUserId, targets: newTargets })
      })
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des objectifs:', error)
    }
  }

  // Fonction pour obtenir les transactions filtrées par mois (selon les clôtures)
  const getFilteredTransactionsByMonth = (dashboard: DashboardData, monthKey: string) => {
    if (monthKey === 'current') {
      // Mois actuel : transactions non archivées après la date de début
      if (dashboard.currentMonthStart) {
        return dashboard.transactions.filter(t => 
          !t.archived && t.date >= dashboard.currentMonthStart!
        )
      }
      return dashboard.transactions.filter(t => !t.archived)
    }
    
    // Mois clôturé spécifique
    const closure = dashboard.monthClosures?.find(c => c.month_year === monthKey)
    if (closure) {
      return dashboard.transactions.filter(t => 
        t.date >= closure.start_date && t.date <= closure.end_date
      )
    }
    
    return []
  }

  // Obtenir les mois disponibles (clôturés + actuel)
  const getAvailableMonths = (dashboard: DashboardData) => {
    const months: { key: string; label: string }[] = [
      { key: 'current', label: 'Mois actuel' }
    ]
    
    dashboard.monthClosures?.forEach(closure => {
      const date = new Date(closure.start_date)
      months.push({
        key: closure.month_year,
        label: date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
      })
    })
    
    return months
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
              Vous n&apos;avez pas encore accès à des dashboards partagés. Demandez à quelqu&apos;un de partager son dashboard avec vous.
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
        const currentFilter = filters[dashboard.ownerUserId] || { search: '', category: '', type: '', account: '', showFilters: false }
        const selectedMonth = selectedMonths[dashboard.ownerUserId] || 'current'
        const currentChartMode = chartMode[dashboard.ownerUserId] || 'month'
        
        // Transactions filtrées par mois (selon clôtures)
        const monthTransactions = getFilteredTransactionsByMonth(dashboard, selectedMonth)
        
        // Calculer revenus et dépenses du mois sélectionné
        const monthlyIncome = monthTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0)
        
        const monthlyExpense = monthTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0)

        // Préparer les données pour le graphique en secteurs (dépenses par catégorie)
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

        // Préparer les données pour le graphique des dépenses selon le mode
        const getChartData = () => {
          if (currentChartMode === 'week') {
            // Mode semaine : afficher les 7 derniers jours des transactions du mois
            const last7Days = Array.from({ length: 7 }, (_, i) => {
              const date = new Date()
              date.setDate(date.getDate() - (6 - i))
              return date.toISOString().split('T')[0]
            })
            return last7Days.map(dateStr => {
              // Utiliser TOUTES les dépenses du jour, pas seulement celles du mois sélectionné
              const dayTransactions = dashboard.transactions.filter(t => 
                t.date.split('T')[0] === dateStr && t.type === 'expense'
              )
              return {
                label: new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short' }),
                amount: dayTransactions.reduce((sum, t) => sum + t.amount, 0)
              }
            })
          } else if (currentChartMode === 'month') {
            // Diviser la période en 4 semaines de 7 jours basées sur la date de début
            let periodStart: Date
            
            if (selectedMonth === 'current') {
              // Mois actuel : utiliser currentMonthStart ou le 1er du mois
              if (dashboard.currentMonthStart) {
                periodStart = new Date(dashboard.currentMonthStart)
              } else {
                const now = new Date()
                periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
              }
            } else {
              // Mois clôturé : utiliser la date de début de la clôture
              const closure = dashboard.monthClosures?.find(c => c.month_year === selectedMonth)
              if (closure) {
                periodStart = new Date(closure.start_date)
              } else {
                const selectedMonthDate = new Date(selectedMonth + '-01')
                periodStart = selectedMonthDate
              }
            }
            
            // Créer 4 semaines de 7 jours chacune à partir de la date de début
            const weeks: { label: string; amount: number; startDate: Date; endDate: Date }[] = []
            
            for (let i = 0; i < 4; i++) {
              const startDate = new Date(periodStart)
              startDate.setDate(periodStart.getDate() + (i * 7))
              
              const endDate = new Date(startDate)
              endDate.setDate(startDate.getDate() + 6)
              endDate.setHours(23, 59, 59, 999)
              
              weeks.push({
                label: `Sem. ${i + 1}`,
                amount: 0,
                startDate,
                endDate
              })
            }
            
            // Répartir les transactions dans les semaines
            monthTransactions
              .filter(t => t.type === 'expense')
              .forEach(t => {
                const txDate = new Date(t.date)
                // Calculer le nombre de jours depuis le début de la période
                const daysSinceStart = Math.floor((txDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
                const weekIndex = Math.floor(daysSinceStart / 7)
                
                if (weekIndex >= 0 && weekIndex < 4) {
                  weeks[weekIndex].amount += t.amount
                } else if (weekIndex >= 4) {
                  // Au-delà de 4 semaines, mettre dans la semaine 4
                  weeks[3].amount += t.amount
                }
              })
            
            return weeks.map(w => ({ label: w.label, amount: w.amount }))
          } else {
            // Mode année : utiliser les clôtures de mois pour grouper les dépenses
            const monthsData: Record<string, number> = {}
            
            // D'abord, calculer les dépenses pour chaque mois clôturé
            dashboard.monthClosures?.forEach(closure => {
              const closureTransactions = dashboard.transactions.filter(t => 
                t.type === 'expense' && 
                t.date >= closure.start_date && 
                t.date <= closure.end_date
              )
              monthsData[closure.month_year] = closureTransactions.reduce((sum, t) => sum + t.amount, 0)
            })
            
            // Ajouter le mois courant (transactions non archivées)
            const currentMonthTransactions = dashboard.transactions.filter(t => 
              t.type === 'expense' && !t.archived
            )
            if (currentMonthTransactions.length > 0) {
              const now = new Date()
              const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
              monthsData[currentKey] = currentMonthTransactions.reduce((sum, t) => sum + t.amount, 0)
            }
            
            return Object.entries(monthsData)
              .sort(([a], [b]) => a.localeCompare(b))
              .slice(-12)
              .map(([key, amount]) => ({
                label: new Date(key + '-01').toLocaleDateString('fr-FR', { month: 'short' }),
                amount
              }))
          }
        }
        
        const chartData = getChartData()

        // Extraire les catégories et comptes uniques pour les filtres
        const categories = [...new Set(monthTransactions.map(t => t.category))].filter(Boolean)
        const accountNames = [...new Set(monthTransactions.map(t => t.account_name))].filter(Boolean)

        // Filtrer les transactions
        const filteredTransactions = monthTransactions.filter(txn => {
          if (currentFilter.search && !txn.category.toLowerCase().includes(currentFilter.search.toLowerCase()) && 
              !(txn.note?.toLowerCase().includes(currentFilter.search.toLowerCase())) &&
              !(txn.description?.toLowerCase().includes(currentFilter.search.toLowerCase()))) {
            return false
          }
          if (currentFilter.category && txn.category !== currentFilter.category) return false
          if (currentFilter.type && txn.type !== currentFilter.type) return false
          if (currentFilter.account && txn.account_name !== currentFilter.account) return false
          return true
        })

        // Mois disponibles
        const availableMonths = getAvailableMonths(dashboard)
        
        // Vue active pour ce dashboard
        const currentView = activeView[dashboard.ownerUserId] || 'transactions'
        
        // Données prévisionnelles pour ce dashboard
        const dashPrevisionnel = previsionnelData[dashboard.ownerUserId]
        const isPrevLoading = previsionnelLoading[dashboard.ownerUserId]

        return (
          <motion.div
            key={dashboard.ownerUserId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: dashIndex * 0.1 }}
            className="space-y-4 md:space-y-6"
          >
            {/* Header du dashboard */}
            <Card className="border-2 border-purple-400/30 bg-gradient-to-br from-purple-900/20 to-slate-900 shadow-xl">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg md:text-xl flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-purple-400" />
                      {dashboard.ownerUsername}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      {dashboard.permission === 'view' ? (
                        <><Eye className="w-3 h-3" /> Lecture seule</>
                      ) : (
                        <><Edit className="w-3 h-3" /> Édition</>
                      )}
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {/* Onglets Transactions / Prévisionnel / Crédits */}
                    <div className="flex gap-1 flex-wrap">
                      <Button
                        size="sm"
                        variant={currentView === 'transactions' ? 'default' : 'outline'}
                        className={`text-xs px-3 py-1 h-7 ${currentView === 'transactions' ? 'bg-purple-600' : ''}`}
                        onClick={() => setActiveView(prev => ({ ...prev, [dashboard.ownerUserId]: 'transactions' }))}
                      >
                        <TrendingDown className="w-3 h-3 mr-1" />
                        Transactions
                      </Button>
                      <Button
                        size="sm"
                        variant={currentView === 'previsionnel' ? 'default' : 'outline'}
                        className={`text-xs px-3 py-1 h-7 ${currentView === 'previsionnel' ? 'bg-purple-600' : ''}`}
                        onClick={() => {
                          setActiveView(prev => ({ ...prev, [dashboard.ownerUserId]: 'previsionnel' }))
                          // Charger le prévisionnel si pas encore fait
                          if (!dashPrevisionnel) {
                            fetchPrevisionnel(dashboard.ownerUserId, selectedMonth)
                          }
                        }}
                      >
                        <Calculator className="w-3 h-3 mr-1" />
                        Prévisionnel
                      </Button>
                      <Button
                        size="sm"
                        variant={currentView === 'credits' ? 'default' : 'outline'}
                        className={`text-xs px-3 py-1 h-7 ${currentView === 'credits' ? 'bg-purple-600' : ''}`}
                        onClick={() => setActiveView(prev => ({ ...prev, [dashboard.ownerUserId]: 'credits' }))}
                      >
                        <CreditCard className="w-3 h-3 mr-1" />
                        Crédits
                      </Button>
                    </div>
                    
                    {/* Sélecteur de mois */}
                    <div className="flex flex-wrap gap-1.5">
                      {availableMonths.map(month => (
                        <Button
                          key={month.key}
                          size="sm"
                          variant={selectedMonth === month.key ? 'default' : 'outline'}
                          className={`text-xs px-2 py-1 h-7 ${selectedMonth === month.key ? 'bg-purple-600' : ''}`}
                          onClick={() => {
                            setSelectedMonths(prev => ({ ...prev, [dashboard.ownerUserId]: month.key }))
                            // Recharger le prévisionnel si on est sur cette vue
                            if (currentView === 'previsionnel') {
                              fetchPrevisionnel(dashboard.ownerUserId, month.key)
                            }
                          }}
                        >
                          {month.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Onglets des comptes - Compacts avec hover */}
            <div className="flex flex-wrap gap-2">
              {dashboard.accounts.map((account, idx) => {
                const balance = account.initialBalance ?? account.currentBalance
                const isPositive = balance >= 0
                const isAccountExpanded = expandedAccounts[`${dashboard.ownerUserId}-${account.id}`]
                
                return (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    className="group relative"
                    onMouseEnter={() => setExpandedAccounts(prev => ({ ...prev, [`${dashboard.ownerUserId}-${account.id}`]: true }))}
                    onMouseLeave={() => setExpandedAccounts(prev => ({ ...prev, [`${dashboard.ownerUserId}-${account.id}`]: false }))}
                    onClick={() => setExpandedAccounts(prev => ({ ...prev, [`${dashboard.ownerUserId}-${account.id}`]: !prev[`${dashboard.ownerUserId}-${account.id}`] }))}
                  >
                    <div className={`
                      cursor-pointer transition-all duration-300 rounded-lg border-2 overflow-hidden
                      ${isPositive 
                        ? 'border-green-500/50 bg-gradient-to-r from-green-900/30 to-green-800/20' 
                        : 'border-red-500/50 bg-gradient-to-r from-red-900/30 to-red-800/20'
                      }
                      ${isAccountExpanded ? 'shadow-lg scale-105' : 'hover:shadow-md hover:scale-102'}
                    `}>
                      <div className={`flex items-center gap-2 px-3 py-2 ${isAccountExpanded ? 'flex-col items-start' : ''}`}>
                        <div className={`flex items-center gap-2 ${isAccountExpanded ? 'w-full justify-between' : ''}`}>
                          <span className={`text-[11px] md:text-xs font-medium ${isPositive ? 'text-green-300' : 'text-red-300'}`}>
                            {account.name}
                          </span>
                          <div className={`w-2 h-2 rounded-full ${isPositive ? 'bg-green-400' : 'bg-red-400'}`} />
                        </div>
                        <span className={`font-bold ${isAccountExpanded ? 'text-lg md:text-xl' : 'text-xs md:text-sm'} ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                          {balance.toFixed(2)} €
                        </span>
                        {isAccountExpanded && (
                          <motion.p 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="text-[10px] text-slate-400 mt-1"
                          >
                            {account.type === 'ponctuel' ? 'Dépenses occasionnelles' : account.type === 'obligatoire' ? 'Dépenses obligatoires' : 'Compte'}
                          </motion.p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
              
              {/* Total - Onglet spécial */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group relative"
              >
                <div className={`
                  transition-all duration-300 rounded-lg border-2 overflow-hidden
                  ${dashboard.totalBalance >= 0 
                    ? 'border-purple-500/50 bg-gradient-to-r from-purple-900/30 to-purple-800/20' 
                    : 'border-orange-500/50 bg-gradient-to-r from-orange-900/30 to-orange-800/20'
                  }
                `}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Wallet className="w-3 h-3 text-purple-400" />
                    <span className="text-[11px] md:text-xs font-medium text-purple-300">Total</span>
                    <span className="text-sm md:text-base font-bold text-purple-400">
                      {dashboard.totalBalance.toFixed(2)} €
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Revenus et Dépenses du mois */}
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <Card className="border-green-500/30 bg-gradient-to-br from-green-900/20 to-slate-900">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="flex items-center gap-1.5 text-xs md:text-sm">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    Revenus
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-xl md:text-2xl font-bold text-green-400">
                    +{monthlyIncome.toFixed(2)} €
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-500/30 bg-gradient-to-br from-red-900/20 to-slate-900">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="flex items-center gap-1.5 text-xs md:text-sm">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    Dépenses
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="text-xl md:text-2xl font-bold text-red-400">
                    -{monthlyExpense.toFixed(2)} €
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Section Prévisionnel */}
            {currentView === 'previsionnel' && (
              <Card className="bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl">
                <CardHeader className="border-b border-slate-700/50 pb-3">
                  <CardTitle className="text-base md:text-lg flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-purple-400" />
                    Prévisionnel par catégorie
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Définissez des objectifs de dépenses pour chaque catégorie
                  </p>
                </CardHeader>
                <CardContent className="pt-4">
                  {isPrevLoading ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Chargement...</p>
                    </div>
                  ) : dashPrevisionnel?.totals && dashPrevisionnel.totals.length > 0 ? (
                    <div className="space-y-3">
                      {dashPrevisionnel.totals.map((item, idx) => {
                        const target = dashPrevisionnel.targets?.[item.category] || 0
                        const progress = target > 0 ? Math.min((item.total / target) * 100, 100) : 0
                        const isOverBudget = target > 0 && item.total > target
                        
                        return (
                          <div key={idx} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-slate-200">{item.category}</span>
                              <span className={`text-sm font-bold ${isOverBudget ? 'text-red-400' : 'text-slate-300'}`}>
                                {item.total.toFixed(2)} €
                              </span>
                            </div>
                            
                            {/* Barre de progression */}
                            {target > 0 && (
                              <div className="mb-2">
                                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-300 rounded-full ${
                                      isOverBudget ? 'bg-red-500' : progress > 80 ? 'bg-orange-500' : 'bg-green-500'
                                    }`}
                                    style={{ width: `${Math.min(progress, 100)}%` }}
                                  />
                                </div>
                                <p className={`text-[10px] mt-1 ${isOverBudget ? 'text-red-400' : 'text-slate-400'}`}>
                                  {isOverBudget 
                                    ? `Dépassé de ${(item.total - target).toFixed(2)} €`
                                    : `${progress.toFixed(0)}% de l'objectif`
                                  }
                                </p>
                              </div>
                            )}
                            
                            {/* Input objectif */}
                            <div className="flex items-center gap-2">
                              <Target className="w-3 h-3 text-purple-400" />
                              <span className="text-xs text-slate-400">Objectif:</span>
                              <Input
                                type="number"
                                value={target || ''}
                                onChange={(e) => updateTarget(dashboard.ownerUserId, item.category, Number(e.target.value))}
                                placeholder="0"
                                className="h-7 w-24 text-xs bg-slate-900/50 border-slate-600"
                              />
                              <span className="text-xs text-slate-400">€</span>
                            </div>
                          </div>
                        )
                      })}
                      
                      {/* Total */}
                      <div className="p-3 rounded-lg bg-purple-900/30 border border-purple-500/30 mt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-purple-300">Total dépenses</span>
                          <span className="text-lg font-bold text-purple-400">
                            {dashPrevisionnel.totals.reduce((sum, t) => sum + t.total, 0).toFixed(2)} €
                          </span>
                        </div>
                        {Object.keys(dashPrevisionnel.targets || {}).length > 0 && (
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-purple-300/70">Total objectifs</span>
                            <span className="text-sm font-medium text-purple-300">
                              {Object.values(dashPrevisionnel.targets || {}).reduce((sum, t) => sum + (t || 0), 0).toFixed(2)} €
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground text-sm">Aucune dépense pour cette période</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Section Crédits */}
            {currentView === 'credits' && (
              <Card className="bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl">
                <CardHeader className="border-b border-slate-700/50 pb-3">
                  <CardTitle className="text-base md:text-lg flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-orange-400" />
                    Suivi des Crédits
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Crédits et emprunts en cours
                  </p>
                </CardHeader>
                <CardContent className="pt-4">
                  {dashboard.credits && dashboard.credits.length > 0 ? (
                    <div className="space-y-3">
                      {/* Résumé des crédits */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="p-3 rounded-lg bg-orange-900/20 border border-orange-500/30">
                          <p className="text-[10px] text-orange-300/70 uppercase tracking-wide">Total emprunté</p>
                          <p className="text-lg font-bold text-orange-400">
                            {dashboard.credits.reduce((sum, c) => sum + c.principal, 0).toFixed(2)} €
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-green-900/20 border border-green-500/30">
                          <p className="text-[10px] text-green-300/70 uppercase tracking-wide">Remboursé</p>
                          <p className="text-lg font-bold text-green-400">
                            {dashboard.credits.reduce((sum, c) => sum + (c.principal - c.outstanding), 0).toFixed(2)} €
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30">
                          <p className="text-[10px] text-red-300/70 uppercase tracking-wide">Restant dû</p>
                          <p className="text-lg font-bold text-red-400">
                            {dashboard.credits.reduce((sum, c) => sum + c.outstanding, 0).toFixed(2)} €
                          </p>
                        </div>
                      </div>
                      
                      {/* Barre de progression globale */}
                      {(() => {
                        const totalPrincipal = dashboard.credits.reduce((sum, c) => sum + c.principal, 0)
                        const totalOutstanding = dashboard.credits.reduce((sum, c) => sum + c.outstanding, 0)
                        const globalProgress = totalPrincipal > 0 ? ((totalPrincipal - totalOutstanding) / totalPrincipal) * 100 : 0
                        
                        return (
                          <div className="mb-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-slate-400">Progression globale</span>
                              <span className="text-sm font-semibold text-white">{globalProgress.toFixed(0)}%</span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-orange-500 to-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${globalProgress}%` }}
                              />
                            </div>
                          </div>
                        )
                      })()}
                      
                      {/* Liste des crédits */}
                      <div className="space-y-2">
                        {dashboard.credits.map((credit) => {
                          const progress = credit.principal > 0 ? ((credit.principal - credit.outstanding) / credit.principal) * 100 : 0
                          const isFullyPaid = credit.outstanding <= 0
                          
                          return (
                            <div 
                              key={credit.id} 
                              className={`p-3 rounded-lg border transition-all ${
                                isFullyPaid 
                                  ? 'bg-green-900/20 border-green-500/30' 
                                  : 'bg-slate-800/50 border-slate-700/50'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <CircleDollarSign className={`w-4 h-4 ${isFullyPaid ? 'text-green-400' : 'text-orange-400'}`} />
                                  <span className="text-sm font-medium text-white">{credit.title}</span>
                                  {isFullyPaid && (
                                    <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded-full">
                                      Remboursé
                                    </span>
                                  )}
                                </div>
                                <span className={`text-sm font-bold ${isFullyPaid ? 'text-green-400' : 'text-white'}`}>
                                  {credit.principal.toFixed(2)} €
                                </span>
                              </div>
                              
                              {/* Barre de progression */}
                              <div className="mb-2">
                                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      isFullyPaid ? 'bg-green-500' : progress > 50 ? 'bg-orange-400' : 'bg-orange-500'
                                    }`}
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">
                                  Restant: <span className={isFullyPaid ? 'text-green-400' : 'text-red-400'}>{credit.outstanding.toFixed(2)} €</span>
                                </span>
                                <span className="text-slate-500">
                                  {new Date(credit.start_date).toLocaleDateString('fr-FR')}
                                </span>
                              </div>
                              
                              {credit.note && (
                                <p className="mt-2 text-[11px] text-slate-400 italic">{credit.note}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">Aucun crédit en cours</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Toutes les transactions avec filtres */}
            {currentView === 'transactions' && (<>
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl">
              <CardHeader className="border-b border-slate-700/50 pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="text-sm md:text-base">Transactions</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setFilters(prev => ({
                      ...prev,
                      [dashboard.ownerUserId]: { ...prev[dashboard.ownerUserId], showFilters: !prev[dashboard.ownerUserId]?.showFilters }
                    }))}
                  >
                    <Filter className="w-4 h-4 mr-1" />
                    {currentFilter.showFilters ? 'Masquer' : 'Filtres'}
                  </Button>
                </div>
                
                {/* Zone de filtres */}
                <AnimatePresence>
                  {currentFilter.showFilters && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3">
                        <div className="relative col-span-2 md:col-span-1">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            placeholder="Rechercher..."
                            className="pl-8 h-8 text-xs"
                            value={currentFilter.search}
                            onChange={e => setFilters(prev => ({
                              ...prev,
                              [dashboard.ownerUserId]: { ...prev[dashboard.ownerUserId], search: e.target.value }
                            }))}
                          />
                        </div>
                        <select
                          className="h-8 text-xs bg-slate-700 border-slate-600 rounded-md px-2"
                          value={currentFilter.category}
                          onChange={e => setFilters(prev => ({
                            ...prev,
                            [dashboard.ownerUserId]: { ...prev[dashboard.ownerUserId], category: e.target.value }
                          }))}
                        >
                          <option value="">Toutes catégories</option>
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <select
                          className="h-8 text-xs bg-slate-700 border-slate-600 rounded-md px-2"
                          value={currentFilter.type}
                          onChange={e => setFilters(prev => ({
                            ...prev,
                            [dashboard.ownerUserId]: { ...prev[dashboard.ownerUserId], type: e.target.value }
                          }))}
                        >
                          <option value="">Tous types</option>
                          <option value="income">Revenus</option>
                          <option value="expense">Dépenses</option>
                        </select>
                        <select
                          className="h-8 text-xs bg-slate-700 border-slate-600 rounded-md px-2"
                          value={currentFilter.account}
                          onChange={e => setFilters(prev => ({
                            ...prev,
                            [dashboard.ownerUserId]: { ...prev[dashboard.ownerUserId], account: e.target.value }
                          }))}
                        >
                          <option value="">Tous comptes</option>
                          {accountNames.map(acc => (
                            <option key={acc} value={acc}>{acc}</option>
                          ))}
                        </select>
                      </div>
                      {(currentFilter.search || currentFilter.category || currentFilter.type || currentFilter.account) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-xs text-slate-400"
                          onClick={() => setFilters(prev => ({
                            ...prev,
                            [dashboard.ownerUserId]: { ...prev[dashboard.ownerUserId], search: '', category: '', type: '', account: '' }
                          }))}
                        >
                          <X className="w-3 h-3 mr-1" /> Réinitialiser
                        </Button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardHeader>
              <CardContent className="pt-4">
                {filteredTransactions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6 text-sm">Aucune transaction</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {filteredTransactions.map((transaction) => {
                      const isFuture = new Date(transaction.date) > new Date()
                      return (
                        <div
                          key={transaction.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                            isFuture
                              ? 'bg-blue-900/20 border-blue-500/30'
                              : transaction.type === 'income'
                                ? 'bg-green-900/20 border-green-500/30'
                                : 'bg-red-900/20 border-red-500/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div 
                              className="w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-base md:text-xl flex-shrink-0"
                              style={{ backgroundColor: '#3b82f630' }}
                            >
                              {transaction.category_icon || '📦'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-xs md:text-sm text-white truncate">{transaction.category || transaction.description}</p>
                              <p className="text-[10px] md:text-xs text-slate-400">
                                {transaction.account_name} • {new Date(transaction.date).toLocaleDateString('fr-FR')}
                              </p>
                            </div>
                          </div>
                          <span className={`text-sm md:text-base font-bold flex-shrink-0 ${
                            transaction.type === 'income' ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {transaction.type === 'income' ? '+' : '-'}{Math.abs(transaction.amount).toFixed(2)} €
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Graphiques */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Dépenses par catégorie */}
              {pieData.length > 0 && (
                <Card className="bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl">
                  <CardHeader className="border-b border-slate-700/50 pb-2">
                    <CardTitle className="text-sm">Dépenses par catégorie</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                          label={(props) => pieData[props.index]?.icon}
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
                    <div className="mt-2 space-y-1">
                      {pieData.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                            <span className="text-slate-300">{item.icon} {item.name}</span>
                          </div>
                          <span className="font-medium text-white">{item.value.toFixed(2)} €</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Évolution des dépenses */}
              <Card className="bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl">
                <CardHeader className="border-b border-slate-700/50 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Évolution dépenses</CardTitle>
                    <div className="flex gap-1">
                      {(['week', 'month', 'year'] as const).map(mode => (
                        <Button
                          key={mode}
                          size="sm"
                          variant={currentChartMode === mode ? 'default' : 'ghost'}
                          className={`text-[10px] px-2 py-0.5 h-6 ${currentChartMode === mode ? 'bg-slate-600' : ''}`}
                          onClick={() => setChartMode(prev => ({ ...prev, [dashboard.ownerUserId]: mode }))}
                        >
                          {mode === 'week' ? '7j' : mode === 'month' ? 'Mois' : 'Année'}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="label" stroke="#9ca3af" style={{ fontSize: '10px' }} />
                      <YAxis stroke="#9ca3af" style={{ fontSize: '10px' }} width={35} />
                      <Tooltip
                        formatter={(value: number) => value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="#ef4444" 
                        strokeWidth={2} 
                        dot={{ fill: '#ef4444', r: 4 }}
                        activeDot={{ r: 6, fill: '#ef4444' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            </>)}
          </motion.div>
        )
      })}
    </div>
  )
}
