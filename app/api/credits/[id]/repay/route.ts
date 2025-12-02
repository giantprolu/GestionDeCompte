import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const { id: creditId } = await context.params
    const body = await request.json()
    const amount = parseFloat(body.amount)
    const accountId = body.accountId
    const note = body.note || null
    const date = body.date || new Date().toISOString()

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
    }

    // Vérifier que le crédit appartient à l'utilisateur
    const { data: credit } = await supabase
      .from('credits')
      .select('*')
      .eq('id', creditId)
      .eq('user_id', userId)
      .single()

    if (!credit) {
      return NextResponse.json({ error: 'Crédit non trouvé' }, { status: 404 })
    }

    // Vérifier que le compte appartient à l'utilisateur
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', accountId)
      .eq('user_id', userId)
      .single()

    if (!account) {
      return NextResponse.json({ error: 'Compte non trouvé' }, { status: 404 })
    }

    // Créer la transaction de remboursement (on considère un remboursement comme une dépense)
    // category_id is NOT NULL in the DB. Try to find a sensible default category
    // for repayments: first try a category named 'Autres dépenses', otherwise
    // fallback to the first category with type 'expense'.
    let categoryId: string | null = null
    try {
      const { data: catByName } = await supabase
        .from('categories')
        .select('id')
        .eq('name', 'Crédit')
        .maybeSingle()

      if (catByName && catByName.id) {
        categoryId = catByName.id
      } else {
        const { data: firstExpenseCat } = await supabase
          .from('categories')
          .select('id')
          .eq('type', 'expense')
          .limit(1)
        if (firstExpenseCat && firstExpenseCat.length > 0) categoryId = firstExpenseCat[0].id
      }
    } catch (err) {
      console.error('Error fetching default category for repayment:', err)
    }

    if (!categoryId) {
      console.error('No expense category available to use for repayment transaction')
      return NextResponse.json({ error: 'Aucune catégorie de dépense disponible' }, { status: 500 })
    }

    const { data: transaction, error: txnError } = await supabase
      .from('transactions')
      .insert({
        amount: amount,
        type: 'expense',
        category_id: categoryId,
        date: date,
        account_id: accountId,
        note: note,
        credit_id: creditId,
        is_recurring: false,
      })
      .select(`*, account:accounts(*), category:categories(*)`)
      .single()

    if (txnError) {
      console.error('Error creating repayment transaction:', txnError)
      throw txnError
    }

    // Mettre à jour outstanding du crédit
    const newOutstanding = parseFloat(credit.outstanding) - amount
    const updates: { outstanding: number; is_closed?: boolean } = { outstanding: newOutstanding }
    if (newOutstanding <= 0) updates.is_closed = true

    const { data: updatedCredit, error: creditUpdateError } = await supabase
      .from('credits')
      .update(updates)
      .eq('id', creditId)
      .select('*')
      .single()

    if (creditUpdateError) {
      console.error('Error updating credit outstanding:', creditUpdateError)
      throw creditUpdateError
    }

    return NextResponse.json({ transaction, credit: updatedCredit })
  } catch (error) {
    console.error('Error /api/credits/[id]/repay POST:', error)
    return NextResponse.json({ error: "Erreur lors de l'enregistrement du remboursement" }, { status: 500 })
  }
}
