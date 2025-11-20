import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

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
        account:user_id (user_id)
      `)
      .eq('id', id)
      .single()
    
    if (!transaction || transaction.account?.user_id !== userId) {
      return NextResponse.json({ error: 'Transaction non trouvée' }, { status: 404 })
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
