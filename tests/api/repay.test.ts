import { describe, it, expect, vi } from 'vitest'
import * as repayRoute from '@/app/api/credits/[id]/repay/route'

vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'test-user' }) }))
vi.mock('@/lib/db', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'credits') {
        return {
          select: (_sel?: any) => ({
            eq: (_k: string, _v: any) => ({
              eq: (_k2: string, _v2: any) => ({
                single: () => ({ data: { id: 'c1', outstanding: 100 }, error: null }),
              }),
            }),
          }),
          update: (updates: any) => ({
            eq: (_k: string, _v: any) => ({
              select: (_sel?: any) => ({ single: () => ({ data: { id: 'c1', ...updates }, error: null }) }),
            }),
          }),
        }
      }

      if (table === 'accounts') {
        return {
          select: (_sel?: any) => ({
            eq: (_k: string, _v: any) => ({
              eq: (_k2: string, _v2: any) => ({ single: () => ({ data: { id: 'a1' }, error: null }) }),
            }),
          }),
        }
      }

      if (table === 'transactions') {
        return {
          insert: (payload: any) => ({ select: (_sel?: any) => ({ single: () => ({ data: { id: 't1', ...payload }, error: null }) }) }),
        }
      }

      return {}
    },
  },
}))

describe('POST /api/credits/:id/repay', () => {
  it('records a repayment and updates credit', async () => {
    const req = new Request('http://localhost/api/credits/c1/repay', { method: 'POST', body: JSON.stringify({ amount: 20, accountId: 'a1' }) })
    // NextRequest has extra props; cast to any to avoid TS mismatch in tests
    const res = await repayRoute.POST(req as any, { params: { id: 'c1' } } as any)
    const json = await res.json()
    expect(json.credit.outstanding).toBe(80)
    expect(json.transaction).toBeDefined()
  })
})
