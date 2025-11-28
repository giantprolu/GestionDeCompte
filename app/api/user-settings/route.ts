import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/db'



// Table: user_settings (user_id, spend_targets: json, savings_rate: number)

export async function GET(request: Request) {
  const authRes = await auth()
  if (!authRes.userId) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const supaRes = await supabase
    .from('user_settings')
    .select('spend_targets, savings_rate')
    .eq('user_id', authRes.userId)
    .maybeSingle()
  if (supaRes.error && supaRes.error.code !== 'PGRST116') {
    return NextResponse.json({ error: supaRes.error.message }, { status: 500 })
  }
  // Si aucun settings, retourne un objet vide
  return NextResponse.json(supaRes.data || {})
}

export async function PATCH(request: Request) {
  const authRes = await auth()
  if (!authRes.userId) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  let body: any = {}
  try {
    body = await request.json()
  } catch {
    console.debug('PATCH body parse error')
  }
  const { spend_targets, savings_rate } = body
  const upsertData = { user_id: authRes.userId, spend_targets, savings_rate }
  const supaRes = await supabase
    .from('user_settings')
    .upsert(upsertData, { onConflict: 'user_id' })
  if (supaRes.error) {
    return NextResponse.json({ error: supaRes.error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
