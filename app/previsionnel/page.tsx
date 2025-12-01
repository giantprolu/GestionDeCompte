"use client"

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import CreditTrackingCard from '@/components/CreditTrackingCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useSelectedMonth } from '@/lib/useSelectedMonth'
import { useUserSettings } from '@/components/AppWrapper'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Calculator, 
  Target, 
  TrendingDown, 
  ChevronRight, 
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Calendar,
  RefreshCw,
  PieChart,
  Zap
} from 'lucide-react'

export default function PrevisionnelPage() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const { userType, isLoading: isLoadingSettings } = useUserSettings()
  const [activeTab, setActiveTab] = useState<'totals' | 'reco'>('totals')
  const [recoVisible, setRecoVisible] = useState(false)
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' €'
  const [totals, setTotals] = useState<{ category: string; total: number }[]>([])
  const [monthsWindow, setMonthsWindow] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [targets, setTargets] = useState<Record<string, number>>({})
  const [budgets, setBudgets] = useState<{ category: string; avgPerMonth: number; recommendedMonthly: number }[]>([])
  const [fileError, setFileError] = useState<string | null>(null)

  // Rediriger les visionneurs vers la page partage
  useEffect(() => {
    if (!isLoadingSettings && userType === 'viewer') {
      router.replace('/partage')
    }
  }, [userType, isLoadingSettings, router])

  // Utiliser le hook partagé pour le mois sélectionné
  const { selectedMonth, isCurrentMonth } = useSelectedMonth()

  const TARGETS_KEY = 'spend_targets_v1'

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    const fetchUserSettings = async () => {
      try {
        const res = await fetch('/api/user-settings')
        if (!res.ok) return
        const json = await res.json()
        if (json.spend_targets) {
          setTargets(json.spend_targets)
          localStorage.setItem(TARGETS_KEY, JSON.stringify(json.spend_targets))
        } else {
          const raw = localStorage.getItem(TARGETS_KEY)
          if (raw) setTargets(JSON.parse(raw))
        }
      } catch {
        const raw = localStorage.getItem(TARGETS_KEY)
        if (raw) setTargets(JSON.parse(raw))
      }
    }
    fetchUserSettings()
  }, [isLoaded, isSignedIn])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    const fetchTotals = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/previsionnel/totals?monthsWindow=${monthsWindow}&selectedMonth=${selectedMonth}`)
        const json = await res.json()
        if (!res.ok) {
          console.error('Erreur totals', json)
          setTotals([])
        } else {
          setTotals(json.totals || [])
        }
      } catch (err) {
        console.error('Erreur fetch totals', err)
      } finally { setLoading(false) }
    }
    fetchTotals()
  }, [monthsWindow, selectedMonth, isLoaded, isSignedIn])

  const computeAlgorithm = async () => {
    setFileError(null)
    setBudgets([])
    try {
      setLoading(true)
      const res = await fetch('/api/previsionnel/algorithm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthsWindow, selectedMonth })
      })
      const json = await res.json()
      if (!res.ok) setFileError(json?.error || 'Erreur algorithm')
      else setBudgets(json.budgets || [])
      setRecoVisible(true)
      setActiveTab('reco')
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Erreur algorithm')
    } finally { setLoading(false) }
  }

  const saveTarget = async (cat: string, value: number) => {
    const newTargets = { ...targets, [cat]: value }
    setTargets(newTargets)
    try {
      await fetch('/api/user-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spend_targets: newTargets }),
      })
      localStorage.setItem(TARGETS_KEY, JSON.stringify(newTargets))
    } catch (e) {
      console.error('Erreur sauvegarde', e)
    }
  }

  const resetTargets = () => {
    setTargets({})
    localStorage.removeItem(TARGETS_KEY)
    fetch('/api/user-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spend_targets: {} }),
    }).catch(console.error)
  }

  // Calculs pour les stats
  const totalSpent = totals.reduce((sum, t) => sum + t.total, 0)
  const totalBudget = Object.values(targets).reduce((sum, t) => sum + (t || 0), 0)
  const categoriesOverBudget = totals.filter(t => targets[t.category] && t.total > targets[t.category]).length
  const categoriesUnderBudget = totals.filter(t => targets[t.category] && t.total <= targets[t.category]).length

  return (
    <div className="pb-20 px-3 sm:px-4 md:px-8 space-y-6 w-full max-w-6xl mx-auto">
      {/* Header avec titre et indicateur de mois */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-4"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30">
                <Calculator className="w-6 h-6 text-purple-400" />
              </div>
              Prévisionnel
            </h1>
            <p className="text-slate-400 text-sm mt-1">Gérez vos budgets et objectifs de dépenses</p>
          </div>
          
          {!isCurrentMonth && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl"
            >
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-300">
                {new Date(selectedMonth + '-01').toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Cartes de statistiques */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
      >
        <Card className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border-blue-500/30 shadow-lg shadow-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-300/70 uppercase tracking-wide">Total dépensé</p>
                <p className="text-xl md:text-2xl font-bold text-blue-400 mt-1">{fmt(totalSpent)}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/20">
                <TrendingDown className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 border-purple-500/30 shadow-lg shadow-purple-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-300/70 uppercase tracking-wide">Budget total</p>
                <p className="text-xl md:text-2xl font-bold text-purple-400 mt-1">{fmt(totalBudget)}</p>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Target className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/40 to-green-800/20 border-green-500/30 shadow-lg shadow-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-300/70 uppercase tracking-wide">Dans le budget</p>
                <p className="text-xl md:text-2xl font-bold text-green-400 mt-1">{categoriesUnderBudget}</p>
              </div>
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-900/40 to-red-800/20 border-red-500/30 shadow-lg shadow-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-300/70 uppercase tracking-wide">Dépassements</p>
                <p className="text-xl md:text-2xl font-bold text-red-400 mt-1">{categoriesOverBudget}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-500/20">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Section principale */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 space-y-5"
        >
          {/* Contrôles */}
          <Card className="border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-slate-700/50 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Paramètres d&apos;analyse
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Fenêtre:</span>
                  <select 
                    value={monthsWindow} 
                    onChange={(e) => setMonthsWindow(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-lg bg-slate-700/50 text-white text-sm border border-slate-600/50 focus:border-purple-500/50 focus:outline-none"
                  >
                    {[1, 2, 3, 6, 12].map(n => (
                      <option key={n} value={n}>{n} mois</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                <Button 
                  onClick={computeAlgorithm}
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/20"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Calculer les recommandations
                </Button>
                <Button 
                  variant="outline" 
                  onClick={resetTargets}
                  className="border-slate-600 hover:bg-slate-700/50"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Réinitialiser objectifs
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Onglets */}
          <Card className="border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 shadow-xl overflow-hidden">
            <CardHeader className="border-b border-slate-700/50 pb-0 pt-4 px-4">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('totals')}
                  className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all relative ${
                    activeTab === 'totals' 
                      ? 'text-white bg-slate-700/50' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4" />
                    <span>Dépenses par catégorie</span>
                  </div>
                  {activeTab === 'totals' && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500"
                    />
                  )}
                </button>
                {recoVisible && (
                  <button
                    onClick={() => setActiveTab('reco')}
                    className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all relative ${
                      activeTab === 'reco' 
                        ? 'text-white bg-slate-700/50' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span>Recommandations</span>
                    </div>
                    {activeTab === 'reco' && (
                      <motion.div 
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500"
                      />
                    )}
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <AnimatePresence mode="wait">
                {activeTab === 'totals' && (
                  <motion.div
                    key="totals"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
                      </div>
                    ) : totals.length === 0 ? (
                      <div className="text-center py-12">
                        <PieChart className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">Aucune dépense trouvée pour cette période</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {totals.map((t, idx) => {
                          const cat = t.category
                          const val = Number(t.total || 0)
                          const target = targets[cat] || 0
                          const progress = target > 0 ? Math.min((val / target) * 100, 100) : 0
                          const isOverBudget = target > 0 && val > target
                          
                          return (
                            <motion.div 
                              key={cat}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              className={`p-3 rounded-xl border transition-all ${
                                isOverBudget 
                                  ? 'bg-red-900/20 border-red-500/30' 
                                  : target > 0 
                                    ? 'bg-green-900/10 border-green-500/20' 
                                    : 'bg-slate-800/50 border-slate-700/50'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-white truncate">{cat}</span>
                                    {isOverBudget && (
                                      <span className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded-full">
                                        Dépassé
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className={`text-lg font-bold ${isOverBudget ? 'text-red-400' : 'text-slate-200'}`}>
                                      {fmt(val)}
                                    </span>
                                    {target > 0 && (
                                      <span className="text-xs text-slate-400">
                                        / {fmt(target)}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Barre de progression */}
                                  {target > 0 && (
                                    <div className="mt-2">
                                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                        <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: `${Math.min(progress, 100)}%` }}
                                          transition={{ delay: idx * 0.03 + 0.2, duration: 0.5 }}
                                          className={`h-full rounded-full ${
                                            isOverBudget ? 'bg-red-500' : progress > 80 ? 'bg-orange-500' : 'bg-green-500'
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Target className="w-4 h-4 text-slate-400" />
                                  <Input
                                    type="number"
                                    value={targets[cat] ?? ''}
                                    onChange={(e) => {
                                      const v = e.target.value === '' ? 0 : Number(e.target.value.replace(',', '.'))
                                      saveTarget(cat, v)
                                    }}
                                    placeholder="Objectif"
                                    className="w-24 h-8 text-sm bg-slate-900/50 border-slate-600/50 focus:border-purple-500/50"
                                  />
                                  <span className="text-xs text-slate-400">€</span>
                                </div>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'reco' && (
                  <motion.div
                    key="reco"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    {fileError && (
                      <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-300">Erreur de calcul</p>
                          <p className="text-xs text-red-400/80 mt-1">{fileError}</p>
                        </div>
                      </div>
                    )}
                    
                    {budgets.length > 0 && (
                      <div className="space-y-2">
                        {budgets.map((b, idx) => (
                          <motion.div 
                            key={b.category}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="p-4 rounded-xl bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/20"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-white">{b.category}</p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Moyenne mensuelle: {fmt(Number(b.avgPerMonth || 0))}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-xs text-slate-400">Recommandé</p>
                                  <p className="text-xl font-bold text-purple-400">{fmt(Number(b.recommendedMonthly || 0))}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-purple-500/30 hover:bg-purple-500/20"
                                  onClick={() => saveTarget(b.category, Number(b.recommendedMonthly || 0))}
                                >
                                  <ChevronRight className="w-4 h-4" />
                                  Appliquer
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                    
                    {!fileError && budgets.length === 0 && (
                      <div className="text-center py-12">
                        <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">Cliquez sur &quot;Calculer les recommandations&quot;</p>
                        <p className="text-xs text-slate-500 mt-1">pour obtenir des suggestions personnalisées</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sidebar - Crédits */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <CreditTrackingCard />
          
          {/* Résumé rapide */}
          <Card className="border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-slate-400" />
                Résumé du mois
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                <span className="text-xs text-slate-400">Catégories suivies</span>
                <span className="text-sm font-medium text-white">{totals.length}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                <span className="text-xs text-slate-400">Objectifs définis</span>
                <span className="text-sm font-medium text-white">{Object.keys(targets).filter(k => targets[k] > 0).length}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-slate-400">Reste à budgéter</span>
                <span className={`text-sm font-medium ${totalBudget >= totalSpent ? 'text-green-400' : 'text-red-400'}`}>
                  {fmt(Math.abs(totalBudget - totalSpent))}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
