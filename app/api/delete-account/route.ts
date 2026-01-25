import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

/**
 * API DELETE /api/delete-account
 * Supprime définitivement un compte utilisateur :
 * 1. Supprime toutes les données DB (transactions, comptes, etc.)
 * 2. Supprime l'utilisateur Clerk
 *
 * IMPORTANT : L'ordre est critique - on supprime la DB AVANT Clerk
 * Pourquoi ? Si Clerk échoue, on peut retry. Si DB échoue après Clerk,
 * on a un compte Clerk supprimé avec des données orphelines en DB.
 */
export async function DELETE() {
  try {
    // 1. Vérifier l'authentification
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    console.log(`🔥 [DELETE-ACCOUNT] Demande de suppression pour: ${userId}`)

    // 2. ÉTAPE CRITIQUE : Supprimer les données DB AVANT Clerk
    try {
      console.log(`🗑️ [DB] Début suppression des données pour: ${userId}`)

      // Récupérer les IDs des comptes pour supprimer les transactions
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', userId)

      const accountIds = accounts?.map(a => a.id) || []

      // Supprimer dans l'ordre pour respecter les contraintes FK
      // 1. Transactions liées aux comptes
      if (accountIds.length > 0) {
        const { error: txError } = await supabase
          .from('transactions')
          .delete()
          .in('account_id', accountIds)

        if (txError) {
          console.error('❌ [DB] Erreur suppression transactions:', txError)
          throw new Error(`Erreur lors de la suppression des transactions: ${txError.message}`)
        }
        console.log(`✅ [DB] Transactions supprimées`)
      }

      // 2. Crédits
      const { error: creditsError } = await supabase
        .from('credits')
        .delete()
        .eq('user_id', userId)

      if (creditsError) {
        console.error('❌ [DB] Erreur suppression crédits:', creditsError)
        throw new Error(`Erreur lors de la suppression des crédits: ${creditsError.message}`)
      }
      console.log(`✅ [DB] Crédits supprimés`)

      // 3. Comptes
      const { error: accountsError } = await supabase
        .from('accounts')
        .delete()
        .eq('user_id', userId)

      if (accountsError) {
        console.error('❌ [DB] Erreur suppression comptes:', accountsError)
        throw new Error(`Erreur lors de la suppression des comptes: ${accountsError.message}`)
      }
      console.log(`✅ [DB] Comptes supprimés`)

      // 4. Clôtures mensuelles
      const { error: closuresError } = await supabase
        .from('month_closures')
        .delete()
        .eq('user_id', userId)

      if (closuresError) {
        console.error('❌ [DB] Erreur suppression clôtures:', closuresError)
        throw new Error(`Erreur lors de la suppression des clôtures: ${closuresError.message}`)
      }
      console.log(`✅ [DB] Clôtures mensuelles supprimées`)

      // 5. Paramètres utilisateur
      const { error: settingsError } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', userId)

      if (settingsError) {
        console.error('❌ [DB] Erreur suppression paramètres:', settingsError)
        throw new Error(`Erreur lors de la suppression des paramètres: ${settingsError.message}`)
      }
      console.log(`✅ [DB] Paramètres utilisateur supprimés`)

      // 6. Préférences de notification
      const { error: notifPrefsError } = await supabase
        .from('notification_preferences')
        .delete()
        .eq('user_id', userId)

      if (notifPrefsError) {
        console.error('❌ [DB] Erreur suppression préférences notifications:', notifPrefsError)
        // Non-bloquant : on continue même si ça échoue
      }
      console.log(`✅ [DB] Préférences de notification supprimées`)

      // 7. Subscriptions push
      const { error: pushSubsError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)

      if (pushSubsError) {
        console.error('❌ [DB] Erreur suppression push subscriptions:', pushSubsError)
        // Non-bloquant : on continue même si ça échoue
      }
      console.log(`✅ [DB] Push subscriptions supprimées`)

      // 8. Notifications envoyées
      const { error: sentNotifsError } = await supabase
        .from('sent_notifications')
        .delete()
        .eq('user_id', userId)

      if (sentNotifsError) {
        console.error('❌ [DB] Erreur suppression notifications envoyées:', sentNotifsError)
        // Non-bloquant : on continue même si ça échoue
      }
      console.log(`✅ [DB] Notifications envoyées supprimées`)

      // 9. Partages (en tant que propriétaire)
      const { error: sharedOwnerError } = await supabase
        .from('shared_dashboards')
        .delete()
        .eq('owner_user_id', userId)

      if (sharedOwnerError) {
        console.error('❌ [DB] Erreur suppression partages (owner):', sharedOwnerError)
        // Non-bloquant : on continue même si ça échoue
      }
      console.log(`✅ [DB] Partages (owner) supprimés`)

      // 10. Partages (en tant que destinataire)
      const { error: sharedWithError } = await supabase
        .from('shared_dashboards')
        .delete()
        .eq('shared_with_user_id', userId)

      if (sharedWithError) {
        console.error('❌ [DB] Erreur suppression partages (shared_with):', sharedWithError)
        // Non-bloquant : on continue même si ça échoue
      }
      console.log(`✅ [DB] Partages (shared_with) supprimés`)

      console.log(`✅ [DB] Toutes les données supprimées avec succès`)
    } catch (dbError) {
      console.error('❌ [DB] Erreur fatale lors de la suppression:', dbError)
      return NextResponse.json(
        {
          error: 'Erreur lors de la suppression des données internes',
          details: dbError instanceof Error ? dbError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

    // 3. Supprimer l'utilisateur Clerk
    try {
      console.log(`🔥 [Clerk] Début suppression utilisateur Clerk`)
      const client = await clerkClient()
      await client.users.deleteUser(userId)
      console.log(`✅ [Clerk] Utilisateur supprimé avec succès`)
    } catch (clerkError) {
      console.error('❌ [Clerk] Erreur lors de la suppression:', clerkError)

      // ATTENTION : État inconsistant (DB supprimée, Clerk non)
      // Le webhook user.deleted ne se déclenchera pas automatiquement
      // Mais les données DB sont déjà supprimées, donc on a fait le principal

      return NextResponse.json(
        {
          error: 'Erreur lors de la suppression du compte Clerk',
          details: clerkError instanceof Error ? clerkError.message : 'Unknown error',
          warning: 'Vos données internes ont été supprimées. Veuillez contacter le support pour finaliser la suppression de votre compte.'
        },
        { status: 500 }
      )
    }

    // 4. Succès complet
    console.log(`✅ [DELETE-ACCOUNT] Suppression totale réussie pour: ${userId}`)

    return NextResponse.json({
      success: true,
      message: 'Compte supprimé avec succès'
    })

  } catch (error) {
    console.error('❌ [DELETE-ACCOUNT] Erreur globale:', error)
    return NextResponse.json(
      {
        error: 'Erreur serveur',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
