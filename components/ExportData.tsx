'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, FileText, Loader2 } from 'lucide-react'

export default function ExportData() {
  const [isExporting, setIsExporting] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dataType, setDataType] = useState<'all' | 'transactions' | 'accounts'>('all')

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      params.append('format', 'csv')
      params.append('type', dataType)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/export?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Erreur lors de l\'export')
      }

      // Télécharger le fichier
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-finances-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de l\'export des données')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5 text-green-400" />
          Export des données
        </CardTitle>
        <p className="text-sm text-slate-400">
          Téléchargez vos données au format CSV pour les utiliser dans un tableur
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type de données */}
        <div className="space-y-2">
          <Label className="text-slate-200">Données à exporter</Label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setDataType('all')}
              className={`px-3 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                dataType === 'all'
                  ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                  : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              📊 Tout
            </button>
            <button
              type="button"
              onClick={() => setDataType('transactions')}
              className={`px-3 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                dataType === 'transactions'
                  ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                  : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              💸 Transactions
            </button>
            <button
              type="button"
              onClick={() => setDataType('accounts')}
              className={`px-3 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
                dataType === 'accounts'
                  ? 'border-green-500 bg-green-500/20 text-green-300'
                  : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              🏦 Comptes
            </button>
          </div>
        </div>

        {/* Filtres de date */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-200">Date de début (optionnel)</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-200">Date de fin (optionnel)</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
        </div>

        {/* Bouton d'export */}
        <Button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Export en cours...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Exporter en CSV
            </>
          )}
        </Button>

        <p className="text-xs text-slate-500 text-center">
          Le fichier sera téléchargé automatiquement dans votre navigateur
        </p>
      </CardContent>
    </Card>
  )
}
