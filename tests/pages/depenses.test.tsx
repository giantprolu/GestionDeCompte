import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import DepensesPage from '@/app/depenses/page'

describe('Depenses page (smoke)', () => {
  it('renders without crashing', () => {
    render(<DepensesPage />)
    expect(document.body).toBeTruthy()
  })
})
