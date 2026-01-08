import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const dataType = searchParams.get('type') || 'all' // 'all', 'transactions', 'accounts'

    // Récupérer les comptes de l'utilisateur
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('name')

    if (accountsError) throw accountsError

    const accountIds = accounts?.map(acc => acc.id) || []

    // Récupérer les transactions
    let transactionsQuery = supabase
      .from('transactions')
      .select(`
        *,
        account:accounts(id, name, type),
        category:categories(id, name, icon)
      `)
      .in('account_id', accountIds)
      .order('date', { ascending: false })

    if (startDate) transactionsQuery = transactionsQuery.gte('date', startDate)
    if (endDate) transactionsQuery = transactionsQuery.lte('date', endDate)

    const { data: transactions, error: transactionsError } = await transactionsQuery

    if (transactionsError) throw transactionsError

    if (format === 'csv') {
      let csvContent = ''

      if (dataType === 'all' || dataType === 'accounts') {
        // Export des comptes
        csvContent += 'COMPTES\n'
        csvContent += 'Nom,Type,Solde Initial,Exclu du Prévisionnel,Date de création\n'
        for (const account of accounts || []) {
          csvContent += `"${account.name}","${account.type}",${account.initial_balance},${account.exclude_from_previsionnel ? 'Oui' : 'Non'},"${new Date(account.created_at).toLocaleDateString('fr-FR')}"\n`
        }
        csvContent += '\n'
      }

      if (dataType === 'all' || dataType === 'transactions') {
        // Export des transactions
        csvContent += 'TRANSACTIONS\n'
        csvContent += 'Date,Type,Montant,Catégorie,Compte,Note,Récurrent,Fréquence\n'
        for (const txn of transactions || []) {
          const account = txn.account as { name: string } | null
          const category = txn.category as { name: string } | null
          const date = new Date(txn.date).toLocaleDateString('fr-FR')
          const type = txn.type === 'income' ? 'Revenu' : 'Dépense'
          const amount = txn.amount.toFixed(2)
          const categoryName = category?.name || 'N/A'
          const accountName = account?.name || 'N/A'
          const note = txn.note ? `"${txn.note.replace(/"/g, '""')}"` : ''
          const isRecurring = txn.is_recurring ? 'Oui' : 'Non'
          const frequency = txn.recurrence_frequency || ''

          csvContent += `"${date}","${type}",${amount},"${categoryName}","${accountName}",${note},${isRecurring},"${frequency}"\n`
        }
      }

      // Retourner le fichier CSV
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="export-finances-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // Retourner les données en JSON si format !== csv
    return NextResponse.json({
      accounts: accounts || [],
      transactions: transactions || [],
      exportDate: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export des données' }, { status: 500 })
  }
}
