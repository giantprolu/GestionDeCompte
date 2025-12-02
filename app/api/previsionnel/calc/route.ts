import { NextResponse } from 'next/server'

type Tx = {
  date: string
  amount: number
  type?: string
  category?: string
}

function parseDate(d: string | number | Date) {
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return null
  return dt
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const transactions: Tx[] = body.transactions || []
    const monthsWindow: number = Number(body.monthsWindow) || 3

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'Aucune transaction fournie' }, { status: 400 })
    }

    // Determine end date (now) and start date monthsWindow months ago
    const end = new Date()
    const start = new Date(end.getFullYear(), end.getMonth() - monthsWindow + 1, 1)

    // Aggregate expenses per category within window
    const sums: Record<string, number> = {}
    for (const t of transactions) {
      const dt = parseDate(t.date)
      if (!dt) continue
      if (dt < start || dt > end) continue
      const amount = Number(t.amount || 0)
      // Consider expense if type explicit or amount positive numeric and type === 'expense' or amount < 0
      const isExpense = (t.type && String(t.type).toLowerCase() === 'expense') || amount < 0 || (!t.type && amount > 0)
      if (!isExpense) continue
      const cat = t.category || 'Non catégorisé'
      sums[cat] = (sums[cat] || 0) + Math.abs(amount)
    }

    const budgets = Object.keys(sums).map(cat => ({
      category: cat,
      total: sums[cat],
      avgPerMonth: sums[cat] / monthsWindow,
    }))

    // Sort by total desc
    budgets.sort((a, b) => b.total - a.total)

    return NextResponse.json({ budgets })
  } catch (err) {
    console.error('Error /api/previsionnel/calc POST:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
