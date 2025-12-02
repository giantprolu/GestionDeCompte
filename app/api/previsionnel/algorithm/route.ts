import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/db'

type Budget = {
  category: string
  total: number
  avgPerMonth: number
  recommendedMonthly: number
  isFixed: boolean
  realistic?: number
  objectif?: number
  base?: number
}

function normalizeName(s: unknown) {
  return (s || '').toString().trim().toLowerCase()
}

// Keyword lists for fixed expenses - catégories à exclure du budget variable
const FIXED_KEYWORDS = [
  'logement', 'loyer', 'allocation', 'assurance', 'assurances', 'santé', 'sante', 
  'abonnement', 'abonnements', 'facture', 'impot', 'impôts', 'impots', 
  'crédit', 'credit', 'remboursement', 'épargne', 'epargne'
]

// Helper pour obtenir le mois précédent au format YYYY-MM
function getPreviousMonth(monthYear: string): string {
  const [year, month] = monthYear.split('-').map(Number)
  const prevDate = new Date(year, month - 2, 1)
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const monthsWindow = Number(body.monthsWindow) || 3
    const selectedMonth = body.selectedMonth // Format: YYYY-MM
    const savingsRate = Number(body.savingsRate ?? 0.1)
    const objectifs = body.targets || {};

    // load user's accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId)

    const accountIds = (accounts || []).map((a: { id: string }) => a.id)

    if (accountIds.length === 0) {
      return NextResponse.json({ error: 'Aucun compte trouvé' }, { status: 400 })
    }

    // Pour les recommandations, on utilise les N mois PRÉCÉDENTS (pas le mois actuel)
    // Car on ne peut pas faire de recommandations basées sur des données incomplètes
    
    // Calculer les mois précédents à analyser
    const monthsToAnalyze: string[] = []
    let currentAnalysisMonth = selectedMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    
    for (let i = 0; i < monthsWindow; i++) {
      currentAnalysisMonth = getPreviousMonth(currentAnalysisMonth)
      monthsToAnalyze.push(currentAnalysisMonth)
    }

    // Récupérer les clôtures des mois à analyser
    const { data: closures } = await supabase
      .from('month_closures')
      .select('month_year, start_date, end_date')
      .eq('user_id', userId)
      .in('month_year', monthsToAnalyze)

    // Construire les périodes à partir des clôtures trouvées
    const periods: { start: string; end: string }[] = []
    
    if (closures && closures.length > 0) {
      for (const closure of closures) {
        periods.push({ start: closure.start_date, end: closure.end_date })
      }
    }

    // Si aucune clôture trouvée, utiliser des dates calendaires approximatives
    if (periods.length === 0) {
      for (const monthYear of monthsToAnalyze) {
        const [year, month] = monthYear.split('-').map(Number)
        const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
        const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0]
        periods.push({ start: startOfMonth, end: endOfMonth })
      }
    }

    // Fetch transactions pour toutes les périodes
    interface TransactionRecord {
      amount: number
      date: string
      type: string
      category?: { name?: string } | { name?: string }[]
    }
    let allTransactions: TransactionRecord[] = []
    
    for (const period of periods) {
      const { data: txs, error } = await supabase
        .from('transactions')
        .select('amount,date,type,category:categories(name)')
        .in('account_id', accountIds)
        .gte('date', period.start)
        .lte('date', period.end)
      
      if (!error && txs) {
        allTransactions = [...allTransactions, ...txs]
      }
    }

    const transactions = allTransactions
    const actualMonthsAnalyzed = periods.length || monthsWindow

    // Regrouper les transactions par catégorie
    const txByCat: Record<string, number[]> = {}
    let totalExpenses = 0
    let totalIncome = 0
    for (const t of transactions) {
      const amt = Number(t.amount || 0)
      if (t.type === 'income') {
        totalIncome += amt
        continue
      }
      const val = amt < 0 ? Math.abs(amt) : amt
      const rawCat = t.category
      const name = (Array.isArray(rawCat) ? rawCat[0]?.name : rawCat?.name) || 'Non catégorisé'
      if (!txByCat[name]) txByCat[name] = []
      txByCat[name].push(val)
      totalExpenses += val
    }

    // Calculer moyenne et médiane par catégorie
    function median(arr: number[]) {
      if (!arr.length) return 0
      const sorted = [...arr].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }

    const budgets: Budget[] = Object.keys(txByCat).map(k => {
      const arr = txByCat[k]
      const avg = arr.reduce((s, v) => s + v, 0) / Math.max(1, actualMonthsAnalyzed)
      const med = median(arr)
      // Choisir la plus réaliste (médiane si > 0, sinon moyenne)
      const realistic = med > 0 ? med : avg
      // Objectif utilisateur (si défini)
      const objectif = typeof objectifs[k] === 'number' ? objectifs[k] : undefined;
      return {
        category: k,
        total: Number(arr.reduce((s, v) => s + v, 0).toFixed(2)),
        avgPerMonth: Number(avg.toFixed(2)),
        recommendedMonthly: 0,
        isFixed: false,
        realistic,
        objectif,
      }
    })

    // Classer fixes/variables
    for (const b of budgets) {
      const name = normalizeName(b.category)
      b.isFixed = FIXED_KEYWORDS.some(kw => name.includes(kw))
    }

    // compute cap disponible: avgIncome per month minus savings
    const avgIncomePerMonth = totalIncome / Math.max(1, actualMonthsAnalyzed)
    // fallback: if no income, estimate from expenses * 1.2
    const effectiveIncome = avgIncomePerMonth > 0 ? avgIncomePerMonth : (totalExpenses / Math.max(1, actualMonthsAnalyzed)) * 1.2
    const savings = effectiveIncome * savingsRate
    const capDisponible = effectiveIncome - savings

    // Fixes : garder la moyenne historique exacte, aucune réduction ni ratio
    for (const b of budgets.filter(b => b.isFixed)) {
      // Si objectif défini, il remplace la moyenne historique
      if (typeof b.objectif === 'number' && !isNaN(b.objectif)) {
        b.recommendedMonthly = Number(b.objectif.toFixed(2));
      } else {
        b.recommendedMonthly = Number(b.avgPerMonth.toFixed(2));
      }
    }
    const fixedTotal = budgets.filter(b => b.isFixed).reduce((s, b) => s + b.recommendedMonthly, 0)

    // Si fixes > capDisponible : impossible
    if (fixedTotal > capDisponible) {
      return NextResponse.json({ error: 'Le total des dépenses fixes dépasse le budget disponible. Aucun budget variable possible.', meta: { monthsWindow, effectiveIncome, capDisponible, fixedTotal } }, { status: 200 })
    }

    // Variables : base = moyenne historique
    const availableForVars = capDisponible - fixedTotal
    const variableBudgets = budgets.filter(b => !b.isFixed)
    // Base = objectif ou moyenne historique
    for (const b of variableBudgets) {
      if (typeof b.objectif === 'number' && !isNaN(b.objectif)) {
        b.base = b.objectif;
      } else {
        b.base = b.avgPerMonth;
      }
      if (typeof b.base !== 'number' || isNaN(b.base)) b.base = 0;
    }
    const variableBases = variableBudgets.reduce((s, b) => s + (b.base || 0), 0)

    // Ratio réel
    let ratio = 1
    if (variableBases > 0) {
      ratio = Math.min(1, availableForVars / variableBases)
    }

    // Appliquer le ratio uniquement aux variables
    for (const b of variableBudgets) {
      const baseVal = typeof b.base === 'number' && !isNaN(b.base) ? b.base : 0;
      b.recommendedMonthly = Number((baseVal * ratio).toFixed(2));
    }

    // Minimum pour toutes variables : 10€
    for (const b of variableBudgets) {
      if (b.recommendedMonthly < 10) b.recommendedMonthly = 10
    }

    // Redistribution du reste uniquement sur Alimentation, Transport, Santé
    const totalVars = variableBudgets.reduce((s, b) => s + b.recommendedMonthly, 0)
    const resteVars = availableForVars - totalVars
    if (resteVars > 0) {
      const ESSENTIALS = ['alimentation', 'transport', 'santé']
      const essentials = variableBudgets.filter(b => ESSENTIALS.some(e => normalizeName(b.category).includes(e)))
      // Utiliser la base (objectif ou moyenne) pour le calcul du poids
      const totalEssentialsBase = essentials.reduce((s, b) => s + (typeof b.base === 'number' && !isNaN(b.base) ? b.base : 0), 0);
      for (const b of essentials) {
        const base = typeof b.base === 'number' && !isNaN(b.base) ? b.base : 0;
        const poids = totalEssentialsBase > 0 ? base / totalEssentialsBase : 1 / essentials.length;
        const allocation = resteVars * poids;
        b.recommendedMonthly = Number((b.recommendedMonthly + allocation).toFixed(2));
        if (b.recommendedMonthly < 10) b.recommendedMonthly = 10;
      }
    }

    // Vérifier le plafond final
    const totalRecommended = budgets.reduce((s, b) => s + b.recommendedMonthly, 0)
    if (totalRecommended > capDisponible + fixedTotal) {
      // Réduire proportionnellement uniquement les variables (jamais les fixes)
      const over = totalRecommended - (capDisponible + fixedTotal)
      const totalVars = variableBudgets.reduce((s, b) => s + b.recommendedMonthly, 0)
      for (const b of variableBudgets) {
        const part = totalVars > 0 ? b.recommendedMonthly / totalVars : 1 / variableBudgets.length
        b.recommendedMonthly = Number(Math.max(10, b.recommendedMonthly - over * part).toFixed(2))
      }
    }

    // Tri par montant total décroissant
    budgets.sort((a, b) => b.total - a.total)

    return NextResponse.json({ 
      budgets, 
      meta: { 
        monthsWindow, 
        actualMonthsAnalyzed,
        monthsAnalyzed: monthsToAnalyze,
        effectiveIncome, 
        capDisponible, 
        fixedTotal 
      } 
    })
  } catch (err) {
    console.error('Error /api/previsionnel/algorithm POST:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
