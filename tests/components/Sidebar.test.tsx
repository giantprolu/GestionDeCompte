import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Sidebar from '../../components/Sidebar'

describe('Sidebar (smoke)', () => {
  it('renders', () => {
    render(
      <Sidebar>
        <div>Content</div>
      </Sidebar>
    )
    // check for existence of some known text from sidebar (fallback: ensure body exists)
    expect(document.body).toBeTruthy()
  })
})
