/**
 * Clean Invalid Push Subscriptions
 *
 * This script removes all push subscriptions from the database.
 * Use this when VAPID keys have been regenerated.
 *
 * Usage:
 *   npx ts-node scripts/clean-invalid-subscriptions.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanSubscriptions() {
  try {
    console.log('🧹 Starting cleanup of push subscriptions...')

    // Count current subscriptions
    const { count: beforeCount, error: countError } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      throw countError
    }

    console.log(`📊 Found ${beforeCount} subscription(s) in database`)

    if (beforeCount === 0) {
      console.log('✅ No subscriptions to clean')
      return
    }

    // Ask for confirmation
    console.log('\n⚠️  This will delete ALL push subscriptions!')
    console.log('Users will need to re-enable notifications.')
    console.log('\nTo confirm, run this script with --confirm flag:')
    console.log('  npx ts-node scripts/clean-invalid-subscriptions.ts --confirm\n')

    if (!process.argv.includes('--confirm')) {
      console.log('❌ Aborted - no changes made')
      return
    }

    // Delete all subscriptions
    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (deleteError) {
      throw deleteError
    }

    console.log(`✅ Successfully deleted ${beforeCount} subscription(s)`)
    console.log('\n📝 Next steps:')
    console.log('1. Deploy the updated notification code to production')
    console.log('2. Notify users to re-enable notifications in settings')
    console.log('3. Monitor logs for successful notification sends')

  } catch (error) {
    console.error('❌ Error cleaning subscriptions:', error)
    process.exit(1)
  }
}

cleanSubscriptions()
