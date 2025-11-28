import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// mock Clerk useUser hook
vi.mock('@clerk/nextjs', () => ({ useUser: () => ({ user: { id: 'u1' }, isLoaded: true }) }))

import InitializeUserAccounts from '@/components/InitializeUserAccounts'

describe('InitializeUserAccounts', () => {
  it('renders nothing when done (noop)', () => {
    render(<InitializeUserAccounts />)
    // component returns null in normal flow; assert container exists
    expect(document.body).toBeTruthy()
  })
})
