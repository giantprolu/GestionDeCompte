'use client'

import { useEffect, useCallback } from 'react'
import { useTutorial } from '@/lib/tutorial/useTutorial'
import { onboardingTutorial, shouldShowOnboarding } from '@/lib/tutorial/onboardingTutorial'

/**
 * Component that auto-starts the tutorial for new users
 * Must be placed inside TutorialProvider
 */
export default function TutorialAutoStart() {
  const { startTutorial, state } = useTutorial()

  const checkAndStartTutorial = useCallback(() => {
    // Don't start if tutorial is already active
    if (state.isActive) return false

    const shouldStart = localStorage.getItem('moneyflow_auto_start_tutorial')
    
    if (shouldStart === 'true' && shouldShowOnboarding()) {
      // Clear the flag immediately
      localStorage.removeItem('moneyflow_auto_start_tutorial')
      
      // Start the tutorial
      startTutorial(onboardingTutorial)
      return true
    }
    return false
  }, [startTutorial, state.isActive])

  useEffect(() => {
    // Check on mount
    const timer = setTimeout(() => {
      checkAndStartTutorial()
    }, 500)

    // Also check periodically for a short time (in case the flag is set after mount)
    const intervals = [1000, 2000, 3000, 5000]
    const timers = intervals.map(delay => 
      setTimeout(() => {
        checkAndStartTutorial()
      }, delay)
    )

    return () => {
      clearTimeout(timer)
      timers.forEach(t => clearTimeout(t))
    }
  }, [checkAndStartTutorial])

  // Listen for storage events (when localStorage changes in another tab or same tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'moneyflow_auto_start_tutorial' && e.newValue === 'true') {
        setTimeout(() => {
          checkAndStartTutorial()
        }, 500)
      }
    }

    // Custom event for same-tab localStorage changes
    const handleCustomStorageChange = () => {
      setTimeout(() => {
        checkAndStartTutorial()
      }, 500)
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('tutorial-auto-start', handleCustomStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('tutorial-auto-start', handleCustomStorageChange)
    }
  }, [checkAndStartTutorial])

  // This component doesn't render anything
  return null
}
