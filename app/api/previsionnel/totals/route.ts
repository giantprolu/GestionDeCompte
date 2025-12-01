import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

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

    // 1) récupérer comptes de l'utilisateur
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId)

    const accountIds = (accounts || []).map((a: any) => a.id)
    if (accountIds.length === 0) return NextResponse.json({ error: 'Aucun compte trouvé' }, { status: 400 })

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

    if (useNonArchived) {
      // Récupérer les transactions non archivées
      let query = supabase
        .from('transactions')
        .select('amount,date,type,category:categories(name,type)')
        .in('account_id', accountIds)
        .neq('archived', true)
      
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

    // 4) Agrégation par catégorie - filtrer les dépenses
    const sums: Record<string, number> = {}
    for (const t of transactions) {
      const rawCat: any = (t as any).category
      const catData = Array.isArray(rawCat) ? rawCat[0] : rawCat
      const catType = catData?.type
      const txType = (t as any).type
      
      // Considérer comme dépense si le type de transaction OU le type de catégorie est 'expense'
      if (txType !== 'expense' && catType !== 'expense') continue
      
      const amt = Number(t.amount || 0)
      const val = amt < 0 ? Math.abs(amt) : amt
      const name = catData?.name || 'Non catégorisé'
      sums[name] = (sums[name] || 0) + val
    }

    const result = Object.keys(sums).map(k => ({ 
      category: k, 
      total: Number(sums[k].toFixed(2)), 
      avgPerMonth: Number((sums[k] / monthsWindow).toFixed(2)) 
    }))
    result.sort((a, b) => b.total - a.total)

    return NextResponse.json({ 
      totals: result, 
      meta: { monthsWindow, startDate, endDate, useNonArchived } 
    })
  } catch (err) {
    console.error('Error /api/previsionnel/totals GET:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
