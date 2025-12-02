import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'Id manquant' }, { status: 400 })

    // Dissocier les transactions du crédit au lieu de supprimer
    const { error: txnErr } = await supabase
      .from('transactions')
      .update({ credit_id: null })
      .eq('credit_id', id)

    if (txnErr) {
      console.error('Error clearing transactions credit_id on delete:', txnErr)
      throw txnErr
    }

    const { error } = await supabase
      .from('credits')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error /api/credits/[id] DELETE:', err)
    return NextResponse.json({ error: 'Erreur suppression crédit' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const { id } = await context.params
    if (!id) return NextResponse.json({ error: 'Id manquant' }, { status: 400 })

    const body = await request.json()
    const updates: any = {}
    if (typeof body.title !== 'undefined') updates.title = body.title
    if (typeof body.note !== 'undefined') updates.note = body.note
    if (typeof body.start_date !== 'undefined') updates.start_date = body.start_date
    if (typeof body.due_date !== 'undefined') updates.due_date = body.due_date
    if (typeof body.outstanding !== 'undefined') updates.outstanding = parseFloat(body.outstanding)
    if (typeof body.is_closed !== 'undefined') updates.is_closed = !!body.is_closed

    const { data, error } = await supabase
      .from('credits')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error /api/credits/[id] PATCH:', err)
    return NextResponse.json({ error: 'Erreur mise à jour crédit' }, { status: 500 })
  }
}
