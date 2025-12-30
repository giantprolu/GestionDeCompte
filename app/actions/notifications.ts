'use server'

import webpush, { PushSubscription as WebPushSubscription } from 'web-push'

// Configure VAPID details only if environment variables are set
const vapidConfigured = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)

if (vapidConfigured) {
  webpush.setVapidDetails(
    'mailto:contact@moneyflow.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
}

// In production, store subscriptions in database
// For now, we'll use a simple in-memory store (resets on server restart)
const subscriptions = new Map<string, WebPushSubscription>()

export async function subscribeUser(sub: WebPushSubscription, userId: string) {
  try {
    subscriptions.set(userId, sub)
    // TODO: In production, store in Supabase
    // await supabase.from('push_subscriptions').upsert({
    //   user_id: userId,
    //   subscription: sub,
    // })
    return { success: true }
  } catch (error) {
    console.error('Error subscribing user:', error)
    return { success: false, error: 'Failed to subscribe' }
  }
}

export async function unsubscribeUser(userId: string) {
  try {
    subscriptions.delete(userId)
    // TODO: In production, remove from Supabase
    // await supabase.from('push_subscriptions').delete().eq('user_id', userId)
    return { success: true }
  } catch (error) {
    console.error('Error unsubscribing user:', error)
    return { success: false, error: 'Failed to unsubscribe' }
  }
}

export async function sendNotification(
  userId: string,
  notification: {
    title: string
    body: string
    icon?: string
    url?: string
    actions?: Array<{ action: string; title: string }>
  }
) {
  if (!vapidConfigured) {
    return { success: false, error: 'VAPID not configured' }
  }

  const subscription = subscriptions.get(userId)

  if (!subscription) {
    return { success: false, error: 'No subscription found' }
  }

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/icon-192x192.png',
        url: notification.url || '/',
        actions: notification.actions || [],
      })
    )
    return { success: true }
  } catch (error) {
    console.error('Error sending push notification:', error)
    return { success: false, error: 'Failed to send notification' }
  }
}

export async function sendNotificationToAll(notification: {
  title: string
  body: string
  icon?: string
  url?: string
}) {
  if (!vapidConfigured) {
    return []
  }

  const results = []

  for (const [userId, subscription] of subscriptions) {
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          title: notification.title,
          body: notification.body,
          icon: notification.icon || '/icon-192x192.png',
          url: notification.url || '/',
        })
      )
      results.push({ userId, success: true })
    } catch (error) {
      console.error(`Error sending to ${userId}:`, error)
      results.push({ userId, success: false })
    }
  }

  return { success: true, results }
}
