'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

/**
 * Hook to detect if viewport is mobile
 * Uses resize observer for efficient updates
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }
    
    checkMobile()
    
    // Use matchMedia for more efficient listening
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
    }
    
    mediaQuery.addEventListener('change', handler)
    
    return () => {
      mediaQuery.removeEventListener('change', handler)
    }
  }, [breakpoint])

  return isMobile
}

/**
 * Hook to detect if device prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersReducedMotion
}

/**
 * Hook for debounced value
 * Useful for expensive operations like filtering/searching
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Hook for throttled callback
 * Useful for scroll handlers and other frequent events
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay = 100
): T {
  const lastCallRef = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const throttled = useCallback((...args: Parameters<T>) => {
    const now = Date.now()
    const remaining = delay - (now - lastCallRef.current)

    if (remaining <= 0) {
      lastCallRef.current = now
      callback(...args)
    } else if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        lastCallRef.current = Date.now()
        timeoutRef.current = null
        callback(...args)
      }, remaining)
    }
  }, [callback, delay]) as T

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return throttled
}

/**
 * Hook for intersection observer (lazy loading)
 */
export function useIntersectionObserver(
  options?: IntersectionObserverInit
): [React.RefCallback<Element>, boolean] {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const setRef = useCallback((element: Element | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    if (!element) return

    observerRef.current = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting)
    }, {
      threshold: 0.1,
      rootMargin: '50px',
      ...options,
    })

    observerRef.current.observe(element)
  }, [options])

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  return [setRef, isIntersecting]
}

/**
 * Hook to check if device has touch capability
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    setIsTouch(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    )
  }, [])

  return isTouch
}

/**
 * Hook to manage scroll lock (useful for modals on mobile)
 */
export function useScrollLock(lock: boolean): void {
  useEffect(() => {
    if (lock) {
      const scrollY = window.scrollY
      const body = document.body
      
      body.style.position = 'fixed'
      body.style.top = `-${scrollY}px`
      body.style.width = '100%'
      body.style.overflow = 'hidden'

      return () => {
        body.style.position = ''
        body.style.top = ''
        body.style.width = ''
        body.style.overflow = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [lock])
}

/**
 * Hook for network status (online/offline)
 */
export function useNetworkStatus(): { online: boolean; effectiveType?: string } {
  const [status, setStatus] = useState({
    online: true,
    effectiveType: undefined as string | undefined,
  })

  useEffect(() => {
    const updateStatus = () => {
      setStatus({
        online: navigator.onLine,
        effectiveType: (navigator as Navigator & { connection?: { effectiveType: string } }).connection?.effectiveType,
      })
    }

    updateStatus()

    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)

    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
    }
  }, [])

  return status
}

export default {
  useIsMobile,
  usePrefersReducedMotion,
  useDebouncedValue,
  useThrottledCallback,
  useIntersectionObserver,
  useIsTouchDevice,
  useScrollLock,
  useNetworkStatus,
}
