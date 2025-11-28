import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExpenseForm from '@/components/ExpenseForm'

vi.mock('react', async () => {
  const actual = await vi.importActual('react')
  return { ...actual, useState: actual.useState }
})

describe('ExpenseForm (smoke)', () => {
  it('renders without crashing', () => {
    render(<ExpenseForm accounts={[]} onSuccess={() => {}} onCancel={() => {}} />)
    expect(document.body).toBeTruthy()
  })
})
