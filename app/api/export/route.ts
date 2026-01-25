import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'
import { jsPDF } from 'jspdf'

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

    // Récupérer les transactions avec plus de détails
    let transactionsQuery = supabase
      .from('transactions')
      .select(`
        *,
        account:accounts(id, name, type, initial_balance),
        category:categories(id, name, icon, type, color)
      `)
      .in('account_id', accountIds)
      .order('date', { ascending: false })

    if (startDate) transactionsQuery = transactionsQuery.gte('date', startDate)
    if (endDate) transactionsQuery = transactionsQuery.lte('date', endDate)

    const { data: transactions, error: transactionsError } = await transactionsQuery

    if (transactionsError) throw transactionsError

    // Récupérer les crédits/prêts
    const { data: credits } = await supabase
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // Récupérer les clôtures de mois
    const { data: closures } = await supabase
      .from('month_closures')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })

    if (format === 'csv') {
      // BOM UTF-8 pour que Excel reconnaisse correctement l'encodage
      const BOM = '\uFEFF'
      let csvContent = BOM

      // En-tête d'export
      const exportDate = new Date().toLocaleString('fr-FR', { 
        dateStyle: 'full', 
        timeStyle: 'short' 
      })
      csvContent += `"EXPORT MONEYFLOW - ${exportDate}"\n`
      csvContent += `"Période: ${startDate ? new Date(startDate).toLocaleDateString('fr-FR') : 'Début'} - ${endDate ? new Date(endDate).toLocaleDateString('fr-FR') : "Aujourd'hui" }"\n\n`

      if (dataType === 'all' || dataType === 'accounts') {
        // Export des comptes avec plus d'infos
        csvContent += '"=== COMPTES ==="\n'
        csvContent += '"Nom";"Type";"Solde Initial (€)";"Exclu Prévisionnel";"ID";"Date de création"\n'
        for (const account of accounts || []) {
          const createdAt = new Date(account.created_at).toLocaleString('fr-FR')
          csvContent += `"${escapeCSV(account.name)}";"${account.type === 'obligatoire' ? 'Obligatoire' : 'Occasionnel'}";"${account.initial_balance.toFixed(2)}";"${account.exclude_from_previsionnel ? 'Oui' : 'Non'}";"${account.id}";"${createdAt}"\n`
        }
        csvContent += '\n'

        // Statistiques des comptes
        const totalInitial = (accounts || []).reduce((sum, acc) => sum + (acc.initial_balance || 0), 0)
        csvContent += `"Total soldes initiaux";"";${totalInitial.toFixed(2)} €\n\n`
      }

      if (dataType === 'all' || dataType === 'transactions') {
        // Export des transactions avec beaucoup plus d'infos
        csvContent += '"=== TRANSACTIONS ==="\n'
        csvContent += '"Date";"Heure";"Type";"Montant (€)";"Catégorie";"Icône";"Compte";"Type Compte";"Note";"Récurrent";"Fréquence";"Jour Récurrence";"Archivé";"ID"\n'
        
        let totalIncome = 0
        let totalExpense = 0
        
        for (const txn of transactions || []) {
          const account = txn.account as { name: string; type: string } | null
          const category = txn.category as { name: string; icon: string; type: string } | null
          const txnDate = new Date(txn.date)
          const date = txnDate.toLocaleDateString('fr-FR')
          const time = txnDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          const type = txn.type === 'income' ? 'Revenu' : 'Dépense'
          const amount = txn.amount.toFixed(2)
          const categoryName = category?.name || 'N/A'
          const categoryIcon = category?.icon || ''
          const accountName = account?.name || 'N/A'
          const accountType = account?.type === 'obligatoire' ? 'Obligatoire' : 'Occasionnel'
          const note = escapeCSV(txn.note || '')
          const isRecurring = txn.is_recurring ? 'Oui' : 'Non'
          const frequency = txn.recurrence_frequency === 'monthly' ? 'Mensuel' : 
                          txn.recurrence_frequency === 'weekly' ? 'Hebdomadaire' : 
                          txn.recurrence_frequency === 'yearly' ? 'Annuel' : ''
          const recurrenceDay = txn.recurrence_day || ''
          const archived = txn.archived ? 'Oui' : 'Non'

          if (txn.type === 'income') totalIncome += txn.amount
          else totalExpense += txn.amount

          csvContent += `"${date}";"${time}";"${type}";"${amount}";"${categoryName}";"${categoryIcon}";"${accountName}";"${accountType}";"${note}";"${isRecurring}";"${frequency}";"${recurrenceDay}";"${archived}";"${txn.id}"\n`
        }

        csvContent += '\n'
        // Statistiques des transactions
        csvContent += '"=== RÉSUMÉ TRANSACTIONS ==="\n'
        csvContent += `"Total revenus";"";"${totalIncome.toFixed(2)} €"\n`
        csvContent += `"Total dépenses";"";"${totalExpense.toFixed(2)} €"\n`
        csvContent += `"Solde net";"";"${(totalIncome - totalExpense).toFixed(2)} €"\n`
        csvContent += `"Nombre de transactions";"";${(transactions || []).length}\n\n`
      }

      // Export des crédits/prêts
      if ((dataType === 'all') && credits && credits.length > 0) {
        csvContent += '"=== CRÉDITS / PRÊTS ==="\n'
        csvContent += '"Nom";"Montant Initial (€)";"Montant Remboursé (€)";"Reste à Payer (€)";"Progression (%)";"Date de création"\n'
        
        for (const credit of credits) {
          const remaining = credit.initial_amount - credit.repaid_amount
          const progress = ((credit.repaid_amount / credit.initial_amount) * 100).toFixed(1)
          const createdAt = new Date(credit.created_at).toLocaleDateString('fr-FR')
          csvContent += `"${escapeCSV(credit.name)}";"${credit.initial_amount.toFixed(2)}";"${credit.repaid_amount.toFixed(2)}";"${remaining.toFixed(2)}";"${progress}%";"${createdAt}"\n`
        }
        csvContent += '\n'
      }

      // Export des clôtures de mois
      if ((dataType === 'all') && closures && closures.length > 0) {
        csvContent += '"=== HISTORIQUE DES CLÔTURES ==="\n'
        csvContent += '"Période";"Date Début";"Date Fin";"Solde Clôturé (€)"\n'
        
        for (const closure of closures) {
          const startDateStr = new Date(closure.start_date).toLocaleDateString('fr-FR')
          const endDateStr = new Date(closure.end_date).toLocaleDateString('fr-FR')
          const balance = closure.closing_balance?.toFixed(2) || 'N/A'
          csvContent += `"${closure.month_year}";"${startDateStr}";"${endDateStr}";"${balance}"\n`
        }
        csvContent += '\n'
      }

      // Pied de page
      csvContent += '\n"---"\n'
      csvContent += `"Généré par MoneyFlow le ${new Date().toLocaleString('fr-FR')}"\n`

      // Retourner le fichier CSV avec encodage UTF-8 correct
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="export-moneyflow-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    if (format === 'pdf') {
      // Créer un nouveau document PDF avec jsPDF
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 15
      let yPos = margin

      // Fonction pour vérifier et ajouter une nouvelle page si nécessaire
      const checkPageBreak = (neededSpace = 20) => {
        if (yPos + neededSpace > pageHeight - margin) {
          doc.addPage()
          yPos = margin
          return true
        }
        return false
      }

      // En-tête du document
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('EXPORT MONEYFLOW', pageWidth / 2, yPos, { align: 'center' })
      yPos += 10

      const exportDate = new Date().toLocaleString('fr-FR', {
        dateStyle: 'full',
        timeStyle: 'short'
      })
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(exportDate, pageWidth / 2, yPos, { align: 'center' })
      yPos += 6

      const periodText = `Période: ${startDate ? new Date(startDate).toLocaleDateString('fr-FR') : 'Début'} - ${endDate ? new Date(endDate).toLocaleDateString('fr-FR') : "Aujourd'hui"}`
      doc.text(periodText, pageWidth / 2, yPos, { align: 'center' })
      yPos += 12

      // Export des comptes
      if (dataType === 'all' || dataType === 'accounts') {
        checkPageBreak(30)

        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('COMPTES', margin, yPos)
        yPos += 8

        const totalInitial = (accounts || []).reduce((sum, acc) => sum + (acc.initial_balance || 0), 0)

        doc.setFontSize(9)
        for (const account of accounts || []) {
          checkPageBreak(15)

          doc.setFont('helvetica', 'bold')
          doc.text(`${account.name} - ${account.type === 'obligatoire' ? 'Obligatoire' : 'Occasionnel'}`, margin, yPos)
          yPos += 5

          doc.setFont('helvetica', 'normal')
          doc.text(`Solde initial: ${account.initial_balance.toFixed(2)} €`, margin + 5, yPos)
          yPos += 4
          doc.text(`Exclu prévisionnel: ${account.exclude_from_previsionnel ? 'Oui' : 'Non'}`, margin + 5, yPos)
          yPos += 6
        }

        doc.setFont('helvetica', 'bold')
        doc.text(`Total soldes initiaux: ${totalInitial.toFixed(2)} €`, margin, yPos)
        yPos += 10
      }

      // Export des transactions
      if (dataType === 'all' || dataType === 'transactions') {
        checkPageBreak(30)

        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('TRANSACTIONS', margin, yPos)
        yPos += 8

        let totalIncome = 0
        let totalExpense = 0
        let transactionCount = 0

        doc.setFontSize(8)
        for (const txn of transactions || []) {
          checkPageBreak(18)

          const account = txn.account as { name: string; type: string } | null
          const category = txn.category as { name: string; icon: string; type: string } | null
          const txnDate = new Date(txn.date)
          const date = txnDate.toLocaleDateString('fr-FR')
          const type = txn.type === 'income' ? 'Revenu' : 'Dépense'

          if (txn.type === 'income') totalIncome += txn.amount
          else totalExpense += txn.amount
          transactionCount++

          doc.setFont('helvetica', 'bold')
          doc.text(`${date} - ${type} - ${txn.amount.toFixed(2)} €`, margin, yPos)
          yPos += 4

          doc.setFont('helvetica', 'normal')
          if (category) {
            doc.text(`Catégorie: ${category.name}`, margin + 5, yPos)
            yPos += 3.5
          }
          if (account) {
            doc.text(`Compte: ${account.name}`, margin + 5, yPos)
            yPos += 3.5
          }
          if (txn.note) {
            const noteLines = doc.splitTextToSize(`Note: ${txn.note}`, pageWidth - margin * 2 - 5)
            doc.text(noteLines, margin + 5, yPos)
            yPos += noteLines.length * 3.5
          }
          yPos += 3
        }

        checkPageBreak(25)
        yPos += 3
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('RÉSUMÉ TRANSACTIONS', margin, yPos)
        yPos += 6

        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.text(`Total revenus: ${totalIncome.toFixed(2)} €`, margin + 5, yPos)
        yPos += 4
        doc.text(`Total dépenses: ${totalExpense.toFixed(2)} €`, margin + 5, yPos)
        yPos += 4
        doc.text(`Solde net: ${(totalIncome - totalExpense).toFixed(2)} €`, margin + 5, yPos)
        yPos += 4
        doc.text(`Nombre de transactions: ${transactionCount}`, margin + 5, yPos)
        yPos += 10
      }

      // Export des crédits/prêts
      if ((dataType === 'all') && credits && credits.length > 0) {
        checkPageBreak(30)

        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('CRÉDITS / PRÊTS', margin, yPos)
        yPos += 8

        doc.setFontSize(9)
        for (const credit of credits) {
          checkPageBreak(20)

          const remaining = credit.initial_amount - credit.repaid_amount
          const progress = ((credit.repaid_amount / credit.initial_amount) * 100).toFixed(1)

          doc.setFont('helvetica', 'bold')
          doc.text(credit.name, margin, yPos)
          yPos += 5

          doc.setFont('helvetica', 'normal')
          doc.text(`Montant initial: ${credit.initial_amount.toFixed(2)} €`, margin + 5, yPos)
          yPos += 4
          doc.text(`Montant remboursé: ${credit.repaid_amount.toFixed(2)} €`, margin + 5, yPos)
          yPos += 4
          doc.text(`Reste à payer: ${remaining.toFixed(2)} €`, margin + 5, yPos)
          yPos += 4
          doc.text(`Progression: ${progress}%`, margin + 5, yPos)
          yPos += 6
        }
      }

      // Pied de page sur chaque page
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text(
          `Généré par MoneyFlow le ${new Date().toLocaleString('fr-FR')} - Page ${i}/${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        )
      }

      // Générer le PDF en tant que buffer
      const pdfOutput = doc.output('arraybuffer')
      const pdfBuffer = Buffer.from(pdfOutput)

      // Retourner le fichier PDF
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="export-moneyflow-${new Date().toISOString().split('T')[0]}.pdf"`,
        },
      })
    }

    // Retourner les données en JSON si format !== csv && format !== pdf
    return NextResponse.json({
      accounts: accounts || [],
      transactions: transactions || [],
      credits: credits || [],
      closures: closures || [],
      exportDate: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export des données' }, { status: 500 })
  }
}

// Fonction pour échapper les caractères spéciaux CSV
function escapeCSV(str: string): string {
  if (!str) return ''
  // Remplacer les guillemets par des guillemets doublés
  return str.replace(/"/g, '""')
}
