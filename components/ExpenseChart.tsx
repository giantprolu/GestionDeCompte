'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { BarChart3, PieChartIcon, Calendar } from 'lucide-react'

interface Transaction {
  id: string
  amount: number
  type: 'income' | 'expense'
  date: string
  category: {
    id: string
    name: string
    icon: string
    color?: string
  }
}

type ViewMode = 'day' | 'week' | 'month'
type ChartType = 'pie' | 'bar'

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#22C55E', '#0EA5E9', '#E11D48'
]

export default function ExpenseChart() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [chartType, setChartType] = useState<ChartType>('pie')
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense')

  useEffect(() => {
    fetchTransactions()
  }, [])

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/expenses?includeUpcoming=false')
      if (response.ok) {
        const data = await response.json()
        setTransactions(data)
      }
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filtrer et grouper les données selon le mode de vue
  const chartData = useMemo(() => {
    const now = new Date()
    let filteredTransactions = transactions.filter(t => t.type === transactionType)

    // Filtrer par période
    const filterByPeriod = (txn: Transaction) => {
      const txnDate = new Date(txn.date)
      
      switch (viewMode) {
        case 'day':
          return txnDate.toDateString() === now.toDateString()
        case 'week': {
          const weekStart = new Date(now)
          weekStart.setDate(now.getDate() - now.getDay())
          weekStart.setHours(0, 0, 0, 0)
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekStart.getDate() + 7)
          return txnDate >= weekStart && txnDate < weekEnd
        }
        case 'month':
          return txnDate.getMonth() === now.getMonth() && txnDate.getFullYear() === now.getFullYear()
        default:
          return true
      }
    }

    filteredTransactions = filteredTransactions.filter(filterByPeriod)

    // Grouper par catégorie
    const categoryMap = new Map<string, { name: string; icon: string; value: number }>()
    
    filteredTransactions.forEach(txn => {
      const catName = txn.category?.name || 'Autre'
      const catIcon = txn.category?.icon || '📦'
      const existing = categoryMap.get(catName)
      
      if (existing) {
        existing.value += txn.amount
      } else {
        categoryMap.set(catName, {
          name: catName,
          icon: catIcon,
          value: txn.amount
        })
      }
    })

    return Array.from(categoryMap.values())
      .sort((a, b) => b.value - a.value)
      .map((item, index) => ({
        ...item,
        color: COLORS[index % COLORS.length]
      }))
  }, [transactions, viewMode, transactionType])

  const totalAmount = chartData.reduce((sum, item) => sum + item.value, 0)

  const periodLabels: Record<ViewMode, string> = {
    day: 'Aujourd\'hui',
    week: 'Cette semaine',
    month: 'Ce mois'
  }

  if (loading) {
    return <div className="text-center py-8 text-slate-400">Chargement...</div>
  }

  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-400" />
          Visualisation par catégorie
        </CardTitle>
        <p className="text-sm text-slate-400">
          Analysez vos {transactionType === 'expense' ? 'dépenses' : 'revenus'} par catégorie
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contrôles */}
        <div className="flex flex-wrap gap-2">
          {/* Type de transaction */}
          <div className="flex gap-1 bg-slate-700/50 p-1 rounded-lg">
            <Button
              size="sm"
              variant={transactionType === 'expense' ? 'default' : 'ghost'}
              onClick={() => setTransactionType('expense')}
              className={transactionType === 'expense' ? 'bg-red-600 hover:bg-red-700' : 'text-slate-400'}
            >
              💸 Dépenses
            </Button>
            <Button
              size="sm"
              variant={transactionType === 'income' ? 'default' : 'ghost'}
              onClick={() => setTransactionType('income')}
              className={transactionType === 'income' ? 'bg-green-600 hover:bg-green-700' : 'text-slate-400'}
            >
              💰 Revenus
            </Button>
          </div>

          {/* Période */}
          <div className="flex gap-1 bg-slate-700/50 p-1 rounded-lg">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={viewMode === mode ? 'default' : 'ghost'}
                onClick={() => setViewMode(mode)}
                className={viewMode === mode ? 'bg-blue-600 hover:bg-blue-700' : 'text-slate-400'}
              >
                {mode === 'day' && '📅'}
                {mode === 'week' && '📆'}
                {mode === 'month' && '🗓️'}
              </Button>
            ))}
          </div>

          {/* Type de graphique */}
          <div className="flex gap-1 bg-slate-700/50 p-1 rounded-lg">
            <Button
              size="sm"
              variant={chartType === 'pie' ? 'default' : 'ghost'}
              onClick={() => setChartType('pie')}
              className={chartType === 'pie' ? 'bg-purple-600 hover:bg-purple-700' : 'text-slate-400'}
            >
              <PieChartIcon className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={chartType === 'bar' ? 'default' : 'ghost'}
              onClick={() => setChartType('bar')}
              className={chartType === 'bar' ? 'bg-purple-600 hover:bg-purple-700' : 'text-slate-400'}
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Résumé */}
        <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-slate-300">{periodLabels[viewMode]}</span>
          </div>
          <span className={`text-lg font-bold ${transactionType === 'expense' ? 'text-red-400' : 'text-green-400'}`}>
            {totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
          </span>
        </div>

        {/* Graphique */}
        {chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'pie' ? (
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(2)} €`}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  />
                </PieChart>
              ) : (
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(2)} €`}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                  />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucune donnée pour cette période</p>
          </div>
        )}

        {/* Légende détaillée */}
        {chartData.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {chartData.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-slate-300">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-white font-semibold">
                    {item.value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </span>
                  <span className="text-slate-400 text-sm ml-2">
                    ({((item.value / totalAmount) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
