'use client'

import React, { createContext, useReducer, useCallback, useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type {
    TutorialConfig,
    TutorialState,
    TutorialContextValue,
    TutorialStep,
    TutorialProgress,
    TUTORIAL_STORAGE_KEY
} from '@/lib/tutorial/types'

// Initial state
const initialState: TutorialState = {
    isActive: false,
    currentStepIndex: 0,
    config: null,
    targetRect: null,
    isWaitingForElement: false
}

// Action types
type TutorialAction =
    | { type: 'START'; payload: TutorialConfig }
    | { type: 'NEXT_STEP' }
    | { type: 'PREV_STEP' }
    | { type: 'GO_TO_STEP'; payload: number }
    | { type: 'END' }
    | { type: 'SET_TARGET_RECT'; payload: DOMRect | null }
    | { type: 'SET_WAITING'; payload: boolean }

// Reducer
function tutorialReducer(state: TutorialState, action: TutorialAction): TutorialState {
    switch (action.type) {
        case 'START':
            return {
                ...state,
                isActive: true,
                currentStepIndex: 0,
                config: action.payload,
                targetRect: null,
                isWaitingForElement: false
            }
        case 'NEXT_STEP':
            if (!state.config) return state
            const nextIndex = state.currentStepIndex + 1
            if (nextIndex >= state.config.steps.length) {
                return { ...initialState }
            }
            return {
                ...state,
                currentStepIndex: nextIndex,
                targetRect: null,
                isWaitingForElement: true
            }
        case 'PREV_STEP':
            if (!state.config || state.currentStepIndex === 0) return state
            return {
                ...state,
                currentStepIndex: state.currentStepIndex - 1,
                targetRect: null,
                isWaitingForElement: true
            }
        case 'GO_TO_STEP':
            if (!state.config || action.payload < 0 || action.payload >= state.config.steps.length) return state
            return {
                ...state,
                currentStepIndex: action.payload,
                targetRect: null,
                isWaitingForElement: true
            }
        case 'END':
            return { ...initialState }
        case 'SET_TARGET_RECT':
            return {
                ...state,
                targetRect: action.payload,
                isWaitingForElement: false
            }
        case 'SET_WAITING':
            return {
                ...state,
                isWaitingForElement: action.payload
            }
        default:
            return state
    }
}

// Context
export const TutorialContext = createContext<TutorialContextValue | null>(null)

// Storage helpers
const STORAGE_KEY = 'moneyflow_tutorial_progress'

function loadProgress(): Record<string, TutorialProgress> {
    if (typeof window === 'undefined') return {}
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        return stored ? JSON.parse(stored) : {}
    } catch {
        return {}
    }
}

function saveProgress(tutorialId: string, stepIndex: number, completed: boolean) {
    if (typeof window === 'undefined') return
    try {
        const progress = loadProgress()
        progress[tutorialId] = {
            tutorialId,
            lastCompletedStep: stepIndex,
            completed,
            lastUpdated: Date.now()
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    } catch (e) {
        console.error('Failed to save tutorial progress:', e)
    }
}

// Provider Props
interface TutorialProviderProps {
    children: React.ReactNode
}

export function TutorialProvider({ children }: TutorialProviderProps) {
    const [state, dispatch] = useReducer(tutorialReducer, initialState)
    const router = useRouter()
    const pathname = usePathname()

    // Get current step
    const currentStep: TutorialStep | null = useMemo(() => {
        if (!state.config || !state.isActive) return null
        return state.config.steps[state.currentStepIndex] || null
    }, [state.config, state.currentStepIndex, state.isActive])

    const totalSteps = state.config?.steps.length || 0
    const progress = totalSteps > 0 ? ((state.currentStepIndex + 1) / totalSteps) * 100 : 0

    // Handle route navigation when step changes
    useEffect(() => {
        if (!currentStep || !state.isActive) return

        // If step requires a different route, navigate
        if (currentStep.route && currentStep.route !== pathname) {
            router.push(currentStep.route)
        }
    }, [currentStep, pathname, router, state.isActive])

    // Call step callbacks
    useEffect(() => {
        if (currentStep?.onEnter) {
            currentStep.onEnter()
        }
        return () => {
            if (currentStep?.onExit) {
                currentStep.onExit()
            }
        }
    }, [currentStep])

    // Handle keyboard events
    useEffect(() => {
        if (!state.isActive) return

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Escape':
                    dispatch({ type: 'END' })
                    break
                case 'ArrowRight':
                case 'Enter':
                    if (!e.shiftKey) {
                        e.preventDefault()
                        handleNextStep()
                    }
                    break
                case 'ArrowLeft':
                    e.preventDefault()
                    handlePrevStep()
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [state.isActive, state.currentStepIndex, state.config])

    // Actions
    const startTutorial = useCallback((config: TutorialConfig) => {
        dispatch({ type: 'START', payload: config })
        // Disable body scroll
        document.body.style.overflow = 'hidden'
    }, [])

    const handleNextStep = useCallback(() => {
        if (!state.config) return

        const isLastStep = state.currentStepIndex >= state.config.steps.length - 1

        if (isLastStep) {
            // Complete tutorial
            saveProgress(state.config.id, state.currentStepIndex, true)
            state.config.onComplete?.()
            dispatch({ type: 'END' })
            document.body.style.overflow = ''
        } else {
            // Go to next step
            saveProgress(state.config.id, state.currentStepIndex, false)
            dispatch({ type: 'NEXT_STEP' })
        }
    }, [state.config, state.currentStepIndex])

    const handlePrevStep = useCallback(() => {
        dispatch({ type: 'PREV_STEP' })
    }, [])

    const goToStep = useCallback((index: number) => {
        dispatch({ type: 'GO_TO_STEP', payload: index })
    }, [])

    const skip = useCallback(() => {
        if (state.config) {
            saveProgress(state.config.id, state.currentStepIndex, false)
            state.config.onSkip?.()
        }
        dispatch({ type: 'END' })
        document.body.style.overflow = ''
    }, [state.config, state.currentStepIndex])

    const restart = useCallback(() => {
        if (state.config) {
            dispatch({ type: 'START', payload: state.config })
        }
    }, [state.config])

    const endTutorial = useCallback(() => {
        dispatch({ type: 'END' })
        document.body.style.overflow = ''
    }, [])

    const setTargetRect = useCallback((rect: DOMRect | null) => {
        dispatch({ type: 'SET_TARGET_RECT', payload: rect })
    }, [])

    const setWaitingForElement = useCallback((waiting: boolean) => {
        dispatch({ type: 'SET_WAITING', payload: waiting })
    }, [])

    const contextValue: TutorialContextValue = useMemo(() => ({
        state,
        currentStep,
        totalSteps,
        progress,
        startTutorial,
        nextStep: handleNextStep,
        prevStep: handlePrevStep,
        goToStep,
        skip,
        restart,
        endTutorial,
        setTargetRect,
        setWaitingForElement
    }), [
        state,
        currentStep,
        totalSteps,
        progress,
        startTutorial,
        handleNextStep,
        handlePrevStep,
        goToStep,
        skip,
        restart,
        endTutorial,
        setTargetRect,
        setWaitingForElement
    ])

    return (
        <TutorialContext.Provider value={contextValue}>
            {children}
        </TutorialContext.Provider>
    )
}
