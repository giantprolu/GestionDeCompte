import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/db'
import { clerkClient } from '@clerk/nextjs/server'

interface Account {
  id: string
  name: string
  type: string
  currentBalance: number
  initialBalance?: number
  icon: string
  color: string
}

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
  categoryId: string
  category_icon: string
  category_color: string
  account_id: string
  account_name: string
  is_recurring: boolean
  recurrence_frequency?: string
  recurrence_day?: number
  note?: string
  archived?: boolean
}

interface MonthClosure {
  month_year: string
  start_date: string
  end_date: string
}

interface DashboardData {
  ownerUserId: string
  ownerUsername: string
  permission: 'view' | 'edit'
  shareId: string
  accounts: Account[]
  transactions: Transaction[]
  totalBalance: number
  monthlyIncome: number
  monthlyExpense: number
  monthClosures: MonthClosure[]
  currentMonthStart?: string
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Récupérer tous les dashboards partagés avec cet utilisateur
    const { data: sharedDashboards, error: shareError } = await supabase
      .from('shared_dashboards')
      .select('*')
      .eq('shared_with_user_id', userId)

    if (shareError) {
      console.error('Erreur Supabase:', shareError)
      return NextResponse.json({ error: shareError.message }, { status: 500 })
    }

    if (!sharedDashboards || sharedDashboards.length === 0) {
      return NextResponse.json([])
    }

    // Grouper par propriétaire
    const dashboardsByOwner: { [key: string]: DashboardData } = {}

    for (const share of sharedDashboards) {
      const ownerId = share.owner_user_id

      // Récupérer les comptes du propriétaire
      const { data: ownerAccounts, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', ownerId)

      if (accountsError) {
        console.error('Erreur comptes:', accountsError)
        continue
      }

      // Récupérer les clôtures de mois du propriétaire
      const { data: monthClosures } = await supabase
        .from('month_closures')
        .select('month_year, start_date, end_date')
        .eq('user_id', ownerId)
        .order('month_year', { ascending: false })

      // Déterminer la date de début du mois actuel (lendemain de la dernière clôture)
      let currentMonthStart: string | undefined
      if (monthClosures && monthClosures.length > 0) {
        const lastClosure = monthClosures[0]
        const endDate = new Date(lastClosure.end_date)
        endDate.setDate(endDate.getDate() + 1)
        currentMonthStart = endDate.toISOString().split('T')[0]
      }

      // Récupérer les transactions du propriétaire (uniquement passées ou aujourd'hui)
      const accountIds = ownerAccounts?.map(acc => acc.id) || []
      const now = new Date()
      now.setHours(23, 59, 59, 999) // Fin de la journée
      
      const { data: ownerTransactions, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          *,
          categories (id, name, icon, color),
          accounts (name)
        `)
        .in('account_id', accountIds)
        .lte('date', now.toISOString()) // Ne compter que les transactions passées/aujourd'hui
        .order('date', { ascending: false })

      if (transactionsError) {
        console.error('Erreur transactions:', transactionsError)
        continue
      }

      // Calculer le total disponible de la même manière que la page principale:
      // somme des soldes initiaux (`initial_balance`) des comptes (sans appliquer les transactions)
      const totalBalance = ownerAccounts?.reduce((sum, acc) => {
        return sum + (acc.initial_balance || 0)
      }, 0) || 0

      const currentMonth = new Date().getMonth()
      const currentYear = new Date().getFullYear()
      const monthTransactions = ownerTransactions?.filter(t => {
        const tDate = new Date(t.date)
        return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear
      }) || []

      const monthlyIncome = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0)

      const monthlyExpense = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0)

      // Formater les comptes (avec soldes calculés correctement)
      const accounts: Account[] = ownerAccounts?.map(acc => {
        const accTransactions = ownerTransactions?.filter(t => t.account_id === acc.id) || []
        const currentBalance = acc.initial_balance + accTransactions.reduce((bal, t) => {
          return bal + (t.type === 'income' ? t.amount : -t.amount)
        }, 0)
        return {
          id: acc.id,
          name: acc.name,
          type: acc.type,
          currentBalance,
          initialBalance: acc.initial_balance,
          icon: acc.icon,
          color: acc.color
        }
      }) || []

      // DEBUG: comparer les soldes calculés ici avec ce que renverrait `/api/accounts`.
      // Ces logs sont temporaires pour investiguer la divergence des soldes.
      try {
        const debugBalances = (ownerAccounts || []).map(acc => {
          const accTxs = ownerTransactions?.filter(t => t.account_id === acc.id) || []
          const balanceViaAccountsApi = (acc.initial_balance || 0) + accTxs.reduce((bal, t) => {
            return bal + (t.type === 'income' ? t.amount : -t.amount)
          }, 0)
          const sharedCurrent = accounts.find(a => a.id === acc.id)?.currentBalance ?? null
          return {
            id: acc.id,
            name: acc.name,
            initial_balance: acc.initial_balance || 0,
            balanceViaAccountsApi,
            sharedCurrent,
            diff: balanceViaAccountsApi - (sharedCurrent ?? 0)
          }
        })

        const sumViaAccountsApi = debugBalances.reduce((s, d) => s + d.balanceViaAccountsApi, 0)
        const sumShared = debugBalances.reduce((s, d) => s + (d.sharedCurrent ?? 0), 0)

      } catch (e) {
        console.error('DEBUG error while computing debug balances', e)
      }

      // Formater les transactions
      const transactions: Transaction[] = ownerTransactions?.map(t => ({
        id: t.id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
        category: t.categories?.name || 'Non catégorisé',
        categoryId: t.categories?.id || '',
        category_icon: t.categories?.icon || '📦',
        category_color: t.categories?.color || '#64748b',
        account_id: t.account_id,
        account_name: t.accounts?.name || '',
        is_recurring: t.is_recurring || false,
        recurrence_frequency: t.recurrence_frequency,
        recurrence_day: t.recurrence_day,
        note: t.note,
        archived: t.archived || false
      })) || []

      dashboardsByOwner[ownerId] = {
        ownerUserId: ownerId,
        ownerUsername: '', // À remplir avec Clerk
        permission: share.permission,
        shareId: share.id,
        accounts,
        transactions,
        totalBalance,
        monthlyIncome,
        monthlyExpense,
        monthClosures: monthClosures || [],
        currentMonthStart
      }
    }

    // Enrichir avec les usernames Clerk
    const client = await clerkClient()
    for (const ownerId of Object.keys(dashboardsByOwner)) {
      try {
        const user = await client.users.getUser(ownerId)
        dashboardsByOwner[ownerId].ownerUsername = user.username || user.emailAddresses[0]?.emailAddress || 'Utilisateur inconnu'
      } catch (error) {
        console.error('Erreur Clerk pour user:', ownerId, error)
        dashboardsByOwner[ownerId].ownerUsername = 'Utilisateur inconnu'
      }
    }

    return NextResponse.json(Object.values(dashboardsByOwner))
  } catch (error) {
    console.error('Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
