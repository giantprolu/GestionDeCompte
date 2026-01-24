import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: transfers, error } = await supabase
      .from('transfers')
      .select(`
        *,
        from_account:accounts!transfers_from_account_id_fkey(id, name, type),
        to_account:accounts!transfers_to_account_id_fkey(id, name, type)
      `)
      .eq('user_id', userId)
      .order('date', { ascending: false })

    if (error) throw error

    return NextResponse.json(transfers || [])
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des virements' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { fromAccountId, toAccountId, amount, date, note } = body

    // Validation
    if (!fromAccountId || !toAccountId) {
      return NextResponse.json({ error: 'Les comptes source et destination sont requis' }, { status: 400 })
    }

    if (fromAccountId === toAccountId) {
      return NextResponse.json({ error: 'Le compte source et destination doivent être différents' }, { status: 400 })
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Le montant doit être positif' }, { status: 400 })
    }

    // Vérifier que les deux comptes appartiennent à l'utilisateur
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId)
      .in('id', [fromAccountId, toAccountId])

    if (accountsError || !accounts || accounts.length !== 2) {
      return NextResponse.json({ error: 'Comptes invalides ou non autorisés' }, { status: 403 })
    }

    // Créer le virement
    const { data: transfer, error } = await supabase
      .from('transfers')
      .insert({
        user_id: userId,
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: parseFloat(amount),
        date: date || new Date().toISOString(),
        note: note || null,
      })
      .select(`
        *,
        from_account:accounts!transfers_from_account_id_fkey(id, name, type),
        to_account:accounts!transfers_to_account_id_fkey(id, name, type)
      `)
      .single()

    if (error) {
      console.error('Insert error:', error)
      throw error
    }

    // Mettre à jour les soldes des comptes
    const transferDate = new Date(date || new Date())
    const now = new Date()

    // Si le virement est dans le passé ou aujourd'hui, mettre à jour les soldes initiaux
    if (transferDate <= now) {
      // Récupérer les soldes actuels
      const { data: fromAccount } = await supabase
        .from('accounts')
        .select('initial_balance')
        .eq('id', fromAccountId)
        .single()

      const { data: toAccount } = await supabase
        .from('accounts')
        .select('initial_balance')
        .eq('id', toAccountId)
        .single()

      if (fromAccount && toAccount) {
        // Débiter le compte source
        await supabase
          .from('accounts')
          .update({ initial_balance: fromAccount.initial_balance - parseFloat(amount) })
          .eq('id', fromAccountId)

        // Créditer le compte destination
        await supabase
          .from('accounts')
          .update({ initial_balance: toAccount.initial_balance + parseFloat(amount) })
          .eq('id', toAccountId)
      }
    }

    return NextResponse.json(transfer)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la création du virement' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const transferId = searchParams.get('id')

    if (!transferId) {
      return NextResponse.json({ error: 'ID du virement requis' }, { status: 400 })
    }

    // Récupérer le virement avant de le supprimer
    const { data: transfer, error: fetchError } = await supabase
      .from('transfers')
      .select('*')
      .eq('id', transferId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !transfer) {
      return NextResponse.json({ error: 'Virement non trouvé ou non autorisé' }, { status: 404 })
    }

    // Annuler les modifications de solde si le virement était dans le passé
    const transferDate = new Date(transfer.date)
    const now = new Date()

    if (transferDate <= now) {
      // Récupérer les soldes actuels
      const { data: fromAccount } = await supabase
        .from('accounts')
        .select('initial_balance')
        .eq('id', transfer.from_account_id)
        .single()

      const { data: toAccount } = await supabase
        .from('accounts')
        .select('initial_balance')
        .eq('id', transfer.to_account_id)
        .single()

      if (fromAccount && toAccount) {
        // Recréditer le compte source
        await supabase
          .from('accounts')
          .update({ initial_balance: fromAccount.initial_balance + parseFloat(transfer.amount) })
          .eq('id', transfer.from_account_id)

        // Redébiter le compte destination
        await supabase
          .from('accounts')
          .update({ initial_balance: toAccount.initial_balance - parseFloat(transfer.amount) })
          .eq('id', transfer.to_account_id)
      }
    }

    // Supprimer le virement
    const { error } = await supabase
      .from('transfers')
      .delete()
      .eq('id', transferId)
      .eq('user_id', userId)

    if (error) {
      console.error('Delete error:', error)
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression du virement' }, { status: 500 })
  }
}
