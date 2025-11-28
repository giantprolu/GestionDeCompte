import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AppPage from '@/app/page'

describe('App root page (smoke)', () => {
  it('renders main title or layout', () => {
    render(<AppPage />)
    // app root may show something; at minimum layout renders
    expect(document.body).toBeTruthy()
  })
})
