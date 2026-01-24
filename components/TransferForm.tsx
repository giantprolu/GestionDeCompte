'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowRightLeft, X } from 'lucide-react'
import { motion } from 'framer-motion'

interface Account {
  id: string
  name: string
  type: string
}

interface TransferFormProps {
  accounts: Account[]
  onClose: () => void
  onTransferCreated: () => void
}

export default function TransferForm({ accounts, onClose, onTransferCreated }: TransferFormProps) {
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!fromAccountId || !toAccountId || !amount) {
      alert('Veuillez remplir tous les champs obligatoires')
      return
    }

    if (fromAccountId === toAccountId) {
      alert('Le compte source et destination doivent être différents')
      return
    }

    const numericAmount = parseFloat(amount.replace(',', '.'))
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert('Le montant doit être un nombre positif')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amount: numericAmount,
          date: new Date(date).toISOString(),
          note: note.trim() || null,
        }),
      })

      if (response.ok) {
        onTransferCreated()
        onClose()
      } else {
        const error = await response.json()
        alert('Erreur: ' + (error.error || 'Impossible de créer le virement'))
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Erreur lors de la création du virement')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-2 border-purple-400/30 bg-gradient-to-br from-slate-800/95 to-slate-900/95 shadow-2xl">
        <CardHeader className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/20">
                <ArrowRightLeft className="w-5 h-5 text-purple-400" />
              </div>
              Effectuer un virement
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Compte source */}
            <div className="space-y-2">
              <Label className="text-slate-200 font-semibold">Depuis le compte</Label>
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                className="w-full h-12 px-4 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                required
              >
                <option value="">Sélectionner un compte</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.type === 'ponctuel' ? 'Occasionnel' : account.type === 'obligatoire' ? 'Obligatoire' : 'Livret'})
                  </option>
                ))}
              </select>
            </div>

            {/* Flèche de direction */}
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-purple-500/20">
                <ArrowRightLeft className="w-6 h-6 text-purple-400" />
              </div>
            </div>

            {/* Compte destination */}
            <div className="space-y-2">
              <Label className="text-slate-200 font-semibold">Vers le compte</Label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full h-12 px-4 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                required
              >
                <option value="">Sélectionner un compte</option>
                {accounts
                  .filter((account) => account.id !== fromAccountId)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.type === 'ponctuel' ? 'Occasionnel' : account.type === 'obligatoire' ? 'Obligatoire' : 'Livret'})
                    </option>
                  ))}
              </select>
            </div>

            {/* Montant */}
            <div className="space-y-2">
              <Label className="text-slate-200 font-semibold">Montant</Label>
              <div className="relative">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.,]/g, '')
                    setAmount(value)
                  }}
                  placeholder="0"
                  className="bg-slate-700/50 border-slate-600/50 text-white h-12 text-lg font-semibold pr-12 focus:border-purple-500 focus:ring-purple-500/20"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">€</span>
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label className="text-slate-200 font-semibold">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-slate-700/50 border-slate-600/50 text-white h-12 focus:border-purple-500 focus:ring-purple-500/20"
                required
              />
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label className="text-slate-200 font-semibold">Note (optionnel)</Label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex: Virement vers livret A, Retrait pour vacances..."
                className="w-full px-4 py-3 rounded-lg bg-slate-700/50 border border-slate-600/50 text-white placeholder:text-slate-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all min-h-20 resize-none"
              />
            </div>

            {/* Boutons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-12 gap-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Virement en cours...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-5 h-5" />
                    Effectuer le virement
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                className="h-12 px-6 bg-slate-700/50 border-slate-600/50 text-white hover:bg-slate-700 hover:border-slate-600"
              >
                Annuler
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
