import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select'

describe('UI Select (smoke)', () => {
  it('renders select trigger and value', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
      </Select>
    )
    expect(screen.getByText('Choose')).toBeInTheDocument()
  })
})
