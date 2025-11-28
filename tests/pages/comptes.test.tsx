import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ComptesPage from '@/app/comptes/page'

const sampleAccounts = [{ id: 'a1', name: 'Bourso', initialBalance: 100 }]
const sampleTransactions: any[] = []

beforeEach(() => {
  vi.resetAllMocks()
  global.fetch = vi.fn((url: any) => {
    if (String(url).includes('/api/accounts')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sampleAccounts) } as any)
    if (String(url).includes('/api/transactions')) return Promise.resolve({ ok: true, json: () => Promise.resolve(sampleTransactions) } as any)
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) } as any)
  }) as any
})

describe('Comptes page', () => {
  it('renders accounts and balances', async () => {
    render(<ComptesPage />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(await screen.findByText('Bourso')).toBeInTheDocument()
  })
})
