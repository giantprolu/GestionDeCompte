'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { TutorialControls } from './TutorialControls'
import type { TutorialStep, TooltipPlacement } from '@/lib/tutorial/types'

interface TutorialTooltipProps {
    step: TutorialStep
    targetRect: DOMRect | null
}

interface TooltipPosition {
    top?: number | string
    bottom?: number | string
    left?: number | string
    right?: number | string
    transform?: string
}

interface ArrowPosition {
    top?: number | string
    bottom?: number | string
    left?: number | string
    right?: number | string
    transform?: string
    borderColor: string
}

const TOOLTIP_MARGIN = 12
const TOOLTIP_MARGIN_MOBILE = 12
const TOOLTIP_WIDTH = 340
const ARROW_SIZE = 10

// Check if viewport is mobile
function isMobileViewport(): boolean {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 768
}

/**
 * Calculate optimal tooltip position based on target rect and viewport
 */
function calculatePosition(
    targetRect: DOMRect | null,
    placement: TooltipPlacement = 'bottom'
): { position: TooltipPosition; arrow: ArrowPosition; actualPlacement: TooltipPlacement } {
    const isMobile = isMobileViewport()
    const margin = TOOLTIP_MARGIN_MOBILE
    
    // Center mode - no target (welcome screen, etc.)
    if (!targetRect) {
        // On mobile, use full width with margins
        if (isMobile) {
            return {
                position: {
                    top: '50%',
                    left: margin,
                    right: margin,
                    transform: 'translateY(-50%)'
                },
                arrow: { borderColor: 'transparent' },
                actualPlacement: 'center'
            }
        }
        return {
            position: {
                top: window.innerHeight / 2,
                left: window.innerWidth / 2,
                transform: 'translate(-50%, -50%)'
            },
            arrow: { borderColor: 'transparent' },
            actualPlacement: 'center'
        }
    }

    const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
    }

    // On mobile, always use full-width bottom/top positioning
    if (isMobile) {
        const targetCenterX = targetRect.left + targetRect.width / 2
        const spaceBelow = viewport.height - targetRect.bottom
        const spaceAbove = targetRect.top
        
        // Decide if tooltip goes above or below target
        const goBelow = spaceBelow > 150 || spaceBelow > spaceAbove
        
        // Arrow position (percentage from left)
        const arrowLeftPercent = Math.max(10, Math.min(90, (targetCenterX / viewport.width) * 100))
        
        if (goBelow) {
            return {
                position: {
                    top: targetRect.bottom + margin,
                    left: margin,
                    right: margin
                },
                arrow: {
                    top: -ARROW_SIZE,
                    left: `${arrowLeftPercent}%`,
                    transform: 'translateX(-50%)',
                    borderColor: 'transparent transparent rgba(30, 41, 59, 0.95) transparent'
                },
                actualPlacement: 'bottom'
            }
        } else {
            return {
                position: {
                    bottom: viewport.height - targetRect.top + margin,
                    left: margin,
                    right: margin
                },
                arrow: {
                    bottom: -ARROW_SIZE,
                    left: `${arrowLeftPercent}%`,
                    transform: 'translateX(-50%)',
                    borderColor: 'rgba(30, 41, 59, 0.95) transparent transparent transparent'
                },
                actualPlacement: 'top'
            }
        }
    }

    // Desktop positioning logic
    const tooltipWidth = TOOLTIP_WIDTH

    // Calculate available space in each direction
    const space = {
        top: targetRect.top,
        bottom: viewport.height - targetRect.bottom,
        left: targetRect.left,
        right: viewport.width - targetRect.right
    }

    // Auto-adjust placement if not enough space
    let actualPlacement = placement
    const tooltipHeight = 200 // Approximate

    if (placement === 'bottom' && space.bottom < tooltipHeight + TOOLTIP_MARGIN) {
        actualPlacement = 'top'
    } else if (placement === 'top' && space.top < tooltipHeight + TOOLTIP_MARGIN) {
        actualPlacement = 'bottom'
    } else if (placement === 'left' && space.left < tooltipWidth + TOOLTIP_MARGIN) {
        actualPlacement = 'right'
    } else if (placement === 'right' && space.right < tooltipWidth + TOOLTIP_MARGIN) {
        actualPlacement = 'left'
    }

    // Calculate position based on actual placement
    const targetCenterX = targetRect.left + targetRect.width / 2
    const targetCenterY = targetRect.top + targetRect.height / 2

    let position: TooltipPosition = {}
    let arrow: ArrowPosition = { borderColor: 'transparent' }

    switch (actualPlacement) {
        case 'bottom':
            position = {
                top: targetRect.bottom + TOOLTIP_MARGIN,
                left: Math.max(TOOLTIP_MARGIN, Math.min(
                    targetCenterX - tooltipWidth / 2,
                    viewport.width - tooltipWidth - TOOLTIP_MARGIN
                ))
            }
            // Calculate arrow position relative to tooltip
            const arrowLeftBottom = targetCenterX - (position.left as number)
            arrow = {
                top: -ARROW_SIZE,
                left: Math.max(TOOLTIP_MARGIN, Math.min(arrowLeftBottom, tooltipWidth - TOOLTIP_MARGIN)),
                transform: 'translateX(-50%)',
                borderColor: 'transparent transparent rgba(30, 41, 59, 0.95) transparent'
            }
            break

        case 'top':
            position = {
                bottom: viewport.height - targetRect.top + TOOLTIP_MARGIN,
                left: Math.max(TOOLTIP_MARGIN, Math.min(
                    targetCenterX - tooltipWidth / 2,
                    viewport.width - tooltipWidth - TOOLTIP_MARGIN
                ))
            }
            const arrowLeftTop = targetCenterX - (position.left as number)
            arrow = {
                bottom: -ARROW_SIZE,
                left: Math.max(TOOLTIP_MARGIN, Math.min(arrowLeftTop, tooltipWidth - TOOLTIP_MARGIN)),
                transform: 'translateX(-50%)',
                borderColor: 'rgba(30, 41, 59, 0.95) transparent transparent transparent'
            }
            break

        case 'left':
            position = {
                top: Math.max(TOOLTIP_MARGIN, Math.min(
                    targetCenterY - 100,
                    viewport.height - 250
                )),
                right: viewport.width - targetRect.left + TOOLTIP_MARGIN
            }
            arrow = {
                right: -ARROW_SIZE,
                top: '50%',
                transform: 'translateY(-50%)',
                borderColor: 'transparent transparent transparent rgba(30, 41, 59, 0.95)'
            }
            break

        case 'right':
            position = {
                top: Math.max(TOOLTIP_MARGIN, Math.min(
                    targetCenterY - 100,
                    viewport.height - 250
                )),
                left: targetRect.right + TOOLTIP_MARGIN
            }
            arrow = {
                left: -ARROW_SIZE,
                top: '50%',
                transform: 'translateY(-50%)',
                borderColor: 'transparent rgba(30, 41, 59, 0.95) transparent transparent'
            }
            break
    }

    return { position, arrow, actualPlacement }
}

/**
 * Animated tooltip with step content and navigation controls
 */
export function TutorialTooltip({ step, targetRect }: TutorialTooltipProps) {
    const { position, arrow, actualPlacement } = useMemo(
        () => calculatePosition(targetRect, step.placement),
        [targetRect, step.placement]
    )

    const isMobile = isMobileViewport()

    // Animation variants based on placement
    const getInitialPosition = () => {
        switch (actualPlacement) {
            case 'bottom': return { y: -10, opacity: 0 }
            case 'top': return { y: 10, opacity: 0 }
            case 'left': return { x: 10, opacity: 0 }
            case 'right': return { x: -10, opacity: 0 }
            default: return { scale: 0.95, opacity: 0 }
        }
    }

    // On mobile, always use full width (auto with left/right margins)
    // On desktop with center placement, also use auto
    const useAutoWidth = isMobile || actualPlacement === 'center'
    
    return (
        <motion.div
            initial={getInitialPosition()}
            animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
                type: 'spring',
                damping: 25,
                stiffness: 350,
                delay: 0.1
            }}
            className="fixed z-[10000] pointer-events-auto"
            style={{
                ...position,
                width: useAutoWidth ? 'auto' : TOOLTIP_WIDTH,
                maxWidth: useAutoWidth ? undefined : `calc(100vw - 24px)`
            }}
        >
            {/* Main tooltip container */}
            <div
                className="relative rounded-xl overflow-hidden"
                style={{
                    background: 'rgba(30, 41, 59, 0.95)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(16, 185, 129, 0.1)'
                }}
            >
                {/* Gradient accent line at top */}
                <div
                    className="h-1 w-full"
                    style={{
                        background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)'
                    }}
                />

                {/* Content */}
                <div className="p-4 sm:p-5">
                    {/* Icon and Title */}
                    <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                        {step.icon && (
                            <span className="text-xl sm:text-2xl flex-shrink-0">{step.icon}</span>
                        )}
                        <div>
                            <h3 className="text-base sm:text-lg font-semibold text-white leading-tight">
                                {step.title}
                            </h3>
                        </div>
                    </div>

                    {/* Description */}
                    <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-5">
                        {step.description}
                    </p>

                    {/* Navigation controls */}
                    <TutorialControls step={step} />
                </div>
            </div>

            {/* Arrow */}
            {actualPlacement !== 'center' && (
                <div
                    className="absolute w-0 h-0"
                    style={{
                        ...arrow,
                        borderWidth: ARROW_SIZE,
                        borderStyle: 'solid'
                    }}
                />
            )}
        </motion.div>
    )
}
