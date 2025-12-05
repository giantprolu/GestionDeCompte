import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/db'

// GET: Vérifier si l'utilisateur a une subscription active
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    if (error) {
      console.error('Error checking subscription:', error)
      return NextResponse.json({ hasSubscription: false })
    }

    return NextResponse.json({ 
      hasSubscription: data && data.length > 0 
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ hasSubscription: false })
  }
}
