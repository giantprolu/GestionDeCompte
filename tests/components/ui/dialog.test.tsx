import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'

describe('UI Dialog (smoke)', () => {
  it('renders dialog trigger and content (not open by default)', () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>Content</DialogContent>
      </Dialog>
    )
    expect(screen.getByText('Open')).toBeInTheDocument()
  })
})
