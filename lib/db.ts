import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null

export const supabase = (() => {
  if (supabaseInstance) {
    return supabaseInstance
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    // Return a mock client during build time to prevent errors
    // The actual client will be created at runtime
    return null as unknown as SupabaseClient
  }
  
  supabaseInstance = createClient(supabaseUrl, supabaseKey)
  return supabaseInstance
})()
