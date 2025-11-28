import '@testing-library/jest-dom'

import { vi } from 'vitest'
import React from 'react'

// Provide a global fetch wrapper that accepts relative URLs during tests
const originalFetch = globalThis.fetch
// always override fetch so relative URLs like '/api/...' don't error under undici
globalThis.fetch = (input: any, init?: any) => {
  try {
    if (typeof input === 'string' && input.startsWith('/')) {
      // default harmless response for relative API calls when no per-test mock is set
      return Promise.resolve({ ok: true, json: async () => [] }) as any
    }
    if (typeof input === 'object' && input?.url && String(input.url).startsWith('/')) {
      return Promise.resolve({ ok: true, json: async () => [] }) as any
    }
  } catch (e) {
    // ignore and fall through to originalFetch
  }

  if (originalFetch) return originalFetch(input as any, init)
  return Promise.resolve({ ok: true, json: async () => ({}) }) as any
}

// Global mocks to make UI components test-friendly

// Mock the Radix-based Select with a simple native select for tests
vi.mock('@/components/ui/select', () => {
  const React = require('react')

  function collectOptions(node: any, out: Array<any>) {
    if (!node) return
    const children = React.Children.toArray(node)
    for (const child of children) {
      if (child && child.props && Object.prototype.hasOwnProperty.call(child.props, 'value')) {
        const label = extractText(child.props.children)
        out.push({ value: child.props.value, label })
      }
      if (child && child.props && child.props.children) {
        collectOptions(child.props.children, out)
      }
    }
  }

  function extractText(node: any): string {
    if (node == null) return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(extractText).join('')
    if (node && node.props && node.props.children) return extractText(node.props.children)
    // Fallback: try to stringify
    try {
      return String(node)
    } catch (e) {
      return ''
    }
  }

  function Select({ value, onValueChange, children }: any) {
    const options: Array<{ value: string; label: any }> = []
    collectOptions(children, options)

    return (
      React.createElement('div', {},
        React.createElement('select', {
          'data-testid': 'mock-select',
          value: value || '',
          onChange: (e: any) => onValueChange && onValueChange(e.target.value),
        }, options.map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label))),
        children
      )
    )
  }

  const SelectTrigger = ({ children, ...props }: any) => React.createElement('button', props, children)
  const SelectContent = (props: any) => React.createElement('div', props)
  const SelectItem = ({ children, value }: any) => React.createElement('div', { 'data-value': value, value }, children)
  const SelectValue = ({ placeholder }: any) => React.createElement('span', {}, placeholder || '')

  return { Select, SelectTrigger, SelectContent, SelectItem, SelectValue }
})

// Mock Clerk components to avoid needing a ClerkProvider in tests
vi.mock('@clerk/nextjs', () => ({
  SignedIn: ({ children }: any) => children,
  SignedOut: ({ children }: any) => children,
  SignInButton: ({ children }: any) => children,
  SignUpButton: ({ children }: any) => children,
  UserButton: (props: any) => React.createElement('div', { 'data-testid': 'user-button' }),
}))
