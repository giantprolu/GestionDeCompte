import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { checkAndSendCriticalNotifications, forceTestNotifications } from '@/lib/notification-checker'

// GET: Vérifier et envoyer les notifications critiques pour l'utilisateur connecté
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier si c'est un test forcé
    const { searchParams } = new URL(request.url)
    const forceTest = searchParams.get('force') === 'true'

    let result
    if (forceTest) {
      // Mode test : envoie toujours les notifications sans vérifier si déjà envoyées
      result = await forceTestNotifications(userId)
    } else {
      result = await checkAndSendCriticalNotifications(userId)
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error checking notifications:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la vérification des notifications' },
      { status: 500 }
    )
  }
}
