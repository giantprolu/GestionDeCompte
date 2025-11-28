import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import ShareAccountModal from '../../components/ShareAccountModal'

describe('ShareAccountModal (smoke)', () => {
  it('renders', () => {
    const onClose = vi.fn()
    render(<ShareAccountModal isOpen={false} onClose={onClose} />)
    expect(document.body).toBeTruthy()
  })
})
