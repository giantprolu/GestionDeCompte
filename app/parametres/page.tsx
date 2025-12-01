'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Settings, Eye, Wallet, Check, ArrowLeft, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useUserSettings } from '@/components/AppWrapper'

export default function ParametresPage() {
  const { isSignedIn, isLoaded } = useUser()
  const { userType, setUserType } = useUserSettings()
  const [selectedType, setSelectedType] = useState<'viewer' | 'user' | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

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
    </div>
  )
}
