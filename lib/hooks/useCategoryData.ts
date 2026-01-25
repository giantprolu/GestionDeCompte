import { useState, useEffect, useCallback } from 'react'

interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  icon: string
  color: string
  is_custom?: boolean
  user_id?: string
}

interface UsageStats {
  categoryId: string
  usageCount: number
  lastUsedDate: string
}

interface UseCategoryDataReturn {
  categories: Category[]
  frequentCategories: Category[]
  lastUsedCategoryId: string | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useCategoryData(
  type: 'income' | 'expense',
  accountIds?: string[]
): UseCategoryDataReturn {
  const [categories, setCategories] = useState<Category[]>([])
  const [frequentCategories, setFrequentCategories] = useState<Category[]>([])
  const [lastUsedCategoryId, setLastUsedCategoryId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all data in parallel
      const [categoriesRes, statsRes, settingsRes] = await Promise.all([
        fetch(`/api/categories?type=${type}`),
        fetch(`/api/categories/usage-stats?type=${type}`),
        fetch('/api/user-settings'),
      ])

      if (!categoriesRes.ok) {
        throw new Error('Failed to fetch categories')
      }

      const categoriesData: Category[] = await categoriesRes.json()
      const statsData: UsageStats[] = statsRes.ok ? await statsRes.json() : []
      const settingsData = settingsRes.ok ? await settingsRes.json() : null

      // Extract lastUsedCategory from settings
      const lastUsed = settingsData?.spend_targets?.lastUsedCategory?.[type] || null

      // Create a map of category IDs to usage stats
      const statsMap = new Map<string, UsageStats>()
      statsData.forEach((stat) => {
        statsMap.set(stat.categoryId, stat)
      })

      // Identify top 3 frequent categories
      const frequent = categoriesData
        .filter((cat) => statsMap.has(cat.id))
        .sort((a, b) => {
          const aStats = statsMap.get(a.id)!
          const bStats = statsMap.get(b.id)!

          // Sort by usage count (desc), then by last used date (desc)
          if (bStats.usageCount !== aStats.usageCount) {
            return bStats.usageCount - aStats.usageCount
          }
          return bStats.lastUsedDate.localeCompare(aStats.lastUsedDate)
        })
        .slice(0, 3)

      setCategories(categoriesData)
      setFrequentCategories(frequent)
      setLastUsedCategoryId(lastUsed)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      console.error('Error fetching category data:', err)
    } finally {
      setLoading(false)
    }
  }, [type])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    categories,
    frequentCategories,
    lastUsedCategoryId,
    loading,
    error,
    refetch: fetchData,
  }
}
