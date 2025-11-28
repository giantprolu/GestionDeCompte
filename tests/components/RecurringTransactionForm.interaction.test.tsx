import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecurringTransactionForm from '../../components/RecurringTransactionForm'
import { vi } from 'vitest'

describe('RecurringTransactionForm interactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('crée une transaction récurrente et appelle onSuccess', async () => {
    const accounts = [{ id: 'acc1', name: 'Compte principal' }]
    const categories = [{ id: 'cat1', name: 'Abonnements', icon: '📺', type: 'expense' }]
    const onSuccess = vi.fn()

    const mockFetch = vi.fn((url, opts) => {
      if (url === '/api/expenses' && opts?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ id: 'r1' }) })
      }
      return Promise.resolve({ ok: true, json: async () => categories })
    })

    // @ts-ignore
    global.fetch = mockFetch

    render(<RecurringTransactionForm accounts={accounts} categories={categories} onSuccess={onSuccess} />)

    // remplir montant
    const amount = screen.getByLabelText(/Montant/i)
    await userEvent.clear(amount)
    await userEvent.type(amount, '20')

    // choisir catégorie et compte via le <select data-testid="mock-select">
    const selects = screen.getAllByTestId('mock-select')
    expect(selects.length).toBeGreaterThanOrEqual(2)
    // @ts-ignore
    await userEvent.selectOptions(selects[0], 'cat1')
    // @ts-ignore
    await userEvent.selectOptions(selects[1], 'acc1')

    // jour de prélèvement (défaut = 1)
    const dayInput = screen.getByLabelText(/Jour du mois/i)
    await userEvent.clear(dayInput)
    await userEvent.type(dayInput, '5')

    // date de début
    const startDate = screen.getByLabelText(/Date de début/i)
    await userEvent.clear(startDate)
    await userEvent.type(startDate, '2023-12-01')

    // submit
    const submit = screen.getByRole('button', { name: /Créer la récurrence|Créer la récurrence/i })
    await userEvent.click(submit)

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/expenses', expect.any(Object)))
    expect(onSuccess).toHaveBeenCalled()
  })
})
