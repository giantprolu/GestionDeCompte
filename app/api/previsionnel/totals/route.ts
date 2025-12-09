import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

// Catégories fixes à exclure du budget variable
const FIXED_CATEGORIES = ['logement', 'allocation', 'assurances', 'santé', 'abonnements']

// Vérifier si une catégorie est fixe
const isFixedCategory = (categoryName: string) => {
  const normalized = categoryName.toLowerCase().trim()
  return FIXED_CATEGORIES.some(fixed => normalized.includes(fixed))
}

// Helper pour obtenir le mois précédent au format YYYY-MM
function getPreviousMonth(monthYear: string): string {
  const [year, month] = monthYear.split('-').map(Number)
  const prevDate = new Date(year, month - 2, 1) // month-1 pour 0-indexed, -1 pour mois précédent
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
}

// Helper pour ajouter un jour à une date ISO
function addOneDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const url = new URL(request.url)
    const monthsWindow = Number(url.searchParams.get('monthsWindow') || '1') || 1
    const selectedMonth = url.searchParams.get('selectedMonth') // Format: YYYY-MM

    // 1) récupérer comptes de l'utilisateur avec leurs soldes initiaux
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, name, exclude_from_previsionnel, initial_balance')
      .eq('user_id', userId)

    if (accountsError) {
      console.error('Erreur récupération comptes:', accountsError)
      return NextResponse.json({ error: 'Erreur récupération comptes' }, { status: 500 })
    }

    // Filtrer les comptes qui ne sont pas exclus du prévisionnel
    const accountsIncluded = (accounts || []).filter((a) => a.exclude_from_previsionnel !== true)
    const accountsExcluded = (accounts || []).filter((a) => a.exclude_from_previsionnel === true)
    const accountIds = accountsIncluded.map((a) => a.id)
    
    // Calculer les totaux des soldes (utiliser initial_balance comme la page /comptes)
    const totalBalanceIncluded = accountsIncluded.reduce((sum, a) => sum + Number(a.initial_balance || 0), 0)
    const totalBalanceExcluded = accountsExcluded.reduce((sum, a) => sum + Number(a.initial_balance || 0), 0)
    const totalBalanceAll = totalBalanceIncluded + totalBalanceExcluded
    
    // Compter les comptes exclus pour info
    const excludedCount = accountsExcluded.length
    
    if (accountIds.length === 0) return NextResponse.json({ error: 'Aucun compte trouvé (ou tous exclus du prévisionnel)' }, { status: 400 })

    // 2) Déterminer les dates de début/fin en utilisant les clôtures
    let startDate: string | null = null
    let endDate: string | null = null
    let useNonArchived = false

    if (selectedMonth) {
      // Récupérer la clôture du mois sélectionné
      const { data: closure } = await supabase
        .from('month_closures')
        .select('start_date, end_date')
        .eq('user_id', userId)
        .eq('month_year', selectedMonth)
        .single()

      if (closure) {
        // Mois clôturé - utiliser ses dates
        startDate = closure.start_date
        endDate = closure.end_date
      } else {
        // Mois pas encore clôturé (mois en cours)
        // Chercher la clôture du mois précédent pour avoir la date de début
        const prevMonth = getPreviousMonth(selectedMonth)
        const { data: prevClosure } = await supabase
          .from('month_closures')
          .select('end_date')
          .eq('user_id', userId)
          .eq('month_year', prevMonth)
          .single()

        if (prevClosure) {
          // Le mois actuel commence le lendemain de la fin du mois précédent
          startDate = addOneDay(prevClosure.end_date)
          // Pas de date de fin - on prend toutes les transactions non archivées après cette date
          useNonArchived = true
        } else {
          // Aucune clôture trouvée - utiliser toutes les transactions non archivées
          useNonArchived = true
        }
      }
    } else {
      // Pas de mois sélectionné - utiliser les transactions non archivées
      useNonArchived = true
    }

    // 3) Récupérer les transactions selon la logique déterminée
    let txs
    let error
    
    // Date d'aujourd'hui pour le filtre optionnel
    const today = new Date().toISOString().split('T')[0]
    
    // Paramètre pour inclure ou non les transactions futures
    const includeFuture = url.searchParams.get('includeFuture') !== 'false' // par défaut true pour le prévisionnel

    if (useNonArchived) {
      // Récupérer les transactions non archivées
      let query = supabase
        .from('transactions')
        .select('amount,date,type,category:categories(name,type)')
        .in('account_id', accountIds)
        .neq('archived', true)
      
      // Si on ne veut pas les transactions futures, filtrer par date
      if (!includeFuture) {
        query = query.lte('date', today)
      }
      
      // Si on a une date de début (lendemain de la clôture précédente), filtrer
      if (startDate) {
        query = query.gte('date', startDate)
      }
      
      const result = await query
      txs = result.data
      error = result.error
    } else {
      // Récupérer les transactions dans la période clôturée
      const result = await supabase
        .from('transactions')
        .select('amount,date,type,category:categories(name,type)')
        .in('account_id', accountIds)
        .gte('date', startDate!)
        .lte('date', endDate!)
      txs = result.data
      error = result.error
    }

    if (error) throw error
    const transactions = txs || []

    // 4) Agrégation par catégorie - séparer fixes et variables
    const sums: Record<string, number> = {}
    const fixedSums: Record<string, number> = {}
    let totalIncome = 0
    let totalFixedExpenses = 0
    let totalVariableExpenses = 0
    
    for (const t of transactions) {
      const txRecord = t as { category?: { name?: string; type?: string } | { name?: string; type?: string }[]; type?: string; amount?: number }
      const rawCat = txRecord.category
      const catData = Array.isArray(rawCat) ? rawCat[0] : rawCat
      const catType = catData?.type
      const txType = txRecord.type
      const name = catData?.name || 'Non catégorisé'
      const amt = Number(t.amount || 0)
      const val = amt < 0 ? Math.abs(amt) : amt
      
      // Revenus
      if (txType === 'income') {
        totalIncome += val
        continue
      }
      
      // Considérer comme dépense si le type de transaction OU le type de catégorie est 'expense'
      if (txType !== 'expense' && catType !== 'expense') continue
      
      // Séparer dépenses fixes et variables
      if (isFixedCategory(name)) {
        fixedSums[name] = (fixedSums[name] || 0) + val
        totalFixedExpenses += val
      } else {
        sums[name] = (sums[name] || 0) + val
        totalVariableExpenses += val
      }
    }
    // Dépenses variables (pour le budget)
    const variableTotals = Object.keys(sums).map(k => ({ 
      category: k, 
      total: Number(sums[k].toFixed(2)), 
      avgPerMonth: Number((sums[k] / monthsWindow).toFixed(2)),
      isFixed: false
    }))
    variableTotals.sort((a, b) => b.total - a.total)
    
    // Dépenses fixes (pour info)
    const fixedTotals = Object.keys(fixedSums).map(k => ({ 
      category: k, 
      total: Number(fixedSums[k].toFixed(2)), 
      avgPerMonth: Number((fixedSums[k] / monthsWindow).toFixed(2)),
      isFixed: true
    }))
    fixedTotals.sort((a, b) => b.total - a.total)

    return NextResponse.json({ 
      totals: variableTotals,
      fixedTotals: fixedTotals,
      summary: {
        totalIncome: Number(totalIncome.toFixed(2)),
        totalFixedExpenses: Number(totalFixedExpenses.toFixed(2)),
        totalVariableExpenses: Number(totalVariableExpenses.toFixed(2)),
        availableForVariable: Number((totalIncome - totalFixedExpenses).toFixed(2)),
        potentialSavings: Number((totalIncome - totalFixedExpenses - totalVariableExpenses).toFixed(2)),
        // Nouveaux champs basés sur les soldes des comptes
        totalBalanceIncluded: Number(totalBalanceIncluded.toFixed(2)),
        totalBalanceExcluded: Number(totalBalanceExcluded.toFixed(2)),
        totalBalanceAll: Number(totalBalanceAll.toFixed(2))
      },
      meta: { monthsWindow, startDate, endDate, useNonArchived, excludedAccountsCount: excludedCount } 
    })
  } catch (err) {
    console.error('Error /api/previsionnel/totals GET:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
