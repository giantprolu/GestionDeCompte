import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TransactionForm from '../../components/TransactionForm'
import { vi } from 'vitest'

describe('TransactionForm interactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('crée une transaction en remplissant le formulaire', async () => {
    const accounts = [{ id: 'a1', name: 'Principal' }]
    const onSuccess = vi.fn()
    const onCancel = vi.fn()

    const categoriesResponse = [{ id: 'c1', name: 'Food', icon: '🍔', color: 'red' }]

    const mockFetch = vi.fn((url, opts) => {
      if (url.startsWith('/api/categories')) {
        return Promise.resolve({ ok: true, json: async () => categoriesResponse })
      }
      if (url === '/api/expenses' && opts?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })

    // @ts-ignore
    global.fetch = mockFetch

    render(<TransactionForm accounts={accounts} onSuccess={onSuccess} onCancel={onCancel} />)

    // attendre le chargement des catégories
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/categories?type=expense'))

    // remplir montant
    const amount = screen.getByLabelText(/Montant/i)
    await userEvent.clear(amount)
    await userEvent.type(amount, '5.50')

    // choisir catégorie et compte via le <select data-testid="mock-select"> rendu par le mock
    const selects = screen.getAllByTestId('mock-select')
    // first select -> catégorie, second -> compte
    expect(selects.length).toBeGreaterThanOrEqual(2)
    // @ts-ignore
    await userEvent.selectOptions(selects[0], 'c1')
    // @ts-ignore
    await userEvent.selectOptions(selects[1], 'a1')

    // date - leave default

    // submit
    const submit = screen.getByRole('button', { name: /Ajouter/i })
    await userEvent.click(submit)

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/expenses', expect.any(Object)))
    expect(onSuccess).toHaveBeenCalled()
  })
})
