import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrevisionnelPage from '@/app/previsionnel/page'

describe('Prévisionnel page', () => {
  it('renders and shows CreditTrackingCard', () => {
    render(<PrevisionnelPage />)
    // heading h1
    expect(screen.getByRole('heading', { name: /Prévisionnel/ })).toBeInTheDocument()
    // CreditTrackingCard renders title (card title contains 'Suivi des crédits passés')
    expect(screen.getByText(/Suivi des crédits passés/)).toBeInTheDocument()
  })
})
