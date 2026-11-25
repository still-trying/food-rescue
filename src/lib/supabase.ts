import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const viteEnv = (import.meta as { env?: Record<string, string | undefined> })
  .env
const nodeEnv = (
  globalThis as {
    process?: { env?: Record<string, string | undefined> }
  }
).process?.env

const supabaseUrl = viteEnv?.VITE_SUPABASE_URL ?? nodeEnv?.VITE_SUPABASE_URL
const supabaseAnonKey =
  viteEnv?.VITE_SUPABASE_ANON_KEY ?? nodeEnv?.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are defined in your environment.'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
