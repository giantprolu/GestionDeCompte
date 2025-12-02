import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { amount, date, note, category_id, account_id } = body

    // Vérifier que la transaction existe et appartient à l'utilisateur
    const { data: transaction } = await supabase
      .from('transactions')
      .select(`
        *,
        account:accounts (user_id, initial_balance)
      `)
      .eq('id', id)
      .single()

    if (!transaction || transaction.account?.user_id !== userId) {
      return NextResponse.json({ error: 'Transaction non trouvée' }, { status: 404 })
    }

    const oldAmount = parseFloat(transaction.amount)
    const newAmount = parseFloat(amount)
    const today = new Date().toISOString().split('T')[0]
    const oldDate = transaction.date
    const newDate = date

    // Calculer l'ajustement du solde
    // 1. Annuler l'effet de l'ancienne transaction (si elle était dans le passé)
    // 2. Appliquer l'effet de la nouvelle transaction (si elle est dans le passé)
    
    let balanceAdjustment = 0
    
    // Annuler l'ancienne transaction si elle était <= aujourd'hui
    if (oldDate <= today) {
      if (transaction.type === 'income') {
        balanceAdjustment -= oldAmount // Annuler le revenu
      } else if (transaction.type === 'expense') {
        balanceAdjustment += oldAmount // Annuler la dépense
      }
    }
    
    // Appliquer la nouvelle transaction si elle est <= aujourd'hui
    if (newDate <= today) {
      if (transaction.type === 'income') {
        balanceAdjustment += newAmount // Ajouter le nouveau revenu
      } else if (transaction.type === 'expense') {
        balanceAdjustment -= newAmount // Soustraire la nouvelle dépense
      }
    }

    // Mettre à jour le solde du compte si nécessaire
    if (balanceAdjustment !== 0) {
      const currentBalance = transaction.account.initial_balance || 0
      const newBalance = currentBalance + balanceAdjustment
      await supabase
        .from('accounts')
        .update({ initial_balance: newBalance })
        .eq('id', transaction.account_id)
    }

    // Si le compte change, ajuster les deux comptes
    if (account_id && account_id !== transaction.account_id) {
      // Annuler sur l'ancien compte (déjà fait ci-dessus si date <= today)
      // Appliquer sur le nouveau compte
      if (newDate <= today) {
        const { data: newAccount } = await supabase
          .from('accounts')
          .select('initial_balance')
          .eq('id', account_id)
          .single()
        
        if (newAccount) {
          let newAccountAdjustment = 0
          if (transaction.type === 'income') {
            newAccountAdjustment = newAmount
          } else if (transaction.type === 'expense') {
            newAccountAdjustment = -newAmount
          }
          const newAccountBalance = (newAccount.initial_balance || 0) + newAccountAdjustment
          await supabase
            .from('accounts')
            .update({ initial_balance: newAccountBalance })
            .eq('id', account_id)
        }
        
        // Annuler l'ajustement fait sur l'ancien compte si on avait appliqué pour newDate
        if (balanceAdjustment !== 0) {
          // On doit annuler car on a appliqué sur le mauvais compte
          const revertAdjustment = transaction.type === 'income' ? -newAmount : newAmount
          const revertedBalance = (transaction.account.initial_balance || 0) + balanceAdjustment - (newDate <= today ? (transaction.type === 'income' ? newAmount : -newAmount) : 0)
          await supabase
            .from('accounts')
            .update({ initial_balance: revertedBalance })
            .eq('id', transaction.account_id)
        }
      }
    }

    // Mettre à jour la transaction
    const updateData: any = {
      amount: newAmount,
      date: newDate,
      updated_at: new Date().toISOString()
    }
    if (note !== undefined) updateData.note = note
    if (category_id !== undefined) updateData.category_id = category_id
    if (account_id) updateData.account_id = account_id

    const { data: updated, error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erreur modification:', error)
    return NextResponse.json({ error: 'Erreur lors de la modification' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { id } = await params

    // Vérifier que la transaction appartient à un compte de l'utilisateur
    const { data: transaction } = await supabase
      .from('transactions')
      .select(`
        *,
        account:accounts (user_id)
      `)
      .eq('id', id)
      .single()

    if (!transaction || transaction.account?.user_id !== userId) {
      return NextResponse.json({ error: 'Transaction non trouvée' }, { status: 404 })
    }

    // Mettre à jour le solde initial du compte
    const montant = parseFloat(transaction.amount)
    let updateValue = 0
    if (transaction.type === 'income') {
      updateValue = -montant
    } else if (transaction.type === 'expense') {
      updateValue = montant
    }
    if (updateValue !== 0) {
      // Récupérer le solde actuel
      const { data: compte } = await supabase
        .from('accounts')
        .select('initial_balance')
        .eq('id', transaction.account_id)
        .single()
      if (compte) {
        const nouveauSolde = (compte.initial_balance || 0) + updateValue
        await supabase
          .from('accounts')
          .update({ initial_balance: nouveauSolde })
          .eq('id', transaction.account_id)
      }
    }

    // Si la transaction est liée à un crédit, mettre à jour outstanding
    try {
      const creditId = transaction.credit_id
      if (creditId) {
        const { data: credit } = await supabase
          .from('credits')
          .select('*')
          .eq('id', creditId)
          .single()

        if (credit) {
          // Une transaction de type 'expense' qui a `credit_id` est probablement
          // un remboursement ; lors de la suppression, on doit augmenter outstanding
          // du montant supprimé.
          const prevOutstanding = Number(credit.outstanding ?? credit.principal ?? 0)
          const newOutstanding = prevOutstanding + montant
          const updates: any = { outstanding: newOutstanding }
          if (newOutstanding > 0) updates.is_closed = false

          await supabase
            .from('credits')
            .update(updates)
            .eq('id', creditId)
        }
      }
    } catch (err) {
      console.error('Erreur mise à jour crédit lors suppression transaction:', err)
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur suppression:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
  }
}
