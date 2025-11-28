import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const category = searchParams.get('category')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = searchParams.get('type')
    const categoryId = searchParams.get('categoryId')
    const includeUpcoming = searchParams.get('includeUpcoming') === 'true'

    // Récupérer uniquement les comptes de l'utilisateur (pas les partagés)
    const { data: userAccounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId)
    
    const userAccountIds = userAccounts?.map(acc => acc.id) || []

    let query = supabase
      .from('transactions')
      .select(`
        *,
        account:accounts(*),
        category:categories(*)
      `)
      .in('account_id', userAccountIds)
      .order('date', { ascending: false })

    if (accountId) query = query.eq('account_id', accountId)
    if (categoryId) query = query.eq('category_id', categoryId)
    if (type) query = query.eq('type', type)
    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)

    // Par défaut, ne montrer que les transactions dont la date est passée ou aujourd'hui
    if (!includeUpcoming) {
      const now = new Date()
      now.setHours(23, 59, 59, 999) // Fin de la journée
      query = query.lte('date', now.toISOString())
    }

    const { data: transactions, error } = await query

    if (error) throw error
    
    // Mapper les champs pour correspondre au front-end
    const mappedTransactions = (transactions || []).map((txn: any) => ({
      id: txn.id,
      amount: txn.amount,
      type: txn.type,
      categoryId: txn.category_id,
      date: txn.date,
      note: txn.note,
      accountId: txn.account_id,
      account: txn.account,
      category: txn.category,
      isRecurring: txn.is_recurring,
      recurrenceFrequency: txn.recurrence_frequency,
      recurrenceDay: txn.recurrence_day,
      isActive: txn.is_active,
      createdAt: txn.created_at,
      updatedAt: txn.updated_at,
      archived: txn.archived,
    }))
    
    return NextResponse.json(mappedTransactions)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des transactions' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    
    // Vérifier que le compte appartient à l'utilisateur
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', body.accountId)
      .eq('user_id', userId)
      .single()
        
    if (!account) {
      // Lister tous les comptes de l'utilisateur pour déboguer
      const { data: allAccounts } = await supabase
        .from('accounts')
        .select('id, name, user_id')
        .eq('user_id', userId)
            
      return NextResponse.json({ 
        error: 'Compte non trouvé',
        debug: {
          searchedAccountId: body.accountId,
          userId,
          availableAccounts: allAccounts
        }
      }, { status: 404 })
    }

    const { data: transaction, error } = await supabase
      .from('transactions')
      .insert({
        amount: parseFloat(body.amount),
        type: body.type,
        category_id: body.categoryId,
        date: body.date,
        account_id: body.accountId,
        note: body.note || null,
        is_recurring: body.isRecurring || false,
        recurrence_frequency: body.recurrenceFrequency || null,
        recurrence_day: body.recurrenceDay || null,
        is_active: body.isActive !== undefined ? body.isActive : true,
      })
      .select(`
        *,
        account:accounts(*),
        category:categories(*)
      `)
      .single()

    if (error) {
      console.error('Insert error:', error)
      throw error
    }

    // Mettre à jour le solde initial du compte
    const montant = parseFloat(body.amount)
    let updateValue = 0
    if (body.type === 'income') {
      updateValue = montant
    } else if (body.type === 'expense') {
      updateValue = -montant
    }
    if (updateValue !== 0) {
      // Récupérer le solde actuel
      const { data: compte } = await supabase
        .from('accounts')
        .select('initial_balance')
        .eq('id', body.accountId)
        .single()
      if (compte) {
        const nouveauSolde = (compte.initial_balance || 0) + updateValue
        await supabase
          .from('accounts')
          .update({ initial_balance: nouveauSolde })
          .eq('id', body.accountId)
      }
    }

    // Mapper les champs pour correspondre au front-end
    const mappedTransaction = {
      id: transaction.id,
      amount: transaction.amount,
      type: transaction.type,
      categoryId: transaction.category_id,
      date: transaction.date,
      note: transaction.note,
      accountId: transaction.account_id,
      account: transaction.account,
      category: transaction.category,
      isRecurring: transaction.is_recurring,
      recurrenceFrequency: transaction.recurrence_frequency,
      recurrenceDay: transaction.recurrence_day,
      isActive: transaction.is_active,
      createdAt: transaction.created_at,
      updatedAt: transaction.updated_at,
    }

    return NextResponse.json(mappedTransaction)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la création de la transaction' }, { status: 500 })
  }
}
