'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Share2, UserPlus, Eye, Edit, Trash2, Users } from 'lucide-react'
import { motion } from 'framer-motion'

interface Share {
  id: string
  shared_with_user_id: string
  permission: 'view' | 'edit'
  created_at: string
  username?: string
}

export default function PartagePage() {
  const [shares, setShares] = useState<Share[]>([])
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [permission, setPermission] = useState<'view' | 'edit'>('view')
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchShares()
  }, [])

  const fetchShares = async () => {
    try {
      const response = await fetch('/api/accounts/share')
      if (response.ok) {
        const data = await response.json()
        setShares(data)
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des partages:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddShare = async () => {
    if (!username.trim()) {
      setError('Veuillez entrer un nom d\'utilisateur')
      return
    }

    setAdding(true)
    setError('')

    try {
      const response = await fetch('/api/accounts/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharedWithUserId: username.trim(),
          permission
        })
      })

      if (response.ok) {
        setUsername('')
        setPermission('view')
        await fetchShares()
      } else {
        const data = await response.json()
        setError(data.error || 'Erreur lors du partage')
      }
    } catch (error) {
      console.error('Erreur lors du partage:', error)
      setError('Erreur lors du partage')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteShare = async (shareId: string) => {
    if (!confirm('Voulez-vous vraiment supprimer ce partage ?')) return

    try {
      const response = await fetch(`/api/accounts/share?shareId=${shareId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchShares()
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
    }
  }

  const handleUpdatePermission = async (shareId: string, newPermission: 'view' | 'edit') => {
    try {
      const response = await fetch('/api/accounts/share', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId, permission: newPermission })
      })

      if (response.ok) {
        await fetchShares()
      }
    } catch (error) {
      console.error('Erreur lors de la modification:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-white">Chargement...</div>
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg flex items-center gap-3">
          <Share2 className="w-8 h-8 md:w-10 md:h-10 text-purple-400" />
          Partage du Dashboard
        </h1>
        <p className="text-slate-200 mt-2 text-base md:text-lg font-medium">
          Partagez tous vos comptes et transactions avec d'autres utilisateurs
        </p>
      </div>

      {/* Card d'ajout de partage */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-2 border-blue-400/30 bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="flex items-center gap-2 text-white">
              <UserPlus className="w-5 h-5 text-blue-400" />
              Partager mon dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300 font-semibold">
                Nom d'utilisateur
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="@utilisateur"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-slate-700/50 border-slate-600/50 text-white placeholder:text-slate-400 h-12"
              />
              <p className="text-xs text-slate-400">
                Entrez le nom d'utilisateur (username) de la personne avec qui partager
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="permission" className="text-slate-300 font-semibold">
                Permission
              </Label>
              <Select value={permission} onValueChange={(value: 'view' | 'edit') => setPermission(value)}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600/50 text-white h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Vue seule - Peut voir uniquement
                    </div>
                  </SelectItem>
                  <SelectItem value="edit">
                    <div className="flex items-center gap-2">
                      <Edit className="w-4 h-4" />
                      Édition - Peut modifier les transactions
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {error}
              </div>
            )}

            <Button
              onClick={handleAddShare}
              disabled={adding || !username.trim()}
              className="w-full h-12 gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              {adding ? 'Partage en cours...' : (
                <>
                  <Share2 className="w-5 h-5" />
                  Partager mon dashboard
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Liste des partages actifs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-2 border-purple-400/30 bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="w-5 h-5 text-purple-400" />
              Partages actifs ({shares.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {shares.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg mb-2">Aucun partage actif</p>
                <p className="text-slate-500 text-sm">
                  Partagez votre dashboard pour permettre à d'autres de suivre vos dépenses
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {shares.map((share, index) => (
                  <motion.div
                    key={share.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-700/30 border border-slate-600/50 hover:bg-slate-700/50 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-lg text-white truncate">
                        @{share.username || share.shared_with_user_id}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Partagé le {new Date(share.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={share.permission}
                        onValueChange={(value: 'view' | 'edit') => handleUpdatePermission(share.id, value)}
                      >
                        <SelectTrigger className="w-40 bg-slate-800/50 border-slate-600 text-white text-sm h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">
                            <div className="flex items-center gap-2">
                              <Eye className="w-3 h-3" />
                              Vue seule
                            </div>
                          </SelectItem>
                          <SelectItem value="edit">
                            <div className="flex items-center gap-2">
                              <Edit className="w-3 h-3" />
                              Édition
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteShare(share.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-10 w-10 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Card d'information */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-blue-400/30 shadow-xl">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <div className="text-blue-400 text-2xl">💡</div>
              <div>
                <h3 className="font-semibold text-blue-300 mb-2">
                  Comment fonctionne le partage ?
                </h3>
                <ul className="text-sm text-slate-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span><strong className="text-blue-300">Vue seule</strong> : La personne peut voir tous vos comptes et transactions, mais ne peut pas les modifier.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span><strong className="text-green-300">Édition</strong> : La personne peut voir ET modifier vos transactions (ajouter, supprimer).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>Le partage est <strong className="text-purple-300">complet</strong> : tous vos comptes et transactions sont accessibles.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>Vous pouvez modifier les permissions ou supprimer un partage à tout moment.</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
