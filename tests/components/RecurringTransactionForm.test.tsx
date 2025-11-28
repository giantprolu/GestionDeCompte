import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import RecurringTransactionForm from '@/components/RecurringTransactionForm'

describe('RecurringTransactionForm (smoke)', () => {
  it('renders', () => {
    render(<RecurringTransactionForm accounts={[]} categories={[]} onSuccess={() => {}} />)
    expect(document.body).toBeTruthy()
  })
})
