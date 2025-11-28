import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import CreditTrackingCard from '@/components/CreditTrackingCard'

// mock fetch endpoints used by the component
beforeEach(() => {
  vi.resetAllMocks()
})

describe('CreditTrackingCard', () => {
  it('renders and can add a credit (calls API)', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) })) as any
    render(<CreditTrackingCard />)
    expect(screen.getByPlaceholderText(/Titre/i)).toBeInTheDocument()

    // simulate adding
    fireEvent.change(screen.getByPlaceholderText(/Montant/i), { target: { value: '10' } })
    const addBtn = screen.getByText(/Ajouter/i)
    fireEvent.click(addBtn)

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
  })
})
