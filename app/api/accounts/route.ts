import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Utiliser la vue account_balances pour récupérer les soldes en 1 seule requête
    const { data: accounts, error } = await supabase
      .from('account_balances')
      .select('*')
      .eq('user_id', userId)
    
    if (error) throw error

    // Mapper les champs pour le front-end
    const accountsWithBalance = (accounts || []).map(account => ({
      id: account.id,
      name: account.name,
      type: account.type,
      initialBalance: account.initial_balance,
      currentBalance: account.current_balance,
      excludeFromPrevisionnel: account.exclude_from_previsionnel ?? false,
      isOwner: true,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
    }))
    
    return NextResponse.json(accountsWithBalance)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des comptes' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { data: account, error } = await supabase
      .from('accounts')
      .insert({
        user_id: userId,
        name: body.name,
        type: body.type,
        initial_balance: body.initialBalance,
      })
      .select()
      .single()
    
    if (error) {
      console.error('Insert error détaillé:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      
      // Erreur de doublon : nom de compte déjà existant
      if (error.code === '23505') {
        return NextResponse.json({ 
          error: 'Un compte avec ce nom existe déjà',
        }, { status: 409 })
      }
      
      return NextResponse.json({ 
        error: `Erreur DB: ${error.message}`,
        details: error.details || 'Aucun détail'
      }, { status: 500 })
    }
    
    return NextResponse.json({
      id: account.id,
      name: account.name,
      type: account.type,
      initialBalance: account.initial_balance,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la création du compte' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    
    // Construire dynamiquement l'objet de mise à jour
    const updateData: Record<string, unknown> = {}
    if (body.initialBalance !== undefined) {
      updateData.initial_balance = body.initialBalance
    }
    if (body.excludeFromPrevisionnel !== undefined) {
      updateData.exclude_from_previsionnel = body.excludeFromPrevisionnel
    }
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune donnée à mettre à jour' }, { status: 400 })
    }
    
    const { data: account, error } = await supabase
      .from('accounts')
      .update(updateData)
      .eq('id', body.id)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      console.error('Update error:', error)
      throw error
    }
    
    return NextResponse.json({
      id: account.id,
      name: account.name,
      type: account.type,
      initialBalance: account.initial_balance,
      excludeFromPrevisionnel: account.exclude_from_previsionnel ?? false,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du compte' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('id')

    if (!accountId) {
      return NextResponse.json({ error: 'ID du compte requis' }, { status: 400 })
    }

    // Vérifier que le compte appartient à l'utilisateur
    const { data: account, error: fetchError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !account) {
      return NextResponse.json({ error: 'Compte non trouvé ou non autorisé' }, { status: 404 })
    }

    // Supprimer d'abord les transactions associées
    const { error: txnError } = await supabase
      .from('transactions')
      .delete()
      .eq('account_id', accountId)

    if (txnError) {
      console.error('Error deleting transactions:', txnError)
    }

    // Supprimer le compte
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', userId)

    if (error) {
      console.error('Delete error:', error)
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression du compte' }, { status: 500 })
  }
}
