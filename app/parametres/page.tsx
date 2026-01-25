'use client'

import { useState, useEffect } from 'react'
import { useUser, UserButton, useClerk } from '@clerk/nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Settings, Eye, Wallet, Check, ArrowLeft, Loader2, HelpCircle, User as UserIcon, AlertTriangle, Trash2, LogOut } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useUserSettings } from '@/components/AppWrapper'
import PushNotificationManager from '@/components/PushNotificationManager'
import NotificationSettings from '@/components/NotificationSettings'
import CategoryManager from '@/components/CategoryManager'
import ExportData from '@/components/ExportData'
import ExpenseChart from '@/components/ExpenseChart'
import { useTutorial } from '@/lib/tutorial/useTutorial'
import { onboardingTutorial } from '@/lib/tutorial/onboardingTutorial'

export default function ParametresPage() {
  const { isSignedIn, isLoaded, user } = useUser()
  const { signOut } = useClerk()
  const { userType, setUserType } = useUserSettings()
  const { startTutorial, state: tutorialState } = useTutorial()
  const [selectedType, setSelectedType] = useState<'viewer' | 'user' | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // État pour la déconnexion
  const [isSigningOut, setIsSigningOut] = useState(false)

  // État pour la suppression de compte
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (userType) {
      setSelectedType(userType)
    }
  }, [userType])

  const handleSave = async () => {
    if (!selectedType || selectedType === userType) return

    setIsSaving(true)
    setSaveSuccess(false)

    try {
      const response = await fetch('/api/user-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_type: selectedType })
      })

      if (response.ok) {
        setUserType(selectedType)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
        // Recharger la page pour appliquer les changements de navigation
        setTimeout(() => window.location.reload(), 1000)
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut({ redirectUrl: '/' })
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      setIsSigningOut(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'SUPPRIMER') {
      setDeleteError('Veuillez taper "SUPPRIMER" pour confirmer')
      return
    }

    setIsDeleting(true)
    setDeleteError('')

    try {
      const response = await fetch('/api/delete-account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression')
      }

      // Rediriger vers la page d'accueil
      window.location.href = '/'
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Une erreur est survenue')
      setIsDeleting(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Card className="border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Connexion requise</h3>
            <p className="text-muted-foreground text-center text-sm">
              Veuillez vous connecter pour accéder aux paramètres.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-400" />
            Paramètres
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gérez vos préférences d&apos;utilisation
          </p>
        </div>
      </div>

      {/* Informations du compte */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-slate-400" />
            Informations du compte
          </CardTitle>
          <p className="text-sm text-slate-400">
            Votre profil et informations personnelles
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Profil utilisateur */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            {user?.imageUrl && (
              <img
                src={user.imageUrl}
                alt="Avatar"
                className="w-16 h-16 rounded-full"
              />
            )}
            <div className="flex-1">
              <p className="text-white font-semibold text-lg">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-slate-400 text-sm">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>

          {/* UserButton pour gérer profil et sécurité */}
          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-12 h-12"
                  }
                }}
              />
              <div className="flex-1">
                <p className="text-sm text-slate-300 mb-2">
                  Cliquez sur votre photo de profil pour :
                </p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li>• Modifier votre profil et photo</li>
                  <li>• Changer votre mot de passe</li>
                  <li>• Gérer la sécurité et l&apos;authentification</li>
                  <li>• Connecter des comptes externes (Google, etc.)</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Type d'utilisateur */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg">Type d&apos;utilisation</CardTitle>
          <p className="text-sm text-slate-400">
            Choisissez comment vous souhaitez utiliser l&apos;application
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Option Visionneur */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setSelectedType('viewer')}
            className="cursor-pointer"
          >
            <Card className={`
              transition-all duration-300 border-2
              ${selectedType === 'viewer' 
                ? 'border-purple-500 bg-purple-900/30 shadow-lg shadow-purple-500/20' 
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }
            `}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                    ${selectedType === 'viewer' ? 'bg-purple-500' : 'bg-slate-700'}
                  `}>
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white">Visionneur</h3>
                      {selectedType === 'viewer' && (
                        <Check className="w-5 h-5 text-purple-400" />
                      )}
                    </div>
                    <p className="text-slate-400 text-sm mt-1">
                      Consulter uniquement les dashboards partagés avec moi
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Option Utilisateur */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setSelectedType('user')}
            className="cursor-pointer"
          >
            <Card className={`
              transition-all duration-300 border-2
              ${selectedType === 'user' 
                ? 'border-green-500 bg-green-900/30 shadow-lg shadow-green-500/20' 
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }
            `}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                    ${selectedType === 'user' ? 'bg-green-500' : 'bg-slate-700'}
                  `}>
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white">Utilisateur complet</h3>
                      {selectedType === 'user' && (
                        <Check className="w-5 h-5 text-green-400" />
                      )}
                    </div>
                    <p className="text-slate-400 text-sm mt-1">
                      Gérer mes propres finances : comptes, transactions, budget
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Bouton de sauvegarde */}
          <div className="pt-4 flex items-center gap-4">
            <Button
              onClick={handleSave}
              disabled={!selectedType || selectedType === userType || isSaving}
              className={`
                transition-all duration-300
                ${selectedType === 'viewer' 
                  ? 'bg-purple-600 hover:bg-purple-700' 
                  : selectedType === 'user'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-slate-600'
                }
              `}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer les modifications'
              )}
            </Button>
            
            {saveSuccess && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-green-400 text-sm flex items-center gap-1"
              >
                <Check className="w-4 h-4" />
                Modifications enregistrées !
              </motion.span>
            )}
          </div>

          {selectedType !== userType && selectedType && (
            <p className="text-xs text-amber-400/80 mt-2">
              ⚠️ {selectedType === 'viewer' 
                ? 'En passant en mode visionneur, vous ne verrez plus vos propres comptes et transactions dans la navigation.' 
                : 'En passant en mode utilisateur complet, des comptes seront créés automatiquement si vous n\'en avez pas.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Aide et tutoriel - En haut */}
      <Card className="bg-gradient-to-br from-purple-900/30 to-slate-900 border-purple-700/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-purple-400" />
            Aide
          </CardTitle>
          <p className="text-sm text-slate-400">
            Relancez le tutoriel pour redécouvrir les fonctionnalités
          </p>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => startTutorial(onboardingTutorial)}
            disabled={tutorialState.isActive}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-medium"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Lancer le tutoriel
          </Button>
        </CardContent>
      </Card>

      {/* Activation des notifications */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg">Notifications push</CardTitle>
          <p className="text-sm text-slate-400">
            Activez les notifications pour recevoir des alertes importantes
          </p>
        </CardHeader>
        <CardContent>
          <PushNotificationManager 
            showLabel={true} 
            fullWidth={true}
            labelText="Activer les notifications"
            description="Recevez des alertes même quand l'app est fermée"
          />
        </CardContent>
      </Card>

      {/* Paramètres détaillés des notifications */}
      <NotificationSettings />

      {/* Export des données */}
      <ExportData />

      {/* Déconnexion */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <LogOut className="w-5 h-5 text-slate-400" />
            Déconnexion
          </CardTitle>
          <p className="text-sm text-slate-400">
            Se déconnecter de votre compte
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Informations de l'utilisateur */}
          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            <p className="text-sm text-slate-300 mb-2">
              Compte actuellement connecté :
            </p>
            <div className="flex items-center gap-3">
              {user?.imageUrl && (
                <img
                  src={user.imageUrl}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <p className="text-white font-medium">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-slate-400">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>
          </div>

          {/* Bouton de déconnexion */}
          <Button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full bg-slate-600 hover:bg-slate-700 transition-colors font-medium text-white"
          >
            {isSigningOut ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Déconnexion en cours...
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4 mr-2" />
                Se déconnecter
              </>
            )}
          </Button>

          <p className="text-xs text-slate-400 text-center">
            Vous serez redirigé vers la page d&apos;accueil après déconnexion
          </p>
        </CardContent>
      </Card>

      {/* Zone de danger - Suppression de compte */}
      <Card className="bg-gradient-to-br from-red-950/50 to-slate-900 border-red-800/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            Zone de danger
          </CardTitle>
          <p className="text-sm text-slate-400">
            Actions irréversibles sur votre compte
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Informations de l'utilisateur */}
          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            <p className="text-sm text-slate-300 mb-2">
              Compte connecté :
            </p>
            <div className="flex items-center gap-3">
              {user?.imageUrl && (
                <img
                  src={user.imageUrl}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <p className="text-white font-medium">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-slate-400">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>
          </div>

          {/* Avertissement */}
          <div className="p-4 rounded-lg bg-red-950/30 border border-red-800/50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300 space-y-2">
                <p className="font-semibold text-red-400">
                  Attention : Cette action est définitive et irréversible !
                </p>
                <p>
                  La suppression de votre compte entraînera la perte permanente de :
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li>Tous vos comptes bancaires</li>
                  <li>Toutes vos transactions</li>
                  <li>Vos données de budget et prévisionnel</li>
                  <li>Vos paramètres et préférences</li>
                  <li>Vos partages de dashboard</li>
                  <li>Votre profil utilisateur Clerk</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Formulaire de confirmation */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Pour confirmer, tapez{' '}
                <code className="bg-slate-700 px-2 py-1 rounded text-red-400 font-mono">
                  SUPPRIMER
                </code>
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => {
                  setDeleteConfirm(e.target.value)
                  setDeleteError('')
                }}
                placeholder="Tapez SUPPRIMER ici"
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-white placeholder-slate-500"
                disabled={isDeleting}
              />
            </div>

            {deleteError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-950/50 border border-red-800/50 rounded-lg"
              >
                <p className="text-sm text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {deleteError}
                </p>
              </motion.div>
            )}

            <Button
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteConfirm !== 'SUPPRIMER'}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors font-medium text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Suppression en cours...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer mon compte définitivement
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
