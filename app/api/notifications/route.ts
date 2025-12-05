import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/db'
import { saveSubscription, removeSubscription } from '@/lib/notifications'

// POST: Sauvegarder une subscription push
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const subscription = await request.json()
    const result = await saveSubscription(subscription, userId)
    
    // Créer les préférences par défaut si elles n'existent pas
    await supabase.from('notification_preferences').upsert({
      user_id: userId,
      negative_balance: true,
      low_balance: true,
      low_balance_threshold: 100,
      upcoming_recurring: true,
      monthly_summary: true,
    }, {
      onConflict: 'user_id'
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error saving subscription:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'enregistrement' },
      { status: 500 }
    )
  }
}

// DELETE: Supprimer une subscription push
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { endpoint } = await request.json()
    const result = await removeSubscription(userId, endpoint)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error removing subscription:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression' },
      { status: 500 }
    )
  }
}

// GET: Récupérer les préférences de notification
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    // Retourner les préférences par défaut si aucune n'existe
    const preferences = data || {
      negative_balance: true,
      low_balance: true,
      low_balance_threshold: 100,
      upcoming_recurring: true,
      monthly_summary: true,
    }

    return NextResponse.json(preferences)
  } catch (error) {
    console.error('Error getting preferences:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des préférences' },
      { status: 500 }
    )
  }
}

// PATCH: Mettre à jour les préférences de notification
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const updates = await request.json()
    
    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: userId,
        ...updates,
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating preferences:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour' },
      { status: 500 }
    )
  }
}
