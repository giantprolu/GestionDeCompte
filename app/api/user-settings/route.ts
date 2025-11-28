import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/db'

function logDebug(...args: any[]) {
  console.log('[user-settings]', ...args)
}

// Table: user_settings (user_id, spend_targets: json, savings_rate: number)

export async function GET(request: Request) {
  const authRes = await auth()
  logDebug('GET called', { userId: authRes.userId })
  if (!authRes.userId) {
    logDebug('Non authentifié')
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const supaRes = await supabase
    .from('user_settings')
    .select('spend_targets, savings_rate')
    .eq('user_id', authRes.userId)
    .maybeSingle()
  logDebug('Supabase GET result', { data: supaRes.data, error: supaRes.error })
  if (supaRes.error && supaRes.error.code !== 'PGRST116') {
    logDebug('Supabase error', supaRes.error)
    return NextResponse.json({ error: supaRes.error.message }, { status: 500 })
  }
  // Si aucun settings, retourne un objet vide
  return NextResponse.json(supaRes.data || {})
}

export async function PATCH(request: Request) {
  const authRes = await auth()
  logDebug('PATCH called', { userId: authRes.userId })
  if (!authRes.userId) {
    logDebug('Non authentifié')
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  let body: any = {}
  try {
    body = await request.json()
  } catch {
    logDebug('PATCH body parse error')
  }
  logDebug('PATCH body', body)
  const { spend_targets, savings_rate } = body
  const upsertData = { user_id: authRes.userId, spend_targets, savings_rate }
  logDebug('Upsert data', upsertData)
  const supaRes = await supabase
    .from('user_settings')
    .upsert(upsertData, { onConflict: 'user_id' })
  logDebug('Supabase PATCH result', { error: supaRes.error })
  if (supaRes.error) {
    logDebug('Supabase error', supaRes.error)
    return NextResponse.json({ error: supaRes.error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
