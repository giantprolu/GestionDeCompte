'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Tag, ArrowLeft, Pencil, X, Check, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  icon: string
  color: string
  is_custom?: boolean
  user_id?: string
}

const EMOJI_LIST = [
  '📦', '🛒', '🍔', '🏠', '🚗', '✈️', '🎮', '📱', '👕', '💊',
  '📚', '🎁', '💼', '🏥', '🎬', '🎵', '💰', '🏦', '💳', '📈',
  '🏋️', '🎨', '🎭', '🎤', '🎧', '📸', '🖥️', '🛠️', '🧹', '🐕',
  '🏖️', '🎂', '☕', '🍕', '🍺', '💅', '🧘', '🚌', '⚡', '💧'
]

const COLOR_LIST = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#22C55E', '#0EA5E9', '#E11D48'
]

export default function CategoriesPage() {
  const { isSignedIn, isLoaded } = useUser()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [newCategory, setNewCategory] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
    icon: '📦',
    color: '#3B82F6',
  })
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchCategories()
    } else if (isLoaded && !isSignedIn) {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn])

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
        setNewCategory({ name: '', type: 'expense', icon: '📦', color: '#3B82F6' })
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

  const handleUpdate = async () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      alert('Veuillez entrer un nom de catégorie')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/categories?id=${editingCategory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingCategory.name,
          icon: editingCategory.icon,
          color: editingCategory.color,
        }),
      })

      if (response.ok) {
        setEditingCategory(null)
        fetchCategories()
      } else {
        const error = await response.json()
        alert('Erreur: ' + error.error)
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la modification')
    } finally {
      setIsSaving(false)
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

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Card className="border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Connexion requise</h3>
            <p className="text-muted-foreground text-center text-sm">
              Veuillez vous connecter pour gérer vos catégories.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/transactions">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Tag className="w-6 h-6 text-blue-400" />
            Catégories personnalisées
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Créez et gérez vos catégories pour mieux organiser vos finances
          </p>
        </div>
      </div>

      {/* Bouton d'ajout */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700" data-tutorial="add-category-card">
        <CardContent className="pt-6">
          <Button
            onClick={() => setShowForm(!showForm)}
            data-tutorial="add-category-button"
            className={`w-full ${showForm ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {showForm ? (
              <>
                <X className="w-4 h-4 mr-2" />
                Annuler
              </>
            ) : (
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
                className="mt-4 space-y-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600"
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
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-800/50 rounded-lg">
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

                <div className="space-y-2">
                  <Label className="text-slate-200">Couleur</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_LIST.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewCategory({ ...newCategory, color })}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          newCategory.color === color
                            ? 'border-white scale-110'
                            : 'border-transparent hover:border-slate-400'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleCreate}
                  disabled={isCreating || !newCategory.name.trim()}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Créer la catégorie
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Liste des catégories personnalisées */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg">Mes catégories ({customCategories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {customCategories.length === 0 ? (
            <p className="text-center text-slate-400 py-8">
              Vous n&apos;avez pas encore créé de catégorie personnalisée
            </p>
          ) : (
            <div className="space-y-3">
              {customCategories.map((category) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg border border-slate-600"
                >
                  {editingCategory?.id === category.id ? (
                    // Mode édition
                    <div className="flex-1 space-y-3">
                      <Input
                        value={editingCategory.name}
                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                        className="bg-slate-600 border-slate-500 text-white"
                      />
                      <div className="flex flex-wrap gap-2">
                        {EMOJI_LIST.slice(0, 20).map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setEditingCategory({ ...editingCategory, icon: emoji })}
                            className={`w-8 h-8 text-lg rounded border-2 transition-all ${
                              editingCategory.icon === emoji
                                ? 'border-blue-500 bg-blue-500/20'
                                : 'border-slate-600 bg-slate-700'
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleUpdate}
                          disabled={isSaving}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingCategory(null)}
                          className="border-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Mode affichage
                    <>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                          style={{ backgroundColor: category.color + '30' }}
                        >
                          {category.icon}
                        </div>
                        <div>
                          <span className="text-white font-medium">{category.name}</span>
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                            category.type === 'income'
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}>
                            {category.type === 'income' ? 'Revenu' : 'Dépense'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCategory(category)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(category.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Liste des catégories par défaut */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg text-slate-400">Catégories par défaut ({defaultCategories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {defaultCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg"
              >
                <div
                  className="w-8 h-8 rounded flex items-center justify-center text-lg"
                  style={{ backgroundColor: category.color + '20' }}
                >
                  {category.icon}
                </div>
                <div className="min-w-0">
                  <span className="text-slate-300 text-sm truncate block">{category.name}</span>
                  <span className={`text-xs ${category.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                    {category.type === 'income' ? 'Revenu' : 'Dépense'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
