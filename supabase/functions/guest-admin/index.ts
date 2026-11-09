import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://tommyu130403.github.io";
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const ID_LENGTH = 12;
// Keep in sync with lib/guestId.ts (GUEST_EMAIL_DOMAIN) and the LIKE checks in
// supabase/migrations/20261108120000_guest_id_expiry.sql. Deno cannot import from lib/.
const GUEST_DOMAIN = "guest.invalid";

function isAllowedOrigin(origin: string): boolean {
  return origin === ALLOWED_ORIGIN || LOCAL_ORIGIN.test(origin);
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Rejection sampling: discard bytes that would bias the modulo.
function generateId(): string {
  const limit = 256 - (256 % ID_ALPHABET.length);
  let out = "";
  while (out.length < ID_LENGTH) {
    const bytes = new Uint8Array(ID_LENGTH * 2);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b >= limit) continue;
      out += ID_ALPHABET[b % ID_ALPHABET.length];
      if (out.length === ID_LENGTH) break;
    }
  }
  return out;
}

async function handle(req: Request): Promise<Response> {
  const origin = req.headers.get("Origin");
  const cors: Record<string, string> = {};
  if (origin) {
    if (!isAllowedOrigin(origin)) return json({ error: "forbidden_origin" }, 403, cors);
    cors["Access-Control-Allow-Origin"] = origin;
    cors["Vary"] = "Origin";
    cors["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";
    cors["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const password = Deno.env.get("GUEST_SHARED_PASSWORD");
  if (!url || !anonKey || !serviceKey || !password) {
    return json({ error: "server_misconfigured" }, 500, cors);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) return json({ error: "unauthorized" }, 401, cors);
  const jwt = match[1];

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData?.user) return json({ error: "unauthorized" }, 401, cors);

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: role, error: roleError } = await caller.rpc("portfolio_access_role");
  if (roleError || role !== "owner") return json({ error: "forbidden" }, 403, cors);

  let action: unknown;
  try {
    const body = await req.json();
    action = body?.action;
  } catch {
    return json({ error: "bad_request" }, 400, cors);
  }

  if (action === "issue") {
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = generateId();
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: `${id}@${GUEST_DOMAIN}`,
        password,
        email_confirm: true,
      });
      if (createError || !created?.user) {
        const message = createError?.message ?? "no user returned";
        if (/already|exists|registered/i.test(message)) continue;
        console.error("createUser failed:", message);
        return json({ error: "create_failed", detail: message }, 502, cors);
      }
      const userId = created.user.id;
      const { data: expiresAt, error: registerError } = await caller.rpc("owner_register_guest", {
        p_user_id: userId,
      });
      if (registerError) {
        console.error("owner_register_guest failed:", registerError.message);
        const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
        if (deleteError) console.error("cleanup deleteUser failed for", userId, deleteError.message);
        return json({ error: "register_failed" }, 500, cors);
      }
      return json({ loginId: id, expiresAt }, 200, cors);
    }
    return json({ error: "create_failed", detail: "id_collision" }, 502, cors);
  }

  if (action === "reset-password") {
    const { data: rows, error: listError } = await caller.rpc("owner_list_guests");
    if (listError) {
      console.error("owner_list_guests failed:", listError.message);
      return json({ error: "list_failed" }, 500, cors);
    }
    const now = Date.now();
    const targets = (rows ?? []).filter(
      (r: { login_id: string; expires_at: string | null }) =>
        !r.login_id.includes("@") && (r.expires_at === null || new Date(r.expires_at).getTime() > now),
    );
    let updated = 0;
    let failed = 0;
    for (const t of targets as { user_id: string }[]) {
      const { error } = await admin.auth.admin.updateUserById(t.user_id, { password });
      if (error) {
        console.error("updateUserById failed:", error.message);
        failed++;
      } else {
        updated++;
      }
    }
    return json({ updated, failed }, 200, cors);
  }

  return json({ error: "bad_request" }, 400, cors);
}

Deno.serve(async (req: Request) => {
  try {
    return await handle(req);
  } catch (e) {
    console.error("unexpected error:", e instanceof Error ? e.message : String(e));
    const origin = req.headers.get("Origin");
    const cors: Record<string, string> = origin && isAllowedOrigin(origin)
      ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" }
      : {};
    return json({ error: "internal_error" }, 500, cors);
  }
});
