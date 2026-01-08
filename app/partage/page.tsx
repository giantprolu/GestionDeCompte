'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Wallet, TrendingDown, TrendingUp, Settings, Eye, Edit, Filter, X, Search, Calculator, Target, CreditCard, CircleDollarSign, PiggyBank, ShoppingBag, Lock, CheckCircle2, AlertTriangle, Plus, Trash2, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
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
  category_id?: string
  account_name: string
  account_id?: string
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

interface Category {
  id: string
  name: string
  type: string
  icon: string
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
  totals: { category: string; total: number; avgPerMonth: number; isFixed?: boolean }[]
  fixedTotals: { category: string; total: number; avgPerMonth: number; isFixed?: boolean }[]
  targets: Record<string, number>
  summary: {
    totalIncome: number
    totalFixedExpenses: number
    totalVariableExpenses: number
    availableForVariable: number
    potentialSavings: number
    totalBalanceIncluded: number
    totalBalanceExcluded: number
    totalBalanceAll: number
  } | null
  meta?: {
    excludedAccountsCount?: number
  }
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
  
  // Onglet actif du prévisionnel par dashboard
  const [previsionnelTab, setPrevisionnelTab] = useState<Record<string, 'variable' | 'fixed'>>({})
  
  // Données prévisionnelles par dashboard
  const [previsionnelData, setPrevisionnelData] = useState<Record<string, PrevisionnelData>>({})
  const [previsionnelLoading, setPrevisionnelLoading] = useState<Record<string, boolean>>({})
  
  // Formulaire d'ajout de transaction pour les éditeurs
  const [showAddForm, setShowAddForm] = useState<Record<string, boolean>>({})
  const [addFormData, setAddFormData] = useState<Record<string, { amount: string; type: 'income' | 'expense'; categoryId: string; accountId: string; date: string; note: string }>>({})
  const [categories, setCategoriesData] = useState<Category[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Édition de transaction
  const [editingTransaction, setEditingTransaction] = useState<{ dashboardId: string; transaction: Transaction } | null>(null)
  const [editFormData, setEditFormData] = useState<{ amount: string; type: 'income' | 'expense'; categoryId: string; date: string; note: string }>({ amount: '', type: 'expense', categoryId: '', date: '', note: '' })
  
  // Helper pour formater les montants
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' €'

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
            fixedTotals: data.fixedTotals || [],
            targets: data.targets || {},
            summary: data.summary || null,
            meta: data.meta || {}
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

  // Charger les catégories pour le formulaire d'ajout
  const fetchCategories = async (type: 'income' | 'expense') => {
    try {
      const res = await fetch(`/api/categories?type=${type}`)
      if (res.ok) {
        const data = await res.json()
        setCategoriesData(data)
      }
    } catch (error) {
      console.error('Erreur chargement catégories:', error)
    }
  }

  // Ouvrir le formulaire d'ajout pour un dashboard
  const openAddForm = (ownerUserId: string, accounts: Account[]) => {
    fetchCategories('expense')
    setAddFormData(prev => ({
      ...prev,
      [ownerUserId]: {
        amount: '',
        type: 'expense',
        categoryId: '',
        accountId: accounts[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        note: ''
      }
    }))
    setShowAddForm(prev => ({ ...prev, [ownerUserId]: true }))
  }

  // Ajouter une transaction sur un compte partagé
  const addTransaction = async (ownerUserId: string) => {
    const formData = addFormData[ownerUserId]
    if (!formData || !formData.amount || !formData.categoryId || !formData.accountId) {
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/shared-dashboards/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerUserId,
          accountId: formData.accountId,
          amount: formData.amount,
          type: formData.type,
          categoryId: formData.categoryId,
          date: formData.date,
          note: formData.note
        })
      })

      if (res.ok) {
        // Rafraîchir les données
        setShowAddForm(prev => ({ ...prev, [ownerUserId]: false }))
        await fetchDashboards()
      } else {
        const error = await res.json()
        console.error('Erreur ajout transaction:', error)
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Supprimer une transaction
  const deleteTransaction = async (ownerUserId: string, transactionId: string) => {
    if (!confirm('Supprimer cette transaction ?')) return

    try {
      const res = await fetch(`/api/shared-dashboards/transactions?transactionId=${transactionId}&ownerUserId=${ownerUserId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        await fetchDashboards()
      } else {
        const error = await res.json()
        console.error('Erreur suppression:', error)
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
    }
  }

  // Ouvrir le formulaire d'édition
  const openEditForm = (dashboardId: string, transaction: Transaction) => {
    fetchCategories(transaction.type)
    setEditingTransaction({ dashboardId, transaction })
    // Extraire la date au format YYYY-MM-DD (les 10 premiers caractères)
    const formattedDate = transaction.date ? transaction.date.substring(0, 10) : new Date().toISOString().substring(0, 10)
    setEditFormData({
      amount: String(Math.abs(transaction.amount)),
      type: transaction.type,
      categoryId: transaction.category_id || '',
      date: formattedDate,
      note: transaction.note || ''
    })
  }

  // Modifier une transaction
  const updateTransaction = async () => {
    if (!editingTransaction) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/shared-dashboards/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerUserId: editingTransaction.dashboardId,
          transactionId: editingTransaction.transaction.id,
          amount: editFormData.amount,
          type: editFormData.type,
          categoryId: editFormData.categoryId,
          date: editFormData.date,
          note: editFormData.note
        })
      })

      if (res.ok) {
        setEditingTransaction(null)
        await fetchDashboards()
      } else {
        const error = await res.json()
        console.error('Erreur modification:', error)
      }
    } catch (error) {
      console.error('Erreur lors de la modification:', error)
    } finally {
      setIsSubmitting(false)
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
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8 px-3 sm:px-4 md:px-8 lg:px-12 pt-4 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4" data-tutorial="partage-header">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">Dashboards Partagés</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            {dashboards.length} dashboard{dashboards.length > 1 ? 's' : ''} partagé{dashboards.length > 1 ? 's' : ''} avec vous
          </p>
        </div>
        <Link href="/partage/gerer">
          <Button variant="outline" size="sm" className="md:text-base md:px-4 md:py-2">
            <Settings className="w-4 h-4 md:w-5 md:h-5 mr-2" />
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
        const filterCategories = [...new Set(monthTransactions.map(t => t.category))].filter(Boolean)
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
            className="space-y-4 md:space-y-6 lg:space-y-8"
          >
            {/* Header du dashboard */}
            <Card className="border-2 border-purple-400/30 bg-gradient-to-br from-purple-900/20 to-slate-900 shadow-xl">
              <CardHeader className="pb-3 md:pb-4 lg:pb-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-4">
                  <div>
                    <CardTitle className="text-lg md:text-xl lg:text-2xl flex items-center gap-2 md:gap-3">
                      <Wallet className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-purple-400" />
                      {dashboard.ownerUsername}
                    </CardTitle>
                    <p className="text-xs md:text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      {dashboard.permission === 'view' ? (
                        <><Eye className="w-3 h-3 md:w-4 md:h-4" /> Lecture seule</>
                      ) : (
                        <><Edit className="w-3 h-3 md:w-4 md:h-4 text-green-400" /> <span className="text-green-400">Mode Édition</span></>
                      )}
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-2 md:gap-3">
                    {/* Onglets Transactions / Prévisionnel / Crédits */}
                    <div className="flex gap-1 md:gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant={currentView === 'transactions' ? 'default' : 'outline'}
                        className={`text-xs md:text-sm px-3 md:px-4 py-1 h-7 md:h-9 ${currentView === 'transactions' ? 'bg-purple-600' : ''}`}
                        onClick={() => setActiveView(prev => ({ ...prev, [dashboard.ownerUserId]: 'transactions' }))}
                      >
                        <TrendingDown className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                        Transactions
                      </Button>
                      <Button
                        size="sm"
                        variant={currentView === 'previsionnel' ? 'default' : 'outline'}
                        className={`text-xs md:text-sm px-3 md:px-4 py-1 h-7 md:h-9 ${currentView === 'previsionnel' ? 'bg-purple-600' : ''}`}
                        onClick={() => {
                          setActiveView(prev => ({ ...prev, [dashboard.ownerUserId]: 'previsionnel' }))
                          // Charger le prévisionnel si pas encore fait
                          if (!dashPrevisionnel) {
                            fetchPrevisionnel(dashboard.ownerUserId, selectedMonth)
                          }
                        }}
                      >
                        <Calculator className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                        Prévisionnel
                      </Button>
                      <Button
                        size="sm"
                        variant={currentView === 'credits' ? 'default' : 'outline'}
                        className={`text-xs md:text-sm px-3 md:px-4 py-1 h-7 md:h-9 ${currentView === 'credits' ? 'bg-purple-600' : ''}`}
                        onClick={() => setActiveView(prev => ({ ...prev, [dashboard.ownerUserId]: 'credits' }))}
                      >
                        <CreditCard className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                        Crédits
                      </Button>
                    </div>
                    
                    {/* Sélecteur de mois */}
                    <div className="flex flex-wrap gap-1.5 md:gap-2">
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
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="group relative cursor-pointer"
                    onMouseEnter={() => setExpandedAccounts(prev => ({ ...prev, [`${dashboard.ownerUserId}-${account.id}`]: true }))}
                    onMouseLeave={() => setExpandedAccounts(prev => ({ ...prev, [`${dashboard.ownerUserId}-${account.id}`]: false }))}
                    onClick={() => setExpandedAccounts(prev => ({ ...prev, [`${dashboard.ownerUserId}-${account.id}`]: !prev[`${dashboard.ownerUserId}-${account.id}`] }))}
                  >
                    <div className={`
                      transition-all duration-300 ease-out rounded-lg border-2 overflow-hidden
                      ${isPositive 
                        ? 'border-green-500/50 bg-gradient-to-r from-green-900/30 to-green-800/20 hover:border-green-400/70 hover:shadow-green-500/20' 
                        : 'border-red-500/50 bg-gradient-to-r from-red-900/30 to-red-800/20 hover:border-red-400/70 hover:shadow-red-500/20'
                      }
                      ${isAccountExpanded ? 'shadow-xl' : 'hover:shadow-lg'}
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
            <div className="grid grid-cols-2 gap-3 md:gap-4 lg:gap-6">
              <Card className="border-green-500/30 bg-gradient-to-br from-green-900/20 to-slate-900">
                <CardHeader className="pb-2 pt-3 md:pt-4 px-3 md:px-4">
                  <CardTitle className="flex items-center gap-1.5 text-xs md:text-sm lg:text-base">
                    <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
                    Revenus
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                  <div className="text-xl md:text-2xl lg:text-3xl font-bold text-green-400">
                    +{monthlyIncome.toFixed(2)} €
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-500/30 bg-gradient-to-br from-red-900/20 to-slate-900">
                <CardHeader className="pb-2 pt-3 md:pt-4 px-3 md:px-4">
                  <CardTitle className="flex items-center gap-1.5 text-xs md:text-sm lg:text-base">
                    <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-red-400" />
                    Dépenses
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
                  <div className="text-xl md:text-2xl lg:text-3xl font-bold text-red-400">
                    -{monthlyExpense.toFixed(2)} €
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Section Prévisionnel - Vue complète */}
            {currentView === 'previsionnel' && (() => {
              const currentTab = previsionnelTab[dashboard.ownerUserId] || 'variable'
              const totalVariableSpent = dashPrevisionnel?.totals?.reduce((sum, t) => sum + t.total, 0) || 0
              const totalFixedSpent = dashPrevisionnel?.fixedTotals?.reduce((sum, t) => sum + t.total, 0) || 0
              const availableForVariable = dashPrevisionnel?.summary?.availableForVariable || 0
              const potentialSavings = dashPrevisionnel?.summary?.totalBalanceIncluded || 0
              const remainingBudget = availableForVariable - totalVariableSpent
              const categoriesOverBudget = dashPrevisionnel?.totals?.filter(t => dashPrevisionnel.targets?.[t.category] && t.total > dashPrevisionnel.targets[t.category]).length || 0
              const categoriesUnderBudget = dashPrevisionnel?.totals?.filter(t => dashPrevisionnel.targets?.[t.category] && t.total <= dashPrevisionnel.targets[t.category]).length || 0
              
              return (
                <div className="space-y-4">
                  {isPrevLoading ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Chargement...</p>
                    </div>
                  ) : dashPrevisionnel?.summary ? (
                    <>
                      {/* Carte épargne potentielle */}
                      <Card className={`border-2 shadow-xl ${
                        potentialSavings >= 0 
                          ? 'bg-gradient-to-br from-emerald-900/40 to-green-800/20 border-emerald-500/40 shadow-emerald-500/10' 
                          : 'bg-gradient-to-br from-red-900/40 to-red-800/20 border-red-500/40 shadow-red-500/10'
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl ${potentialSavings >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                                <PiggyBank className={`w-6 h-6 ${potentialSavings >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                              </div>
                              <div>
                                <p className={`text-xs font-medium ${potentialSavings >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                  {potentialSavings >= 0 ? 'Épargne potentielle' : 'Déficit prévu'}
                                </p>
                                <p className={`text-2xl font-bold ${potentialSavings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {potentialSavings >= 0 ? '+' : ''}{fmt(potentialSavings)}
                                </p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                                <p className="text-slate-400 text-[10px]">Revenus</p>
                                <p className="text-white font-semibold text-sm">{fmt(dashPrevisionnel.summary.totalIncome)}</p>
                              </div>
                              <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                                <p className="text-slate-400 text-[10px] flex items-center gap-1">
                                  <Lock className="w-2 h-2" /> Charges
                                </p>
                                <p className="text-orange-400 font-semibold text-sm">-{fmt(dashPrevisionnel.summary.totalFixedExpenses)}</p>
                              </div>
                              <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                                <p className="text-slate-400 text-[10px] flex items-center gap-1">
                                  <ShoppingBag className="w-2 h-2" /> Variable
                                </p>
                                <p className="text-blue-400 font-semibold text-sm">{fmt(availableForVariable)}</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Cartes de statistiques */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
                        <Card className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border-blue-500/30">
                          <CardContent className="p-3 md:p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] md:text-xs text-blue-300/70 uppercase tracking-wide">Dép. variables</p>
                                <p className="text-lg md:text-xl lg:text-2xl font-bold text-blue-400">{fmt(totalVariableSpent)}</p>
                              </div>
                              <ShoppingBag className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 border-purple-500/30">
                          <CardContent className="p-3 md:p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] md:text-xs text-purple-300/70 uppercase tracking-wide">Reste</p>
                                <p className={`text-lg md:text-xl lg:text-2xl font-bold ${remainingBudget >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                                  {fmt(remainingBudget)}
                                </p>
                              </div>
                              <Wallet className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-green-900/40 to-green-800/20 border-green-500/30">
                          <CardContent className="p-3 md:p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] md:text-xs text-green-300/70 uppercase tracking-wide">Dans budget</p>
                                <p className="text-lg md:text-xl lg:text-2xl font-bold text-green-400">{categoriesUnderBudget}</p>
                              </div>
                              <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-red-900/40 to-red-800/20 border-red-500/30">
                          <CardContent className="p-3 md:p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] md:text-xs text-red-300/70 uppercase tracking-wide">Dépassés</p>
                                <p className="text-lg md:text-xl lg:text-2xl font-bold text-red-400">{categoriesOverBudget}</p>
                              </div>
                              <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-400" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Onglets variable/fixe */}
                      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl overflow-hidden">
                        <CardHeader className="border-b border-slate-700/50 pb-0 pt-3 md:pt-4 px-3 md:px-4">
                          <div className="flex gap-1 md:gap-2">
                            <button
                              onClick={() => setPrevisionnelTab(prev => ({ ...prev, [dashboard.ownerUserId]: 'variable' }))}
                              className={`px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-medium rounded-t-lg transition-all ${
                                currentTab === 'variable' 
                                  ? 'text-white bg-slate-700/50' 
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 md:gap-2">
                                <ShoppingBag className="w-3 h-3 md:w-4 md:h-4" />
                                <span>Budget variable</span>
                              </div>
                            </button>
                            <button
                              onClick={() => setPrevisionnelTab(prev => ({ ...prev, [dashboard.ownerUserId]: 'fixed' }))}
                              className={`px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-medium rounded-t-lg transition-all ${
                                currentTab === 'fixed' 
                                  ? 'text-white bg-slate-700/50' 
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 md:gap-2">
                                <Lock className="w-3 h-3 md:w-4 md:h-4" />
                                <span>Charges fixes</span>
                              </div>
                            </button>
                          </div>
                        </CardHeader>
                        <CardContent className="p-3 md:p-4 lg:p-5 max-h-[400px] md:max-h-[500px] overflow-y-auto custom-scrollbar">
                          {currentTab === 'variable' ? (
                            dashPrevisionnel.totals && dashPrevisionnel.totals.length > 0 ? (
                              <div className="space-y-2 md:space-y-3">
                                {dashPrevisionnel.totals.map((item, idx) => {
                                  const target = dashPrevisionnel.targets?.[item.category] || 0
                                  const progress = target > 0 ? Math.min((item.total / target) * 100, 100) : 0
                                  const isOverBudget = target > 0 && item.total > target
                                  
                                  return (
                                    <div key={idx} className="p-2.5 md:p-3 lg:p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                                      <div className="flex items-center justify-between mb-1.5 md:mb-2">
                                        <span className="text-xs md:text-sm lg:text-base font-medium text-slate-200">{item.category}</span>
                                        <span className={`text-xs md:text-sm lg:text-base font-bold ${isOverBudget ? 'text-red-400' : 'text-slate-300'}`}>
                                          {fmt(item.total)}
                                        </span>
                                      </div>
                                      
                                      {target > 0 && (
                                        <div className="mb-1.5 md:mb-2">
                                          <div className="h-1.5 md:h-2 bg-slate-700 rounded-full overflow-hidden">
                                            <div 
                                              className={`h-full transition-all duration-300 rounded-full ${
                                                isOverBudget ? 'bg-red-500' : progress > 80 ? 'bg-orange-500' : 'bg-green-500'
                                              }`}
                                              style={{ width: `${Math.min(progress, 100)}%` }}
                                            />
                                          </div>
                                          <p className={`text-[9px] mt-0.5 ${isOverBudget ? 'text-red-400' : 'text-slate-400'}`}>
                                            {isOverBudget 
                                              ? `Dépassé de ${fmt(item.total - target)}`
                                              : `${progress.toFixed(0)}% de l'objectif`
                                            }
                                          </p>
                                        </div>
                                      )}
                                      
                                      <div className="flex items-center gap-1.5">
                                        <Target className="w-2.5 h-2.5 text-purple-400" />
                                        <span className="text-[10px] text-slate-400">Objectif:</span>
                                        <Input
                                          type="number"
                                          value={target || ''}
                                          onChange={(e) => updateTarget(dashboard.ownerUserId, item.category, Number(e.target.value))}
                                          placeholder="0"
                                          className="h-6 w-20 text-[10px] bg-slate-900/50 border-slate-600"
                                        />
                                        <span className="text-[10px] text-slate-400">€</span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-6">
                                <p className="text-muted-foreground text-xs">Aucune dépense variable</p>
                              </div>
                            )
                          ) : (
                            dashPrevisionnel.fixedTotals && dashPrevisionnel.fixedTotals.length > 0 ? (
                              <div className="space-y-2">
                                {dashPrevisionnel.fixedTotals.map((item, idx) => (
                                  <div key={idx} className="p-2.5 rounded-lg bg-slate-800/50 border border-orange-500/20">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Lock className="w-3 h-3 text-orange-400" />
                                        <span className="text-xs font-medium text-slate-200">{item.category}</span>
                                      </div>
                                      <span className="text-xs font-bold text-orange-400">{fmt(item.total)}</span>
                                    </div>
                                  </div>
                                ))}
                                
                                <div className="p-2.5 rounded-lg bg-orange-900/30 border border-orange-500/30 mt-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-orange-300">Total charges fixes</span>
                                    <span className="text-sm font-bold text-orange-400">{fmt(totalFixedSpent)}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-6">
                                <p className="text-muted-foreground text-xs">Aucune charge fixe</p>
                              </div>
                            )
                          )}
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground text-sm">Aucune donnée prévisionnelle</p>
                    </div>
                  )}
                </div>
              )
            })()}

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
                  <div className="flex items-center gap-2">
                    {dashboard.permission === 'edit' && (
                      <Button
                        variant="default"
                        size="sm"
                        className="text-xs bg-green-600 hover:bg-green-700"
                        onClick={() => openAddForm(dashboard.ownerUserId, dashboard.accounts)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter
                      </Button>
                    )}
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
                </div>
                
                {/* Formulaire d'ajout de transaction pour éditeurs */}
                <AnimatePresence>
                  {showAddForm[dashboard.ownerUserId] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 mt-3 rounded-lg bg-green-900/20 border border-green-500/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-green-400">Nouvelle transaction</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setShowAddForm(prev => ({ ...prev, [dashboard.ownerUserId]: false }))}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        {/* Type de transaction */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className={`flex-1 text-xs ${addFormData[dashboard.ownerUserId]?.type === 'expense' ? 'bg-red-600' : 'bg-slate-700'}`}
                            onClick={() => {
                              setAddFormData(prev => ({ ...prev, [dashboard.ownerUserId]: { ...prev[dashboard.ownerUserId], type: 'expense', categoryId: '' }}))
                              fetchCategories('expense')
                            }}
                          >
                            Dépense
                          </Button>
                          <Button
                            size="sm"
                            className={`flex-1 text-xs ${addFormData[dashboard.ownerUserId]?.type === 'income' ? 'bg-green-600' : 'bg-slate-700'}`}
                            onClick={() => {
                              setAddFormData(prev => ({ ...prev, [dashboard.ownerUserId]: { ...prev[dashboard.ownerUserId], type: 'income', categoryId: '' }}))
                              fetchCategories('income')
                            }}
                          >
                            Revenu
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            placeholder="Montant"
                            className="h-8 text-xs bg-slate-800 border-slate-600"
                            value={addFormData[dashboard.ownerUserId]?.amount || ''}
                            onChange={e => setAddFormData(prev => ({
                              ...prev,
                              [dashboard.ownerUserId]: { ...prev[dashboard.ownerUserId], amount: e.target.value }
                            }))}
                          />
                          <Input
                            type="date"
                            className="h-8 text-xs bg-slate-800 border-slate-600"
                            value={addFormData[dashboard.ownerUserId]?.date || ''}
                            onChange={e => setAddFormData(prev => ({
                              ...prev,
                              [dashboard.ownerUserId]: { ...prev[dashboard.ownerUserId], date: e.target.value }
                            }))}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <select
                            className="h-8 text-xs bg-slate-800 border-slate-600 rounded-md px-2"
                            value={addFormData[dashboard.ownerUserId]?.categoryId || ''}
                            onChange={e => setAddFormData(prev => ({
                              ...prev,
                              [dashboard.ownerUserId]: { ...prev[dashboard.ownerUserId], categoryId: e.target.value }
                            }))}
                          >
                            <option value="">Catégorie...</option>
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                            ))}
                          </select>
                          <select
                            className="h-8 text-xs bg-slate-800 border-slate-600 rounded-md px-2"
                            value={addFormData[dashboard.ownerUserId]?.accountId || ''}
                            onChange={e => setAddFormData(prev => ({
                              ...prev,
                              [dashboard.ownerUserId]: { ...prev[dashboard.ownerUserId], accountId: e.target.value }
                            }))}
                          >
                            <option value="">Compte...</option>
                            {dashboard.accounts.map(acc => (
                              <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                          </select>
                        </div>

                        <Input
                          placeholder="Note (optionnel)"
                          className="h-8 text-xs bg-slate-800 border-slate-600"
                          value={addFormData[dashboard.ownerUserId]?.note || ''}
                          onChange={e => setAddFormData(prev => ({
                            ...prev,
                            [dashboard.ownerUserId]: { ...prev[dashboard.ownerUserId], note: e.target.value }
                          }))}
                        />

                        <Button
                          className="w-full bg-green-600 hover:bg-green-700 text-xs h-8"
                          onClick={() => addTransaction(dashboard.ownerUserId)}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Ajout...' : 'Ajouter la transaction'}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
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
                          {filterCategories.map(cat => (
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
                  <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {filteredTransactions.map((transaction) => {
                      const isFuture = new Date(transaction.date) > new Date()
                      return (
                        <div
                          key={transaction.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all group ${
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
                          <div className="flex items-center gap-1 md:gap-2">
                            <span className={`text-sm md:text-base font-bold flex-shrink-0 ${
                              transaction.type === 'income' ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {transaction.type === 'income' ? '+' : '-'}{Math.abs(transaction.amount).toFixed(2)} €
                            </span>
                            {dashboard.permission === 'edit' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 transition-colors"
                                  onClick={() => openEditForm(dashboard.ownerUserId, transaction)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/30 transition-colors"
                                  onClick={() => deleteTransaction(dashboard.ownerUserId, transaction.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
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

      {/* Modal d'édition de transaction */}
      <AnimatePresence>
        {editingTransaction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEditingTransaction(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 border border-slate-700 rounded-xl p-4 md:p-6 w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Modifier la transaction</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setEditingTransaction(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* Type de transaction */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className={`flex-1 ${editFormData.type === 'expense' ? 'bg-red-600' : 'bg-slate-700'}`}
                    onClick={() => {
                      setEditFormData(prev => ({ ...prev, type: 'expense', categoryId: '' }))
                      fetchCategories('expense')
                    }}
                  >
                    Dépense
                  </Button>
                  <Button
                    size="sm"
                    className={`flex-1 ${editFormData.type === 'income' ? 'bg-green-600' : 'bg-slate-700'}`}
                    onClick={() => {
                      setEditFormData(prev => ({ ...prev, type: 'income', categoryId: '' }))
                      fetchCategories('income')
                    }}
                  >
                    Revenu
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Montant</label>
                    <Input
                      type="number"
                      placeholder="Montant"
                      className="bg-slate-700 border-slate-600"
                      value={editFormData.amount}
                      onChange={e => setEditFormData(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Date</label>
                    <Input
                      type="date"
                      className="bg-slate-700 border-slate-600"
                      value={editFormData.date}
                      onChange={e => setEditFormData(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Catégorie</label>
                  <select
                    className="w-full h-10 bg-slate-700 border-slate-600 rounded-md px-3 text-sm"
                    value={editFormData.categoryId}
                    onChange={e => setEditFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                  >
                    <option value="">Sélectionner une catégorie</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Note (optionnel)</label>
                  <Input
                    placeholder="Note"
                    className="bg-slate-700 border-slate-600"
                    value={editFormData.note}
                    onChange={e => setEditFormData(prev => ({ ...prev, note: e.target.value }))}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditingTransaction(null)}
                  >
                    Annuler
                  </Button>
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    onClick={updateTransaction}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Modification...' : 'Modifier'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
