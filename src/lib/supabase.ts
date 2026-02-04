import { createClient } from '@supabase/supabase-js'
import { Database } from '@/src/types/supabase' // 先ほど生成した型ファイル

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 型安全なSupabaseクライアントをエクスポート
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)