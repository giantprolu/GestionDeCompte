import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'income' ou 'expense'

    let query = supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true })

    if (type) {
      query = query.eq('type', type)
    }

    const { data: categories, error } = await query

    if (error) throw error
    
    return NextResponse.json(categories || [])
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des catégories' }, { status: 500 })
  }
}
