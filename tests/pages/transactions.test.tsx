import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TransactionsPage from '@/app/transactions/page'

const sampleAccounts = [{ id: 'a1', name: 'Bourso', initialBalance: 100 }]
const sampleTransactions = [
  { id: 't1', amount: 50, type: 'expense', category: { name: 'Alimentation', icon: '🛒', color: '#ef4444' }, date: new Date().toISOString(), note: 'Café', account: sampleAccounts[0], accountId: 'a1', categoryId: 'c1' },
  { id: 't2', amount: 200, type: 'income', category: { name: 'Salaire' }, date: new Date().toISOString(), note: null, account: sampleAccounts[0], accountId: 'a1', categoryId: 'c2' }
]

beforeEach(() => {
  vi.resetAllMocks()
  global.fetch = vi.fn((url: any) => {
    if (String(url).includes('/api/expenses')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sampleTransactions) } as any)
    if (String(url).includes('/api/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sampleAccounts) } as any)
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) } as any)
  }) as any
})

describe('Transactions page', () => {
  it('renders totals and list', async () => {
    render(<TransactionsPage />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    // Totals should show (allow multiple matches, assert at least one)
    const depensesMatches = await screen.findAllByText(/Dépenses/i)
    expect(depensesMatches.length).toBeGreaterThan(0)
    const revenusMatches = await screen.findAllByText(/Revenus/i)
    expect(revenusMatches.length).toBeGreaterThan(0)
    // Items
    expect(await screen.findByText('Alimentation')).toBeInTheDocument()
  })

  it('filters by type tab', async () => {
    render(<TransactionsPage />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    // Click Revenus tab to filter
    const revenusTabs = await screen.findAllByRole('tab', { name: /Revenus/i })
    // click the tab trigger (first matching tab) using userEvent to simulate real interaction
    if (revenusTabs.length > 0) {
      const user = userEvent.setup()
      await user.click(revenusTabs[0])
    }
    // The Revenus tab should become selected after click (wait for state update)
    await waitFor(() => {
      const updated = screen.getAllByRole('tab', { name: /Revenus/i })
      expect(updated.length).toBeGreaterThan(0)
      const isSelected = updated[0].getAttribute('aria-selected') === 'true' || updated[0].getAttribute('data-state') === 'active'
      expect(isSelected).toBeTruthy()
    })
  })
})
