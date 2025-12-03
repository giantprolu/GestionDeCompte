'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Bell, 
  AlertTriangle, 
  TrendingDown, 
  Calendar, 
  CreditCard,
  BarChart3,
  Loader2,
  Check,
  TestTube
} from 'lucide-react'
import { motion } from 'framer-motion'

interface NotificationPreferences {
  negative_balance: boolean
  low_balance: boolean
  low_balance_threshold: number
  upcoming_recurring: boolean
  monthly_summary: boolean
}

const defaultPreferences: NotificationPreferences = {
  negative_balance: true,
  low_balance: true,
  low_balance_threshold: 100,
  upcoming_recurring: true,
  monthly_summary: true,
}

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const loadPreferences = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications')
      if (response.ok) {
        const data = await response.json()
        setPreferences({
          negative_balance: data.negative_balance ?? true,
          low_balance: data.low_balance ?? true,
          low_balance_threshold: data.low_balance_threshold ?? 100,
          upcoming_recurring: data.upcoming_recurring ?? true,
          monthly_summary: data.monthly_summary ?? true,
        })
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  const savePreferences = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      })
      
      if (response.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch (error) {
      console.error('Error saving preferences:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const testNotifications = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      // Utiliser force=true pour toujours envoyer une notification
      const response = await fetch('/api/notifications/check?force=true')
      const data = await response.json()
      
      if (!response.ok) {
        setTestResult({ 
          success: false, 
          message: data.error || 'Erreur lors du test' 
        })
        return
      }

      // Analyser les résultats
      const results = data.results || []
      const sent = results.filter((r: { success: boolean }) => r.success)
      const alreadySent = results.filter((r: { reason?: string }) => r.reason === 'already_sent')
      
      if (sent.length > 0) {
        setTestResult({ 
          success: true, 
          message: `${sent.length} notification(s) envoyée(s) !` 
        })
      } else if (alreadySent.length > 0) {
        setTestResult({ 
          success: true, 
          message: 'Notifications déjà envoyées aujourd\'hui' 
        })
      } else if (results.length === 0) {
        setTestResult({ 
          success: true, 
          message: 'Aucune alerte à envoyer (vos comptes vont bien !)' 
        })
      } else {
        // Vérifier les erreurs spécifiques
        const noSubscription = results.some((r: { error?: string }) => r.error === 'No subscriptions found')
        const vapidNotConfigured = results.some((r: { error?: string }) => r.error === 'VAPID not configured')
        
        if (noSubscription) {
          setTestResult({ 
            success: false, 
            message: 'Activez d\'abord les notifications push ci-dessus' 
          })
        } else if (vapidNotConfigured) {
          setTestResult({ 
            success: false, 
            message: 'Les notifications push ne sont pas configurées sur le serveur' 
          })
        } else {
          setTestResult({ 
            success: false, 
            message: 'Erreur lors de l\'envoi des notifications' 
          })
        }
      }
    } catch (error) {
      console.error('Error testing notifications:', error)
      setTestResult({ 
        success: false, 
        message: 'Erreur de connexion au serveur' 
      })
    } finally {
      setIsTesting(false)
      // Effacer le message après 5 secondes
      setTimeout(() => setTestResult(null), 5000)
    }
  }

  const togglePreference = (key: keyof NotificationPreferences) => {
    if (typeof preferences[key] === 'boolean') {
      setPreferences(prev => ({ ...prev, [key]: !prev[key] }))
    }
  }

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    )
  }

  const notificationOptions = [
    {
      key: 'negative_balance' as const,
      icon: AlertTriangle,
      title: 'Solde négatif',
      description: 'Alerte quand un compte passe en négatif',
      color: 'text-red-500',
      bgColor: 'bg-red-500/20',
      activeColor: 'border-red-500',
    },
    {
      key: 'low_balance' as const,
      icon: TrendingDown,
      title: 'Solde bas',
      description: `Alerte quand un compte passe sous ${preferences.low_balance_threshold} €`,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/20',
      activeColor: 'border-amber-500',
      hasThreshold: true,
    },
    {
      key: 'upcoming_recurring' as const,
      icon: Calendar,
      title: 'Prélèvements à venir',
      description: 'Rappel 3 jours avant un prélèvement récurrent',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/20',
      activeColor: 'border-blue-500',
    },
    {
      key: 'monthly_summary' as const,
      icon: BarChart3,
      title: 'Résumé mensuel',
      description: 'Récapitulatif de vos finances chaque mois',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/20',
      activeColor: 'border-emerald-500',
    },
  ]

  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="w-5 h-5 text-emerald-500" />
          Paramètres des notifications
        </CardTitle>
        <CardDescription>
          Choisissez les alertes que vous souhaitez recevoir
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notificationOptions.map((option) => {
          const Icon = option.icon
          const isActive = preferences[option.key]
          
          return (
            <motion.div
              key={option.key}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => togglePreference(option.key)}
              className="cursor-pointer"
            >
              <Card className={`
                transition-all duration-300 border-2
                ${isActive 
                  ? `${option.activeColor} ${option.bgColor}` 
                  : 'border-slate-700 bg-slate-800/50 opacity-60'
                }
              `}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`
                      w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                      ${isActive ? option.bgColor : 'bg-slate-700'}
                    `}>
                      <Icon className={`w-5 h-5 ${isActive ? option.color : 'text-slate-400'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white">{option.title}</h3>
                        <div className={`
                          w-12 h-6 rounded-full transition-all duration-300 flex items-center px-1
                          ${isActive ? 'bg-emerald-600' : 'bg-slate-600'}
                        `}>
                          <motion.div
                            className="w-4 h-4 rounded-full bg-white"
                            animate={{ x: isActive ? 24 : 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          />
                        </div>
                      </div>
                      <p className="text-slate-400 text-sm mt-1">
                        {option.description}
                      </p>
                      
                      {/* Champ pour le seuil de solde bas */}
                      {option.hasThreshold && isActive && (
                        <div className="mt-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <Label htmlFor="threshold" className="text-slate-300 text-sm whitespace-nowrap">
                            Seuil :
                          </Label>
                          <Input
                            id="threshold"
                            type="number"
                            value={preferences.low_balance_threshold}
                            onChange={(e) => setPreferences(prev => ({
                              ...prev,
                              low_balance_threshold: parseFloat(e.target.value) || 0
                            }))}
                            className="w-24 h-8 bg-slate-700 border-slate-600 text-white"
                            min={0}
                            step={10}
                          />
                          <span className="text-slate-400 text-sm">€</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}

        {/* Boutons d'action */}
        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Button
            onClick={savePreferences}
            disabled={isSaving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : saveSuccess ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Enregistré !
              </>
            ) : (
              'Enregistrer les préférences'
            )}
          </Button>
          
          <Button
            onClick={testNotifications}
            disabled={isTesting}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Test en cours...
              </>
            ) : (
              <>
                <TestTube className="w-4 h-4 mr-2" />
                Tester les alertes
              </>
            )}
          </Button>
        </div>

        {/* Résultat du test */}
        {testResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-lg text-sm text-center ${
              testResult.success 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}
          >
            {testResult.success ? (
              <Check className="w-4 h-4 inline mr-2" />
            ) : (
              <AlertTriangle className="w-4 h-4 inline mr-2" />
            )}
            {testResult.message}
          </motion.div>
        )}

        <p className="text-xs text-slate-500 text-center mt-2">
          Les notifications sont envoyées une seule fois par jour pour chaque alerte
        </p>
      </CardContent>
    </Card>
  )
}
