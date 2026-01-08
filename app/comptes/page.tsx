'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { getBaseInitial } from '@/lib/balances'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Wallet, Save, Pencil, X, Share2, Plus, Trash2, CreditCard, PiggyBank, ChevronRight, Calculator } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUserSettings } from '@/components/AppWrapper'

interface Account {
  id: string
  name: string
  type: string
  initialBalance: number
  currentBalance?: number
  excludeFromPrevisionnel?: boolean
  isOwner?: boolean
  permission?: 'view' | 'edit'
  shareId?: string
  ownerUserId?: string
}

export default function ComptesPage() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const { userType, isLoading: isLoadingSettings } = useUserSettings()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')

  // Rediriger les visionneurs vers la page partage
  useEffect(() => {
    if (!isLoadingSettings && userType === 'viewer') {
      router.replace('/partage')
    }
  }, [userType, isLoadingSettings, router])

  // États pour le formulaire d'ajout
  const [showAddForm, setShowAddForm] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountType, setNewAccountType] = useState<'ponctuel' | 'obligatoire'>('ponctuel')
  const [newAccountBalance, setNewAccountBalance] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchAccounts()
    } else if (isLoaded && !isSignedIn) {
      setLoading(false)
    }
  }, [isLoaded, isSignedIn])

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts')
      if (!response.ok) return
      const data = await response.json()
      setAccounts(Array.isArray(data) ? data : [])

      // Initialiser les balances
      const initialBalances: Record<string, number> = {}
      data.forEach((acc: Account) => {
        initialBalances[acc.id] = acc.initialBalance
      })
      setBalances(initialBalances)
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculer le solde courant pour chaque compte (utilise l'utilitaire centralisé)
  const getCurrentBalance = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId)
    if (!account) return 0
    return getBaseInitial(account, balances)
  }

  const startEditing = (accountId: string, currentBalance: number) => {
    setEditingId(accountId)
    setEditingValue(currentBalance.toString().replace('.', ','))
  }

  const handleUpdateBalance = async (accountId: string) => {
    const numericValue = parseFloat(editingValue.replace(',', '.')) || 0
    try {
      const response = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: accountId,
          initialBalance: numericValue,
        }),
      })

      if (response.ok) {
        fetchAccounts()
        setEditingId(null)
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error)
      alert('Erreur lors de la mise à jour')
    }
  }

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      alert('Veuillez entrer un nom de compte')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAccountName.trim(),
          type: newAccountType,
          initialBalance: parseFloat(newAccountBalance.replace(',', '.')) || 0,
        }),
      })

      if (response.ok) {
        setNewAccountName('')
        setNewAccountType('ponctuel')
        setNewAccountBalance('')
        setShowAddForm(false)
        fetchAccounts()
      } else {
        const error = await response.json()
        alert('Erreur: ' + (error.error || 'Impossible de créer le compte'))
      }
    } catch (error) {
      console.error('Erreur lors de la création:', error)
      alert('Erreur lors de la création du compte')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteAccount = async (accountId: string, accountName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le compte "${accountName}" ? Toutes les transactions associées seront également supprimées.`)) {
      return
    }

    try {
      const response = await fetch(`/api/accounts?id=${accountId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchAccounts()
      } else {
        const error = await response.json()
        alert('Erreur: ' + (error.error || 'Impossible de supprimer le compte'))
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
      alert('Erreur lors de la suppression du compte')
    }
  }

  const handleTogglePrevisionnel = async (accountId: string, currentValue: boolean) => {
    try {
      const response = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: accountId,
          excludeFromPrevisionnel: !currentValue,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Recharger les comptes depuis le serveur pour avoir les vraies valeurs
        await fetchAccounts()
      } else {
        // Afficher l'erreur - souvent c'est parce que la colonne n'existe pas en base
        const errorMsg = data.error || 'Impossible de mettre à jour'
        if (errorMsg.includes('exclude_from_previsionnel') || errorMsg.includes('column')) {
          alert('Erreur: La colonne exclude_from_previsionnel n\'existe pas en base. Exécutez la migration SQL: ALTER TABLE accounts ADD COLUMN exclude_from_previsionnel BOOLEAN DEFAULT FALSE;')
        } else {
          alert('Erreur: ' + errorMsg)
        }
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error)
      alert('Erreur lors de la mise à jour. Vérifiez que la migration SQL a été exécutée.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Wallet className="w-12 h-12 text-blue-400" />
          <p className="text-slate-400">Chargement des comptes...</p>
        </div>
      </div>
    )
  }

  // Calculer les totaux
  const totalBalance = accounts
    .filter(acc => acc.isOwner !== false)
    .reduce((sum, acc) => sum + getCurrentBalance(acc.id), 0)

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8 px-3 sm:px-4 md:px-6 pt-4">
      {/* Header avec titre et bouton d'ajout côte à côte */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
            <Wallet className="w-7 h-7 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Mes Comptes</h1>
            <p className="text-slate-400 text-sm">
              {accounts.length} compte{accounts.length > 1 ? 's' : ''} • Solde total: <span className={`font-semibold ${totalBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{totalBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
            </p>
          </div>
        </div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            data-tutorial="create-account-button"
            className={`w-full sm:w-auto font-semibold shadow-lg hover:shadow-xl transition-all duration-200 px-5 py-5 text-base ${showAddForm
                ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
              }`}
          >
            {showAddForm ? (
              <>
                <X className="w-5 h-5 mr-2" />
                Annuler
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 mr-2" />
                Nouveau compte
              </>
            )}
          </Button>
        </motion.div>
      </div>

      {/* Formulaire d'ajout de compte */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-2 border-green-400/30 bg-gradient-to-br from-slate-800/95 to-slate-900/95 shadow-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-b border-slate-700/50">
                <CardTitle className="text-white flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-green-500/20">
                    <PiggyBank className="w-5 h-5 text-green-400" />
                  </div>
                  Créer un nouveau compte
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Nom du compte */}
                <div className="space-y-2">
                  <Label className="text-slate-200 font-semibold flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-400" />
                    Nom du compte
                  </Label>
                  <Input
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="Ex: Compte courant, Livret A, Carte resto..."
                    className="bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-400 h-12 text-base focus:border-green-500 focus:ring-green-500/20"
                  />
                </div>

                {/* Type de compte */}
                <div className="space-y-3">
                  <Label className="text-slate-200 font-semibold">Type de compte</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setNewAccountType('ponctuel')}
                      className={`relative p-5 rounded-2xl border-2 transition-all duration-200 text-left overflow-hidden ${newAccountType === 'ponctuel'
                          ? 'border-blue-500 bg-gradient-to-br from-blue-500/20 to-blue-600/10 shadow-lg shadow-blue-500/20'
                          : 'border-slate-600/50 bg-slate-700/30 hover:border-slate-500 hover:bg-slate-700/50'
                        }`}
                    >
                      {newAccountType === 'ponctuel' && (
                        <motion.div
                          layoutId="accountTypeIndicator"
                          className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent"
                        />
                      )}
                      <div className="relative flex items-start gap-4">
                        <div className={`p-3 rounded-xl ${newAccountType === 'ponctuel' ? 'bg-blue-500/30' : 'bg-slate-600/50'}`}>
                          <span className="text-2xl">🛒</span>
                        </div>
                        <div className="flex-1">
                          <div className={`font-bold text-lg ${newAccountType === 'ponctuel' ? 'text-blue-300' : 'text-slate-300'}`}>
                            Occasionnel
                          </div>
                          <div className={`text-sm mt-1 ${newAccountType === 'ponctuel' ? 'text-blue-300/70' : 'text-slate-400'}`}>
                            Dépenses variables du quotidien, courses, loisirs...
                          </div>
                        </div>
                        {newAccountType === 'ponctuel' && (
                          <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-blue-400" />
                        )}
                      </div>
                    </motion.button>

                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setNewAccountType('obligatoire')}
                      className={`relative p-5 rounded-2xl border-2 transition-all duration-200 text-left overflow-hidden ${newAccountType === 'obligatoire'
                          ? 'border-emerald-500 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 shadow-lg shadow-emerald-500/20'
                          : 'border-slate-600/50 bg-slate-700/30 hover:border-slate-500 hover:bg-slate-700/50'
                        }`}
                    >
                      {newAccountType === 'obligatoire' && (
                        <motion.div
                          layoutId="accountTypeIndicator"
                          className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent"
                        />
                      )}
                      <div className="relative flex items-start gap-4">
                        <div className={`p-3 rounded-xl ${newAccountType === 'obligatoire' ? 'bg-emerald-500/30' : 'bg-slate-600/50'}`}>
                          <span className="text-2xl">📋</span>
                        </div>
                        <div className="flex-1">
                          <div className={`font-bold text-lg ${newAccountType === 'obligatoire' ? 'text-emerald-300' : 'text-slate-300'}`}>
                            Obligatoire
                          </div>
                          <div className={`text-sm mt-1 ${newAccountType === 'obligatoire' ? 'text-emerald-300/70' : 'text-slate-400'}`}>
                            Charges fixes, loyer, abonnements, factures...
                          </div>
                        </div>
                        {newAccountType === 'obligatoire' && (
                          <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-emerald-400" />
                        )}
                      </div>
                    </motion.button>
                  </div>
                </div>

                {/* Solde initial */}
                <div className="space-y-2">
                  <Label className="text-slate-200 font-semibold flex items-center gap-2">
                    💰 Solde initial
                  </Label>
                  <div className="relative">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={newAccountBalance}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.,]/g, '')
                        setNewAccountBalance(value)
                      }}
                      placeholder="0"
                      className="bg-slate-700/50 border-slate-600/50 text-white h-12 text-lg font-semibold pr-12 focus:border-green-500 focus:ring-green-500/20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">€</span>
                  </div>
                  <p className="text-xs text-slate-400">Montant disponible actuellement sur ce compte</p>
                </div>

                {/* Boutons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    onClick={handleCreateAccount}
                    disabled={isCreating || !newAccountName.trim()}
                    className="flex-1 h-12 gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                  >
                    {isCreating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Création...
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Créer le compte
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => setShowAddForm(false)}
                    variant="outline"
                    className="h-12 px-6 bg-slate-700/50 border-slate-600/50 text-white hover:bg-slate-700 hover:border-slate-600"
                  >
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Liste des comptes */}
      {accounts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 border-2">
            <CardContent className="py-16 text-center">
              <div className="inline-flex p-4 rounded-full bg-slate-700/50 mb-6">
                <Wallet className="w-12 h-12 text-slate-500" />
              </div>
              <h3 className="text-xl font-semibold text-slate-300 mb-2">Aucun compte configuré</h3>
              <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                Créez votre premier compte pour commencer à suivre vos finances
              </p>
              <Button
                onClick={() => setShowAddForm(true)}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white gap-2"
              >
                <Plus className="w-5 h-5" />
                Créer mon premier compte
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
          {accounts.map((account, index) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex-shrink-0 w-80"
            >
              <Card className={`h-full border bg-gradient-to-br from-slate-800/95 to-slate-900/95 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden ${account.type === 'ponctuel'
                  ? 'border-blue-500/30 hover:border-blue-500/50'
                  : 'border-emerald-500/30 hover:border-emerald-500/50'
                }`}>
                <CardContent className="p-4">
                  {editingId === account.id ? (
                    // Mode édition
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${account.type === 'ponctuel' ? 'bg-blue-500/20' : 'bg-emerald-500/20'}`}>
                          <Pencil className={`w-5 h-5 ${account.type === 'ponctuel' ? 'text-blue-400' : 'text-emerald-400'}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{account.name}</h3>
                          <p className="text-sm text-slate-400">Modifier le solde initial</p>
                        </div>
                      </div>

                      <div className="relative">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={editingValue}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.,]/g, '')
                            setEditingValue(value)
                          }}
                          className="bg-slate-700/50 border-slate-600/50 text-white text-2xl font-bold h-14 pr-12 focus:border-blue-500 focus:ring-blue-500/20"
                          autoFocus
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl font-semibold">€</span>
                      </div>

                      <div className="flex gap-3">
                        <Button
                          onClick={() => handleUpdateBalance(account.id)}
                          className="flex-1 h-11 gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-lg"
                        >
                          <Save className="w-4 h-4" />
                          Enregistrer
                        </Button>
                        <Button
                          onClick={() => {
                            setEditingId(null)
                            setEditingValue('')
                          }}
                          variant="outline"
                          className="h-11 px-6 bg-slate-700/50 border-slate-600/50 text-white hover:bg-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    // Mode affichage - Layout vertical pour cards en ligne
                    <div className="flex flex-col h-full">
                      {/* Header avec nom et badges */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${account.type === 'ponctuel'
                              ? 'bg-blue-500/20'
                              : 'bg-emerald-500/20'
                            }`}>
                            {account.type === 'ponctuel' ? (
                              <CreditCard className="w-5 h-5 text-blue-400" />
                            ) : (
                              <Wallet className="w-5 h-5 text-emerald-400" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-white">{account.name}</h3>
                            <span className={`text-xs font-medium ${account.type === 'ponctuel' ? 'text-blue-400' : 'text-emerald-400'
                              }`}>
                              {account.type === 'ponctuel' ? 'Occasionnel' : 'Obligatoire'}
                            </span>
                          </div>
                        </div>
                        {/* Badges */}
                        <div className="flex flex-col gap-1">
                          {!account.isOwner && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-medium">
                              <Share2 className="w-2.5 h-2.5" />
                              Partagé
                            </span>
                          )}
                          {account.excludeFromPrevisionnel && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[10px] font-medium">
                              <Calculator className="w-2.5 h-2.5" />
                              Exclu
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Solde actuel - Prominent */}
                      <div className="flex-1 flex flex-col justify-center py-3 border-y border-slate-700/50">
                        <p className="text-xs text-slate-400 mb-1">Solde actuel</p>
                        <p className={`text-3xl font-bold ${getCurrentBalance(account.id) >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                          {getCurrentBalance(account.id).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Initial: {(balances[account.id] ?? account.initialBalance).toFixed(2)} €
                        </p>
                      </div>

                      {/* Actions */}
                      {(account.isOwner || account.permission === 'edit') && (
                        <div className="flex items-center justify-end gap-1 pt-3">
                          <Button
                            onClick={() => handleTogglePrevisionnel(account.id, account.excludeFromPrevisionnel || false)}
                            variant="ghost"
                            size="icon"
                            title={account.excludeFromPrevisionnel ? 'Inclure dans le prévisionnel' : 'Exclure du prévisionnel'}
                            className={`h-8 w-8 rounded-lg transition-all ${account.excludeFromPrevisionnel
                                ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400'
                                : 'hover:bg-slate-700 text-slate-400 hover:text-white'
                              }`}
                          >
                            <Calculator className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => startEditing(account.id, balances[account.id] ?? account.initialBalance)}
                            variant="ghost"
                            size="icon"
                            title="Modifier le solde"
                            className="h-8 w-8 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-all"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {account.isOwner && (
                            <Button
                              onClick={() => handleDeleteAccount(account.id, account.name)}
                              variant="ghost"
                              size="icon"
                              title="Supprimer"
                              className="h-8 w-8 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Card d'info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-4"
      >
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-blue-400/20">
          <CardContent className="py-5 px-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-xl bg-blue-500/20 shrink-0">
                <span className="text-xl">💡</span>
              </div>
              <div>
                <h3 className="font-semibold text-blue-300 mb-1">Comment ça fonctionne ?</h3>
                <p className="text-sm text-slate-400">
                  Le <strong className="text-blue-300">solde initial</strong> est le montant de départ.
                  Le <strong className="text-green-300">solde actuel</strong> est calculé automatiquement en fonction de vos transactions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-orange-400/20">
          <CardContent className="py-5 px-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-xl bg-orange-500/20 shrink-0">
                <Calculator className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-orange-300 mb-1">Exclusion du prévisionnel</h3>
                <p className="text-sm text-slate-400">
                  Cliquez sur l&apos;icône <Calculator className="w-4 h-4 inline text-orange-400" /> pour exclure un compte du calcul du prévisionnel.
                  <strong className="text-orange-300"> Utile pour les cartes ticket resto</strong> ou autres comptes que vous ne voulez pas inclure dans votre budget.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
