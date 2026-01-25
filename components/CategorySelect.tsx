'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useCategoryData } from '@/lib/hooks/useCategoryData'

interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  icon: string
  color: string
  is_custom?: boolean
  user_id?: string
}

interface CategorySelectProps {
  value: string
  onChange: (value: string) => void
  type: 'income' | 'expense'
  accountIds?: string[]
  autoFill?: boolean
  className?: string
}

export function CategorySelect({
  value,
  onChange,
  type,
  accountIds,
  autoFill = true,
  className,
}: CategorySelectProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const {
    categories,
    frequentCategories,
    lastUsedCategoryId,
    loading,
    error,
  } = useCategoryData(type, accountIds)

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto-fill with last used category
  useEffect(() => {
    if (autoFill && lastUsedCategoryId && !value && categories.length > 0) {
      // Verify the category exists in the current list
      const categoryExists = categories.some((cat) => cat.id === lastUsedCategoryId)
      if (categoryExists) {
        onChange(lastUsedCategoryId)
      }
    }
  }, [autoFill, lastUsedCategoryId, value, categories, onChange])

  // Filter frequent categories based on search query
  const filteredFrequent = useMemo(() => {
    if (!searchQuery) return frequentCategories
    const query = searchQuery.toLowerCase()
    return frequentCategories.filter((cat) =>
      cat.name.toLowerCase().includes(query)
    )
  }, [frequentCategories, searchQuery])

  // Filter all categories based on search query, excluding frequent ones to avoid duplicates
  const filteredCategories = useMemo(() => {
    const frequentIds = new Set(filteredFrequent.map((cat) => cat.id))
    const filtered = searchQuery
      ? categories.filter((cat) => cat.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : categories
    return filtered.filter((cat) => !frequentIds.has(cat.id))
  }, [categories, searchQuery, filteredFrequent])

  if (loading) {
    return (
      <Select value={value || ''} onValueChange={onChange} disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Chargement..." />
        </SelectTrigger>
      </Select>
    )
  }

  if (error) {
    return (
      <Select value={value || ''} onValueChange={onChange} disabled>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Erreur de chargement" />
        </SelectTrigger>
      </Select>
    )
  }

  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Sélectionner une catégorie" />
      </SelectTrigger>
      <SelectContent className="bg-slate-800 border-slate-700">
        {/* Search Input - sticky */}
        <div className="p-2 sticky top-0 bg-slate-800 z-10 border-b border-slate-700">
          <Input
            ref={searchInputRef}
            placeholder="🔍 Rechercher une catégorie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus={!isMobile}
            className="bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-400 h-9"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // Prevent Select from closing when typing
              e.stopPropagation()
            }}
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          {/* Frequent Section */}
          {filteredFrequent.length > 0 && (
            <>
              <SelectGroup>
                <SelectLabel className="text-slate-400 text-xs font-semibold px-2 py-2">
                  FRÉQUENTES
                </SelectLabel>
                {filteredFrequent.map((category) => (
                  <SelectItem
                    key={`frequent-${category.id}`}
                    value={category.id}
                    className="text-white hover:bg-slate-700 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span>{category.icon}</span>
                      <span>{category.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator className="bg-slate-700 my-2" />
            </>
          )}

          {/* All Categories */}
          <SelectGroup>
            <SelectLabel className="text-slate-400 text-xs font-semibold px-2 py-2">
              TOUTES LES CATÉGORIES
            </SelectLabel>
            {filteredCategories.length > 0 ? (
              filteredCategories.map((category) => (
                <SelectItem
                  key={category.id}
                  value={category.id}
                  className="text-white hover:bg-slate-700 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span>{category.icon}</span>
                    <span>{category.name}</span>
                  </span>
                </SelectItem>
              ))
            ) : (
              <div className="p-4 text-center text-slate-400 text-sm">
                Aucune catégorie trouvée
              </div>
            )}
          </SelectGroup>

          {/* Empty State - No categories at all */}
          {categories.length === 0 && (
            <div className="p-4 text-center text-slate-400 text-sm">
              Aucune catégorie disponible
            </div>
          )}
        </div>
      </SelectContent>
    </Select>
  )
}
