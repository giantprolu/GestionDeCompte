'use client'

import { useEffect, useState, createContext, useContext, ReactNode } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import UserTypeModal from './UserTypeModal'

type UserType = 'viewer' | 'user' | null

interface UserSettingsContextType {
  userType: UserType
  setUserType: (type: UserType) => void
  isLoading: boolean
}

const UserSettingsContext = createContext<UserSettingsContextType>({
  userType: null,
  setUserType: () => {},
  isLoading: true
})

export const useUserSettings = () => useContext(UserSettingsContext)

interface Props {
  children: ReactNode
}

export default function AppWrapper({ children }: Props) {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const pathname = usePathname()
  const [status, setStatus] = useState<'idle' | 'loading' | 'checking-type' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [showUserTypeModal, setShowUserTypeModal] = useState(false)
  const [userType, setUserType] = useState<UserType>(null)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)

  // Plus de création automatique de comptes - l'utilisateur doit les créer manuellement

  useEffect(() => {
    if (!isLoaded || !user || status !== 'idle') return

    const initializeUser = async () => {
      setStatus('loading')
      try {
        // 1. Vérifier les paramètres utilisateur (user_type)
        const settingsRes = await fetch('/api/user-settings')
        if (settingsRes.ok) {
          const settings = await settingsRes.json()
          
          // Si user_type n'est pas défini, afficher le modal
          if (!settings.user_type) {
            setStatus('checking-type')
            setShowUserTypeModal(true)
            setIsLoadingSettings(false)
            return
          }
          
          setUserType(settings.user_type)
          
          // Si c'est un visionneur, pas besoin d'initialiser de comptes
          if (settings.user_type === 'viewer') {
            setStatus('done')
            setIsLoadingSettings(false)
            // Rediriger vers /partage si pas déjà sur une page partage
            if (!pathname.startsWith('/partage')) {
              router.push('/partage')
            }
            return
          }
        }

        // 2. Pour les utilisateurs complets, pas de création de comptes automatique
        // L'utilisateur devra créer ses comptes manuellement
        setStatus('done')
        setIsLoadingSettings(false)
      } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error)
        setError(error instanceof Error ? error.message : 'Erreur inconnue')
        setStatus('error')
        setIsLoadingSettings(false)
      }
    }

    initializeUser()
  }, [user, isLoaded, status, pathname, router])

  const handleUserTypeSelect = async (type: 'viewer' | 'user') => {
    setUserType(type)
    setShowUserTypeModal(false)
    setStatus('done')
    
    if (type === 'viewer') {
      // Visionneur - rediriger vers /partage
      router.push('/partage')
    } else {
      // Utilisateur complet - signaler pour déclencher le tutoriel automatiquement
      // Le composant TutorialAutoStart (dans TutorialWrapper) va le détecter
      localStorage.setItem('moneyflow_auto_start_tutorial', 'true')
      // Déclencher un événement personnalisé pour notifier le même onglet
      window.dispatchEvent(new Event('tutorial-auto-start'))
    }
    // Utilisateur complet - pas de création de comptes automatique
    // Il devra créer ses comptes manuellement dans /comptes
  }

  // Modal de choix du type d'utilisateur
  if (showUserTypeModal) {
    return <UserTypeModal isOpen={true} onSelect={handleUserTypeSelect} />
  }

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-600">Initialisation de votre compte...</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-red-600 mb-2">Erreur d&apos;initialisation</h3>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <UserSettingsContext.Provider value={{ userType, setUserType, isLoading: isLoadingSettings }}>
      {children}
    </UserSettingsContext.Provider>
  )
}
