'use client'

import { useEffect } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { Sparkles } from 'lucide-react'

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { isSignedIn, isLoaded } = useUser()
  const { openSignIn } = useClerk()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      openSignIn()
    }
  }, [isLoaded, isSignedIn, openSignIn])

  // Afficher un écran de chargement pendant la vérification
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg mx-auto mb-4 animate-pulse">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <p className="text-slate-400">Chargement...</p>
        </div>
      </div>
    )
  }

  // Bloquer l'accès si non connecté
  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg mx-auto mb-4">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">MoneyFlow</h1>
          <p className="text-slate-400 mb-4">Connectez-vous pour accéder à l&apos;application</p>
        </div>
      </div>
    )
  }

  // Utilisateur connecté - afficher le contenu
  return <>{children}</>
}
