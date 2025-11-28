"use client"
// ...existing code...
// ...existing code...

import { useEffect, useState } from 'react'
import CreditTrackingCard from '@/components/CreditTrackingCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { getMonthClosure } from '@/lib/utils'

type ImportedTx = {
  date: string
  amount: number
  type?: string
  category?: string
  note?: string
}

export default function PrevisionnelPage() {
    const [activeTab, setActiveTab] = useState<'totals' | 'reco'>('totals')
    const [recoVisible, setRecoVisible] = useState(false)
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' €'
  const [totals, setTotals] = useState<any[]>([])
  const [monthsWindow, setMonthsWindow] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [targets, setTargets] = useState<Record<string, number>>({})
  const [transactionsPreview, setTransactionsPreview] = useState<ImportedTx[] | null>(null)
  const [budgets, setBudgets] = useState<any[]>([])
  const [fileError, setFileError] = useState<string | null>(null)

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const [monthClosure, setMonthClosureState] = useState<{ start_date: string, end_date: string } | null>(null)

  const allMonths = transactionsPreview ? Array.from(new Set(transactionsPreview.map(txn => {
    const d = new Date(txn.date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }))).sort().reverse() : [];

  // Récupération de la période de clôture du mois sélectionné
  useEffect(() => {
    async function fetchClosure() {
      // Récupérer l'utilisateur courant (à adapter selon votre auth)
      // Ici, à adapter selon la logique d'utilisateur de la page
      const userId = null // À remplacer par l'ID utilisateur réel
      if (!userId) return
      const closure = await getMonthClosure(userId, selectedMonth)
      setMonthClosureState(closure)
    }
    fetchClosure()
  }, [selectedMonth])

  // Filtrer les transactions preview selon la période de clôture
  const filteredTransactionsPreview = monthClosure && transactionsPreview ? transactionsPreview.filter(txn => {
    return txn.date >= monthClosure.start_date && txn.date <= monthClosure.end_date && !(txn as any).archived
  }) : [];

  const TARGETS_KEY = 'spend_targets_v1'

  useEffect(() => {
    // Charger les objectifs depuis l'API serveur
    const fetchUserSettings = async () => {
      try {
        const res = await fetch('/api/user-settings')
        const json = await res.json()
        if (json.spend_targets) {
          setTargets(json.spend_targets)
          localStorage.setItem(TARGETS_KEY, JSON.stringify(json.spend_targets))
        } else {
          // fallback localStorage si pas de settings serveur
          const raw = localStorage.getItem(TARGETS_KEY)
          if (raw) setTargets(JSON.parse(raw))
        }
      } catch (e) {
        // fallback localStorage si erreur serveur
        const raw = localStorage.getItem(TARGETS_KEY)
        if (raw) setTargets(JSON.parse(raw))
      }
    }
    fetchUserSettings()
  }, [])

  useEffect(() => {
    const fetchTotals = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/previsionnel/totals?monthsWindow=${monthsWindow}`)
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
  }, [monthsWindow])

  const saveTargets = async () => {
    try {
      // Sauvegarde serveur
      await fetch('/api/user-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spend_targets: targets }),
      })
      // Sauvegarde locale pour fallback/offline
      localStorage.setItem(TARGETS_KEY, JSON.stringify(targets))
    } catch (e) {
      console.error('Erreur sauvegarde targets', e)
    }
  }

  // Parse simple CSV (headers required: date,amount,category,type)
  const parseCSV = async (text: string): Promise<ImportedTx[]> => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return []
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const rows = lines.slice(1)
    return rows.map(r => {
      const cols = r.split(',')
      const obj: any = {}
      headers.forEach((h, i) => { obj[h] = cols[i] })
      return {
        date: obj.date,
        amount: parseFloat((obj.amount || '0').replace(',', '.')),
        category: obj.category || obj.cat || obj.categorie,
        type: obj.type,
        note: obj.note || '',
      }
    })
  }

  const handleFile = async (file: File | null) => {
    setFileError(null)
    setTransactionsPreview(null)
    setBudgets([])
    if (!file) return
    try {
      const text = await file.text()
      let parsed: ImportedTx[] = []
      if (file.name.endsWith('.json')) {
        const j = JSON.parse(text)
        if (Array.isArray(j)) {
          parsed = j.map((t: any) => ({ date: t.date, amount: Number(t.amount), category: t.category || t.cat, type: t.type, note: t.note }))
        } else {
          throw new Error('JSON must be an array of transactions')
        }
      } else {
        parsed = await parseCSV(text)
      }
      setTransactionsPreview(parsed.slice(0, 500))
    } catch (err: any) {
      setFileError(err?.message || 'Erreur parsing file')
    }
  }

  const computeBudgets = async () => {
    setFileError(null)
    setBudgets([])
    if (!transactionsPreview || transactionsPreview.length === 0) {
      setFileError('Aucune transaction à analyser')
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/previsionnel/calc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: transactionsPreview, monthsWindow }),
      })
      const json = await res.json()
      if (!res.ok) {
        setFileError(json?.error || 'Erreur calcul')
      } else {
        setBudgets(json.budgets || [])
      }
    } catch (err: any) {
      setFileError(err?.message || 'Erreur calcul')
    } finally { setLoading(false) }
  }

  const computeFromDB = async () => {
    setFileError(null)
    setBudgets([])
    try {
      setLoading(true)
      const res = await fetch('/api/previsionnel/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthsWindow }),
      })
      const json = await res.json()
      if (!res.ok) setFileError(json?.error || 'Erreur calcul depuis la base')
      else {
        setBudgets((budgets) => {
          return json.budgets || []
        })
      }
    } catch (err: any) {
      setFileError(err?.message || 'Erreur calcul depuis la base')
    } finally { setLoading(false) }
  }

  const computeAlgorithm = async () => {
    setFileError(null)
    setBudgets([])
    try {
      setLoading(true)
      const res = await fetch('/api/previsionnel/algorithm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthsWindow })
      })
      const json = await res.json()
      if (!res.ok) setFileError(json?.error || 'Erreur algorithm')
      else setBudgets((budgets) => {
        return json.budgets || []
      })
      setRecoVisible(true)
      setActiveTab('reco')
    } catch (err: any) {
      setFileError(err?.message || 'Erreur algorithm')
    } finally { setLoading(false) }
  }

  return (
    <div className="pb-20 px-2 sm:px-4 md:px-8 space-y-6 w-full max-w-5xl mx-auto">
      {/* Onglets de sélection de mois */}
      <div className="mb-4">
        <div className="flex gap-2 overflow-x-auto">
          {allMonths.map(month => (
            <Button
              key={month}
              variant={month === selectedMonth ? 'default' : 'outline'}
              className={month === selectedMonth ? 'font-bold bg-blue-600 text-white' : ''}
              onClick={() => setSelectedMonth(month)}
            >
              {new Date(month + '-01').toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 pt-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Prévisionnel</h1>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
        <div className="space-y-4 lg:col-span-2">
          <Card className="border-2 border-slate-700/50 bg-gradient-to-br from-slate-800/95 to-slate-900/95 shadow-xl">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Importer des données / Calcul manuel</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs sm:text-sm text-slate-400 mb-3">Totaux des dépenses par catégorie (fenêtre: derniers {monthsWindow} mois).</p>
              <div className="flex flex-col sm:flex-row items-center gap-2 mb-3">
                <label className="text-xs sm:text-sm text-slate-300">Fenêtre (mois):</label>
                <input type="number" min={1} value={monthsWindow} onChange={(e) => setMonthsWindow(Number(e.target.value))} className="px-2 py-1 rounded bg-slate-700/50 text-white w-20" />
                {loading && <div className="text-xs sm:text-sm text-slate-300 ml-2">Chargement...</div>}
                <div className="flex flex-row gap-2 mt-2 sm:mt-0 ml-0 sm:ml-4 w-full sm:w-auto">
                  <Button size="sm" className="w-full sm:w-auto bg-emerald-600" onClick={() => computeAlgorithm()}>Calculer recommandations</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-700/50 bg-gradient-to-br from-slate-800/95 to-slate-900/95 shadow-xl">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Preview transactions / Résultats</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={tab => setActiveTab(tab as 'totals' | 'reco')} className="w-full">
                <div className="flex gap-2 mb-4">
                  <Button
                    variant={activeTab === 'totals' ? 'default' : 'outline'}
                    size="sm"
                    className={`min-w-[120px] ${activeTab === 'totals' ? 'border-green-500/50 bg-gradient-to-br from-green-500/20 to-green-600/20 text-green-300 shadow-lg shadow-green-500/20' : ''}`}
                    onClick={() => setActiveTab('totals')}
                  >
                    Totaux par catégorie
                  </Button>
                  {recoVisible && (
                    <Button
                      variant={activeTab === 'reco' ? 'default' : 'outline'}
                      size="sm"
                      className={`min-w-[120px] ${activeTab === 'reco' ? 'border-green-500/50 bg-gradient-to-br from-green-500/20 to-green-600/20 text-green-300 shadow-lg shadow-green-500/20' : ''}`}
                      onClick={() => setActiveTab('reco')}
                    >
                      Recommandations
                    </Button>
                  )}
                </div>
                <div className="mt-3 flex flex-col sm:flex-row items-center justify-end gap-2">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => { setTargets({}); localStorage.removeItem(TARGETS_KEY) }}>Réinitialiser</Button>
                </div>
                <TabsContent value="totals">
                  <div className="text-xs sm:text-sm text-slate-200 lg:max-h-none lg:overflow-visible max-h-[350px] sm:max-h-64 overflow-auto">
                    {totals.length === 0 ? (
                      <div className="text-xs sm:text-sm text-slate-400">Aucun total disponible.</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {totals.map((t: any) => {
                          const cat = t.category
                          const val = Number(t.total || 0)
                          return (
                            <div key={cat} className="p-2 bg-slate-800/60 rounded border border-slate-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                              <div className="flex-1">
                                <div className="text-xs sm:text-sm font-medium truncate">{cat}</div>
                                <div className="text-[10px] sm:text-xs text-slate-400">Total: {fmt(val)}</div>
                              </div>
                              <div className="w-full sm:w-36 mt-2 sm:mt-0">
                                <Label className="text-[10px] sm:text-xs">Objectif</Label>
                                <Input
                                  type="number"
                                  value={targets[cat] ?? ''}
                                  onChange={async (e) => {
                                    const v = e.target.value === '' ? '' : Number(String(e.target.value).replace(',', '.'))
                                    const newTargets = { ...targets, [cat]: v === '' ? 0 : Number(v) }
                                    setTargets(newTargets)
                                    // Sauvegarde auto à chaque modification
                                    try {
                                      await fetch('/api/user-settings', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ spend_targets: newTargets }),
                                      })
                                      localStorage.setItem('spend_targets_v1', JSON.stringify(newTargets))
                                    } catch (e) {
                                      console.error('Erreur sauvegarde auto', e)
                                    }
                                  }}
                                  className="w-full"
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="reco">
                  <div className="text-xs sm:text-sm text-slate-200 lg:max-h-none lg:overflow-visible max-h-[350px] sm:max-h-64 overflow-auto">
                    {fileError && (
                      <div className="mt-4 p-3 bg-red-900/80 border border-red-700 rounded text-red-200 text-xs sm:text-sm">
                        <strong>Erreur de recommandation&nbsp;:</strong> {fileError}
                      </div>
                    )}
                    {budgets.length > 0 && (
                      <>
                        <div className="mt-4">
                          <h3 className="text-xs sm:text-sm font-semibold text-slate-200 mb-2">Recommandations</h3>
                          <div className="space-y-2">
                            {budgets.map((b: any) => {
                              return (
                                <div key={b.category} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2 bg-slate-800/60 rounded border border-slate-700/50">
                                  <div>
                                    <div className="text-xs sm:text-sm font-medium">{b.category}</div>
                                    <div className="text-[10px] sm:text-xs text-slate-400">Moyenne/mois: {fmt(Number(b.avgPerMonth || 0))}</div>
                                  </div>
                                  <div className="text-right mt-2 sm:mt-0">
                                    <div className="text-xs sm:text-sm text-slate-300">Recommandé</div>
                                    <div className="text-base sm:text-lg font-bold">{fmt(Number(b.recommendedMonthly || 0))}</div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 mt-6 lg:mt-0">
          <div className="space-y-4">
            <CreditTrackingCard />
          </div>
        </div>
      </div>
    </div>
  )
}
