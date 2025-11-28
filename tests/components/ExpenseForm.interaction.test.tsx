import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpenseForm from '../../components/ExpenseForm'
import { vi } from 'vitest'

describe('ExpenseForm interactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('remplit le formulaire et soumet via fetch, appelle onSuccess', async () => {
    const accounts = [{ id: 'acc1', name: 'Compte principal', type: 'checking' }]
    const onSuccess = vi.fn()
    const onCancel = vi.fn()

    const mockFetch = vi.fn((url, opts) => {
      if (url === '/api/expenses' && opts?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ id: 'e1', ...JSON.parse(opts.body) }) })
      }
      return Promise.resolve({ ok: true, json: async () => [] })
    })

    // @ts-ignore
    global.fetch = mockFetch

    render(<ExpenseForm accounts={accounts} onSuccess={onSuccess} onCancel={onCancel} />)

    // remplir montant
    const amount = screen.getByLabelText(/Montant/i)
    await userEvent.clear(amount)
    await userEvent.type(amount, '12.34')

    // remplir catégorie
    const category = screen.getByLabelText(/Catégorie/i)
    await userEvent.type(category, 'Alimentation')

    // date
    const dateInput = screen.getByLabelText(/Date/i)
    await userEvent.clear(dateInput)
    await userEvent.type(dateInput, '2023-12-01')

    // choisir compte via le <select data-testid="mock-select">
    const select = screen.getByTestId('mock-select')
    // @ts-ignore
    await userEvent.selectOptions(select, 'acc1')

    // submit
    const submit = screen.getByRole('button', { name: /Ajouter/i })
    await userEvent.click(submit)

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/expenses', expect.any(Object)))
    expect(onSuccess).toHaveBeenCalled()
  })
})
