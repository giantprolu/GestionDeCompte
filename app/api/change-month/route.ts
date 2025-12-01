import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { archivePreviousMonthTransactions } from '@/lib/utils'

export async function POST() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
    }

    const result = await archivePreviousMonthTransactions(userId)
    return NextResponse.json({ success: true, debug: result })
  } catch (error) {
    let message = 'Erreur inconnue';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
