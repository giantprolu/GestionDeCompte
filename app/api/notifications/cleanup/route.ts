import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/db'

// POST: Clean up all subscriptions for the current user
// This is useful when VAPID keys have been regenerated
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    console.log('[Cleanup] Removing all subscriptions for user:', userId)

    // Delete all push subscriptions for this user
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)

    if (error) {
      console.error('[Cleanup] Error deleting subscriptions:', error)
      throw error
    }

    console.log('[Cleanup] ✅ All subscriptions removed successfully')

    return NextResponse.json({
      success: true,
      message: 'All subscriptions removed. Please re-enable notifications.'
    })
  } catch (error) {
    console.error('[Cleanup] Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du nettoyage des notifications' },
      { status: 500 }
    )
  }
}
