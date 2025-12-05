import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { WebhookEvent } from '@clerk/nextjs/server'
import { supabase } from '@/lib/db'

export async function POST(request: NextRequest) {
  // Vérifier la signature du webhook
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET non configuré')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // Récupérer les headers Svix
  const svix_id = request.headers.get('svix-id')
  const svix_timestamp = request.headers.get('svix-timestamp')
  const svix_signature = request.headers.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  // Récupérer le body
  const payload = await request.json()
  const body = JSON.stringify(payload)

  // Vérifier la signature
  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Erreur de vérification du webhook:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Traiter l'événement
  const eventType = evt.type

  if (eventType === 'user.deleted') {
    const userId = evt.data.id

    if (!userId) {
      return NextResponse.json({ error: 'No user ID in event' }, { status: 400 })
    }

    console.log(`🗑️ Suppression des données pour l'utilisateur: ${userId}`)

    try {
      // 1. Récupérer les IDs des comptes de l'utilisateur
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', userId)

      const accountIds = accounts?.map(a => a.id) || []

      // 2. Supprimer les transactions liées aux comptes
      if (accountIds.length > 0) {
        const { error: txError } = await supabase
          .from('transactions')
          .delete()
          .in('account_id', accountIds)

        if (txError) console.error('Erreur suppression transactions:', txError)
      }

      // 3. Supprimer les crédits
      const { error: creditsError } = await supabase
        .from('credits')
        .delete()
        .eq('user_id', userId)

      if (creditsError) console.error('Erreur suppression crédits:', creditsError)

      // 4. Supprimer les comptes
      const { error: accountsError } = await supabase
        .from('accounts')
        .delete()
        .eq('user_id', userId)

      if (accountsError) console.error('Erreur suppression comptes:', accountsError)

      // 5. Supprimer les clôtures mensuelles
      const { error: closuresError } = await supabase
        .from('month_closures')
        .delete()
        .eq('user_id', userId)

      if (closuresError) console.error('Erreur suppression clôtures:', closuresError)

      // 6. Supprimer les paramètres utilisateur
      const { error: settingsError } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', userId)

      if (settingsError) console.error('Erreur suppression paramètres:', settingsError)

      // 7. Supprimer les préférences de notification
      const { error: notifPrefsError } = await supabase
        .from('notification_preferences')
        .delete()
        .eq('user_id', userId)

      if (notifPrefsError) console.error('Erreur suppression préférences notifications:', notifPrefsError)

      // 8. Supprimer les subscriptions push
      const { error: pushSubsError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)

      if (pushSubsError) console.error('Erreur suppression push subscriptions:', pushSubsError)

      // 9. Supprimer les notifications envoyées
      const { error: sentNotifsError } = await supabase
        .from('sent_notifications')
        .delete()
        .eq('user_id', userId)

      if (sentNotifsError) console.error('Erreur suppression notifications envoyées:', sentNotifsError)

      // 10. Supprimer les partages (en tant que propriétaire)
      const { error: sharedOwnerError } = await supabase
        .from('shared_dashboards')
        .delete()
        .eq('owner_user_id', userId)

      if (sharedOwnerError) console.error('Erreur suppression partages (owner):', sharedOwnerError)

      // 11. Supprimer les partages (en tant que destinataire)
      const { error: sharedWithError } = await supabase
        .from('shared_dashboards')
        .delete()
        .eq('shared_with_user_id', userId)

      if (sharedWithError) console.error('Erreur suppression partages (shared_with):', sharedWithError)

      console.log(`✅ Données supprimées pour l'utilisateur: ${userId}`)

      return NextResponse.json({ success: true, message: 'User data deleted' })
    } catch (error) {
      console.error('Erreur lors de la suppression des données:', error)
      return NextResponse.json({ error: 'Failed to delete user data' }, { status: 500 })
    }
  }

  // Pour les autres événements, juste confirmer la réception
  return NextResponse.json({ received: true })
}
