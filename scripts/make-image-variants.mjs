// 画像置き場(Storage の Portfolio)の画像から、表示の大きさに合わせた縮小版(WebP)を作って置く。
// 置き場所は _v/<幅>/<元のパス>.webp。画面(components/ProtectedImage.tsx)は縮小版を先に読み、無ければ元の画像を読む。
// 閲覧者が縮小版を読めるのは supabase/migrations/20261112120000_image_variants_read.sql を流したあと。
//
// 書き込みに管理用の鍵が要るため、オーナーが手元で実行する(鍵は環境変数で渡し、コマンドやファイルに書かない):
//   SUPABASE_URL=<プロジェクトの URL> SUPABASE_SERVICE_ROLE_KEY=<鍵> node scripts/make-image-variants.mjs          … 何を作るかの一覧だけ(書き込まない)
//   SUPABASE_URL=<プロジェクトの URL> SUPABASE_SERVICE_ROLE_KEY=<鍵> node scripts/make-image-variants.mjs --apply  … 作って置く
// --force を付けると、作成済みの縮小版も作り直す。画像を足したら --apply をもう一度実行する(作成済みは飛ばす)。
// 元の画像を同じ名前のまま差し替えたときは、作成済みとみなされて古い縮小版が残るため --force を付ける。
//
// sharp は next に同梱のものを使う(package.json には足していない)。
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "Portfolio";
const WIDTHS = [480, 960]; // components/ProtectedImage.tsx の VariantWidth・閲覧規則の SQL と揃える
const QUALITY = 80;
const VARIANT_ROOT = "_v";
const RASTER = /\.(png|jpe?g|webp)$/i;

const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("環境変数 SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を渡してください(値はコマンド履歴に残らない方法で)。");
  process.exit(1);
}
const storage = createClient(url, key, { auth: { persistSession: false } }).storage.from(BUCKET);

/** フォルダを下までたどって、ファイルのパスと大きさを集める */
async function listAll(prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`一覧の取得に失敗: ${prefix || "(最上位)"}: ${error.message}`);
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      // id が無いものはフォルダ
      if (item.id === null) files.push(...(await listAll(full)));
      else files.push({ path: full, size: item.metadata?.size ?? 0 });
    }
    if (data.length < 1000) break;
  }
  return files;
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

const all = await listAll();
const variants = new Set(all.filter((f) => f.path.startsWith(`${VARIANT_ROOT}/`)).map((f) => f.path));
const originals = all.filter((f) => !f.path.startsWith(`${VARIANT_ROOT}/`) && RASTER.test(f.path));
console.log(`元の画像 ${originals.length} 枚 / 作成済みの縮小版 ${variants.size} 枚 / ${apply ? "作成する" : "一覧のみ(--apply で作成)"}`);

let made = 0;
let skipped = 0;
let failed = 0;
let before = 0;
let after = 0;
for (const { path, size } of originals) {
  const targets = WIDTHS.map((w) => ({ w, path: `${VARIANT_ROOT}/${w}/${path}.webp` }))
    .filter((t) => force || !variants.has(t.path));
  if (targets.length === 0) {
    skipped += 1;
    continue;
  }
  if (!apply) {
    console.log(`  ${path}(${kb(size)})→ ${targets.map((t) => t.w).join(" / ")}px`);
    continue;
  }
  try {
    const { data, error } = await storage.download(path);
    if (error) throw new Error(error.message);
    const input = Buffer.from(await data.arrayBuffer());
    for (const t of targets) {
      const output = await sharp(input, { limitInputPixels: false })
        .rotate()
        .resize({ width: t.w, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer();
      const { error: upErr } = await storage.upload(t.path, output, { contentType: "image/webp", upsert: true });
      if (upErr) throw new Error(`${t.path}: ${upErr.message}`);
      before += input.length;
      after += output.length;
      made += 1;
      console.log(`  ${t.path}  ${kb(input.length)} → ${kb(output.length)}`);
    }
  } catch (e) {
    failed += 1;
    console.error(`  失敗: ${path}: ${e.message}`);
  }
}

if (apply) {
  console.log(`作成 ${made} 枚・飛ばした元画像 ${skipped} 枚・失敗 ${failed} 枚(元 ${kb(before)} → 縮小版 ${kb(after)}。元は幅ごとに数えている)`);
  if (failed > 0) process.exit(1);
}
