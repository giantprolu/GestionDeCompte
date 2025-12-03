'use server'

import { supabase } from '@/lib/db'
import {
  notifyNegativeBalance,
  notifyLowBalance,
  notifyUpcomingRecurring,
  notifyCreditDue,
} from '@/lib/notifications'

interface AccountBalance {
  accountId: string
  accountName: string
  balance: number
}

interface NotificationPreferences {
  negative_balance: boolean
  low_balance: boolean
  low_balance_threshold: number
  upcoming_recurring: boolean
}

// Récupérer les préférences de notification d'un utilisateur
async function getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      // Retourner les préférences par défaut
      return {
        negative_balance: true,
        low_balance: true,
        low_balance_threshold: 100,
        upcoming_recurring: true,
      }
    }

    return {
      negative_balance: data.negative_balance ?? true,
      low_balance: data.low_balance ?? true,
      low_balance_threshold: data.low_balance_threshold ?? 100,
      upcoming_recurring: data.upcoming_recurring ?? true,
    }
  } catch {
    return {
      negative_balance: true,
      low_balance: true,
      low_balance_threshold: 100,
      upcoming_recurring: true,
    }
  }
}

// Calculer les soldes des comptes d'un utilisateur
async function getAccountBalances(userId: string): Promise<AccountBalance[]> {
  try {
    const { data: accounts, error: accountError } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)

    if (accountError || !accounts) return []

    const balances: AccountBalance[] = []
    const now = new Date()
    now.setHours(23, 59, 59, 999)

    for (const account of accounts) {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('account_id', account.id)
        .lte('date', now.toISOString())

      let balance = account.initial_balance || 0
      transactions?.forEach(txn => {
        if (txn.type === 'income') {
          balance += txn.amount
        } else if (txn.type === 'expense') {
          balance -= txn.amount
        }
      })

      balances.push({
        accountId: account.id,
        accountName: account.name,
        balance,
      })
    }

    return balances
  } catch (error) {
    console.error('Error getting account balances:', error)
    return []
  }
}

// Vérifier les transactions récurrentes à venir
async function getUpcomingRecurringTransactions(userId: string, daysAhead: number = 3) {
  try {
    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + daysAhead)

    const { data: accounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId)

    if (!accounts || accounts.length === 0) return []

    const accountIds = accounts.map(a => a.id)

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .in('account_id', accountIds)
      .eq('is_recurring', true)
      .gte('date', now.toISOString().split('T')[0])
      .lte('date', futureDate.toISOString().split('T')[0])

    if (error) throw error

    return (transactions || []).map(txn => ({
      id: txn.id,
      name: txn.description,
      amount: txn.amount,
      date: new Date(txn.date),
      daysUntil: Math.ceil((new Date(txn.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    }))
  } catch (error) {
    console.error('Error getting recurring transactions:', error)
    return []
  }
}

// Vérifier les crédits avec échéance proche
async function getUpcomingCredits(userId: string) {
  try {
    const { data: credits, error } = await supabase
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (error || !credits) return []

    const now = new Date()
    const upcoming = []

    for (const credit of credits) {
      // Calculer la prochaine date d'échéance
      const startDate = new Date(credit.start_date)
      const dayOfMonth = credit.payment_day || startDate.getDate()
      
      // Trouver la prochaine date de paiement
      const nextPayment = new Date(now.getFullYear(), now.getMonth(), dayOfMonth)
      if (nextPayment < now) {
        nextPayment.setMonth(nextPayment.getMonth() + 1)
      }

      // Calculer le nombre de mois restants
      const monthsPaid = Math.floor(
        (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      )
      const remainingMonths = Math.max(0, credit.duration_months - monthsPaid)

      // Si l'échéance est dans les 3 prochains jours
      const daysUntil = Math.ceil((nextPayment.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysUntil >= 0 && daysUntil <= 3 && remainingMonths > 0) {
        upcoming.push({
          id: credit.id,
          name: credit.name,
          monthlyPayment: credit.monthly_payment,
          dueDate: nextPayment,
          remainingMonths,
        })
      }
    }

    return upcoming
  } catch (error) {
    console.error('Error getting upcoming credits:', error)
    return []
  }
}

// Fonction principale pour vérifier et envoyer les notifications critiques
export async function checkAndSendCriticalNotifications(userId: string) {
  const results: Array<{ type: string; success: boolean; reason?: string }> = []

  try {
    // Récupérer les préférences de l'utilisateur
    const prefs = await getUserNotificationPreferences(userId)

    // 1. Vérifier les soldes des comptes
    const balances = await getAccountBalances(userId)

    for (const account of balances) {
      // Notification solde négatif
      if (prefs.negative_balance && account.balance < 0) {
        const result = await notifyNegativeBalance(
          userId,
          account.accountName,
          account.accountId,
          account.balance
        )
        results.push({ type: 'negative_balance', ...result })
      }
      // Notification solde bas (mais pas négatif)
      else if (prefs.low_balance && account.balance >= 0 && account.balance < prefs.low_balance_threshold) {
        const result = await notifyLowBalance(
          userId,
          account.accountName,
          account.accountId,
          account.balance,
          prefs.low_balance_threshold
        )
        results.push({ type: 'low_balance', ...result })
      }
    }

    // 2. Vérifier les transactions récurrentes à venir
    if (prefs.upcoming_recurring) {
      const recurringTransactions = await getUpcomingRecurringTransactions(userId)
      
      for (const txn of recurringTransactions) {
        const result = await notifyUpcomingRecurring(
          userId,
          txn.name,
          txn.id,
          txn.amount,
          txn.date,
          txn.daysUntil
        )
        results.push({ type: 'recurring_due', ...result })
      }
    }

    // 3. Vérifier les crédits à venir
    const upcomingCredits = await getUpcomingCredits(userId)
    
    for (const credit of upcomingCredits) {
      const result = await notifyCreditDue(
        userId,
        credit.name,
        credit.id,
        credit.monthlyPayment,
        credit.dueDate,
        credit.remainingMonths
      )
      results.push({ type: 'credit_due', ...result })
    }

    return { success: true, results }
  } catch (error) {
    console.error('Error checking critical notifications:', error)
    return { success: false, error: 'Failed to check notifications', results }
  }
}

// Vérifier les notifications pour un compte spécifique (appelé après une transaction)
export async function checkAccountNotifications(userId: string, accountId: string) {
  try {
    const prefs = await getUserNotificationPreferences(userId)
    const balances = await getAccountBalances(userId)
    const account = balances.find(a => a.accountId === accountId)

    if (!account) return { success: false, error: 'Account not found' }

    if (prefs.negative_balance && account.balance < 0) {
      return await notifyNegativeBalance(
        userId,
        account.accountName,
        account.accountId,
        account.balance
      )
    }

    if (prefs.low_balance && account.balance >= 0 && account.balance < prefs.low_balance_threshold) {
      return await notifyLowBalance(
        userId,
        account.accountName,
        account.accountId,
        account.balance,
        prefs.low_balance_threshold
      )
    }

    return { success: true, reason: 'no_notification_needed' }
  } catch (error) {
    console.error('Error checking account notifications:', error)
    return { success: false, error: 'Failed to check account' }
  }
}
