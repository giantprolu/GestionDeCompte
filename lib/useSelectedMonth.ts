"use client"

import { useEffect, useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'selectedMonth'

// Obtenir le mois actuel au format YYYY-MM
export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Store externe pour le mois sélectionné
let currentMonth = typeof window !== 'undefined' 
  ? localStorage.getItem(STORAGE_KEY) || getCurrentMonth()
  : getCurrentMonth()

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return currentMonth
}

function getServerSnapshot() {
  return getCurrentMonth()
}

function setMonth(month: string) {
  currentMonth = month
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, month)
  }
  listeners.forEach(listener => listener())
}

// Hook pour gérer le mois sélectionné partagé entre les pages
export function useSelectedMonth() {
  const selectedMonth = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Écouter les changements depuis d'autres onglets
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setMonth(e.newValue)
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Fonction pour changer le mois
  const setSelectedMonth = useCallback((month: string | null) => {
    const newMonth = month || getCurrentMonth()
    setMonth(newMonth)
  }, [])

  // Fonction pour toggle le mois (si on clique sur le même mois, on revient au mois actuel)
  const toggleMonth = useCallback((month: string) => {
    const current = getCurrentMonth()
    if (selectedMonth === month && month !== current) {
      // Si on reclique sur le même mois passé, on revient au mois courant
      setMonth(current)
    } else if (selectedMonth === month && month === current) {
      // Si on clique sur le mois courant alors qu'il est déjà sélectionné, rien ne change
      return
    } else {
      setMonth(month)
    }
  }, [selectedMonth])

  // Réinitialiser au mois courant
  const resetToCurrentMonth = useCallback(() => {
    setMonth(getCurrentMonth())
  }, [])

  // Vérifier si on est sur le mois courant
  const isCurrentMonth = selectedMonth === getCurrentMonth()

  return {
    selectedMonth,
    setSelectedMonth,
    toggleMonth,
    resetToCurrentMonth,
    isCurrentMonth,
    isInitialized: true
  }
}
