'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, X, Share, Plus } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Check platform outside of component
function getPlatformInfo() {
  if (typeof window === 'undefined') {
    return { isIOS: false, isStandalone: false, wasDismissed: false }
  }
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
  const dismissedTime = localStorage.getItem('pwa-install-dismissed')
  const wasDismissed = dismissedTime ? (Date.now() - parseInt(dismissedTime, 10) < 7 * 24 * 60 * 60 * 1000) : false
  return { isIOS, isStandalone, wasDismissed }
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [platformInfo, setPlatformInfo] = useState<{ isIOS: boolean; isStandalone: boolean; wasDismissed: boolean } | null>(null)

  useEffect(() => {
    // Use requestAnimationFrame to defer state updates
    requestAnimationFrame(() => {
      const info = getPlatformInfo()
      setPlatformInfo(info)
      setDismissed(info.wasDismissed)

      // Show iOS prompt after a delay
      if (info.isIOS && !info.isStandalone && !info.wasDismissed) {
        setTimeout(() => setShowPrompt(true), 3000)
      }
    })

    // Listen for beforeinstallprompt event (Chrome, Edge, etc.)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    setDismissed(true)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  // Don't show if not mounted, already installed or dismissed
  if (!platformInfo || platformInfo.isStandalone || dismissed || !showPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <Card className="border-emerald-500/50 bg-slate-900 shadow-xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Download className="h-5 w-5 text-emerald-500" />
              Installer MoneyFlow
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-white"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="text-slate-400">
            Installez l&apos;application pour un accès rapide
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {platformInfo.isIOS ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                Pour installer sur iOS :
              </p>
              <ol className="text-sm text-slate-400 space-y-2">
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-xs">1</span>
                  Appuyez sur <Share className="h-4 w-4 inline mx-1" /> (Partager)
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-xs">2</span>
                  Sélectionnez <Plus className="h-4 w-4 inline mx-1" /> &quot;Sur l&apos;écran d&apos;accueil&quot;
                </li>
              </ol>
            </div>
          ) : (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={handleInstall}
            >
              <Download className="mr-2 h-4 w-4" />
              Installer l&apos;application
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
