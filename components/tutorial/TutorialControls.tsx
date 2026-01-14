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
        <div className="space-y-2 sm:space-y-3">
            {/* Progress dots - more compact on mobile */}
            {totalSteps > 1 && (
                <div className="flex items-center justify-center tutorial-progress-dots flex-wrap py-1">
                    {Array.from({ length: totalSteps }).map((_, index) => (
                        <motion.div
                            key={index}
                            initial={false}
                            animate={{
                                scale: index === currentIndex ? 1 : 0.8,
                                opacity: index === currentIndex ? 1 : 0.4
                            }}
                            className={`rounded-full transition-colors ${index === currentIndex
                                    ? 'w-3 sm:w-4 md:w-6 h-1 sm:h-1.5 md:h-2 bg-gradient-to-r from-emerald-500 to-blue-500'
                                    : index < currentIndex
                                        ? 'w-1 sm:w-1.5 md:w-2 h-1 sm:h-1.5 md:h-2 bg-emerald-500'
                                        : 'w-1 sm:w-1.5 md:w-2 h-1 sm:h-1.5 md:h-2 bg-slate-500'
                                }`}
                        />
                    ))}
                </div>
            )}

            {/* Navigation buttons - touch-friendly */}
            <div className="flex items-center justify-between gap-2">
                {/* Skip button */}
                {canSkip && !isLastStep && (
                    <button
                        onClick={skip}
                        className="tutorial-btn text-xs text-slate-400 hover:text-slate-200 active:text-slate-100 transition-colors flex items-center gap-0.5 px-2 py-1.5 rounded-lg active:bg-slate-700/30"
                    >
                        <X className="w-3 h-3" />
                        <span className="hidden xs:inline">Passer</span>
                    </button>
                )}

                {/* Spacer if no skip button */}
                {(!canSkip || isLastStep) && <div />}

                {/* Previous/Next buttons */}
                <div className="flex items-center gap-1.5">
                    {/* Previous button */}
                    {!isFirstStep && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={prevStep}
                            className="tutorial-btn text-slate-300 hover:text-white hover:bg-slate-700/50 active:bg-slate-600/50 px-2 sm:px-3 h-8 text-xs"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline ml-0.5">{step.prevButtonText || 'Préc.'}</span>
                        </Button>
                    )}

                    {/* Next/Finish button */}
                    <Button
                        onClick={nextStep}
                        size="sm"
                        className="tutorial-btn bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 active:from-emerald-700 active:to-emerald-800 text-white font-medium shadow-lg shadow-emerald-500/20 px-3 sm:px-4 h-8 text-xs sm:text-sm"
                    >
                        <span>{isLastStep ? (step.nextButtonText || 'Terminer') : (step.nextButtonText || 'Suivant')}</span>
                        {!isLastStep && <ChevronRight className="w-3.5 h-3.5 ml-0.5" />}
                    </Button>
                </div>
            </div>

            {/* Step counter - smaller on mobile */}
            <div className="text-center">
                <span className="text-[9px] sm:text-[10px] md:text-xs text-slate-500">
                    {currentIndex + 1}/{totalSteps}
                </span>
            </div>
            
            {/* Mobile swipe hint - only show on first step on mobile */}
            {isMobile && isFirstStep && (
                <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center justify-center gap-1.5 pb-0.5"
                >
                    <motion.div
                        animate={{ x: [0, -6, 0] }}
                        transition={{ duration: 1.5, repeat: 3, ease: "easeInOut" }}
                    >
                        <Hand className="w-2.5 h-2.5 text-slate-500" />
                    </motion.div>
                    <span className="text-[9px] text-slate-500">
                        Glissez ← →
                    </span>
                </motion.div>
            )}
        </div>
    )
}
