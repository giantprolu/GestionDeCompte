import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const url = new URL(request.url)
    const monthsWindow = Number(url.searchParams.get('monthsWindow') || '6') || 6

    // 1) récupérer comptes de l'utilisateur
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId)

    const accountIds = (accounts || []).map((a: any) => a.id)
    if (accountIds.length === 0) return NextResponse.json({ error: 'Aucun compte trouvé' }, { status: 400 })

    // période
    const end = new Date()
    const start = new Date(end.getFullYear(), end.getMonth() - monthsWindow + 1, 1)

    // récupérer transactions de type expense
    const { data: txs, error } = await supabase
      .from('transactions')
      .select('amount,date,category:categories(name)')
      .in('account_id', accountIds)
      .gte('date', start.toISOString())

    if (error) throw error
    const transactions = txs || []

    // agrégation par catégorie
    const sums: Record<string, number> = {}
    for (const t of transactions) {
      const amt = Number(t.amount || 0)
      // considérer les dépenses : si amount < 0, prendre abs; sinon garder
      const val = amt < 0 ? Math.abs(amt) : amt
      const rawCat: any = (t as any).category
      const name = (Array.isArray(rawCat) ? rawCat[0]?.name : rawCat?.name) || 'Non catégorisé'
      sums[name] = (sums[name] || 0) + val
    }

    const result = Object.keys(sums).map(k => ({ category: k, total: Number(sums[k].toFixed(2)), avgPerMonth: Number((sums[k] / monthsWindow).toFixed(2)) }))
    // trier par total desc
    result.sort((a, b) => b.total - a.total)

    return NextResponse.json({ totals: result, meta: { monthsWindow } })
  } catch (err) {
    console.error('Error /api/previsionnel/totals GET:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
