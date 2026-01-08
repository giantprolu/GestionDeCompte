'use client'

import { useEffect, useState, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useTutorial } from '@/lib/tutorial/useTutorial'
import { useElementReady } from '@/lib/tutorial/useElementReady'
import { TutorialHighlight } from './TutorialHighlight'
import { TutorialTooltip } from './TutorialTooltip'

// Check if viewport is mobile
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
 * Main tutorial overlay component
 * 
 * Renders the semi-transparent backdrop, spotlight highlight,
 * and tooltip when a tutorial is active.
 * 
 * Place this component once in your app layout.
 */
export function TutorialOverlay() {
    const { state, currentStep, setTargetRect } = useTutorial()
    const isMobile = useIsMobile()

    // Determine which selector to use based on device
    const targetSelector = useMemo(() => {
        if (!currentStep) return undefined
        if (isMobile && currentStep.mobileTargetSelector) {
            return currentStep.mobileTargetSelector
        }
        return currentStep.targetSelector
    }, [currentStep, isMobile])

    // Watch for target element
    const { rect, isReady } = useElementReady(
        targetSelector,
        state.isActive
    )

    // Update target rect in context when it changes
    useEffect(() => {
        if (isReady) {
            setTargetRect(rect)
        }
    }, [rect, isReady, setTargetRect])

    // Add/remove tutorial-active class on html element to prevent overflow clipping
    useEffect(() => {
        if (state.isActive) {
            document.documentElement.classList.add('tutorial-active')
        } else {
            document.documentElement.classList.remove('tutorial-active')
        }
        return () => {
            document.documentElement.classList.remove('tutorial-active')
        }
    }, [state.isActive])

    // Create a modified step with mobile placement if needed
    const displayStep = useMemo(() => {
        if (!currentStep) return null
        if (isMobile && currentStep.mobilePlacement) {
            return { ...currentStep, placement: currentStep.mobilePlacement }
        }
        return currentStep
    }, [currentStep, isMobile])

    // Don't render if tutorial is not active
    if (!state.isActive) return null

    // Show loading state while waiting for element
    const isLoading = Boolean(targetSelector && !isReady)

    return (
        <AnimatePresence mode="wait">
            {state.isActive && displayStep && (
                <>
                    {/* Spotlight highlight on target element */}
                    <TutorialHighlight
                        targetRect={rect}
                        isLoading={isLoading}
                        highlightStyle={displayStep?.highlightStyle}
                    />

                    {/* Tooltip with step content */}
                    {!isLoading && displayStep && (
                        <TutorialTooltip
                            step={displayStep}
                            targetRect={rect}
                        />
                    )}
                </>
            )}
        </AnimatePresence>
    )
}
