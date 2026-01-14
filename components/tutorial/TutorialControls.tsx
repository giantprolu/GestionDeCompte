'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, Hand } from 'lucide-react'
import { useTutorial } from '@/lib/tutorial/useTutorial'
import { Button } from '@/components/ui/button'
import type { TutorialStep } from '@/lib/tutorial/types'

interface TutorialControlsProps {
    step: TutorialStep
}

// Hook to detect mobile viewport
function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(false)
    
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])
    
    return isMobile
}

/**
 * Navigation controls for tutorial steps
 * Includes previous/next buttons, skip link, progress indicator and swipe hint for mobile
 */
export function TutorialControls({ step }: TutorialControlsProps) {
    const {
        state,
        totalSteps,
        nextStep,
        prevStep,
        skip
    } = useTutorial()
    
    const isMobile = useIsMobile()

    const currentIndex = state.currentStepIndex
    const isFirstStep = currentIndex === 0
    const isLastStep = currentIndex === totalSteps - 1
    const canSkip = step.canSkip !== false // Default to true

    return (
        <div className="space-y-2 sm:space-y-4">
            {/* Progress dots */}
            {totalSteps > 1 && (
                <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-wrap">
                    {Array.from({ length: totalSteps }).map((_, index) => (
                        <motion.div
                            key={index}
                            initial={false}
                            animate={{
                                scale: index === currentIndex ? 1 : 0.8,
                                opacity: index === currentIndex ? 1 : 0.4
                            }}
                            className={`rounded-full transition-colors ${index === currentIndex
                                    ? 'w-4 sm:w-6 h-1.5 sm:h-2 bg-gradient-to-r from-emerald-500 to-blue-500'
                                    : index < currentIndex
                                        ? 'w-1.5 sm:w-2 h-1.5 sm:h-2 bg-emerald-500'
                                        : 'w-1.5 sm:w-2 h-1.5 sm:h-2 bg-slate-500'
                                }`}
                        />
                    ))}
                </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between gap-2 sm:gap-3">
                {/* Skip button */}
                {canSkip && !isLastStep && (
                    <button
                        onClick={skip}
                        className="text-xs sm:text-sm text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-0.5 sm:gap-1"
                    >
                        <X className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>Passer</span>
                    </button>
                )}

                {/* Spacer if no skip button */}
                {(!canSkip || isLastStep) && <div />}

                {/* Previous/Next buttons */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Previous button */}
                    {!isFirstStep && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={prevStep}
                            className="text-slate-300 hover:text-white hover:bg-slate-700/50 px-2 sm:px-3 h-8 sm:h-9 text-xs sm:text-sm"
                        >
                            <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
                            <span className="hidden xs:inline">{step.prevButtonText || 'Précédent'}</span>
                            <span className="xs:hidden">Préc.</span>
                        </Button>
                    )}

                    {/* Next/Finish button */}
                    <Button
                        onClick={nextStep}
                        size="sm"
                        className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium shadow-lg shadow-emerald-500/20 px-3 sm:px-4 h-8 sm:h-9 text-xs sm:text-sm"
                    >
                        {isLastStep
                            ? (step.nextButtonText || 'Terminer')
                            : (step.nextButtonText || 'Suivant')
                        }
                        {!isLastStep && <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 ml-0.5 sm:ml-1" />}
                    </Button>
                </div>
            </div>

            {/* Step counter */}
            <div className="text-center">
                <span className="text-[10px] sm:text-xs text-slate-500">
                    Étape {currentIndex + 1} sur {totalSteps}
                </span>
            </div>
            
            {/* Mobile swipe hint - only show on first step on mobile */}
            {isMobile && isFirstStep && (
                <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center justify-center gap-2 pt-1 pb-1"
                >
                    <motion.div
                        animate={{ x: [0, -8, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <Hand className="w-3 h-3 text-slate-500" />
                    </motion.div>
                    <span className="text-[10px] text-slate-500">
                        Glissez pour naviguer
                    </span>
                </motion.div>
            )}
        </div>
    )
}
