import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { supabase } from "./db"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Récupère la période de clôture pour un mois donné
export async function getMonthClosure(userId: string, monthYear: string) {
  const { data, error } = await supabase
    .from('month_closures')
    .select('start_date, end_date')
    .eq('user_id', userId)
    .eq('month_year', monthYear)
    .single()
  // PGRST116 = no rows returned, ce n'est pas une erreur
  if (error && error.code !== 'PGRST116') throw error
  return data
}

// Enregistre une nouvelle période de clôture pour un mois
export async function setMonthClosure(userId: string, monthYear: string, startDate: string, endDate: string) {
  const { error } = await supabase
    .from('month_closures')
    .upsert({ user_id: userId, month_year: monthYear, start_date: startDate, end_date: endDate })
  if (error) throw error
}

// Archive les transactions du mois précédent
export async function archivePreviousMonthTransactions(userId: string) {
  const today = new Date()
  const todayIso = today.toISOString().split('T')[0] // format YYYY-MM-DD

  // Récupérer les comptes de l'utilisateur
  const { data: userAccounts, error: accountsError } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', userId)

  if (accountsError) {
    throw new Error('Erreur lors de la récupération des comptes')
  }

  const userAccountIds = userAccounts?.map(a => a.id) || []

  if (userAccountIds.length === 0) {
    throw new Error('Aucun compte trouvé pour cet utilisateur')
  }

  // Récupérer les transactions non archivées avant aujourd'hui pour cet utilisateur
  const { data: txsToArchive, error: previewError } = await supabase
    .from('transactions')
    .select('date, account_id')
    .lt('date', todayIso)
    .eq('archived', false)
    .in('account_id', userAccountIds)
    .order('date', { ascending: true })

  if (previewError) {
    console.error('[archivePreviousMonthTransactions] preview error:', previewError)
    throw new Error('Erreur lors de la récupération des transactions')
  }

  if (!txsToArchive || txsToArchive.length === 0) {
    throw new Error('Aucune transaction à archiver')
  }

  const firstDate = txsToArchive[0].date
  const lastDate = txsToArchive[txsToArchive.length - 1].date

  // Calculer la période de clôture basée sur la première date
  const d = new Date(firstDate)
  const monthYear = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  // Enregistrer la période de clôture
  await setMonthClosure(userId, monthYear, firstDate, lastDate)

  // Archiver les transactions de cet utilisateur
  const { data, error } = await supabase
    .from('transactions')
    .update({ archived: true })
    .lt('date', todayIso)
    .eq('archived', false)
    .in('account_id', userAccountIds)

  if (error) {
    throw new Error('Erreur lors de l\'archivage des transactions : ' + error.message)
  }
  
  return { updated: data, closure: { monthYear, startDate: firstDate, endDate: lastDate } }
}
