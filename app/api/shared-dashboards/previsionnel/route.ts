import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/db'

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
  const prevDate = new Date(year, month - 2, 1)
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
}

// Helper pour ajouter un jour à une date ISO
function addOneDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// GET - Récupérer les totaux prévisionnels d'un compte partagé
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const url = new URL(request.url)
    const ownerUserId = url.searchParams.get('ownerUserId')
    const selectedMonth = url.searchParams.get('selectedMonth')
    const monthsWindow = Number(url.searchParams.get('monthsWindow') || '1') || 1

    if (!ownerUserId) {
      return NextResponse.json({ error: 'ownerUserId requis' }, { status: 400 })
    }

    // Vérifier que l'utilisateur a accès à ce dashboard partagé
    const { data: share, error: shareError } = await supabase
      .from('shared_dashboards')
      .select('id, owner_user_id, permission')
      .eq('owner_user_id', ownerUserId)
      .eq('shared_with_user_id', userId)
      .single()

    if (shareError || !share) {
      return NextResponse.json({ error: 'Accès non autorisé à ce dashboard' }, { status: 403 })
    }

    // Récupérer les comptes du propriétaire avec leurs soldes
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name, exclude_from_previsionnel, initial_balance')
      .eq('user_id', ownerUserId)

    // Filtrer les comptes inclus/exclus du prévisionnel
    const accountsIncluded = (accounts || []).filter((a: { exclude_from_previsionnel?: boolean }) => a.exclude_from_previsionnel !== true)
    const accountsExcluded = (accounts || []).filter((a: { exclude_from_previsionnel?: boolean }) => a.exclude_from_previsionnel === true)
    const accountIds = accountsIncluded.map((a: { id: string }) => a.id)
    
    // Calculer les totaux des soldes
    const totalBalanceIncluded = accountsIncluded.reduce((sum: number, a: { initial_balance?: number }) => sum + Number(a.initial_balance || 0), 0)
    const totalBalanceExcluded = accountsExcluded.reduce((sum: number, a: { initial_balance?: number }) => sum + Number(a.initial_balance || 0), 0)
    const totalBalanceAll = totalBalanceIncluded + totalBalanceExcluded
    const excludedCount = accountsExcluded.length
    
    if (accountIds.length === 0) {
      return NextResponse.json({ totals: [], fixedTotals: [], summary: null })
    }

    // Déterminer les dates de début/fin en utilisant les clôtures
    let startDate: string | null = null
    let endDate: string | null = null
    let useNonArchived = false

    if (selectedMonth && selectedMonth !== 'current') {
      // Récupérer la clôture du mois sélectionné
      const { data: closure } = await supabase
        .from('month_closures')
        .select('start_date, end_date')
        .eq('user_id', ownerUserId)
        .eq('month_year', selectedMonth)
        .single()

      if (closure) {
        startDate = closure.start_date
        endDate = closure.end_date
      } else {
        const prevMonth = getPreviousMonth(selectedMonth)
        const { data: prevClosure } = await supabase
          .from('month_closures')
          .select('end_date')
          .eq('user_id', ownerUserId)
          .eq('month_year', prevMonth)
          .single()

        if (prevClosure) {
          startDate = addOneDay(prevClosure.end_date)
          useNonArchived = true
        } else {
          useNonArchived = true
        }
      }
    } else {
      // Mois actuel - chercher la dernière clôture
      const { data: lastClosure } = await supabase
        .from('month_closures')
        .select('end_date')
        .eq('user_id', ownerUserId)
        .order('end_date', { ascending: false })
        .limit(1)
        .single()

      if (lastClosure) {
        startDate = addOneDay(lastClosure.end_date)
      }
      useNonArchived = true
    }

    // Récupérer les transactions
    let txs
    let error

    if (useNonArchived) {
      let query = supabase
        .from('transactions')
        .select('amount,date,type,category:categories(name,type)')
        .in('account_id', accountIds)
        .neq('archived', true)
      
      if (startDate) {
        query = query.gte('date', startDate)
      }
      
      const result = await query
      txs = result.data
      error = result.error
    } else {
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

    // Agrégation par catégorie - séparer fixes et variables
    const sums: Record<string, number> = {}
    const fixedSums: Record<string, number> = {}
    let totalIncome = 0
    let totalFixedExpenses = 0
    let totalVariableExpenses = 0
    
    for (const t of transactions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawCat = (t as Record<string, unknown>).category as any
      const catData = Array.isArray(rawCat) ? rawCat[0] : rawCat
      const catType = catData?.type
      const txType = (t as Record<string, unknown>).type
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

    // Dépenses variables
    const variableTotals = Object.keys(sums).map(k => ({ 
      category: k, 
      total: Number(sums[k].toFixed(2)), 
      avgPerMonth: Number((sums[k] / monthsWindow).toFixed(2)),
      isFixed: false
    }))
    variableTotals.sort((a, b) => b.total - a.total)
    
    // Dépenses fixes
    const fixedTotals = Object.keys(fixedSums).map(k => ({ 
      category: k, 
      total: Number(fixedSums[k].toFixed(2)), 
      avgPerMonth: Number((fixedSums[k] / monthsWindow).toFixed(2)),
      isFixed: true
    }))
    fixedTotals.sort((a, b) => b.total - a.total)

    // Récupérer les objectifs de dépenses du propriétaire
    const { data: ownerSettings } = await supabase
      .from('user_settings')
      .select('spend_targets')
      .eq('user_id', ownerUserId)
      .single()

    const targets = ownerSettings?.spend_targets || {}

    return NextResponse.json({ 
      totals: variableTotals,
      fixedTotals: fixedTotals,
      targets,
      summary: {
        totalIncome: Number(totalIncome.toFixed(2)),
        totalFixedExpenses: Number(totalFixedExpenses.toFixed(2)),
        totalVariableExpenses: Number(totalVariableExpenses.toFixed(2)),
        availableForVariable: Number((totalIncome - totalFixedExpenses).toFixed(2)),
        potentialSavings: Number((totalIncome - totalFixedExpenses - totalVariableExpenses).toFixed(2)),
        totalBalanceIncluded: Number(totalBalanceIncluded.toFixed(2)),
        totalBalanceExcluded: Number(totalBalanceExcluded.toFixed(2)),
        totalBalanceAll: Number(totalBalanceAll.toFixed(2))
      },
      meta: { monthsWindow, startDate, endDate, useNonArchived, excludedAccountsCount: excludedCount } 
    })
  } catch (err) {
    console.error('Error /api/shared-dashboards/previsionnel GET:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

// POST - Mettre à jour les objectifs de dépenses (même pour les visionneurs)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { ownerUserId, targets } = body

    if (!ownerUserId) {
      return NextResponse.json({ error: 'ownerUserId requis' }, { status: 400 })
    }

    // Vérifier que l'utilisateur a accès à ce dashboard partagé
    const { data: share, error: shareError } = await supabase
      .from('shared_dashboards')
      .select('id, owner_user_id')
      .eq('owner_user_id', ownerUserId)
      .eq('shared_with_user_id', userId)
      .single()

    if (shareError || !share) {
      return NextResponse.json({ error: 'Accès non autorisé à ce dashboard' }, { status: 403 })
    }

    // Stocker les objectifs dans les settings du propriétaire
    // Récupérer d'abord les settings existants
    const { data: existingSettings } = await supabase
      .from('user_settings')
      .select('spend_targets')
      .eq('user_id', ownerUserId)
      .single()

    if (existingSettings) {
      // Mettre à jour
      const { error: updateError } = await supabase
        .from('user_settings')
        .update({ spend_targets: targets })
        .eq('user_id', ownerUserId)

      if (updateError) throw updateError
    } else {
      // Créer
      const { error: insertError } = await supabase
        .from('user_settings')
        .insert({ user_id: ownerUserId, spend_targets: targets })

      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error /api/shared-dashboards/previsionnel POST:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
