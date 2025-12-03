'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Bell, BellOff, Loader2 } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

interface PushNotificationManagerProps {
  showLabel?: boolean
  className?: string
}

export default function PushNotificationManager({ 
  showLabel = true,
  className = ''
}: PushNotificationManagerProps) {
  const { user } = useUser()
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = useState<boolean | null>(null)

  const registerServiceWorker = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      })
      const sub = await registration.pushManager.getSubscription()
      setSubscription(sub)
    } catch (error) {
      console.error('Service worker registration failed:', error)
    }
  }, [])

  useEffect(() => {
    // Use requestAnimationFrame to defer state updates
    requestAnimationFrame(() => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window
      setIsSupported(supported)
      if (supported) {
        setPermission(Notification.permission)
        registerServiceWorker()
      }
    })
  }, [registerServiceWorker])

  const subscribeToPush = async () => {
    if (!user) return
    
    setIsLoading(true)
    try {
      // Request permission
      const permission = await Notification.requestPermission()
      setPermission(permission)
      
      if (permission !== 'granted') {
        setIsLoading(false)
        return
      }

      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      })
      
      setSubscription(sub)
      
      // Sauvegarder via l'API (qui stocke en base de données)
      const serializedSub = JSON.parse(JSON.stringify(sub))
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializedSub),
      })

      // Vérifier immédiatement les notifications critiques
      await fetch('/api/notifications/check')
    } catch (error) {
      console.error('Error subscribing to push:', error)
    }
    setIsLoading(false)
  }

  const unsubscribeFromPush = async () => {
    if (!user || !subscription) return
    
    setIsLoading(true)
    try {
      await subscription.unsubscribe()
      
      // Supprimer via l'API
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })
      
      setSubscription(null)
    } catch (error) {
      console.error('Error unsubscribing from push:', error)
    }
    setIsLoading(false)
  }

  // Don't render until we know if supported
  if (isSupported === null || !isSupported) {
    return null
  }

  if (permission === 'denied') {
    return (
      <div className={`flex items-center gap-2 text-sm text-red-400 ${className}`}>
        <BellOff className="h-4 w-4" />
        {showLabel && <span>Notifications bloquées</span>}
      </div>
    )
  }

  return (
    <Button
      variant={subscription ? 'outline' : 'default'}
      size={showLabel ? 'default' : 'icon'}
      className={className}
      onClick={subscription ? unsubscribeFromPush : subscribeToPush}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : subscription ? (
        <>
          <BellOff className="h-4 w-4" />
          {showLabel && <span className="ml-2">Désactiver les notifications</span>}
        </>
      ) : (
        <>
          <Bell className="h-4 w-4" />
          {showLabel && <span className="ml-2">Activer les notifications</span>}
        </>
      )}
    </Button>
  )
}
