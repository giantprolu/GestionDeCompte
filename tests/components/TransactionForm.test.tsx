import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import TransactionForm from '@/components/TransactionForm'

describe('TransactionForm (smoke)', () => {
  it('renders with minimal props', () => {
    render(<TransactionForm accounts={[]} onSuccess={() => {}} onCancel={() => {}} />)
    expect(document.body).toBeTruthy()
  })
})
