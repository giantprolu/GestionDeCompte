import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

export async function GET(_request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: credits, error } = await supabase
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(credits || [])
  } catch (error) {
    console.error('Error /api/credits GET:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des crédits' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await request.json()
    const principal = parseFloat(body.principal)
    if (isNaN(principal) || principal <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
    }

    const payload: any = {
      user_id: userId,
      account_id: body.account_id || null,
      title: body.title || 'Crédit',
      principal: principal,
      outstanding: typeof body.outstanding !== 'undefined' ? parseFloat(body.outstanding) : principal,
      start_date: body.start_date || new Date().toISOString(),
      due_date: body.due_date || null,
      installments: body.installments || null,
      frequency: body.frequency || 'oneoff',
      note: body.note || null,
      is_closed: false,
    }

    const { data: credit, error } = await supabase
      .from('credits')
      .insert(payload)
      .select('*')
      .single()

    if (error) {
      console.error('Insert credit error:', error)
      throw error
    }

    return NextResponse.json(credit)
  } catch (error) {
    console.error('Error /api/credits POST:', error)
    return NextResponse.json({ error: 'Erreur lors de la création du crédit' }, { status: 500 })
  }
}
