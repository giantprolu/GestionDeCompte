'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Eye, Wallet, Check } from 'lucide-react'

interface UserTypeModalProps {
  isOpen: boolean
  onSelect: (type: 'viewer' | 'user') => void
}

export default function UserTypeModal({ isOpen, onSelect }: UserTypeModalProps) {
  const [selected, setSelected] = useState<'viewer' | 'user' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!selected) return
    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/user-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_type: selected })
      })
      
      if (response.ok) {
        onSelect(selected)
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="w-full max-w-2xl my-4 sm:my-0"
          >
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-2xl">
              <CardHeader className="text-center pb-2 px-3 sm:px-6">
                <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
                  Bienvenue ! 👋
                </CardTitle>
                <p className="text-slate-400 mt-1 sm:mt-2 text-xs sm:text-sm md:text-base">
                  Comment souhaitez-vous utiliser l&apos;application ?
                </p>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 pt-2 sm:pt-4 px-3 sm:px-6">
                {/* Option Visionneur */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelected('viewer')}
                  className="cursor-pointer"
                >
                  <Card className={`
                    transition-all duration-300 border-2
                    ${selected === 'viewer' 
                      ? 'border-purple-500 bg-purple-900/30 shadow-lg shadow-purple-500/20' 
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }
                  `}>
                    <CardContent className="p-3 sm:p-4 md:p-6">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className={`
                          w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0
                          ${selected === 'viewer' ? 'bg-purple-500' : 'bg-slate-700'}
                        `}>
                          <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-base sm:text-lg font-bold text-white">Visionneur</h3>
                            {selected === 'viewer' && (
                              <Check className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-slate-400 text-xs sm:text-sm mt-1">
                            <strong className="text-purple-300">Consulter</strong> les dashboards partagés avec moi.
                          </p>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2 sm:mt-3">
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-700/50 rounded text-[10px] sm:text-xs text-slate-300">
                              📊 Dashboards partagés
                            </span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-700/50 rounded text-[10px] sm:text-xs text-slate-300">
                              👀 Lecture seule
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Option Utilisateur */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelected('user')}
                  className="cursor-pointer"
                >
                  <Card className={`
                    transition-all duration-300 border-2
                    ${selected === 'user' 
                      ? 'border-green-500 bg-green-900/30 shadow-lg shadow-green-500/20' 
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }
                  `}>
                    <CardContent className="p-3 sm:p-4 md:p-6">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className={`
                          w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0
                          ${selected === 'user' ? 'bg-green-500' : 'bg-slate-700'}
                        `}>
                          <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-base sm:text-lg font-bold text-white">Utilisateur complet</h3>
                            {selected === 'user' && (
                              <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-slate-400 text-xs sm:text-sm mt-1">
                            <strong className="text-green-300">Gérer mes finances</strong> : comptes, transactions, budget.
                          </p>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2 sm:mt-3">
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-700/50 rounded text-[10px] sm:text-xs text-slate-300">
                              💳 Comptes
                            </span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-700/50 rounded text-[10px] sm:text-xs text-slate-300">
                              📝 Transactions
                            </span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-700/50 rounded text-[10px] sm:text-xs text-slate-300">
                              📈 Budget
                            </span>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-slate-700/50 rounded text-[10px] sm:text-xs text-slate-300">
                              🔗 Partage
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Bouton de confirmation */}
                <Button
                  onClick={handleSubmit}
                  disabled={!selected || isSubmitting}
                  className={`
                    w-full h-10 sm:h-12 text-sm sm:text-base font-semibold transition-all duration-300
                    ${selected === 'viewer' 
                      ? 'bg-purple-600 hover:bg-purple-700' 
                      : selected === 'user'
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-slate-600'
                    }
                  `}
                >
                  {isSubmitting ? 'Enregistrement...' : 'Continuer'}
                </Button>

                <p className="text-center text-[10px] sm:text-xs text-slate-500 mt-1 sm:mt-2 pb-2">
                  Modifiable à tout moment dans les paramètres
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
