import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PartageGererPage from '@/app/partage/gerer/page'

describe('Partage gerer page (smoke)', () => {
  it('renders without crashing', () => {
    render(<PartageGererPage />)
    expect(document.body).toBeTruthy()
  })
})
