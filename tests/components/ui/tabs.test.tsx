import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs'

describe('UI Tabs (smoke)', () => {
  it('renders tabs list and trigger', () => {
    render(
      <Tabs value="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>
    )
    expect(screen.getByText('A')).toBeInTheDocument()
  })
})
