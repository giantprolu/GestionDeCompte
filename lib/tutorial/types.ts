/**
 * Tutorial System Types
 * 
 * Complete type definitions for the interactive tutorial/onboarding system.
 */

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center'

export interface TutorialStep {
  /** Unique identifier for this step */
  id: string
  /** Title displayed in the tooltip */
  title: string
  /** Description text */
  description: string
  /** Optional icon emoji */
  icon?: string
  /** 
   * Target element selector via data-tutorial attribute
   * If not provided, step is displayed centered (full-page step)
   */
  targetSelector?: string
  /**
   * Alternative target selector for mobile devices
   * If provided and on mobile, this selector will be used instead
   */
  mobileTargetSelector?: string
  /** Route to navigate to before showing this step */
  route?: string
  /** Tooltip placement relative to target */
  placement?: TooltipPlacement
  /** Tooltip placement on mobile (defaults to bottom) */
  mobilePlacement?: TooltipPlacement
  /** Whether this step can be skipped */
  canSkip?: boolean
  /** Custom text for the next button */
  nextButtonText?: string
  /** Custom text for the previous button */
  prevButtonText?: string
  /** Callback when entering this step */
  onEnter?: () => void
  /** Callback when exiting this step */
  onExit?: () => void
  /** Optional highlight style override */
  highlightStyle?: 'glow' | 'border' | 'pulse'
}

export interface TutorialConfig {
  /** Unique identifier for this tutorial */
  id: string
  /** Display name */
  name: string
  /** Ordered list of steps */
  steps: TutorialStep[]
  /** Callback when tutorial is completed */
  onComplete?: () => void
  /** Callback when tutorial is skipped */
  onSkip?: () => void
  /** Whether to show progress indicator */
  showProgress?: boolean
}

export interface TutorialProgress {
  /** Tutorial ID */
  tutorialId: string
  /** Last completed step index */
  lastCompletedStep: number
  /** Whether tutorial was completed */
  completed: boolean
  /** Timestamp of last interaction */
  lastUpdated: number
}

export interface TutorialState {
  /** Whether a tutorial is currently active */
  isActive: boolean
  /** Current step index (0-based) */
  currentStepIndex: number
  /** Current tutorial configuration */
  config: TutorialConfig | null
  /** Target element's bounding rect (for positioning) */
  targetRect: DOMRect | null
  /** Whether we're waiting for element to be ready */
  isWaitingForElement: boolean
}

export interface TutorialContextValue {
  // State
  state: TutorialState
  currentStep: TutorialStep | null
  totalSteps: number
  progress: number // 0-100 percentage
  
  // Actions
  startTutorial: (config: TutorialConfig) => void
  nextStep: () => void
  prevStep: () => void
  goToStep: (index: number) => void
  skip: () => void
  restart: () => void
  endTutorial: () => void
  
  // Element registration
  setTargetRect: (rect: DOMRect | null) => void
  setWaitingForElement: (waiting: boolean) => void
}

// Storage key for persisting tutorial progress
export const TUTORIAL_STORAGE_KEY = 'moneyflow_tutorial_progress'
