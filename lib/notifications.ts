'use server'

import webpush, { PushSubscription as WebPushSubscription } from 'web-push'
import { supabase } from '@/lib/db'

// Configure VAPID details
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:contact@moneyflow.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

// Types de notifications critiques
export type CriticalNotificationType = 
  | 'negative_balance'
  | 'low_balance'
  | 'recurring_due'
  | 'credit_due'
  | 'monthly_summary'

// Interface pour les notifications
export interface CriticalNotification {
  type: CriticalNotificationType
  title: string
  body: string
  icon: string
  badge?: string
  tag?: string
  url?: string
  data?: Record<string, unknown>
}

// Icônes et emojis pour les notifications
const NOTIFICATION_ICONS = {
  negative_balance: '🔴',
  low_balance: '⚠️',
  recurring_due: '📅',
  credit_due: '💳',
  monthly_summary: '📊',
}

// Sauvegarder une subscription en base de données
export async function saveSubscription(subscription: WebPushSubscription, userId: string) {
  try {
    const keys = subscription.keys as { p256dh: string; auth: string }
    
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        keys_p256dh: keys.p256dh,
        keys_auth: keys.auth,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,endpoint'
      })

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error saving subscription:', error)
    return { success: false, error: 'Failed to save subscription' }
  }
}

// Supprimer une subscription
export async function removeSubscription(userId: string, endpoint?: string) {
  try {
    let query = supabase.from('push_subscriptions').delete().eq('user_id', userId)
    
    if (endpoint) {
      query = query.eq('endpoint', endpoint)
    }
    
    const { error } = await query
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error removing subscription:', error)
    return { success: false, error: 'Failed to remove subscription' }
  }
}

// Récupérer les subscriptions d'un utilisateur
export async function getUserSubscriptions(userId: string): Promise<WebPushSubscription[]> {
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error

    return (data || []).map(sub => ({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys_p256dh,
        auth: sub.keys_auth,
      }
    })) as WebPushSubscription[]
  } catch (error) {
    console.error('Error getting subscriptions:', error)
    return []
  }
}

// Vérifier si une notification a déjà été envoyée aujourd'hui
async function wasNotificationSentToday(
  userId: string, 
  type: CriticalNotificationType, 
  referenceId: string
): Promise<boolean> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const { data, error } = await supabase
      .from('sent_notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('notification_type', type)
      .eq('reference_id', referenceId)
      .gte('sent_at', today.toISOString())
      .limit(1)

    if (error) throw error
    return (data?.length || 0) > 0
  } catch (error) {
    console.error('Error checking sent notification:', error)
    return false
  }
}

// Marquer une notification comme envoyée
async function markNotificationSent(
  userId: string, 
  type: CriticalNotificationType, 
  referenceId: string
) {
  try {
    await supabase.from('sent_notifications').insert({
      user_id: userId,
      notification_type: type,
      reference_id: referenceId,
    })
  } catch (error) {
    console.error('Error marking notification sent:', error)
  }
}

// Envoyer une notification push
export async function sendPushNotification(
  userId: string,
  notification: CriticalNotification
): Promise<{ success: boolean; error?: string }> {
  try {
    const subscriptions = await getUserSubscriptions(userId)
    
    if (subscriptions.length === 0) {
      return { success: false, error: 'No subscriptions found' }
    }

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/icon-192x192.png',
      badge: notification.badge || '/icon-192x192.png',
      tag: notification.tag || notification.type,
      url: notification.url || '/',
      data: notification.data || {},
    })

    const results = await Promise.allSettled(
      subscriptions.map(sub => webpush.sendNotification(sub, payload))
    )

    const successCount = results.filter(r => r.status === 'fulfilled').length
    
    if (successCount === 0) {
      return { success: false, error: 'All notifications failed' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error sending push notification:', error)
    return { success: false, error: 'Failed to send notification' }
  }
}

// ============================================
// NOTIFICATIONS CRITIQUES
// ============================================

// Notification: Solde négatif
export async function notifyNegativeBalance(
  userId: string,
  accountName: string,
  accountId: string,
  balance: number
) {
  const referenceId = `negative_${accountId}`
  
  // Vérifier si déjà notifié aujourd'hui
  if (await wasNotificationSentToday(userId, 'negative_balance', referenceId)) {
    return { success: false, reason: 'already_sent' }
  }

  const notification: CriticalNotification = {
    type: 'negative_balance',
    title: `${NOTIFICATION_ICONS.negative_balance} Solde Négatif !`,
    body: `Votre compte "${accountName}" est passé à ${balance.toFixed(2)} €. Attention aux frais bancaires !`,
    icon: '/icon-192x192.png',
    tag: `negative_balance_${accountId}`,
    url: '/comptes',
    data: {
      accountId,
      accountName,
      balance,
      type: 'negative_balance',
    }
  }

  const result = await sendPushNotification(userId, notification)
  
  if (result.success) {
    await markNotificationSent(userId, 'negative_balance', referenceId)
  }

  return result
}

// Notification: Solde bas (seuil configurable)
export async function notifyLowBalance(
  userId: string,
  accountName: string,
  accountId: string,
  balance: number,
  threshold: number = 100
) {
  const referenceId = `low_${accountId}_${threshold}`
  
  if (await wasNotificationSentToday(userId, 'low_balance', referenceId)) {
    return { success: false, reason: 'already_sent' }
  }

  const notification: CriticalNotification = {
    type: 'low_balance',
    title: `${NOTIFICATION_ICONS.low_balance} Solde Bas`,
    body: `Votre compte "${accountName}" n'a plus que ${balance.toFixed(2)} € (seuil: ${threshold} €)`,
    icon: '/icon-192x192.png',
    tag: `low_balance_${accountId}`,
    url: '/comptes',
    data: {
      accountId,
      accountName,
      balance,
      threshold,
      type: 'low_balance',
    }
  }

  const result = await sendPushNotification(userId, notification)
  
  if (result.success) {
    await markNotificationSent(userId, 'low_balance', referenceId)
  }

  return result
}

// Notification: Prélèvement récurrent à venir
export async function notifyUpcomingRecurring(
  userId: string,
  transactionName: string,
  transactionId: string,
  amount: number,
  dueDate: Date,
  daysUntil: number
) {
  const referenceId = `recurring_${transactionId}_${dueDate.toISOString().split('T')[0]}`
  
  if (await wasNotificationSentToday(userId, 'recurring_due', referenceId)) {
    return { success: false, reason: 'already_sent' }
  }

  const dayText = daysUntil === 0 ? "aujourd'hui" : 
                  daysUntil === 1 ? "demain" : 
                  `dans ${daysUntil} jours`

  const notification: CriticalNotification = {
    type: 'recurring_due',
    title: `${NOTIFICATION_ICONS.recurring_due} Prélèvement ${dayText}`,
    body: `"${transactionName}" de ${amount.toFixed(2)} € sera débité ${dayText}`,
    icon: '/icon-192x192.png',
    tag: `recurring_${transactionId}`,
    url: '/transactions',
    data: {
      transactionId,
      transactionName,
      amount,
      dueDate: dueDate.toISOString(),
      type: 'recurring_due',
    }
  }

  const result = await sendPushNotification(userId, notification)
  
  if (result.success) {
    await markNotificationSent(userId, 'recurring_due', referenceId)
  }

  return result
}

// Notification: Échéance de crédit
export async function notifyCreditDue(
  userId: string,
  creditName: string,
  creditId: string,
  monthlyPayment: number,
  dueDate: Date,
  remainingMonths: number
) {
  const referenceId = `credit_${creditId}_${dueDate.toISOString().split('T')[0]}`
  
  if (await wasNotificationSentToday(userId, 'credit_due', referenceId)) {
    return { success: false, reason: 'already_sent' }
  }

  const notification: CriticalNotification = {
    type: 'credit_due',
    title: `${NOTIFICATION_ICONS.credit_due} Échéance de crédit`,
    body: `"${creditName}": ${monthlyPayment.toFixed(2)} € à payer. Encore ${remainingMonths} mois restants.`,
    icon: '/icon-192x192.png',
    tag: `credit_${creditId}`,
    url: '/depenses',
    data: {
      creditId,
      creditName,
      monthlyPayment,
      remainingMonths,
      type: 'credit_due',
    }
  }

  const result = await sendPushNotification(userId, notification)
  
  if (result.success) {
    await markNotificationSent(userId, 'credit_due', referenceId)
  }

  return result
}

// Notification: Résumé mensuel
export async function notifyMonthlySummary(
  userId: string,
  month: string,
  totalIncome: number,
  totalExpenses: number,
  balance: number
) {
  const referenceId = `summary_${month}`
  
  if (await wasNotificationSentToday(userId, 'monthly_summary', referenceId)) {
    return { success: false, reason: 'already_sent' }
  }

  const emoji = balance >= 0 ? '✅' : '❌'
  const balanceText = balance >= 0 ? 'excédent' : 'déficit'

  const notification: CriticalNotification = {
    type: 'monthly_summary',
    title: `${NOTIFICATION_ICONS.monthly_summary} Résumé de ${month}`,
    body: `${emoji} Revenus: ${totalIncome.toFixed(2)} € | Dépenses: ${totalExpenses.toFixed(2)} € | ${balanceText}: ${Math.abs(balance).toFixed(2)} €`,
    icon: '/icon-192x192.png',
    tag: `summary_${month}`,
    url: '/previsionnel',
    data: {
      month,
      totalIncome,
      totalExpenses,
      balance,
      type: 'monthly_summary',
    }
  }

  const result = await sendPushNotification(userId, notification)
  
  if (result.success) {
    await markNotificationSent(userId, 'monthly_summary', referenceId)
  }

  return result
}
