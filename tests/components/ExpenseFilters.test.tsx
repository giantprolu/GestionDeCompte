import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import ExpenseFilters from '../../components/ExpenseFilters'

describe('ExpenseFilters (smoke)', () => {
  it('renders', () => {
    const filters = { accountId: '', category: '', startDate: '', endDate: '' }
    const setFilters = vi.fn()
    const accounts: any[] = []
    const onApply = vi.fn()
    const onReset = vi.fn()

    render(
      <ExpenseFilters
        filters={filters}
        setFilters={setFilters}
        accounts={accounts}
        onApply={onApply}
        onReset={onReset}
      />
    )
    expect(document.body).toBeTruthy()
  })
})
