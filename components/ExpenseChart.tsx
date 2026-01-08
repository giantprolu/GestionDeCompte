'use client'

import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { BarChart3, PieChartIcon, Calendar } from 'lucide-react'
import { supabase } from '@/lib/db'
import { motion } from 'framer-motion'

interface Transaction {
  id: string
  amount: number
  type: 'income' | 'expense'
  date: string
  archived?: boolean
  category: {
    id: string
    name: string
    icon: string
    color?: string
  }
}

interface MonthClosure {
  month_year: string
  start_date: string
  end_date: string
}

type ChartType = 'pie' | 'bar'

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#22C55E', '#0EA5E9', '#E11D48'
]

export default function ExpenseChart() {
  const { user, isLoaded } = useUser()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [closures, setClosures] = useState<MonthClosure[]>([])
  const [loading, setLoading] = useState(true)
  const [chartType, setChartType] = useState<ChartType>('pie')
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense')
  const [showCurrent, setShowCurrent] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')

  useEffect(() => {
    if (isLoaded && user) {
      fetchData()
    }
  }, [isLoaded, user])

  const fetchData = async () => {
    try {
      // Récupérer les transactions
      const response = await fetch('/api/expenses?includeUpcoming=false')
      if (response.ok) {
        const data = await response.json()
        setTransactions(data)
      }

      // Récupérer les clôtures
      if (user?.id) {
        const { data: closuresData, error } = await supabase
          .from('month_closures')
          .select('month_year, start_date, end_date')
          .eq('user_id', user.id)
          .order('start_date', { ascending: false })

        if (!error && Array.isArray(closuresData)) {
          setClosures(closuresData)
        }
      }
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  // Générer la liste des périodes
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    const baseDate = dateStr.split('T')[0]
    const d = new Date(baseDate)
    if (isNaN(d.getTime())) return baseDate
    return d.toLocaleDateString('fr-FR')
  }

  const allPeriods = closures.map(c => ({
    key: c.month_year,
    label: `${formatDate(c.start_date)} - ${formatDate(c.end_date)}`,
    start_date: c.start_date,
    end_date: c.end_date
  }))

  // Filtrer les transactions selon la période sélectionnée
  const lastClosureEndDate = allPeriods.length > 0 ? allPeriods[0].end_date : null
  const currentClosure = allPeriods.find(p => p.key === selectedPeriod)

  const filteredByPeriod = useMemo(() => {
    if (showCurrent) {
      // Période actuelle : depuis le jour après la dernière clôture jusqu'à aujourd'hui
      return transactions.filter(txn => {
        if (txn.archived) return false
        if (lastClosureEndDate) {
          return txn.date > lastClosureEndDate
        }
        return true
      })
    } else if (currentClosure) {
      // Période archivée sélectionnée
      return transactions.filter(txn => 
        txn.date >= currentClosure.start_date && 
        txn.date <= currentClosure.end_date && 
        txn.archived === true
      )
    }
    return []
  }, [transactions, showCurrent, currentClosure, lastClosureEndDate])

  // Calculer les données du graphique
  const chartData = useMemo(() => {
    const filtered = filteredByPeriod.filter(t => t.type === transactionType)

    // Grouper par catégorie
    const categoryMap = new Map<string, { name: string; icon: string; value: number }>()
    
    filtered.forEach(txn => {
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
  }, [filteredByPeriod, transactionType])

  const totalAmount = chartData.reduce((sum, item) => sum + item.value, 0)

  const periodLabel = showCurrent 
    ? 'Période actuelle' 
    : currentClosure?.label || 'Sélectionnez une période'

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
        {/* Sélecteur de période */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => { setShowCurrent(true); setSelectedPeriod(''); }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              showCurrent
                ? 'bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg'
                : 'bg-slate-700/40 hover:bg-slate-700/70 text-slate-300 border border-slate-600/30'
            }`}
          >
            Période actuelle
          </motion.button>
          {allPeriods.map((period, idx) => (
            <motion.button
              key={period.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: (idx + 1) * 0.03 }}
              onClick={() => { setShowCurrent(false); setSelectedPeriod(period.key); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                !showCurrent && selectedPeriod === period.key
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : 'bg-slate-700/40 hover:bg-slate-700/70 text-slate-300 border border-slate-600/30'
              }`}
            >
              {period.label}
            </motion.button>
          ))}
        </div>

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
            <span className="text-slate-300">{periodLabel}</span>
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
