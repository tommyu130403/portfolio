/**
 * サーバー専用 Supabase クライアント（サービスロールキー使用）
 *
 * 使用場所: Server Actions / API Routes のみ。
 * クライアントコンポーネントからは import しないこと。
 * サービスロールは RLS をバイパスするため、管理者処理専用とする。
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/supabase";

let _admin: ReturnType<typeof createClient<Database>> | null = null;

function getSupabaseAdmin() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY を .env.local に設定してください（サーバー専用）。"
    );
  }
  _admin = createClient<Database>(url, key, { auth: { persistSession: false } });
  return _admin;
}

export { getSupabaseAdmin };
