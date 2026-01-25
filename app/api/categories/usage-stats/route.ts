import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/db'

export async function GET(request: Request) {
  const authRes = await auth()
  if (!authRes.userId) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (!type || !['income', 'expense'].includes(type)) {
    return NextResponse.json(
      { error: 'Type de transaction invalide. Utilisez "income" ou "expense"' },
      { status: 400 }
    )
  }

  try {
    // First, get all account IDs for this user
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', authRes.userId)

    if (accountsError) {
      return NextResponse.json({ error: accountsError.message }, { status: 500 })
    }

    if (!accounts || accounts.length === 0) {
      // No accounts = no usage stats
      return NextResponse.json([])
    }

    const accountIds = accounts.map((acc) => acc.id)

    // Query transactions to get category usage stats
    const { data: stats, error: statsError } = await supabase
      .from('transactions')
      .select('category_id, date')
      .in('account_id', accountIds)
      .eq('type', type)

    if (statsError) {
      return NextResponse.json({ error: statsError.message }, { status: 500 })
    }

    if (!stats || stats.length === 0) {
      // No transactions = no usage stats
      return NextResponse.json([])
    }

    // Group by category_id and count usage
    const usageMap = new Map<string, { count: number; lastUsed: string }>()

    stats.forEach((transaction) => {
      const categoryId = transaction.category_id
      const date = transaction.date

      if (!usageMap.has(categoryId)) {
        usageMap.set(categoryId, { count: 1, lastUsed: date })
      } else {
        const current = usageMap.get(categoryId)!
        current.count += 1
        // Keep the most recent date
        if (date > current.lastUsed) {
          current.lastUsed = date
        }
      }
    })

    // Convert to array and sort by usage count (desc) then by last used date (desc)
    const sortedStats = Array.from(usageMap.entries())
      .map(([categoryId, data]) => ({
        categoryId,
        usageCount: data.count,
        lastUsedDate: data.lastUsed,
      }))
      .sort((a, b) => {
        // First sort by usage count (descending)
        if (b.usageCount !== a.usageCount) {
          return b.usageCount - a.usageCount
        }
        // If same count, sort by last used date (descending)
        return b.lastUsedDate.localeCompare(a.lastUsedDate)
      })
      .slice(0, 3) // Return top 3

    return NextResponse.json(sortedStats)
  } catch (error) {
    console.error('Error fetching usage stats:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    )
  }
}
