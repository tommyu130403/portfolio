import { createClient } from '@supabase/supabase-js'
import { Database } from '@/src/types/supabase'
import { createFixtureClient } from "@/src/lib/fixture-client";

const IS_DEV = process.env.NODE_ENV === "development";

// dev: NEXT_PUBLIC_DEV_SUPABASE_URL
// prod (CI): NEXT_PUBLIC_SUPABASE_URL (GitHub Secrets)
// prod (local build): NEXT_PUBLIC_PRO_SUPABASE_URL (fallback)
// どれも無ければ fixture (src/lib/fixture-client.ts)
const supabaseUrl = IS_DEV
  ? process.env.NEXT_PUBLIC_DEV_SUPABASE_URL
  : (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_PRO_SUPABASE_URL);

const supabaseAnonKey = IS_DEV
  ? process.env.NEXT_PUBLIC_DEV_SUPABASE_ANON_KEY
  : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_PRO_SUPABASE_ANON_KEY);

const url = supabaseUrl?.trim();
const anonKey = supabaseAnonKey?.trim();

type PortfolioSupabaseClient = ReturnType<typeof createClient<Database>>;

export const supabase: PortfolioSupabaseClient =
  url && anonKey
    ? createClient<Database>(url, anonKey)
    : (createFixtureClient() as unknown as PortfolioSupabaseClient);
