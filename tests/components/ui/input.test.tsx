import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Input } from '@/components/ui/input'

describe('UI Input', () => {
  it('renders input', () => {
    render(<Input placeholder="Type" />)
    expect(screen.getByPlaceholderText('Type')).toBeInTheDocument()
  })
})
