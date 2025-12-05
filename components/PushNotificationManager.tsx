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
  const { user, isLoaded } = useUser()
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = useState<boolean | null>(null)
  const [hasServerSubscription, setHasServerSubscription] = useState(false)

  // Vérifier si l'utilisateur a une subscription en base de données
  const checkServerSubscription = useCallback(async () => {
    if (!user) return false
    try {
      const response = await fetch('/api/notifications/subscription-status')
      if (response.ok) {
        const data = await response.json()
        return data.hasSubscription
      }
    } catch (error) {
      console.error('Error checking server subscription:', error)
    }
    return false
  }, [user])

  const registerServiceWorker = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      })
      
      // Vérifier s'il y a une mise à jour du SW
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              // Rafraîchir la page si un nouveau SW est activé
              window.location.reload()
            }
          })
        }
      })

      const sub = await registration.pushManager.getSubscription()
      setSubscription(sub)
      return sub
    } catch (error) {
      console.error('Service worker registration failed:', error)
      return null
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window
      setIsSupported(supported)
      
      if (!supported) {
        setIsLoading(false)
        return
      }
      
      setPermission(Notification.permission)
      const sub = await registerServiceWorker()
      
      // Vérifier aussi en base de données
      if (isLoaded && user) {
        const hasServer = await checkServerSubscription()
        setHasServerSubscription(hasServer)
        
        // Si on a une subscription serveur mais pas locale, essayer de restaurer
        if (hasServer && !sub && Notification.permission === 'granted') {
          // Réinscrire silencieusement
          try {
            const registration = await navigator.serviceWorker.ready
            const newSub = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(
                process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
              ),
            })
            setSubscription(newSub)
          } catch (e) {
            console.error('Failed to restore subscription:', e)
          }
        }
      }
      
      setIsLoading(false)
    }
    
    if (isLoaded) {
      init()
    }
  }, [registerServiceWorker, checkServerSubscription, isLoaded, user])

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
      
      setHasServerSubscription(true)

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
      setHasServerSubscription(false)
    } catch (error) {
      console.error('Error unsubscribing from push:', error)
    }
    setIsLoading(false)
  }

  // Don't render until we know if supported
  if (isSupported === null || !isSupported || !isLoaded) {
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

  const isActive = subscription !== null || hasServerSubscription

  return (
    <Button
      variant="ghost"
      size={showLabel ? 'default' : 'icon'}
      className={`
        transition-all duration-300 
        ${isActive 
          ? 'bg-green-600 hover:bg-green-700 text-white border-green-500' 
          : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600'
        }
        ${className}
      `}
      onClick={isActive ? unsubscribeFromPush : subscribeToPush}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isActive ? (
        <>
          <Bell className="h-4 w-4" />
          {showLabel && <span className="ml-2">Notifications activées</span>}
        </>
      ) : (
        <>
          <BellOff className="h-4 w-4" />
          {showLabel && <span className="ml-2">Activer les notifications</span>}
        </>
      )}
    </Button>
  )
}
