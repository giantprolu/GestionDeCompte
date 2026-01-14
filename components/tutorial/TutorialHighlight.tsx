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

// Check if in standalone PWA mode
function isStandalonePWA(): boolean {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * Spotlight/highlight effect that isolates the target element
 * Uses a CSS box-shadow technique to create the "cutout" effect
 * Optimized for mobile PWA with reduced animations
 */
export function TutorialHighlight({
    targetRect,
    isLoading = false,
    highlightStyle = 'glow'
}: TutorialHighlightProps) {
    // If no target rect, it's a centered modal step
    const isCenterMode = !targetRect
    const isMobile = isMobileViewport()
    const isPWA = isStandalonePWA()

    // Padding around the highlighted element - smaller on mobile
    const padding = isMobile ? 4 : 8

    // Calculate spotlight dimensions with bounds checking
    const spotlightStyle = targetRect ? {
        left: Math.max(0, targetRect.left - padding),
        top: Math.max(0, targetRect.top - padding),
        width: Math.min(targetRect.width + padding * 2, window.innerWidth),
        height: Math.min(targetRect.height + padding * 2, window.innerHeight)
    } : null

    // Simpler glow on mobile for performance
    const glowEffect = isMobile 
        ? '0 0 20px 3px rgba(16, 185, 129, 0.3)'
        : '0 0 30px 5px rgba(16, 185, 129, 0.4), 0 0 60px 10px rgba(16, 185, 129, 0.2)'

    return (
        <>
            {/* Dark overlay - touch passthrough disabled */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: isMobile ? 0.2 : 0.3 }}
                className="fixed inset-0 z-[9998] touch-none"
                style={{
                    backgroundColor: isMobile ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.4)'
                }}
            />

            {/* Spotlight cutout */}
            {spotlightStyle && !isLoading && (
                <motion.div
                    initial={{ opacity: 0, scale: isMobile ? 1.05 : 1.1 }}
                    animate={{
                        opacity: 1,
                        scale: 1,
                        ...spotlightStyle
                    }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{
                        type: 'spring',
                        damping: isMobile ? 30 : 25,
                        stiffness: isMobile ? 400 : 300
                    }}
                    className="fixed z-[9999] pointer-events-none tutorial-spotlight"
                    style={{
                        borderRadius: isMobile ? '8px' : '12px',
                        overflow: 'visible',
                        // Create spotlight with box-shadow that covers the overlay
                        boxShadow: `
                            0 0 0 calc(100vw + 100vh) ${isMobile ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.4)'},
                            ${highlightStyle === 'glow' ? glowEffect : ''}
                        `,
                        border: highlightStyle === 'border'
                            ? '2px solid rgba(16, 185, 129, 0.8)'
                            : isMobile 
                                ? '1.5px solid rgba(255, 255, 255, 0.25)' 
                                : '2px solid rgba(255, 255, 255, 0.2)'
                    }}
                >
                    {/* Pulse animation overlay - disabled on mobile for performance */}
                    {highlightStyle === 'pulse' && !isMobile && (
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

            {/* Loading state - more compact on mobile */}
            {isLoading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center"
                >
                    <div className="flex flex-col items-center gap-2 text-white">
                        <Loader2 className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} animate-spin text-emerald-400`} />
                        <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-slate-300`}>Chargement...</p>
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
