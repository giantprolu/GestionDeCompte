import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/db'

// POST - Créer une transaction sur un compte partagé (éditeur uniquement)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { ownerUserId, accountId, amount, type, categoryId, date, note } = body

    if (!ownerUserId || !accountId || !amount || !type || !categoryId || !date) {
      return NextResponse.json({ error: 'Données requises manquantes' }, { status: 400 })
    }

    // Vérifier que l'utilisateur a la permission d'édition sur ce dashboard
    const { data: share, error: shareError } = await supabase
      .from('shared_dashboards')
      .select('id, permission')
      .eq('owner_user_id', ownerUserId)
      .eq('shared_with_user_id', userId)
      .single()

    if (shareError || !share) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    if (share.permission !== 'edit') {
      return NextResponse.json({ error: 'Permission d\'édition requise' }, { status: 403 })
    }

    // Vérifier que le compte appartient bien au propriétaire
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, name, initial_balance')
      .eq('id', accountId)
      .eq('user_id', ownerUserId)
      .single()

    if (accountError || !account) {
      return NextResponse.json({ error: 'Compte non trouvé' }, { status: 404 })
    }

    // Créer la transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: ownerUserId,
        account_id: accountId,
        category_id: categoryId,
        amount: type === 'expense' ? -Math.abs(Number(amount)) : Math.abs(Number(amount)),
        type: type,
        date: date,
        note: note || null,
        description: note || '',
        is_recurring: false,
        archived: false
      })
      .select()
      .single()

    if (txError) {
      console.error('Erreur création transaction:', txError)
      return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })
    }

    // Mettre à jour le solde du compte
    const newBalance = Number(account.initial_balance) + (type === 'expense' ? -Math.abs(Number(amount)) : Math.abs(Number(amount)))
    await supabase
      .from('accounts')
      .update({ initial_balance: newBalance })
      .eq('id', accountId)

    return NextResponse.json({ success: true, transaction })
  } catch (err) {
    console.error('Error /api/shared-dashboards/transactions POST:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

// DELETE - Supprimer une transaction sur un compte partagé (éditeur uniquement)
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const url = new URL(request.url)
    const transactionId = url.searchParams.get('transactionId')
    const ownerUserId = url.searchParams.get('ownerUserId')

    if (!transactionId || !ownerUserId) {
      return NextResponse.json({ error: 'ID de transaction et ownerUserId requis' }, { status: 400 })
    }

    // Vérifier permission d'édition
    const { data: share } = await supabase
      .from('shared_dashboards')
      .select('id, permission')
      .eq('owner_user_id', ownerUserId)
      .eq('shared_with_user_id', userId)
      .single()

    if (!share || share.permission !== 'edit') {
      return NextResponse.json({ error: 'Permission d\'édition requise' }, { status: 403 })
    }

    // Récupérer la transaction pour mettre à jour le solde
    const { data: tx } = await supabase
      .from('transactions')
      .select('amount, type, account_id')
      .eq('id', transactionId)
      .eq('user_id', ownerUserId)
      .single()

    if (!tx) {
      return NextResponse.json({ error: 'Transaction non trouvée' }, { status: 404 })
    }

    // Supprimer la transaction
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId)

    if (deleteError) {
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
    }

    // Mettre à jour le solde du compte (inverser l'effet de la transaction)
    const { data: account } = await supabase
      .from('accounts')
      .select('initial_balance')
      .eq('id', tx.account_id)
      .single()

    if (account) {
      const adjustment = tx.type === 'expense' ? Math.abs(Number(tx.amount)) : -Math.abs(Number(tx.amount))
      const newBalance = Number(account.initial_balance) + adjustment
      await supabase
        .from('accounts')
        .update({ initial_balance: newBalance })
        .eq('id', tx.account_id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error /api/shared-dashboards/transactions DELETE:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

// PUT - Modifier une transaction sur un compte partagé (éditeur uniquement)
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { ownerUserId, transactionId, amount, type, categoryId, date, note } = body

    if (!ownerUserId || !transactionId) {
      return NextResponse.json({ error: 'ownerUserId et transactionId requis' }, { status: 400 })
    }

    // Vérifier permission d'édition
    const { data: share } = await supabase
      .from('shared_dashboards')
      .select('id, permission')
      .eq('owner_user_id', ownerUserId)
      .eq('shared_with_user_id', userId)
      .single()

    if (!share || share.permission !== 'edit') {
      return NextResponse.json({ error: 'Permission d\'édition requise' }, { status: 403 })
    }

    // Récupérer l'ancienne transaction
    const { data: oldTx } = await supabase
      .from('transactions')
      .select('amount, type, account_id')
      .eq('id', transactionId)
      .eq('user_id', ownerUserId)
      .single()

    if (!oldTx) {
      return NextResponse.json({ error: 'Transaction non trouvée' }, { status: 404 })
    }

    // Calculer l'ancien et nouveau montant
    const oldAmount = oldTx.type === 'expense' ? -Math.abs(Number(oldTx.amount)) : Math.abs(Number(oldTx.amount))
    const newAmount = type === 'expense' ? -Math.abs(Number(amount)) : Math.abs(Number(amount))
    const balanceAdjustment = newAmount - oldAmount

    // Mettre à jour la transaction
    const updateData: Record<string, unknown> = {}
    if (amount !== undefined) updateData.amount = newAmount
    if (type !== undefined) updateData.type = type
    if (categoryId !== undefined) updateData.category_id = categoryId
    if (date !== undefined) updateData.date = date
    if (note !== undefined) updateData.note = note

    const { error: updateError } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId)

    if (updateError) {
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }

    // Mettre à jour le solde du compte
    const { data: account } = await supabase
      .from('accounts')
      .select('initial_balance')
      .eq('id', oldTx.account_id)
      .single()

    if (account) {
      const newBalance = Number(account.initial_balance) + balanceAdjustment
      await supabase
        .from('accounts')
        .update({ initial_balance: newBalance })
        .eq('id', oldTx.account_id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error /api/shared-dashboards/transactions PUT:', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
