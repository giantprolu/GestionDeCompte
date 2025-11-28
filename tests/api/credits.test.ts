import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as creditsRoute from '@/app/api/credits/route'

// Mock auth to return a userId
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'test-user' }),
}))

// Mock supabase client
vi.mock('@/lib/db', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          order: () => ({ data: [{ id: 'c1', user_id: 'test-user', title: 'T', principal: 100, outstanding: 100, date: new Date().toISOString() }], error: null }),
        }),
      }),
      insert: (payload: any) => ({ select: () => ({ single: () => ({ data: { id: 'c2', ...payload }, error: null }) }) }),
    }),
  },
}))

describe('GET /api/credits', () => {
  it('returns list of credits', async () => {
    const req = new Request('http://localhost/api/credits')
    const res = await creditsRoute.GET(req)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    expect(json[0].id).toBe('c1')
  })
})

describe('POST /api/credits', () => {
  it('creates a credit', async () => {
    const req = new Request('http://localhost/api/credits', { method: 'POST', body: JSON.stringify({ principal: 50, title: 'X' }) })
    const res = await creditsRoute.POST(req)
    const json = await res.json()
    expect(json.principal).toBe(50)
    expect(json.title).toBe('X')
  })
})
