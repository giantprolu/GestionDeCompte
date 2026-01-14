/**
 * Custom hooks for mobile optimizations and gestures
 */

export { useGestures, useSwipeNavigation } from './useGestures'
export type { GestureConfig, GestureState } from './useGestures'

export {
  useIsMobile,
  usePrefersReducedMotion,
  useDebouncedValue,
  useThrottledCallback,
  useIntersectionObserver,
  useIsTouchDevice,
  useScrollLock,
  useNetworkStatus,
} from './useMobileOptimizations'
