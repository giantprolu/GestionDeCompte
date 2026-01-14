'use client'

import { useRef, useCallback, useEffect, useState } from 'react'

export interface GestureConfig {
  /** Callback when swipe left is detected */
  onSwipeLeft?: () => void
  /** Callback when swipe right is detected */
  onSwipeRight?: () => void
  /** Callback when swipe up is detected */
  onSwipeUp?: () => void
  /** Callback when swipe down is detected */
  onSwipeDown?: () => void
  /** Callback when long press is detected */
  onLongPress?: () => void
  /** Callback when double tap is detected */
  onDoubleTap?: () => void
  /** Minimum distance (px) for swipe detection, default 50 */
  swipeThreshold?: number
  /** Long press duration in ms, default 500 */
  longPressDuration?: number
  /** Maximum time between taps for double tap in ms, default 300 */
  doubleTapDelay?: number
  /** Whether gestures are enabled, default true */
  enabled?: boolean
}

export interface GestureState {
  isSwiping: boolean
  swipeDirection: 'left' | 'right' | 'up' | 'down' | null
  isLongPressing: boolean
}

interface TouchState {
  startX: number
  startY: number
  startTime: number
}

/**
 * Hook for handling mobile gestures
 * Supports swipe, long press, and double tap
 * 
 * @example
 * ```tsx
 * const { bind } = useGestures({
 *   onSwipeLeft: () => nextStep(),
 *   onSwipeRight: () => prevStep(),
 *   onLongPress: () => showMenu(),
 * })
 * 
 * return <div {...bind}>Content</div>
 * ```
 */
export function useGestures(config: GestureConfig = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onLongPress,
    onDoubleTap,
    swipeThreshold = 50,
    longPressDuration = 500,
    doubleTapDelay = 300,
    enabled = true,
  } = config

  const [state, setState] = useState<GestureState>({
    isSwiping: false,
    swipeDirection: null,
    isLongPressing: false,
  })

  const touchRef = useRef<TouchState | null>(null)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastTapRef = useRef<number>(0)
  const preventDefaultRef = useRef(false)

  // Clear long press timer
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    setState(prev => ({ ...prev, isLongPressing: false }))
  }, [])

  // Handle touch start
  const handleTouchStart = useCallback((e: TouchEvent | React.TouchEvent) => {
    if (!enabled) return

    const touch = 'touches' in e ? e.touches[0] : (e as React.TouchEvent).touches[0]
    
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    }

    setState(prev => ({ ...prev, isSwiping: true, swipeDirection: null }))

    // Start long press timer
    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, isLongPressing: true }))
        onLongPress()
        // Vibrate if supported
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
      }, longPressDuration)
    }

    // Handle double tap
    if (onDoubleTap) {
      const now = Date.now()
      if (now - lastTapRef.current < doubleTapDelay) {
        onDoubleTap()
        lastTapRef.current = 0
      } else {
        lastTapRef.current = now
      }
    }
  }, [enabled, onLongPress, onDoubleTap, longPressDuration, doubleTapDelay])

  // Handle touch move
  const handleTouchMove = useCallback((e: TouchEvent | React.TouchEvent) => {
    if (!enabled || !touchRef.current) return

    const touch = 'touches' in e ? e.touches[0] : (e as React.TouchEvent).touches[0]
    const deltaX = touch.clientX - touchRef.current.startX
    const deltaY = touch.clientY - touchRef.current.startY
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    // If moved significantly, cancel long press
    if (absX > 10 || absY > 10) {
      clearLongPressTimer()
    }

    // Determine swipe direction
    if (absX > absY && absX > swipeThreshold / 2) {
      setState(prev => ({ 
        ...prev, 
        swipeDirection: deltaX > 0 ? 'right' : 'left' 
      }))
      // Prevent scroll if horizontal swipe
      if (preventDefaultRef.current) {
        e.preventDefault()
      }
    } else if (absY > absX && absY > swipeThreshold / 2) {
      setState(prev => ({ 
        ...prev, 
        swipeDirection: deltaY > 0 ? 'down' : 'up' 
      }))
    }
  }, [enabled, swipeThreshold, clearLongPressTimer])

  // Handle touch end
  const handleTouchEnd = useCallback((e: TouchEvent | React.TouchEvent) => {
    if (!enabled || !touchRef.current) return

    clearLongPressTimer()

    const touch = 'changedTouches' in e 
      ? e.changedTouches[0] 
      : (e as React.TouchEvent).changedTouches[0]

    const deltaX = touch.clientX - touchRef.current.startX
    const deltaY = touch.clientY - touchRef.current.startY
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)
    const elapsed = Date.now() - touchRef.current.startTime

    // Only trigger if swipe was fast enough (< 300ms) or long enough
    const isValidSwipe = elapsed < 300 || Math.max(absX, absY) > swipeThreshold * 1.5

    if (isValidSwipe) {
      if (absX > absY && absX > swipeThreshold) {
        // Horizontal swipe
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight()
          if (navigator.vibrate) navigator.vibrate(25)
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft()
          if (navigator.vibrate) navigator.vibrate(25)
        }
      } else if (absY > absX && absY > swipeThreshold) {
        // Vertical swipe
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown()
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp()
        }
      }
    }

    touchRef.current = null
    setState({ isSwiping: false, swipeDirection: null, isLongPressing: false })
  }, [enabled, swipeThreshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, clearLongPressTimer])

  // Handle touch cancel
  const handleTouchCancel = useCallback(() => {
    clearLongPressTimer()
    touchRef.current = null
    setState({ isSwiping: false, swipeDirection: null, isLongPressing: false })
  }, [clearLongPressTimer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearLongPressTimer()
    }
  }, [clearLongPressTimer])

  // Bind function that returns props to spread on element
  const bind = useCallback(() => ({
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  }), [handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel])

  // Set whether to prevent default on horizontal swipes
  const setPreventDefault = useCallback((value: boolean) => {
    preventDefaultRef.current = value
  }, [])

  return {
    bind,
    state,
    setPreventDefault,
  }
}

/**
 * Hook for swipe navigation (simplified version)
 * Useful for navigating between steps/pages
 */
export function useSwipeNavigation(
  onNext: () => void,
  onPrev: () => void,
  enabled = true
) {
  return useGestures({
    onSwipeLeft: onNext,
    onSwipeRight: onPrev,
    enabled,
    swipeThreshold: 60,
  })
}

export default useGestures
