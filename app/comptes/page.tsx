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
  const [newAccountBalance, setNewAccountBalance] = useState(0)
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

  const handleUpdateBalance = async (accountId: string) => {
    try {
      const response = await fetch('/api/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: accountId,
          initialBalance: balances[accountId],
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
          initialBalance: newAccountBalance,
        }),
      })

      if (response.ok) {
        setNewAccountName('')
        setNewAccountType('ponctuel')
        setNewAccountBalance(0)
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
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8">
      {/* Header avec total */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 p-6 md:p-8 shadow-2xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOGMxNi41NjkgMCAzMC0xMy40MzEgMzAtMzAgMC05Ljk0MS04LjA1OS0xOC0xOC0xOHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Mes Comptes</h1>
              </div>
              <p className="text-blue-100 text-sm md:text-base">
                {accounts.length} compte{accounts.length > 1 ? 's' : ''} • Gérez vos soldes
              </p>
            </div>
            <div className="text-right">
              <p className="text-blue-200 text-sm font-medium mb-1">Solde total</p>
              <p className={`text-3xl md:text-4xl font-bold ${totalBalance >= 0 ? 'text-white' : 'text-red-300'}`}>
                {totalBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bouton ajouter un compte */}
      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`w-full p-4 rounded-2xl border-2 border-dashed transition-all duration-300 flex items-center justify-center gap-3 ${
            showAddForm 
              ? 'border-red-400/50 bg-red-500/10 text-red-300 hover:bg-red-500/20' 
              : 'border-green-400/50 bg-green-500/10 text-green-300 hover:bg-green-500/20 hover:border-green-400'
          }`}
        >
          {showAddForm ? (
            <>
              <X className="w-5 h-5" />
              <span className="font-semibold">Annuler</span>
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              <span className="font-semibold">Ajouter un nouveau compte</span>
            </>
          )}
        </button>
      </motion.div>

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
                      className={`relative p-5 rounded-2xl border-2 transition-all duration-200 text-left overflow-hidden ${
                        newAccountType === 'ponctuel'
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
                      className={`relative p-5 rounded-2xl border-2 transition-all duration-200 text-left overflow-hidden ${
                        newAccountType === 'obligatoire'
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
                      type="number"
                      step="0.01"
                      value={newAccountBalance}
                      onChange={(e) => setNewAccountBalance(parseFloat(e.target.value) || 0)}
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
        <div className="space-y-3 sm:space-y-4">
          {accounts.map((account, index) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`group border-2 bg-gradient-to-br from-slate-800/95 to-slate-900/95 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden ${
                account.type === 'ponctuel' 
                  ? 'border-blue-400/20 hover:border-blue-400/40' 
                  : 'border-emerald-400/20 hover:border-emerald-400/40'
              }`}>
                {/* Barre de couleur en haut */}
                <div className={`h-1 ${account.type === 'ponctuel' ? 'bg-gradient-to-r from-blue-500 to-blue-400' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'}`} />
                
                <CardContent className="p-3 sm:p-5">
                  {editingId === account.id ? (
                    // Mode édition amélioré
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-3 mb-4">
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
                          type="number"
                          step="0.01"
                          value={balances[account.id] || 0}
                          onChange={(e) =>
                            setBalances({
                              ...balances,
                              [account.id]: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="bg-slate-700/50 border-slate-600/50 text-white text-2xl font-bold h-16 pr-12 focus:border-blue-500 focus:ring-blue-500/20"
                          autoFocus
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl font-semibold">€</span>
                      </div>
                      
                      <div className="flex gap-3">
                        <Button
                          onClick={() => handleUpdateBalance(account.id)}
                          className="flex-1 h-12 gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold shadow-lg"
                        >
                          <Save className="w-4 h-4" />
                          Enregistrer
                        </Button>
                        <Button
                          onClick={() => {
                            setEditingId(null)
                            setBalances({
                              ...balances,
                              [account.id]: account.initialBalance,
                            })
                          }}
                          variant="outline"
                          className="h-12 px-6 bg-slate-700/50 border-slate-600/50 text-white hover:bg-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    // Mode affichage - Responsive
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                      {/* Info compte */}
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl shrink-0 ${
                          account.type === 'ponctuel' 
                            ? 'bg-blue-500/20' 
                            : 'bg-emerald-500/20'
                        }`}>
                          {account.type === 'ponctuel' ? (
                            <span className="text-xl sm:text-2xl">🛒</span>
                          ) : (
                            <span className="text-xl sm:text-2xl">📋</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base sm:text-lg text-white truncate">{account.name}</h3>
                            {!account.isOwner && (
                              <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-400/30 text-[10px] sm:text-xs font-semibold shrink-0">
                                <Share2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                Partagé
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1 flex-wrap">
                            <span className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full ${
                              account.type === 'ponctuel'
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {account.type === 'ponctuel' ? 'Occasionnel' : 'Obligatoire'}
                            </span>
                            {account.excludeFromPrevisionnel && (
                              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300">
                                <Calculator className="w-2.5 h-2.5" />
                                Exclu prévisionnel
                              </span>
                            )}
                            <span className="text-[10px] sm:text-xs text-slate-500">
                              Initial: {(balances[account.id] ?? account.initialBalance).toFixed(2)} €
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Solde et actions - Pleine largeur sur mobile */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0 pl-11 sm:pl-0">
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] sm:text-xs text-slate-400 mb-0.5">Solde actuel</p>
                          <p className={`text-xl sm:text-2xl md:text-3xl font-bold ${
                            getCurrentBalance(account.id) >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {getCurrentBalance(account.id).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </p>
                        </div>
                        
                        {(account.isOwner || account.permission === 'edit') && (
                          <div className="flex items-center gap-1">
                            <Button
                              onClick={() => handleTogglePrevisionnel(account.id, account.excludeFromPrevisionnel || false)}
                              variant="ghost"
                              size="icon"
                              title={account.excludeFromPrevisionnel ? 'Inclure dans le prévisionnel' : 'Exclure du prévisionnel'}
                              className={`h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl border transition-all ${
                                account.excludeFromPrevisionnel 
                                  ? 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/50 text-orange-400' 
                                  : 'bg-slate-700/30 hover:bg-purple-500/20 border-slate-600/30 hover:border-purple-500/50 text-slate-400 hover:text-purple-400'
                              }`}
                            >
                              <Calculator className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </Button>
                            <Button
                              onClick={() => setEditingId(account.id)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-slate-700/30 hover:bg-blue-500/20 border border-slate-600/30 hover:border-blue-500/50 text-slate-400 hover:text-blue-400 transition-all"
                            >
                              <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </Button>
                            {account.isOwner && (
                              <Button
                                onClick={() => handleDeleteAccount(account.id, account.name)}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-slate-700/30 hover:bg-red-500/20 border border-slate-600/30 hover:border-red-500/50 text-slate-400 hover:text-red-400 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
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
