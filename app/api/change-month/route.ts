import { NextResponse } from 'next/server'
import { archivePreviousMonthTransactions } from '@/lib/utils'

export async function POST() {
  try {
    const result = await archivePreviousMonthTransactions()
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
