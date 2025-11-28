import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import PartagePage from '@/app/partage/page'

describe('Partage page (smoke)', () => {
  it('renders without crashing', () => {
    render(<PartagePage />)
    expect(document.body).toBeTruthy()
  })
})
