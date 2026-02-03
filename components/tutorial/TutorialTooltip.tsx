'use client'

import { useMemo, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { TutorialControls } from './TutorialControls'
import { useTutorial } from '@/lib/tutorial/useTutorial'
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
    maxHeight?: number | string
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
const TOOLTIP_MARGIN_MOBILE = 8
const TOOLTIP_WIDTH = 340
const TOOLTIP_WIDTH_MOBILE = 'calc(100vw - 16px)'
const ARROW_SIZE = 8

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
        // On mobile, use full width with margins and account for safe areas
        if (isMobile) {
            return {
                position: {
                    top: '50%',
                    left: margin,
                    right: margin,
                    transform: 'translateY(-50%)',
                    maxHeight: '70vh'
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
        const targetCenterY = targetRect.top + targetRect.height / 2
        const spaceBelow = viewport.height - targetRect.bottom
        const spaceAbove = targetRect.top

        // PWA safe area buffer (accounts for iOS home indicator, notch, etc.)
        const safeAreaTop = 60 // Status bar + notch
        const safeAreaBottom = 100 // Home indicator + nav bar

        // Minimum space needed for tooltip (approximate height with content)
        const minTooltipSpace = 200

        // Arrow position (percentage from left)
        const arrowLeftPercent = Math.max(10, Math.min(90, (targetCenterX / viewport.width) * 100))

        // Check if target element is very large (takes most of screen)
        const targetIsLarge = targetRect.height > viewport.height * 0.5

        // If target is very large or neither above nor below has enough space, use centered overlay
        if (targetIsLarge || (spaceAbove < minTooltipSpace && spaceBelow < minTooltipSpace)) {
            return {
                position: {
                    top: safeAreaTop,
                    left: margin,
                    right: margin,
                    maxHeight: viewport.height - safeAreaTop - safeAreaBottom
                },
                arrow: { borderColor: 'transparent' },
                actualPlacement: 'center'
            }
        }

        // Decide if tooltip goes above or below target
        // Prefer below if there's enough space
        const goBelow = spaceBelow >= minTooltipSpace && (spaceBelow >= spaceAbove || spaceAbove < minTooltipSpace)

        if (goBelow) {
            // Position below the target element
            const topPosition = Math.min(targetRect.bottom + margin, viewport.height - minTooltipSpace - safeAreaBottom)
            const maxAvailableHeight = viewport.height - topPosition - safeAreaBottom
            return {
                position: {
                    top: topPosition,
                    left: margin,
                    right: margin,
                    maxHeight: Math.max(150, Math.min(maxAvailableHeight, viewport.height * 0.45))
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
            // Position above the target element - use top positioning to ensure visibility
            const maxAvailableHeight = Math.min(targetRect.top - margin - safeAreaTop, viewport.height * 0.45)
            const topPosition = Math.max(safeAreaTop, targetRect.top - margin - maxAvailableHeight)
            return {
                position: {
                    top: topPosition,
                    left: margin,
                    right: margin,
                    maxHeight: Math.max(150, maxAvailableHeight)
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
 * Supports swipe gestures on mobile for navigation
 */
export function TutorialTooltip({ step, targetRect }: TutorialTooltipProps) {
    const { nextStep, prevStep, state, totalSteps } = useTutorial()
    const { position, arrow, actualPlacement } = useMemo(
        () => calculatePosition(targetRect, step.placement),
        [targetRect, step.placement]
    )

    const isMobile = isMobileViewport()
    const isFirstStep = state.currentStepIndex === 0
    const isLastStep = state.currentStepIndex === totalSteps - 1
    
    // Touch gesture handling for swipe navigation
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
    const SWIPE_THRESHOLD = 50
    
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0]
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now()
        }
    }, [])
    
    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current) return
        
        const touch = e.changedTouches[0]
        const deltaX = touch.clientX - touchStartRef.current.x
        const deltaY = touch.clientY - touchStartRef.current.y
        const elapsed = Date.now() - touchStartRef.current.time
        
        // Only handle horizontal swipes, ignore vertical
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
            // Quick swipe or long enough distance
            if (elapsed < 300 || Math.abs(deltaX) > SWIPE_THRESHOLD * 1.5) {
                if (deltaX < 0 && !isLastStep) {
                    // Swipe left = next
                    nextStep()
                    if (navigator.vibrate) navigator.vibrate(25)
                } else if (deltaX > 0 && !isFirstStep) {
                    // Swipe right = previous
                    prevStep()
                    if (navigator.vibrate) navigator.vibrate(25)
                }
            }
        }
        
        touchStartRef.current = null
    }, [nextStep, prevStep, isFirstStep, isLastStep])

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
            className={`fixed z-[10000] pointer-events-auto tutorial-no-zoom ${isMobile ? 'tutorial-tooltip-mobile' : ''}`}
            style={{
                ...position,
                width: useAutoWidth ? 'auto' : TOOLTIP_WIDTH,
                maxWidth: useAutoWidth ? undefined : `calc(100vw - 24px)`,
                touchAction: 'pan-y pinch-zoom'
            }}
            onTouchStart={isMobile ? handleTouchStart : undefined}
            onTouchEnd={isMobile ? handleTouchEnd : undefined}
        >
            {/* Main tooltip container */}
            <div
                className="relative rounded-xl overflow-hidden max-h-full"
                style={{
                    background: 'rgba(30, 41, 59, 0.98)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(16, 185, 129, 0.1)'
                }}
            >
                {/* Gradient accent line at top */}
                <div
                    className="h-1 w-full flex-shrink-0"
                    style={{
                        background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)'
                    }}
                />

                {/* Content - scrollable on mobile if needed */}
                <div className="tutorial-content p-3 sm:p-4 md:p-5 overflow-y-auto" style={{ maxHeight: isMobile ? 'calc(100% - 4px)' : undefined }}>
                    {/* Icon and Title */}
                    <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                        {step.icon && (
                            <span className="text-lg sm:text-xl md:text-2xl flex-shrink-0">{step.icon}</span>
                        )}
                        <div className="min-w-0 flex-1">
                            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-white leading-tight">
                                {step.title}
                            </h3>
                        </div>
                    </div>

                    {/* Description */}
                    <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4 md:mb-5">
                        {step.description}
                    </p>

                    {/* Navigation controls */}
                    <TutorialControls step={step} />
                </div>
            </div>

            {/* Arrow - smaller on mobile */}
            {actualPlacement !== 'center' && (
                <div
                    className="absolute w-0 h-0"
                    style={{
                        ...arrow,
                        borderWidth: isMobile ? ARROW_SIZE - 2 : ARROW_SIZE,
                        borderStyle: 'solid'
                    }}
                />
            )}
        </motion.div>
    )
}
