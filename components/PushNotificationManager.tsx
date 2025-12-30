'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Bell, BellOff, Loader2, AlertCircle } from 'lucide-react'

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
  fullWidth?: boolean
  labelText?: string
  description?: string
}

export default function PushNotificationManager({ 
  showLabel = true,
  className = '',
  fullWidth = false,
  labelText,
  description
}: PushNotificationManagerProps) {
  const { user, isLoaded } = useUser()
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = useState<boolean | null>(null)
  const [hasServerSubscription, setHasServerSubscription] = useState(false)
  const [vapidError, setVapidError] = useState(false)

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
      // Check VAPID key first
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        console.error('VAPID Public Key is missing!')
        setVapidError(true)
        setIsLoading(false)
        return
      }

      const supported = 'serviceWorker' in navigator && 'PushManager' in window
      setIsSupported(supported)
      
      if (!supported) {
        setIsLoading(false)
        return
      }
      
      setPermission(Notification.permission)

      if (Notification.permission !== 'denied') {
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
      }
      
      setIsLoading(false)
    }
    
    if (isLoaded) {
      init()
    }
  }, [registerServiceWorker, checkServerSubscription, isLoaded, user])

  const subscribeToPush = async () => {
    if (!user) {
      console.error('[PushManager] 🔴 User is missing', { user });
      alert('Erreur : Utilisateur non connecté ou non chargé.');
      return;
    }

    if (vapidError) {
      console.error('[PushManager] 🔴 VAPID Error is true');
      alert('Configuration des notifications manquante (Clé VAPID)');
      return;
    }

    setIsLoading(true);
    try {
      // Request permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        setIsLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });
      setSubscription(sub);

      // Sauvegarder via l'API (qui stocke en base de données)
      const serializedSub = JSON.parse(JSON.stringify(sub));
      const saveRes = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializedSub),
      });


      if (!saveRes.ok) {
        const errorBody = await saveRes.text();
        console.error('[PushManager] 🔴 API Error body:', errorBody);
        throw new Error(`Failed to save subscription: ${saveRes.status} ${saveRes.statusText}`);
      }

      setHasServerSubscription(true);

      // Vérifier immédiatement les notifications critiques
      await fetch('/api/notifications/check');
    } catch (error) {
      console.error('[PushManager] 🔴 Error subscribing to push:', error);
      alert('Erreur lors de l\'activation des notifications. Vérifiez la console pour plus de détails.');
    }
    setIsLoading(false);
  }

  const unsubscribeFromPush = async () => {
    if (!user || !subscription) {
      console.warn('[PushManager] Cannot unsubscribe: user or subscription missing', { user: !!user, subscription: !!subscription });
      return;
    }

    setIsLoading(true);
    try {
      await subscription.unsubscribe();

      // Supprimer via l'API
      const res = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      setSubscription(null);
      setHasServerSubscription(false);
    } catch (error) {
      console.error('[PushManager] 🔴 Error unsubscribing from push:', error);
    }
    setIsLoading(false);
  }

  // Fallback UI for missing VAPID
  if (vapidError) {
    return (
      <div className={`flex items-center gap-2 text-sm text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20 ${className}`}>
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span>Erreur de configuration serveur (Clés VAPID manquantes)</span>
      </div>
    )
  }

  // UI for unsupported browsers
  if (isSupported === false) {
    return (
      <div className={`p-4 rounded-xl border border-slate-700 bg-slate-800/50 ${className}`}>
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <BellOff className="h-5 w-5" />
          <p className="font-medium">Non supporté</p>
        </div>
        <p className="text-xs text-slate-500">
          Votre navigateur ne supporte pas les notifications push web. Essayez :
        </p>
        <ul className="text-xs text-slate-500 list-disc ml-4 mt-1">
          <li>Sur iOS : Safari, après "Ajouter à l'écran d'accueil"</li>
          <li>Sur Android : Chrome ou Firefox</li>
          <li>Sur PC/Mac : Chrome, Edge ou Firefox</li>
        </ul>
      </div>
    )
  }

  // Not loaded yet
  if (isSupported === null || !isLoaded) {
    return (
      <Button variant="ghost" disabled className={className}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    )
  }

  if (permission === 'denied') {
    return (
      <div className={`w-full rounded-xl border border-red-500/20 bg-red-500/10 p-4 ${className}`}>
        <div className="flex items-center gap-2 text-red-400 mb-2">
          <BellOff className="h-5 w-5" />
          <span className="font-medium">Notifications bloquées</span>
        </div>
        <p className="text-xs text-red-300/80 mb-2">
          Vous avez refusé les notifications. Pour les activer :
        </p>
        <ol className="text-xs text-red-300/60 list-decimal ml-4 space-y-1">
          <li>Cliquez sur le cadenas 🔒 dans la barre d'adresse</li>
          <li>Cherchez "Notifications" ou "Permissions"</li>
          <li>Cliquez sur "Réinitialiser" ou "Autoriser"</li>
          <li>Rechargez la page</li>
        </ol>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full border-red-500/30 text-red-300 hover:bg-red-500/20 hover:text-white"
          onClick={() => window.location.reload()}
        >
          J'ai débloqué, recharger la page
        </Button>
      </div>
    )
  }

  // isActive should primarily rely on local subscription to be accurate for "Toggle" action
  // hasServerSubscription is useful for initial state but shouldn't block re-subscription if local is null.
  const isActive = subscription !== null;

  // Version pleine largeur avec description
  if (fullWidth) {
    return (
      <button
        onClick={isActive ? unsubscribeFromPush : subscribeToPush}
        disabled={isLoading}
        className={`
          w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 relative overflow-hidden touch-target active:scale-[0.98] outline-none focus:ring-2 focus:ring-emerald-500/50
          ${isActive
            ? 'bg-green-600/20 hover:bg-green-600/30 border border-green-500/50'
            : 'bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50'
          }
          ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${className}
        `}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <div className="text-left relative z-10 flex-1 mr-4">
          <p className={`font-medium ${isActive ? 'text-green-300' : 'text-white'}`}>
            {labelText || (isActive ? 'Notifications activées' : 'Activer les notifications')}
          </p>
          {description && (
            <p className="text-slate-400 text-sm mt-0.5">{description}</p>
          )}
        </div>
        <div className={`
          p-2.5 rounded-xl transition-colors relative z-10 flex-shrink-0
          ${isActive ? 'bg-green-500/30' : 'bg-slate-600/50'}
        `}>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          ) : isActive ? (
            <Bell className="h-5 w-5 text-green-400" />
          ) : (
            <BellOff className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </button>
    )
  }

  return (
    <Button
      variant="ghost"
      size={showLabel ? 'default' : 'icon'}
      className={`
        transition-all duration-300 relative z-10
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
