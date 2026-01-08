'use client'

import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

interface TutorialHighlightProps {
    targetRect: DOMRect | null
    isLoading?: boolean
    highlightStyle?: 'glow' | 'border' | 'pulse'
}

// Check if viewport is mobile
function isMobileViewport(): boolean {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 768
}

/**
 * Spotlight/highlight effect that isolates the target element
 * Uses a CSS box-shadow technique to create the "cutout" effect
 */
export function TutorialHighlight({
    targetRect,
    isLoading = false,
    highlightStyle = 'glow'
}: TutorialHighlightProps) {
    // If no target rect, it's a centered modal step
    const isCenterMode = !targetRect
    const isMobile = isMobileViewport()

    // Padding around the highlighted element - smaller on mobile
    const padding = isMobile ? 4 : 8

    // Calculate spotlight dimensions
    const spotlightStyle = targetRect ? {
        left: targetRect.left - padding,
        top: targetRect.top - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2
    } : null

    return (
        <>
            {/* Light overlay - no blur */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 z-[9998]"
                style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.4)'
                }}
            />

            {/* Spotlight cutout */}
            {spotlightStyle && !isLoading && (
                <motion.div
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{
                        opacity: 1,
                        scale: 1,
                        ...spotlightStyle
                    }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{
                        type: 'spring',
                        damping: 25,
                        stiffness: 300
                    }}
                    className="fixed z-[9999] pointer-events-none tutorial-spotlight"
                    style={{
                        borderRadius: '12px',
                        overflow: 'visible',
                        // Create spotlight with massive box-shadow that covers the overlay
                        boxShadow: `
              0 0 0 calc(100vw + 100vh) rgba(0, 0, 0, 0.4),
              ${highlightStyle === 'glow' ? '0 0 30px 5px rgba(16, 185, 129, 0.4)' : ''},
              ${highlightStyle === 'glow' ? '0 0 60px 10px rgba(16, 185, 129, 0.2)' : ''}
            `,
                        border: highlightStyle === 'border'
                            ? '2px solid rgba(16, 185, 129, 0.8)'
                            : '2px solid rgba(255, 255, 255, 0.2)'
                    }}
                >
                    {/* Pulse animation overlay */}
                    {highlightStyle === 'pulse' && (
                        <motion.div
                            className="absolute inset-0 rounded-xl"
                            animate={{
                                boxShadow: [
                                    '0 0 0 0 rgba(16, 185, 129, 0.4)',
                                    '0 0 0 10px rgba(16, 185, 129, 0)',
                                ]
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: 'easeOut'
                            }}
                        />
                    )}
                </motion.div>
            )}

            {/* Loading state */}
            {isLoading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center"
                >
                    <div className="flex flex-col items-center gap-3 text-white">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                        <p className="text-sm text-slate-300">Chargement...</p>
                    </div>
                </motion.div>
            )}

            {/* Center mode - no spotlight, just show tooltip in center */}
            {isCenterMode && !isLoading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
                />
            )}
        </>
    )
}
