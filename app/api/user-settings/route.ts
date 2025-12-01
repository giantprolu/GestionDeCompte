import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/db'



// Table: user_settings (user_id, spend_targets: json, savings_rate: number, user_type: 'viewer' | 'user')

export async function GET(request: Request) {
  const authRes = await auth()
  if (!authRes.userId) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  
  // D'abord, essayer avec user_type
  let supaRes = await supabase
    .from('user_settings')
    .select('spend_targets, savings_rate, user_type')
    .eq('user_id', authRes.userId)
    .maybeSingle()
  
  // Si erreur (probablement colonne user_type n'existe pas), essayer sans
  if (supaRes.error) {
    supaRes = await supabase
      .from('user_settings')
      .select('spend_targets, savings_rate')
      .eq('user_id', authRes.userId)
      .maybeSingle()
      
    if (supaRes.error && supaRes.error.code !== 'PGRST116') {
      return NextResponse.json({ error: supaRes.error.message }, { status: 500 })
    }
    
    // Retourner les données sans user_type
    return NextResponse.json(supaRes.data ? { ...supaRes.data, user_type: null } : { user_type: null })
  }
  
  // Si aucun settings, retourne un objet avec user_type null
  return NextResponse.json(supaRes.data || { user_type: null })
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
  const { spend_targets, savings_rate, user_type } = body
  
  // Construire l'objet de mise à jour dynamiquement
  const upsertData: Record<string, any> = { user_id: authRes.userId }
  if (spend_targets !== undefined) upsertData.spend_targets = spend_targets
  if (savings_rate !== undefined) upsertData.savings_rate = savings_rate
  if (user_type !== undefined) upsertData.user_type = user_type
  
  const supaRes = await supabase
    .from('user_settings')
    .upsert(upsertData, { onConflict: 'user_id' })
  if (supaRes.error) {
    // Si l'erreur est liée à la colonne user_type qui n'existe pas
    if (supaRes.error.message.includes('user_type')) {
      // Réessayer sans user_type
      delete upsertData.user_type
      const retryRes = await supabase
        .from('user_settings')
        .upsert(upsertData, { onConflict: 'user_id' })
      if (retryRes.error) {
        return NextResponse.json({ error: retryRes.error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, warning: 'user_type column not available' })
    }
    return NextResponse.json({ error: supaRes.error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
