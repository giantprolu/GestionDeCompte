'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface MoneyInputProps extends Omit<React.ComponentProps<'input'>, 'onChange' | 'value' | 'type'> {
  /** Current value as a number */
  value: number | string
  /** Callback when value changes */
  onChange: (value: number) => void
  /** Allow negative values, default false */
  allowNegative?: boolean
  /** Maximum decimal places, default 2 */
  decimalPlaces?: number
  /** Placeholder text */
  placeholder?: string
}

/**
 * Money input component that supports both comma and dot as decimal separators
 * Optimized for mobile keyboard with inputMode="decimal"
 * 
 * @example
 * ```tsx
 * <MoneyInput
 *   value={amount}
 *   onChange={(val) => setAmount(val)}
 *   placeholder="Montant"
 * />
 * ```
 */
export function MoneyInput({
  value,
  onChange,
  allowNegative = false,
  decimalPlaces = 2,
  placeholder = 'Montant',
  className,
  ...props
}: MoneyInputProps) {
  // Keep track of the display value (with comma for French locale)
  const [displayValue, setDisplayValue] = React.useState<string>(() => {
    if (value === '' || value === undefined || value === null) return ''
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(num)) return ''
    // Format with comma for display
    return num.toString().replace('.', ',')
  })

  // Sync display value when external value changes
  React.useEffect(() => {
    if (value === '' || value === undefined || value === null) {
      setDisplayValue('')
      return
    }
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(num)) {
      setDisplayValue('')
      return
    }
    // Only update if the parsed value is different (avoid cursor jumps)
    const currentParsed = parseFloat(displayValue.replace(',', '.'))
    if (currentParsed !== num) {
      setDisplayValue(num.toString().replace('.', ','))
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value

    // Allow empty input
    if (inputValue === '' || inputValue === '-') {
      setDisplayValue(inputValue)
      onChange(0)
      return
    }

    // Replace comma with dot for parsing, but keep original for display
    const normalizedValue = inputValue.replace(',', '.')

    // Validate the format
    const regex = allowNegative
      ? /^-?\d*\.?\d*$/
      : /^\d*\.?\d*$/

    if (!regex.test(normalizedValue)) {
      return // Don't update if invalid
    }

    // Limit decimal places
    const parts = normalizedValue.split('.')
    if (parts[1] && parts[1].length > decimalPlaces) {
      return // Don't allow more decimals than specified
    }

    // Update display value (keep comma if user typed comma)
    setDisplayValue(inputValue)

    // Parse and send numeric value
    const numericValue = parseFloat(normalizedValue)
    if (!isNaN(numericValue)) {
      onChange(numericValue)
    } else if (normalizedValue === '.' || normalizedValue === '-.') {
      // User just typed decimal separator, don't update numeric value yet
    } else {
      onChange(0)
    }
  }, [onChange, allowNegative, decimalPlaces])

  // Handle blur to format the final value
  const handleBlur = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const normalizedValue = displayValue.replace(',', '.')
    const numericValue = parseFloat(normalizedValue)
    
    if (!isNaN(numericValue)) {
      // Format with proper decimal places and comma
      const formatted = numericValue.toFixed(decimalPlaces).replace('.', ',')
      // Remove trailing zeros after comma if they're all zeros
      const cleanFormatted = formatted.replace(/,00$/, '').replace(/,(\d)0$/, ',$1')
      setDisplayValue(numericValue === 0 ? '' : cleanFormatted)
    } else {
      setDisplayValue('')
    }
    
    props.onBlur?.(e)
  }, [displayValue, decimalPlaces, props])

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[,.]?[0-9]*"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
    />
  )
}

export default MoneyInput
