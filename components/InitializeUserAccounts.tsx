'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Loader2 } from 'lucide-react'

export default function InitializeUserAccounts() {
  const { user, isLoaded } = useUser()
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded || !user || status !== 'idle') return

    const initializeAccounts = async () => {
      setStatus('loading')
      try {
        const response = await fetch('/api/accounts')
        
        if (!response.ok) {
          throw new Error('Erreur lors de la récupération des comptes')
        }
        
        const accounts = await response.json()

        if (accounts.length === 0) {
          console.log('Création des comptes par défaut...')
          
          const boursoRes = await fetch('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'Bourso',
              type: 'ponctuel',
              initialBalance: 0,
            }),
          })

          if (!boursoRes.ok) {
            const errorData = await boursoRes.json()
            throw new Error(`Erreur Bourso: ${errorData.error}`)
          }

          const caisseRes = await fetch('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'Caisse EP',
              type: 'obligatoire',
              initialBalance: 0,
            }),
          })

          if (!caisseRes.ok) {
            const errorData = await caisseRes.json()
            throw new Error(`Erreur Caisse EP: ${errorData.error}`)
          }

          console.log('✅ Comptes créés avec succès!')
        }
        
        setStatus('done')
      } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error)
        setError(error instanceof Error ? error.message : 'Erreur inconnue')
        setStatus('error')
      }
    }

    initializeAccounts()
  }, [user, isLoaded, status])

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-600">Initialisation de votre compte...</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-red-600 mb-2">Erreur d'initialisation</h3>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  return null
}
