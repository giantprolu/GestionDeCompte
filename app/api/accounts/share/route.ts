import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/db'

// GET /api/accounts/share - Récupérer les partages de dashboard
export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer les partages de dashboard de l'utilisateur
    const { data: shares } = await supabase
      .from('shared_dashboards')
      .select('*')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false })

    // Enrichir avec les usernames depuis Clerk
    if (shares && shares.length > 0) {
      const { clerkClient } = await import('@clerk/nextjs/server')
      const client = await clerkClient()
      
      const enrichedShares = await Promise.all(
        shares.map(async (share) => {
          try {
            const user = await client.users.getUser(share.shared_with_user_id)
            return {
              ...share,
              username: user.username || user.emailAddresses[0]?.emailAddress || share.shared_with_user_id
            }
          } catch (error) {
            console.error('Erreur récupération user:', error)
            return {
              ...share,
              username: share.shared_with_user_id
            }
          }
        })
      )
      
      return NextResponse.json(enrichedShares)
    }

    return NextResponse.json(shares || [])
  } catch (error) {
    console.error('Erreur lors de la récupération des partages:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/accounts/share - Créer un nouveau partage de dashboard
export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { sharedWithUserId, permission } = body

    if (!sharedWithUserId || !permission) {
      return NextResponse.json(
        { error: 'Nom d\'utilisateur et permission sont requis' },
        { status: 400 }
      )
    }

    if (!['view', 'edit'].includes(permission)) {
      return NextResponse.json(
        { error: 'Permission invalide (view ou edit)' },
        { status: 400 }
      )
    }

    // Récupérer l'ID utilisateur depuis le username via Clerk
    const { clerkClient } = await import('@clerk/nextjs/server')
    const client = await clerkClient()
    const users = await client.users.getUserList({
      username: [sharedWithUserId]
    })

    if (!users.data || users.data.length === 0) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    const targetUserId = users.data[0].id

    // Vérifier que le partage n'existe pas déjà
    const { data: existingShare } = await supabase
      .from('shared_dashboards')
      .select('*')
      .eq('owner_user_id', userId)
      .eq('shared_with_user_id', targetUserId)
      .single()

    if (existingShare) {
      return NextResponse.json(
        { error: 'Votre dashboard est déjà partagé avec cet utilisateur' },
        { status: 409 }
      )
    }

    // Créer le partage
    const { data: newShare, error: insertError } = await supabase
      .from('shared_dashboards')
      .insert({
        owner_user_id: userId,
        shared_with_user_id: targetUserId,
        permission
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json(newShare, { status: 201 })
  } catch (error) {
    console.error('Erreur lors de la création du partage:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/accounts/share - Supprimer un partage
export async function DELETE(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const shareId = searchParams.get('shareId')

    if (!shareId) {
      return NextResponse.json({ error: 'shareId requis' }, { status: 400 })
    }

    // Vérifier que l'utilisateur est le propriétaire
    const { data: share } = await supabase
      .from('shared_dashboards')
      .select('*')
      .eq('id', shareId)
      .eq('owner_user_id', userId)
      .single()

    if (!share) {
      return NextResponse.json(
        { error: 'Partage non trouvé ou non autorisé' },
        { status: 404 }
      )
    }

    // Supprimer le partage
    await supabase
      .from('shared_dashboards')
      .delete()
      .eq('id', shareId)

    return NextResponse.json({ message: 'Partage supprimé avec succès' })
  } catch (error) {
    console.error('Erreur lors de la suppression du partage:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH /api/accounts/share - Modifier les permissions d'un partage
export async function PATCH(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { shareId, permission } = body

    if (!shareId || !permission) {
      return NextResponse.json(
        { error: 'shareId et permission sont requis' },
        { status: 400 }
      )
    }

    if (!['view', 'edit'].includes(permission)) {
      return NextResponse.json(
        { error: 'Permission invalide (view ou edit)' },
        { status: 400 }
      )
    }

    // Vérifier que l'utilisateur est le propriétaire
    const { data: share } = await supabase
      .from('shared_dashboards')
      .select('*')
      .eq('id', shareId)
      .eq('owner_user_id', userId)
      .single()

    if (!share) {
      return NextResponse.json(
        { error: 'Partage non trouvé ou non autorisé' },
        { status: 404 }
      )
    }

    // Mettre à jour les permissions
    const { data: updatedShare, error: updateError } = await supabase
      .from('shared_dashboards')
      .update({ permission })
      .eq('id', shareId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json(updatedShare)
  } catch (error) {
    console.error('Erreur lors de la modification du partage:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
