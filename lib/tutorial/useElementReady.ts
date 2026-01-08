'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

interface ElementReadyResult {
    element: Element | null
    rect: DOMRect | null
    isReady: boolean
}

/**
 * Scroll element into view with smooth animation
 */
function scrollElementIntoView(element: Element) {
    const rect = element.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    
    // Check if element is already mostly visible
    const isVerticallyVisible = rect.top >= 50 && rect.bottom <= viewportHeight - 100
    const isHorizontallyVisible = rect.left >= 0 && rect.right <= viewportWidth
    
    if (!isVerticallyVisible || !isHorizontallyVisible) {
        // Scroll element into center of viewport
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        })
    }
}

/**
 * Hook to detect when a target element is mounted and get its position
 * Uses MutationObserver to watch for element appearance after navigation
 * 
 * @param selector - data-tutorial attribute value to find
 * @param enabled - whether to actively search for element
 * @param autoScroll - whether to auto-scroll to element when found
 */
export function useElementReady(
    selector: string | undefined,
    enabled: boolean = true,
    autoScroll: boolean = true
): ElementReadyResult {
    const [element, setElement] = useState<Element | null>(null)
    const [rect, setRect] = useState<DOMRect | null>(null)
    const [isReady, setIsReady] = useState(false)
    const observerRef = useRef<MutationObserver | null>(null)
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const hasScrolledRef = useRef<string | null>(null)

    const findElement = useCallback(() => {
        if (!selector) {
            setElement(null)
            setRect(null)
            setIsReady(true) // Center mode - no element needed
            return null
        }

        const el = document.querySelector(`[data-tutorial="${selector}"]`)
        if (el) {
            // Auto-scroll to element if enabled and not already scrolled for this selector
            if (autoScroll && hasScrolledRef.current !== selector) {
                hasScrolledRef.current = selector
                // Small delay to let the page settle
                setTimeout(() => {
                    scrollElementIntoView(el)
                    // Update rect after scroll animation
                    setTimeout(() => {
                        setRect(el.getBoundingClientRect())
                    }, 400)
                }, 100)
            }
            
            setElement(el)
            setRect(el.getBoundingClientRect())
            setIsReady(true)
            return el
        }
        return null
    }, [selector, autoScroll])

    // Update rect on scroll/resize
    const updateRect = useCallback(() => {
        if (element) {
            setRect(element.getBoundingClientRect())
        }
    }, [element])

    useEffect(() => {
        if (!enabled) {
            setElement(null)
            setRect(null)
            setIsReady(false)
            return
        }

        // Try to find element immediately
        const found = findElement()

        if (found) {
            // Element already exists, watch for position changes
            const handleUpdate = () => updateRect()
            window.addEventListener('scroll', handleUpdate, true)
            window.addEventListener('resize', handleUpdate)

            return () => {
                window.removeEventListener('scroll', handleUpdate, true)
                window.removeEventListener('resize', handleUpdate)
            }
        }

        // Element not found - watch for it to appear
        setIsReady(false)

        // Maximum retry count to prevent infinite loops
        let retryCount = 0
        const maxRetries = 50 // 5 seconds max (50 * 100ms)

        // Set up MutationObserver to watch for element
        observerRef.current = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    const found = findElement()
                    if (found) {
                        observerRef.current?.disconnect()
                        break
                    }
                }
            }
        })

        observerRef.current.observe(document.body, {
            childList: true,
            subtree: true
        })

        // Also retry with timeout as fallback with max retries
        const retryFind = () => {
            const found = findElement()
            if (!found && retryCount < maxRetries) {
                retryCount++
                retryTimeoutRef.current = setTimeout(retryFind, 100)
            } else if (!found) {
                // Element not found after max retries - mark as ready anyway
                // This prevents infinite loading for elements that don't exist
                console.warn(`Tutorial element [data-tutorial="${selector}"] not found after ${maxRetries} retries`)
                setIsReady(true)
            }
        }
        retryTimeoutRef.current = setTimeout(retryFind, 50)

        return () => {
            observerRef.current?.disconnect()
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current)
            }
        }
    }, [selector, enabled, findElement, updateRect])

    // Keep rect updated when element exists
    useEffect(() => {
        if (!element || !enabled) return

        const handleUpdate = () => updateRect()
        window.addEventListener('scroll', handleUpdate, true)
        window.addEventListener('resize', handleUpdate)

        // Update periodically in case of layout shifts
        const interval = setInterval(updateRect, 500)

        return () => {
            window.removeEventListener('scroll', handleUpdate, true)
            window.removeEventListener('resize', handleUpdate)
            clearInterval(interval)
        }
    }, [element, enabled, updateRect])

    return { element, rect, isReady }
}
