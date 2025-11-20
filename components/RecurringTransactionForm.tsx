'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Calendar, RefreshCw } from 'lucide-react'

const recurringTransactionSchema = z.object({
  amount: z.string().min(1, 'Montant requis'),
  type: z.enum(['income', 'expense']),
  categoryId: z.string().min(1, 'Catégorie requise'),
  accountId: z.string().min(1, 'Compte requis'),
  note: z.string().optional(),
  recurrenceFrequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  recurrenceDay: z.string().min(1, 'Jour requis'),
  startDate: z.string().min(1, 'Date de début requise'),
})

type RecurringTransactionFormData = z.infer<typeof recurringTransactionSchema>

interface RecurringTransactionFormProps {
  accounts: Array<{ id: string; name: string }>
  categories?: Array<{ id: string; name: string; icon: string; type: string }>
  onSuccess: () => void
}

export default function RecurringTransactionForm({ accounts, categories: initialCategories, onSuccess }: RecurringTransactionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense')
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly')
  const [categories, setCategories] = useState(initialCategories || [])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')

  useEffect(() => {
    // Charger les catégories si elles ne sont pas fournies
    if (!initialCategories || initialCategories.length === 0) {
      fetch(`/api/categories?type=${transactionType}`)
        .then(res => res.json())
        .then(data => setCategories(data))
        .catch(err => console.error('Erreur chargement catégories:', err))
    }
  }, [transactionType, initialCategories])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RecurringTransactionFormData>({
    resolver: zodResolver(recurringTransactionSchema),
    defaultValues: {
      type: 'expense',
      recurrenceFrequency: 'monthly',
      recurrenceDay: '1',
    },
  })

  const filteredCategories = categories.filter(cat => cat.type === transactionType)

  const onSubmit = async (data: RecurringTransactionFormData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(data.amount),
          type: data.type,
          categoryId: data.categoryId,
          accountId: data.accountId,
          note: data.note,
          date: data.startDate,
          isRecurring: true,
          recurrenceFrequency: data.recurrenceFrequency,
          recurrenceDay: parseInt(data.recurrenceDay),
          isActive: true,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la création')
      }

      reset()
      onSuccess()
    } catch (error) {
      console.error('Erreur:', error)
      alert(error instanceof Error ? error.message : 'Erreur lors de la création de la transaction récurrente')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full border-2 border-slate-700/50 bg-gradient-to-br from-slate-800/95 to-slate-900/95 shadow-2xl backdrop-blur-sm">
      <CardHeader className="border-b border-slate-700/50 pb-4">
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-white">
          <RefreshCw className="w-5 h-5 text-blue-400" />
          Nouvelle Transaction Récurrente
        </CardTitle>
        <p className="text-sm text-slate-300 mt-1">
          Pour abonnements, prélèvements mensuels, salaires, etc.
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Type de transaction */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-200">Type</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setTransactionType('expense')
                  register('type').onChange({ target: { value: 'expense' } })
                }}
                className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 font-semibold ${
                  transactionType === 'expense'
                    ? 'border-red-500/50 bg-gradient-to-br from-red-500/20 to-red-600/20 text-red-300 shadow-lg shadow-red-500/20'
                    : 'border-slate-600/50 bg-slate-700/30 text-slate-300 hover:border-slate-500 hover:bg-slate-700/50'
                }`}
              >
                💸 Dépense
              </button>
              <button
                type="button"
                onClick={() => {
                  setTransactionType('income')
                  register('type').onChange({ target: { value: 'income' } })
                }}
                className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 font-semibold ${
                  transactionType === 'income'
                    ? 'border-green-500/50 bg-gradient-to-br from-green-500/20 to-green-600/20 text-green-300 shadow-lg shadow-green-500/20'
                    : 'border-slate-600/50 bg-slate-700/30 text-slate-300 hover:border-slate-500 hover:bg-slate-700/50'
                }`}
              >
                💰 Revenu
              </button>
            </div>
            <input type="hidden" {...register('type')} value={transactionType} />
          </div>

          {/* Montant */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm font-semibold text-slate-200">Montant (€)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 text-lg font-semibold h-12"
              {...register('amount')}
            />
            {errors.amount && (
              <p className="text-sm text-red-400">{errors.amount.message}</p>
            )}
          </div>

          {/* Catégorie */}
          <div className="space-y-2">
            <Label htmlFor="categoryId" className="text-sm font-semibold text-slate-200">Catégorie</Label>
            <Select 
              value={selectedCategory} 
              onValueChange={(value) => {
                setSelectedCategory(value)
                register('categoryId').onChange({ target: { value } })
              }}
            >
              <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white hover:bg-slate-700 transition-colors h-12">
                <SelectValue placeholder="Sélectionner une catégorie" className="text-slate-400" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {filteredCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id} className="text-white hover:bg-slate-700">
                    <span className="flex items-center gap-2">
                      <span>{category.icon}</span>
                      <span>{category.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" {...register('categoryId')} value={selectedCategory} />
            {errors.categoryId && (
              <p className="text-sm text-red-400">{errors.categoryId.message}</p>
            )}
          </div>

          {/* Compte */}
          <div className="space-y-2">
            <Label htmlFor="accountId" className="text-sm font-semibold text-slate-200">Compte</Label>
            <Select 
              value={selectedAccount} 
              onValueChange={(value) => {
                setSelectedAccount(value)
                register('accountId').onChange({ target: { value } })
              }}
            >
              <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white hover:bg-slate-700 transition-colors h-12">
                <SelectValue placeholder="Sélectionner un compte" className="text-slate-400" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id} className="text-white hover:bg-slate-700">
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" {...register('accountId')} value={selectedAccount} />
            {errors.accountId && (
              <p className="text-sm text-red-400">{errors.accountId.message}</p>
            )}
          </div>

          {/* Fréquence */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-200">Fréquence</Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'monthly', label: '📅 Mensuel' },
                { value: 'yearly', label: '🗓️ Annuel' },
                { value: 'weekly', label: '📆 Hebdomadaire' },
                { value: 'daily', label: '🔄 Quotidien' },
              ].map((freq) => (
                <button
                  key={freq.value}
                  type="button"
                  onClick={() => {
                    setFrequency(freq.value as any)
                    register('recurrenceFrequency').onChange({ target: { value: freq.value } })
                  }}
                  className={`px-3 py-3 rounded-xl border-2 transition-all duration-200 text-sm font-semibold ${
                    frequency === freq.value
                      ? 'border-blue-500/50 bg-gradient-to-br from-blue-500/20 to-blue-600/20 text-blue-300 shadow-lg shadow-blue-500/20'
                      : 'border-slate-600/50 bg-slate-700/30 text-slate-300 hover:border-slate-500 hover:bg-slate-700/50'
                  }`}
                >
                  {freq.label}
                </button>
              ))}
            </div>
            <input type="hidden" {...register('recurrenceFrequency')} value={frequency} />
          </div>

          {/* Jour de prélèvement (pour mensuel/annuel) */}
          {(frequency === 'monthly' || frequency === 'yearly') && (
            <div className="space-y-2">
              <Label htmlFor="recurrenceDay" className="text-sm font-semibold text-slate-200">
                {frequency === 'monthly' ? 'Jour du mois (1-31)' : 'Jour de l\'année (1-365)'}
              </Label>
              <Input
                id="recurrenceDay"
                type="number"
                min="1"
                max={frequency === 'monthly' ? '31' : '365'}
                placeholder={frequency === 'monthly' ? '1' : '1'}
                className="bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 h-12"
                {...register('recurrenceDay')}
              />
              {errors.recurrenceDay && (
                <p className="text-sm text-red-400">{errors.recurrenceDay.message}</p>
              )}
            </div>
          )}

          {/* Date de début */}
          <div className="space-y-2">
            <Label htmlFor="startDate" className="text-sm font-semibold text-slate-200">Date de début</Label>
            <Input
              id="startDate"
              type="date"
              className="bg-slate-700/50 border-slate-600/50 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 h-12"
              {...register('startDate')}
            />
            {errors.startDate && (
              <p className="text-sm text-red-400">{errors.startDate.message}</p>
            )}
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note" className="text-sm font-semibold text-slate-200">Note (optionnel)</Label>
            <Input
              id="note"
              placeholder="Ex: Abonnement Netflix, Salaire, etc."
              className="bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 h-12"
              {...register('note')}
            />
          </div>

          {/* Boutons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 h-12 text-base"
            >
              {isSubmitting ? 'Création...' : '✓ Créer la récurrence'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => reset()}
              className="bg-slate-700/50 border-slate-600/50 text-white hover:bg-slate-700 hover:border-slate-600 h-12 px-6 font-semibold"
            >
              Annuler
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
