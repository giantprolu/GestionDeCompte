'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Tag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  icon: string
  color: string
  is_custom?: boolean
  user_id?: string
}

const EMOJI_LIST = ['📦', '🛒', '🍔', '🏠', '🚗', '✈️', '🎮', '📱', '👕', '💊', '📚', '🎁', '💼', '🏥', '🎬', '🎵', '💰', '🏦', '💳', '📈']

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newCategory, setNewCategory] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
    icon: '📦',
  })
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newCategory.name.trim()) {
      alert('Veuillez entrer un nom de catégorie')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCategory),
      })

      if (response.ok) {
        setNewCategory({ name: '', type: 'expense', icon: '📦' })
        setShowForm(false)
        fetchCategories()
      } else {
        const error = await response.json()
        alert('Erreur: ' + error.error)
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la création')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) return

    try {
      const response = await fetch(`/api/categories?id=${categoryId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchCategories()
      } else {
        const error = await response.json()
        alert('Erreur: ' + error.error)
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  const customCategories = categories.filter(cat => cat.is_custom)
  const defaultCategories = categories.filter(cat => !cat.is_custom)

  if (loading) {
    return <div className="text-center py-8 text-slate-400">Chargement...</div>
  }

  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Tag className="w-5 h-5 text-blue-400" />
          Catégories personnalisées
        </CardTitle>
        <p className="text-sm text-slate-400">
          Créez vos propres catégories pour mieux organiser vos finances
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bouton d'ajout */}
        <Button
          onClick={() => setShowForm(!showForm)}
          className={`w-full ${showForm ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {showForm ? 'Annuler' : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle catégorie
            </>
          )}
        </Button>

        {/* Formulaire d'ajout */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600"
            >
              <div className="space-y-2">
                <Label className="text-slate-200">Nom de la catégorie</Label>
                <Input
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="Ex: Sport, Cinéma, Freelance..."
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-200">Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCategory({ ...newCategory, type: 'expense' })}
                    className={`px-4 py-2 rounded-lg border-2 font-semibold transition-all ${
                      newCategory.type === 'expense'
                        ? 'border-red-500 bg-red-500/20 text-red-300'
                        : 'border-slate-600 bg-slate-700 text-slate-300'
                    }`}
                  >
                    💸 Dépense
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCategory({ ...newCategory, type: 'income' })}
                    className={`px-4 py-2 rounded-lg border-2 font-semibold transition-all ${
                      newCategory.type === 'income'
                        ? 'border-green-500 bg-green-500/20 text-green-300'
                        : 'border-slate-600 bg-slate-700 text-slate-300'
                    }`}
                  >
                    💰 Revenu
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-200">Icône</Label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewCategory({ ...newCategory, icon: emoji })}
                      className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                        newCategory.icon === emoji
                          ? 'border-blue-500 bg-blue-500/20'
                          : 'border-slate-600 bg-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleCreate}
                disabled={isCreating || !newCategory.name.trim()}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isCreating ? 'Création...' : 'Créer la catégorie'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Liste des catégories personnalisées */}
        {customCategories.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-300">Mes catégories</h4>
            <div className="space-y-2">
              {customCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{category.icon}</span>
                    <span className="text-white font-medium">{category.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      category.type === 'income'
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}>
                      {category.type === 'income' ? 'Revenu' : 'Dépense'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(category.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Liste des catégories par défaut */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-400">Catégories par défaut</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {defaultCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg text-sm"
              >
                <span>{category.icon}</span>
                <span className="text-slate-300 truncate">{category.name}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
