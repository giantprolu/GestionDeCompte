'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, UserPlus, Eye, Edit, Trash2 } from 'lucide-react'

interface Share {
  id: string
  shared_with_user_id: string
  permission: 'view' | 'edit'
  created_at: string
  username?: string
}

interface ShareAccountModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ShareAccountModal({ isOpen, onClose }: ShareAccountModalProps) {
  const [shares, setShares] = useState<Share[]>([])
  const [userIdToShare, setUserIdToShare] = useState('')
  const [permission, setPermission] = useState<'view' | 'edit'>('view')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchShares()
    }
  }, [isOpen])

  const fetchShares = async () => {
    try {
      const response = await fetch(`/api/accounts/share`)
      if (response.ok) {
        const data = await response.json()
        setShares(data)
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des partages:', error)
    }
  }

  const handleAddShare = async () => {
    if (!userIdToShare.trim()) {
      setError('Veuillez entrer un ID utilisateur')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/accounts/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sharedWithUserId: userIdToShare.trim(),
          permission
        })
      })

      if (response.ok) {
        setUserIdToShare('')
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
      setLoading(false)
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-blue-400" />
            Partager mon dashboard
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Formulaire d'ajout */}
          <div className="p-4 rounded-xl bg-slate-700/30 border border-slate-600/50 space-y-4">
            <h3 className="font-semibold text-lg">Partager mon dashboard</h3>
            
            <div className="space-y-2">
              <Label htmlFor="userId" className="text-slate-300">
                Nom d'utilisateur Clerk
              </Label>
              <Input
                id="userId"
                type="text"
                placeholder="@utilisateur"
                value={userIdToShare}
                onChange={(e) => setUserIdToShare(e.target.value)}
                className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-400">
                Entrez le nom d'utilisateur (username) de la personne avec qui partager
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="permission" className="text-slate-300">
                Permission
              </Label>
              <Select value={permission} onValueChange={(value: 'view' | 'edit') => setPermission(value)}>
                <SelectTrigger className="bg-slate-800/50 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Vue seule
                    </div>
                  </SelectItem>
                  <SelectItem value="edit">
                    <div className="flex items-center gap-2">
                      <Edit className="w-4 h-4" />
                      Modification
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                {error}
              </p>
            )}

            <Button
              onClick={handleAddShare}
              disabled={loading || !userIdToShare.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
            >
              {loading ? 'Partage en cours...' : 'Ajouter le partage'}
            </Button>
          </div>

          {/* Liste des partages existants */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Dashboards partagés ({shares.length})</h3>
            
            {shares.length === 0 ? (
              <p className="text-slate-400 text-center py-8 bg-slate-700/20 rounded-xl border border-slate-600/30">
                Vous n'avez pas encore partagé votre dashboard
              </p>
            ) : (
              <div className="space-y-2">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-slate-700/30 border border-slate-600/50 hover:bg-slate-700/50 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">
                        @{share.username || share.shared_with_user_id}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Partagé le {new Date(share.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={share.permission}
                        onValueChange={(value: 'view' | 'edit') => handleUpdatePermission(share.id, value)}
                      >
                        <SelectTrigger className="w-32 bg-slate-800/50 border-slate-600 text-white text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">
                            <div className="flex items-center gap-2">
                              <Eye className="w-3 h-3" />
                              Vue
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
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
