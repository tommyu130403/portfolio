type Row = Record<string, unknown>;

const FIXTURE_URL = "https://fixture.invalid";
const FIXTURE_SESSION = { access_token: "fixture", user: { id: "fixture-reader" } };

function fixtureResult(data: unknown) {
  return { data, error: null, count: null, status: 200, statusText: "OK" };
}

function fixtureError(message: string, code = "FIXTURE") {
  return {
    data: null,
    error: { message, details: "", hint: "", code },
    count: null,
    status: 400,
    statusText: "Bad Request",
  };
}

type SelectSpec =
  | { kind: "all" }
  | { kind: "col"; name: string }
  | { kind: "rel"; name: string; inner: string };

function parseSelect(columns: string): SelectSpec[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of columns) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p): SelectSpec => {
      if (p === "*") return { kind: "all" };
      const rel = /^(\w+)\s*\(([\s\S]*)\)$/.exec(p);
      if (rel) return { kind: "rel", name: rel[1], inner: rel[2] };
      return { kind: "col", name: p };
    });
}

const RELATION_FK: Record<string, string> = {
  contents_vocab: "content_id",
  tools_vocab: "tool_id",
};

function project(row: Row, specs: SelectSpec[], tables: Record<string, Row[] | undefined>): Row {
  const out: Row = {};
  for (const spec of specs) {
    if (spec.kind === "all") {
      Object.assign(out, row);
    } else if (spec.kind === "col") {
      out[spec.name] = row[spec.name];
    } else {
      const fk = RELATION_FK[spec.name];
      const target = fk ? tables[spec.name]?.find((r) => r.id === row[fk]) : undefined;
      out[spec.name] = target ? project(target, parseSelect(spec.inner), tables) : null;
    }
  }
  return out;
}

type OrderSpec = { column: string; ascending: boolean; nullsFirst: boolean };
type Filter = (row: Row) => boolean;
type Mode = "normal" | "single" | "maybeSingle";

function createQuery(table: string) {
  let columns = "*";
  const filters: Filter[] = [];
  const orders: OrderSpec[] = [];
  let limitN: number | null = null;
  let mode: Mode = "normal";
  let isWrite = false;

  const query = {
    select(cols = "*") {
      columns = cols;
      return query;
    },
    eq(c: string, v: unknown) {
      filters.push((r) => r[c] === v);
      return query;
    },
    neq(c: string, v: unknown) {
      filters.push((r) => r[c] !== v);
      return query;
    },
    in(c: string, values: unknown[]) {
      filters.push((r) => values.some((v) => r[c] === v));
      return query;
    },
    is(c: string, v: unknown) {
      filters.push((r) => r[c] === v);
      return query;
    },
    ilike(c: string, pattern: string) {
      const source = pattern
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/%/g, ".*")
        .replace(/_/g, ".");
      const re = new RegExp(`^${source}$`, "i");
      filters.push((r) => re.test(String(r[c] ?? "")));
      return query;
    },
    order(c: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
      const ascending = opts?.ascending ?? true;
      orders.push({ column: c, ascending, nullsFirst: opts?.nullsFirst ?? !ascending });
      return query;
    },
    limit(n: number) {
      limitN = n;
      return query;
    },
    single() {
      mode = "single";
      return query;
    },
    maybeSingle() {
      mode = "maybeSingle";
      return query;
    },
    insert() {
      isWrite = true;
      return query;
    },
    update() {
      isWrite = true;
      return query;
    },
    upsert() {
      isWrite = true;
      return query;
    },
    delete() {
      isWrite = true;
      return query;
    },
    then<R1 = unknown, R2 = never>(
      onfulfilled?: ((value: unknown) => R1 | PromiseLike<R1>) | null,
      onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
    ): Promise<R1 | R2> {
      return execute().then(onfulfilled, onrejected);
    },
  };

  function compare(a: unknown, b: unknown): number {
    if (a === b) return 0;
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
    const sa = String(a);
    const sb = String(b);
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  }

  async function execute(): Promise<unknown> {
    try {
      if (isWrite) return fixtureError("フィクスチャモードは読み取り専用です");
      const { FIXTURE_TABLES } = await import("./fixtures/data");
      const tables: Record<string, Row[] | undefined> = FIXTURE_TABLES;
      const source = tables[table];
      if (!source) return fixtureError(`fixture に ${table} がありません`, "42P01");

      let rows = source.filter((r) => filters.every((f) => f(r)));
      rows = [...rows].sort((a, b) => {
        for (const o of orders) {
          const av = a[o.column];
          const bv = b[o.column];
          const aNull = av === null || av === undefined;
          const bNull = bv === null || bv === undefined;
          if (aNull || bNull) {
            if (aNull && bNull) continue;
            return aNull === o.nullsFirst ? -1 : 1;
          }
          const c = compare(av, bv);
          if (c !== 0) return o.ascending ? c : -c;
        }
        return 0;
      });
      if (limitN !== null) rows = rows.slice(0, limitN);
      const specs = parseSelect(columns);
      const projected = rows.map((r) => project(r, specs, tables));

      const singleError = () =>
        fixtureError("JSON object requested, multiple (or no) rows returned", "PGRST116");
      if (mode === "single") {
        return projected.length === 1 ? fixtureResult(projected[0]) : singleError();
      }
      if (mode === "maybeSingle") {
        if (projected.length === 0) return fixtureResult(null);
        return projected.length === 1 ? fixtureResult(projected[0]) : singleError();
      }
      return fixtureResult(projected);
    } catch (e) {
      return fixtureError(String(e));
    }
  }

  return query;
}

let warned = false;

export function createFixtureClient(): unknown {
  if (!warned) {
    warned = true;
    console.warn(
      "[portfolio] Supabase の環境変数が無いため、フィクスチャ (src/lib/fixtures/data.ts) で表示します",
    );
  }

  const storageUnavailable = () =>
    Promise.resolve(fixtureError("フィクスチャモードではストレージを使えません"));

  return {
    from: (table: string) => createQuery(table),
    rpc: (name: string) =>
      Promise.resolve(
        name === "portfolio_access_role"
          ? fixtureResult("reader")
          : fixtureError("フィクスチャモードでは RPC を実行できません"),
      ),
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string, opts?: { transform?: unknown }) => ({
          data: {
            publicUrl: opts?.transform
              ? `${FIXTURE_URL}/storage/v1/render/image/public/${bucket}/${path}`
              : `${FIXTURE_URL}/storage/v1/object/public/${bucket}/${path}`,
          },
        }),
        createSignedUrl: storageUnavailable,
        upload: storageUnavailable,
        remove: storageUnavailable,
        list: storageUnavailable,
      }),
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: FIXTURE_SESSION }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
      signInWithPassword: () =>
        Promise.resolve({
          data: { user: null, session: null },
          error: { message: "フィクスチャモードではログインできません" },
        }),
    },
  };
}
