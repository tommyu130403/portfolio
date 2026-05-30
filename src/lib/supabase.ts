import { createClient } from '@supabase/supabase-js'
import { Database } from '@/src/types/supabase'

const IS_DEV = process.env.NODE_ENV === "development";

// dev: NEXT_PUBLIC_DEV_SUPABASE_URL
// prod (CI): NEXT_PUBLIC_SUPABASE_URL (GitHub Secrets)
// prod (local build): NEXT_PUBLIC_PRO_SUPABASE_URL (fallback)
const supabaseUrl = (IS_DEV
  ? process.env.NEXT_PUBLIC_DEV_SUPABASE_URL
  : (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_PRO_SUPABASE_URL))!;

const supabaseAnonKey = (IS_DEV
  ? process.env.NEXT_PUBLIC_DEV_SUPABASE_ANON_KEY
  : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_PRO_SUPABASE_ANON_KEY))!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)