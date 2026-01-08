'use client'

import { TutorialProvider, TutorialOverlay } from '@/components/tutorial'

interface TutorialWrapperProps {
    children: React.ReactNode
}

/**
 * Client wrapper that provides tutorial context and renders overlay
 * Use this in the root layout to enable tutorial functionality
 */
export function TutorialWrapper({ children }: TutorialWrapperProps) {
    return (
        <TutorialProvider>
            {children}
            <TutorialOverlay />
        </TutorialProvider>
    )
}
