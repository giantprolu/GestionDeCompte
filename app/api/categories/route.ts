import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'income' ou 'expense'

    // Récupérer les catégories par défaut (is_custom = false)
    let defaultQuery = supabase
      .from('categories')
      .select('*')
      .eq('is_custom', false)
      .order('name', { ascending: true })

    if (type) {
      defaultQuery = defaultQuery.eq('type', type)
    }

    const { data: defaultCategories, error: defaultError } = await defaultQuery
    if (defaultError) throw defaultError

    let userCategories: typeof defaultCategories = []

    // Si l'utilisateur est authentifié, récupérer ses catégories personnalisées
    if (userId) {
      let userQuery = supabase
        .from('categories')
        .select('*')
        .eq('is_custom', true)
        .eq('user_id', userId)
        .order('name', { ascending: true })

      if (type) {
        userQuery = userQuery.eq('type', type)
      }

      const { data: userCategoriesData, error: userError } = await userQuery
      if (userError) throw userError
      userCategories = userCategoriesData || []
    }

    // Combiner les deux listes
    const allCategories = [...(defaultCategories || []), ...userCategories]

    return NextResponse.json(allCategories)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des catégories' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { name, type, icon, color } = body

    if (!name || !type) {
      return NextResponse.json({ error: 'Nom et type requis' }, { status: 400 })
    }

    if (type !== 'income' && type !== 'expense') {
      return NextResponse.json({ error: 'Type invalide (income ou expense)' }, { status: 400 })
    }

    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        name,
        type,
        icon: icon || '📦',
        color: color || '#6366f1',
        user_id: userId,
        is_custom: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Insert error:', error)
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Une catégorie avec ce nom existe déjà' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la création de la catégorie' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('id')

    if (!categoryId) {
      return NextResponse.json({ error: 'ID de la catégorie requis' }, { status: 400 })
    }

    // Vérifier que la catégorie est personnalisée et appartient à l'utilisateur
    const { data: category, error: fetchError } = await supabase
      .from('categories')
      .select('id, is_custom, user_id')
      .eq('id', categoryId)
      .single()

    if (fetchError || !category) {
      return NextResponse.json({ error: 'Catégorie non trouvée' }, { status: 404 })
    }

    if (!category.is_custom) {
      return NextResponse.json({ error: 'Impossible de supprimer une catégorie par défaut' }, { status: 403 })
    }

    if (category.user_id !== userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId)

    if (error) {
      console.error('Delete error:', error)
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la suppression de la catégorie' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('id')

    if (!categoryId) {
      return NextResponse.json({ error: 'ID de la catégorie requis' }, { status: 400 })
    }

    const body = await request.json()
    const { name, icon, color } = body

    // Vérifier que la catégorie est personnalisée et appartient à l'utilisateur
    const { data: category, error: fetchError } = await supabase
      .from('categories')
      .select('id, is_custom, user_id')
      .eq('id', categoryId)
      .single()

    if (fetchError || !category) {
      return NextResponse.json({ error: 'Catégorie non trouvée' }, { status: 404 })
    }

    if (!category.is_custom) {
      return NextResponse.json({ error: 'Impossible de modifier une catégorie par défaut' }, { status: 403 })
    }

    if (category.user_id !== userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const updateData: Record<string, string> = {}
    if (name) updateData.name = name
    if (icon) updateData.icon = icon
    if (color) updateData.color = color

    const { data: updatedCategory, error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', categoryId)
      .select()
      .single()

    if (error) {
      console.error('Update error:', error)
      throw error
    }

    return NextResponse.json(updatedCategory)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Erreur lors de la modification de la catégorie' }, { status: 500 })
  }
}
