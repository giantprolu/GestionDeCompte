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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const transactionSchema = z.object({
  amount: z.string().min(1, 'Le montant est requis'),
  type: z.enum(['income', 'expense']),
  categoryId: z.string().min(1, 'La catégorie est requise'),
  accountId: z.string().min(1, 'Le compte est requis'),
  date: z.string().min(1, 'La date est requise'),
  note: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceFrequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
  recurrenceDay: z.number().optional(),
})

type TransactionFormData = z.infer<typeof transactionSchema>

interface Category {
  id: string
  name: string
  type: string
  icon: string
  color: string
}

interface Account {
  id: string
  name: string
}

interface TransactionFormProps {
  accounts: Account[]
  onSuccess: () => void
  onCancel: () => void
}

export default function TransactionForm({ accounts, onSuccess, onCancel }: TransactionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense')
  const [isRecurring, setIsRecurring] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      type: 'expense',
      isRecurring: false,
    },
  })

  const accountId = watch('accountId')
  const categoryId = watch('categoryId')
  const recurrenceFrequency = watch('recurrenceFrequency')

  useEffect(() => {
    fetchCategories(transactionType)
  }, [transactionType])

  const fetchCategories = async (type: 'income' | 'expense') => {
    try {
      const res = await fetch(`/api/categories?type=${type}`)
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error)
    }
  }

  const handleTypeChange = (type: 'income' | 'expense') => {
    setTransactionType(type)
    setValue('type', type)
    setValue('categoryId', '')
  }

  const onSubmit = async (data: TransactionFormData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          amount: parseFloat(data.amount),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Erreur API:', errorData)
        throw new Error(errorData.error || 'Erreur lors de la création')
      }

      onSuccess()
    } catch (error) {
      console.error('Erreur:', error)
      alert(error instanceof Error ? error.message : 'Erreur lors de la création de la transaction')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full border-2 border-slate-700/50 bg-gradient-to-br from-slate-800/95 to-slate-900/95 shadow-2xl backdrop-blur-sm">
      <CardHeader className="border-b border-slate-700/50 pb-4">
        <CardTitle className="text-xl font-bold text-white">Nouvelle transaction</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-slate-200">Type de transaction</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
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
                onClick={() => handleTypeChange('income')}
                className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 font-semibold ${
                  transactionType === 'income'
                    ? 'border-green-500/50 bg-gradient-to-br from-green-500/20 to-green-600/20 text-green-300 shadow-lg shadow-green-500/20'
                    : 'border-slate-600/50 bg-slate-700/30 text-slate-300 hover:border-slate-500 hover:bg-slate-700/50'
                }`}
              >
                💰 Revenu
              </button>
            </div>
          </div>

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
              <p className="text-sm text-red-400 mt-1">{errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryId" className="text-sm font-semibold text-slate-200">Catégorie</Label>
            <Select value={categoryId} onValueChange={(value) => setValue('categoryId', value)}>
              <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white hover:bg-slate-700 transition-colors h-11">
                <SelectValue placeholder="Sélectionner une catégorie" className="text-slate-400" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id} className="text-white hover:bg-slate-700">
                    <span className="flex items-center gap-2">
                      <span>{category.icon}</span>
                      <span>{category.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && (
              <p className="text-sm text-red-400 mt-1">{errors.categoryId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountId" className="text-sm font-semibold text-slate-200">Compte</Label>
            <Select value={accountId} onValueChange={(value) => setValue('accountId', value)}>
              <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white hover:bg-slate-700 transition-colors h-11">
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
            {errors.accountId && (
              <p className="text-sm text-red-400 mt-1">{errors.accountId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="date" className="text-sm font-semibold text-slate-200">Date</Label>
            <Input 
              id="date" 
              type="date" 
              className="bg-slate-700/50 border-slate-600/50 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 h-11 text-sm md:text-base" 
              {...register('date')} 
            />
            {errors.date && (
              <p className="text-sm text-red-400 mt-1">{errors.date.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="note" className="text-sm font-semibold text-slate-200">Note (optionnel)</Label>
            <Input 
              id="note" 
              placeholder="Ajouter une note..." 
              className="bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 h-11" 
              {...register('note')} 
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 h-12 text-base"
            >
              {isSubmitting ? 'Ajout...' : 'Ajouter'}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
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
