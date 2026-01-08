/**
 * Script de migration des utilisateurs Clerk de Dev vers Prod
 * 
 * Ce script permet de migrer les données des utilisateurs de l'environnement 
 * de développement Clerk vers l'environnement de production.
 * 
 * IMPORTANT: Les user_id Clerk changent entre dev et prod !
 * Ce script met à jour les références user_id dans Supabase.
 * 
 * Prérequis:
 * 1. Avoir les clés API des deux environnements Clerk (dev et prod)
 * 2. Avoir un accès à la base de données Supabase
 * 3. Les utilisateurs doivent se reconnecter en prod pour obtenir leur nouveau user_id
 * 
 * Usage:
 * npx ts-node scripts/migrate-clerk-users.ts
 * 
 * Ou avec les variables d'environnement:
 * CLERK_DEV_SECRET_KEY=sk_test_xxx CLERK_PROD_SECRET_KEY=sk_live_xxx npx ts-node scripts/migrate-clerk-users.ts
 */

// Charger les variables d'environnement depuis .env
import { config } from 'dotenv'
config()

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Variables globales - initialisées dans main()
let supabase: SupabaseClient
let CLERK_DEV_SECRET_KEY: string
let CLERK_PROD_SECRET_KEY: string

// Tables contenant des références user_id
const TABLES_WITH_USER_ID = [
  { table: 'accounts', column: 'user_id' },
  { table: 'credits', column: 'user_id' },
  { table: 'month_closures', column: 'user_id' },
  { table: 'user_settings', column: 'user_id' },
  { table: 'notification_preferences', column: 'user_id' },
  { table: 'push_subscriptions', column: 'user_id' },
  { table: 'sent_notifications', column: 'user_id' },
  { table: 'shared_dashboards', column: 'owner_user_id' },
  { table: 'shared_dashboards', column: 'shared_with_user_id' },
]

interface ClerkUser {
  id: string
  email_addresses: Array<{ email_address: string }>
  username: string | null
  first_name: string | null
  last_name: string | null
  created_at: number
}

interface MigrationMapping {
  devUserId: string
  prodUserId: string
  email: string
}

async function fetchClerkUsers(secretKey: string): Promise<ClerkUser[]> {
  const response = await fetch('https://api.clerk.com/v1/users?limit=500', {
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Clerk API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

async function createMigrationMapping(): Promise<MigrationMapping[]> {
  console.log('📥 Récupération des utilisateurs Clerk Dev...')
  const devUsers = await fetchClerkUsers(CLERK_DEV_SECRET_KEY)
  console.log(`   Trouvé ${devUsers.length} utilisateurs en Dev`)

  console.log('📥 Récupération des utilisateurs Clerk Prod...')
  const prodUsers = await fetchClerkUsers(CLERK_PROD_SECRET_KEY)
  console.log(`   Trouvé ${prodUsers.length} utilisateurs en Prod`)

  // Créer un mapping basé sur l'email (identifiant stable entre dev et prod)
  const mappings: MigrationMapping[] = []
  const prodUsersByEmail = new Map<string, ClerkUser>()

  for (const user of prodUsers) {
    const email = user.email_addresses[0]?.email_address
    if (email) {
      prodUsersByEmail.set(email.toLowerCase(), user)
    }
  }

  for (const devUser of devUsers) {
    const email = devUser.email_addresses[0]?.email_address
    if (!email) continue

    const prodUser = prodUsersByEmail.get(email.toLowerCase())
    if (prodUser) {
      mappings.push({
        devUserId: devUser.id,
        prodUserId: prodUser.id,
        email: email,
      })
    } else {
      console.warn(`⚠️  Utilisateur ${email} n'existe pas encore en prod`)
    }
  }

  return mappings
}

async function migrateUserData(mapping: MigrationMapping): Promise<void> {
  console.log(`\n🔄 Migration de ${mapping.email}`)
  console.log(`   Dev ID: ${mapping.devUserId} → Prod ID: ${mapping.prodUserId}`)

  for (const { table, column } of TABLES_WITH_USER_ID) {
    // Vérifier si des données existent pour cet utilisateur
    const { data: existingData, error: selectError } = await supabase
      .from(table)
      .select('id')
      .eq(column, mapping.devUserId)

    if (selectError) {
      console.error(`   ❌ Erreur lecture ${table}.${column}: ${selectError.message}`)
      continue
    }

    if (!existingData || existingData.length === 0) {
      continue
    }

    // Mettre à jour le user_id
    const { error: updateError } = await supabase
      .from(table)
      .update({ [column]: mapping.prodUserId })
      .eq(column, mapping.devUserId)

    if (updateError) {
      console.error(`   ❌ Erreur migration ${table}.${column}: ${updateError.message}`)
    } else {
      console.log(`   ✅ ${table}.${column}: ${existingData.length} enregistrement(s) migré(s)`)
    }
  }
}

async function generateMigrationReport(mappings: MigrationMapping[]): Promise<void> {
  console.log('\n📊 Rapport de migration')
  console.log('========================')

  for (const { table, column } of TABLES_WITH_USER_ID) {
    // Compter les entrées avec des user_id dev (non migrées)
    const devUserIds = mappings.map(m => m.devUserId)
    
    if (devUserIds.length === 0) continue

    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .in(column, devUserIds)

    if (count && count > 0) {
      console.log(`   ⚠️  ${table}.${column}: ${count} entrée(s) avec user_id dev restantes`)
    }
  }
}

async function createUserIdMappingTable(): Promise<void> {
  // Créer une table de mapping pour référence future
  console.log('\n📝 Création de la table de mapping user_id...')

  const { error } = await supabase.rpc('create_user_id_mapping_table', {})
  
  if (error && !error.message.includes('already exists')) {
    console.warn('   ⚠️  La table de mapping ne peut pas être créée automatiquement.')
    console.log('   Exécutez ce SQL manuellement si nécessaire:')
    console.log(`
CREATE TABLE IF NOT EXISTS user_id_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dev_user_id TEXT NOT NULL,
  prod_user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  migrated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dev_user_id),
  UNIQUE(prod_user_id)
);
    `)
  }
}

async function saveMappings(mappings: MigrationMapping[]): Promise<void> {
  console.log('\n💾 Sauvegarde des mappings...')

  for (const mapping of mappings) {
    const { error } = await supabase
      .from('user_id_migrations')
      .upsert({
        dev_user_id: mapping.devUserId,
        prod_user_id: mapping.prodUserId,
        email: mapping.email,
      }, {
        onConflict: 'dev_user_id'
      })

    if (error && !error.message.includes('does not exist')) {
      console.error(`   ❌ Erreur sauvegarde mapping pour ${mapping.email}: ${error.message}`)
    }
  }
}

async function main() {
  console.log('🚀 Migration des utilisateurs Clerk Dev → Prod')
  console.log('==============================================\n')

  // Récupérer les variables d'environnement
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Vérifications préalables
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Variables SUPABASE manquantes (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
    process.exit(1)
  }

  // Initialiser les variables globales
  CLERK_DEV_SECRET_KEY = process.env.CLERK_DEV_SECRET_KEY || ''
  CLERK_PROD_SECRET_KEY = process.env.CLERK_PROD_SECRET_KEY || ''

  if (!CLERK_DEV_SECRET_KEY || !CLERK_PROD_SECRET_KEY) {
    console.error('❌ Variables CLERK manquantes (CLERK_DEV_SECRET_KEY, CLERK_PROD_SECRET_KEY)')
    console.log('\nUsage:')
    console.log('CLERK_DEV_SECRET_KEY=sk_test_xxx CLERK_PROD_SECRET_KEY=sk_live_xxx npx ts-node scripts/migrate-clerk-users.ts')
    process.exit(1)
  }

  // Initialiser le client Supabase
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // 1. Créer le mapping entre user_id dev et prod
    const mappings = await createMigrationMapping()

    if (mappings.length === 0) {
      console.log('\n⚠️  Aucun utilisateur à migrer.')
      console.log('   Les utilisateurs doivent d\'abord se connecter en prod pour créer leur compte.')
      process.exit(0)
    }

    console.log(`\n✅ ${mappings.length} utilisateur(s) trouvé(s) pour la migration`)

    // 2. Afficher un aperçu
    console.log('\n📋 Aperçu des migrations:')
    for (const mapping of mappings) {
      console.log(`   ${mapping.email}: ${mapping.devUserId} → ${mapping.prodUserId}`)
    }

    // 3. Demander confirmation (si en mode interactif)
    if (process.stdin.isTTY) {
      console.log('\n⚠️  Cette opération va modifier la base de données.')
      console.log('   Appuyez sur Entrée pour continuer ou Ctrl+C pour annuler...')
      await new Promise<void>(resolve => {
        process.stdin.once('data', () => resolve())
      })
    }

    // 4. Créer la table de mapping si elle n'existe pas
    await createUserIdMappingTable()

    // 5. Sauvegarder les mappings
    await saveMappings(mappings)

    // 6. Effectuer la migration
    for (const mapping of mappings) {
      await migrateUserData(mapping)
    }

    // 7. Générer le rapport
    await generateMigrationReport(mappings)

    console.log('\n✅ Migration terminée!')
    console.log('\n📝 Prochaines étapes:')
    console.log('   1. Mettre à jour les variables d\'environnement pour pointer vers Clerk Prod')
    console.log('   2. Configurer le webhook Clerk en production')
    console.log('   3. Tester la connexion des utilisateurs')

  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error)
    process.exit(1)
  }
}

// Exécuter le script
main()
