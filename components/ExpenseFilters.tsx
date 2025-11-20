'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { motion } from 'framer-motion'

interface Account {
  id: string
  name: string
}

interface Filters {
  accountId: string
  category: string
  startDate: string
  endDate: string
}

interface ExpenseFiltersProps {
  filters: Filters
  setFilters: (filters: Filters) => void
  accounts: Account[]
  onApply: () => void
  onReset: () => void
}

export default function ExpenseFilters({
  filters,
  setFilters,
  accounts,
  onApply,
  onReset,
}: ExpenseFiltersProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
    >
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Compte</Label>
              <Select
                value={filters.accountId}
                onValueChange={(value) => setFilters({ ...filters, accountId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Input
                placeholder="Filtrer par catégorie"
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Date début</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Date fin</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <Button onClick={onApply}>Appliquer</Button>
            <Button variant="outline" onClick={onReset}>
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
