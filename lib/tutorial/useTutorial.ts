'use client'

import { useContext } from 'react'
import { TutorialContext } from '@/components/tutorial/TutorialProvider'
import type { TutorialContextValue } from './types'

/**
 * Hook to access tutorial functionality
 * 
 * @example
 * ```tsx
 * const { startTutorial, nextStep, isActive } = useTutorial()
 * 
 * // Start a tutorial
 * startTutorial(onboardingConfig)
 * 
 * // Check if tutorial is running
 * if (isActive) {
 *   // ...
 * }
 * ```
 */
export function useTutorial(): TutorialContextValue {
    const context = useContext(TutorialContext)

    if (!context) {
        throw new Error('useTutorial must be used within a TutorialProvider')
    }

    return context
}

/**
 * Hook to check if tutorial is currently active
 * Lightweight alternative when you only need active state
 */
export function useTutorialActive(): boolean {
    const { state } = useTutorial()
    return state.isActive
}
