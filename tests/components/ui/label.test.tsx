import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Label } from '@/components/ui/label'

describe('UI Label', () => {
  it('renders label text', () => {
    render(<Label>My label</Label>)
    expect(screen.getByText('My label')).toBeInTheDocument()
  })
})
