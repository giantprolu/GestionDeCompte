import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

/**
 * API pour traiter les transactions récurrentes du jour
 * - Trouve toutes les transactions récurrentes actives dont la date est aujourd'hui ou passée
 * - Met à jour le solde du compte
 * - Crée une copie de la transaction pour la conserver dans l'historique
 * - Reprogramme la transaction originale pour la prochaine occurrence
 */
export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Récupérer les comptes de l'utilisateur
    const { data: userAccounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId)

    if (accountsError || !userAccounts || userAccounts.length === 0) {
      return NextResponse.json({ processed: 0, message: 'Aucun compte trouvé' })
    }

    const accountIds = userAccounts.map(acc => acc.id)
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    // Trouver les transactions récurrentes actives dont la date est aujourd'hui ou passée (non traitées)
    const { data: recurringTransactions, error: txnError } = await supabase
      .from('transactions')
      .select(`
        *,
        account:accounts(id, initial_balance, name)
      `)
      .in('account_id', accountIds)
      .eq('is_recurring', true)
      .eq('is_active', true)
      .eq('archived', false)
      .lte('date', today) // Date <= aujourd'hui

    if (txnError) {
      console.error('Erreur récupération transactions récurrentes:', txnError)
      throw txnError
    }

    if (!recurringTransactions || recurringTransactions.length === 0) {
      return NextResponse.json({ processed: 0, message: 'Aucune transaction récurrente à traiter' })
    }

    let processed = 0
    const results: Array<{ id: string; name: string; nextDate: string }> = []

    for (const txn of recurringTransactions) {
      try {
        // 1. Mettre à jour le solde du compte
        const account = txn.account as { id: string; initial_balance: number; name: string }
        const currentBalance = account.initial_balance || 0
        const amount = Number(txn.amount)
        
        let newBalance: number
        if (txn.type === 'income') {
          newBalance = currentBalance + amount
        } else {
          newBalance = currentBalance - amount
        }

        await supabase
          .from('accounts')
          .update({ initial_balance: newBalance })
          .eq('id', account.id)

        // 2. Créer une copie de la transaction pour l'historique (non récurrente)
        // Cette copie reste visible dans les transactions du mois
        await supabase
          .from('transactions')
          .insert({
            amount: txn.amount,
            type: txn.type,
            category_id: txn.category_id,
            account_id: txn.account_id,
            date: txn.date,
            note: txn.note ? `${txn.note} (récurrent)` : '(récurrent)',
            is_recurring: false, // Non récurrent - juste un historique
            is_active: true,
            archived: false,
          })

        // 3. Calculer la prochaine date selon la fréquence
        const currentDate = new Date(txn.date)
        let nextDate: Date

        switch (txn.recurrence_frequency) {
          case 'daily':
            nextDate = new Date(currentDate)
            nextDate.setDate(nextDate.getDate() + 1)
            break
          case 'weekly':
            nextDate = new Date(currentDate)
            nextDate.setDate(nextDate.getDate() + 7)
            break
          case 'monthly':
            nextDate = new Date(currentDate)
            nextDate.setMonth(nextDate.getMonth() + 1)
            // Gérer les cas où le jour n'existe pas (ex: 31 février)
            if (txn.recurrence_day) {
              const targetDay = txn.recurrence_day
              const maxDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()
              nextDate.setDate(Math.min(targetDay, maxDay))
            }
            break
          case 'yearly':
            nextDate = new Date(currentDate)
            nextDate.setFullYear(nextDate.getFullYear() + 1)
            break
          default:
            // Par défaut, mensuel
            nextDate = new Date(currentDate)
            nextDate.setMonth(nextDate.getMonth() + 1)
        }

        // 4. Mettre à jour la date de la transaction récurrente pour la prochaine occurrence
        const nextDateStr = nextDate.toISOString().split('T')[0]
        
        await supabase
          .from('transactions')
          .update({ date: nextDateStr })
          .eq('id', txn.id)

        processed++
        results.push({
          id: txn.id,
          name: txn.note || 'Transaction récurrente',
          nextDate: nextDateStr,
        })

      } catch (err) {
        console.error(`Erreur traitement transaction ${txn.id}:`, err)
        // Continuer avec les autres transactions
      }
    }

    return NextResponse.json({
      processed,
      message: `${processed} transaction(s) récurrente(s) traitée(s)`,
      results,
    })

  } catch (error) {
    console.error('Erreur process-recurring:', error)
    return NextResponse.json({ error: 'Erreur lors du traitement des transactions récurrentes' }, { status: 500 })
  }
}

// GET pour vérifier les transactions récurrentes en attente
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: userAccounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId)

    if (!userAccounts || userAccounts.length === 0) {
      return NextResponse.json({ pending: 0, transactions: [] })
    }

    const accountIds = userAccounts.map(acc => acc.id)
    const today = new Date().toISOString().split('T')[0]

    const { data: pendingTransactions, error } = await supabase
      .from('transactions')
      .select(`
        id,
        amount,
        type,
        note,
        date,
        recurrence_frequency,
        category:categories(name, icon)
      `)
      .in('account_id', accountIds)
      .eq('is_recurring', true)
      .eq('is_active', true)
      .eq('archived', false)
      .lte('date', today)

    if (error) throw error

    return NextResponse.json({
      pending: pendingTransactions?.length || 0,
      transactions: pendingTransactions || [],
    })

  } catch (error) {
    console.error('Erreur GET process-recurring:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
