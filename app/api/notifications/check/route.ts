import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { checkAndSendCriticalNotifications } from '@/lib/notification-checker'

// GET: Vérifier et envoyer les notifications critiques pour l'utilisateur connecté
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const result = await checkAndSendCriticalNotifications(userId)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error checking notifications:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la vérification des notifications' },
      { status: 500 }
    )
  }
}
