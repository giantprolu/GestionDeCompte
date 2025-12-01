'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Filter, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import ExpenseForm from '@/components/ExpenseForm'
import ExpenseFilters from '@/components/ExpenseFilters'
import { useUserSettings } from '@/components/AppWrapper'

interface Account {
  id: string
  name: string
  type: string
}

interface Expense {
  id: string
  amount: number
  category: string
  date: string
  note: string | null
  accountId: string
  account: Account
}

export default function DepensesPage() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const { userType, isLoading: isLoadingSettings } = useUserSettings()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    accountId: '',
    category: '',
    startDate: '',
    endDate: '',
  })

  // Rediriger les visionneurs vers la page partage
  useEffect(() => {
    if (!isLoadingSettings && userType === 'viewer') {
      router.replace('/partage')
    }
  }, [userType, isLoadingSettings, router])

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchData()
    } else if (isLoaded && !isSignedIn) {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn])

  const fetchData = async () => {
    try {
      const [expensesRes, accountsRes] = await Promise.all([
        fetch('/api/expenses'),
        fetch('/api/accounts'),
      ])
      
      if (!expensesRes.ok || !accountsRes.ok) return
      
      const expensesData = await expensesRes.json()
      const accountsData = await accountsRes.json()
      
      setExpenses(Array.isArray(expensesData) ? expensesData : [])
      setAccounts(Array.isArray(accountsData) ? accountsData : [])
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) return

    try {
      await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      setExpenses(expenses.filter(e => e.id !== id))
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
    }
  }

  const handleAddExpense = async (expense: Expense) => {
    setExpenses([expense, ...expenses])
    setShowForm(false)
  }

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (filters.accountId) params.append('accountId', filters.accountId)
    if (filters.category) params.append('category', filters.category)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)

    fetch(`/api/expenses?${params.toString()}`)
      .then(res => res.json())
      .then(data => setExpenses(data))
      .catch(error => console.error('Erreur:', error))
  }

  const resetFilters = () => {
    setFilters({ accountId: '', category: '', startDate: '', endDate: '' })
    fetchData()
  }

  const filteredExpenses = expenses

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Dépenses</h1>
          <p className="text-slate-500 mt-1">Gérez vos transactions</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Filtres
          </Button>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nouvelle dépense
          </Button>
        </div>
      </div>

      {showFilters && (
        <ExpenseFilters
          filters={filters}
          setFilters={setFilters}
          accounts={accounts}
          onApply={applyFilters}
          onReset={resetFilters}
        />
      )}

      {showForm && (
        <ExpenseForm
          accounts={accounts}
          onSuccess={handleAddExpense}
          onCancel={() => setShowForm(false)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Liste des dépenses ({filteredExpenses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              Aucune dépense enregistrée
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExpenses.map((expense, index) => (
                <motion.div
                  key={expense.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-semibold text-slate-800">
                        {expense.amount.toFixed(2)} €
                      </div>
                      <div className="px-2 py-1 bg-white rounded text-xs font-medium text-slate-600">
                        {expense.category}
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        expense.account.type === 'ponctuel' 
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {expense.account.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                      <span>{new Date(expense.date).toLocaleDateString('fr-FR')}</span>
                      {expense.note && <span>• {expense.note}</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteExpense(expense.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
