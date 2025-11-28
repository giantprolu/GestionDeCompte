  // import { supabase } from './db' // déjà importé plus bas

    // Récupère la période de clôture pour un mois donné
    export async function getMonthClosure(userId: string, monthYear: string) {
      const { data, error } = await supabase
        .from('month_closures')
        .select('start_date, end_date')
        .eq('user_id', userId)
        .eq('month_year', monthYear)
        .single()
      if (error) throw error
      return data
    }

    // Enregistre une nouvelle période de clôture pour un mois
    export async function setMonthClosure(userId: string, monthYear: string, startDate: string, endDate: string) {
      const { error } = await supabase
        .from('month_closures')
        .upsert({ user_id: userId, month_year: monthYear, start_date: startDate, end_date: endDate })
      if (error) throw error
    }
    // Log toutes les transactions pour vérifier le format des dates
    const { data: allTx, error: allTxError } = await supabase
      .from('transactions')
      .select('id, date, archived')

    if (allTxError) {
      console.error('[archivePreviousMonthTransactions] ALL error:', allTxError)
    }
  // Définition des variables de date
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDayPrevMonth = new Date(firstDayOfMonth.getTime() - 1)
  const firstDayPrevMonth = new Date(lastDayPrevMonth.getFullYear(), lastDayPrevMonth.getMonth(), 1)

  // Logs des dates
  // Afficher toutes les transactions du mois précédent avant l'update
  const { data: preview, error: previewError } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', firstDayPrevMonth.toISOString())
    .lte('date', lastDayPrevMonth.toISOString())

  if (previewError) {
    console.error('[archivePreviousMonthTransactions] preview error:', previewError)
  }
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { supabase } from "./db"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Archive les transactions du mois précédent
export async function archivePreviousMonthTransactions() {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDayPrevMonth = new Date(firstDayOfMonth.getTime() - 1)
  const firstDayPrevMonth = new Date(lastDayPrevMonth.getFullYear(), lastDayPrevMonth.getMonth(), 1)


  // Archiver toutes les transactions non archivées dont la date est antérieure à aujourd'hui
  const today = new Date()
  const todayIso = today.toISOString().split('T')[0] // format YYYY-MM-DD

  // Récupérer l'utilisateur courant (à adapter selon votre auth)
  const userId = (await supabase.auth.getUser()).data?.user?.id
  if (!userId) throw new Error('Utilisateur non authentifié')

  // Récupérer la dernière transaction à archiver
  const { data: txsToArchive, error: previewError } = await supabase
    .from('transactions')
    .select('date')
    .lt('date', todayIso)
    .eq('archived', false)
    .order('date', { ascending: false })
    .limit(1)

  if (previewError) {
    console.error('[archivePreviousMonthTransactions] preview error:', previewError)
  }
  const lastDate = txsToArchive?.[0]?.date
  if (!lastDate) throw new Error('Aucune transaction à archiver')

  // Calculer la période de clôture
  const d = new Date(lastDate)
  const monthYear = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  const endDate = lastDate

  // Enregistrer la période de clôture
  await setMonthClosure(userId, monthYear, startDate, endDate)

  // Archiver les transactions
  const { data, error } = await supabase
    .from('transactions')
    .update({ archived: true })
    .lte('date', endDate)
    .eq('archived', false)

  if (error) {
    throw new Error('Erreur lors de l’archivage des transactions : ' + error.message)
  }
  return { updated: data, error, closure: { monthYear, startDate, endDate } }
}
