// サイトで使うフォントを Google Fonts から取り直し、app/fonts/ に保存する。
// ふだんのビルドでは使わない(ビルドは app/fonts/ の保存済みファイルだけを読む)。
// フォントの種類・太さを変えたいときにだけ、ここを直してから実行する:
//   node scripts/fetch-fonts.mjs
//
// 取得する中身は next/font/google と同じにしている。URL の組み立て・代替フォントの補正値は
// next 自身の処理を呼んで求めるので、以前 next/font/google で読み込んでいたときと同じものになる。
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const G = path.join(root, "node_modules/next/dist/compiled/@next/font/dist/google");
const { getFontAxes } = require(`${G}/get-font-axes`);
const { getGoogleFontsUrl } = require(`${G}/get-google-fonts-url`);
const { fetchCSSFromGoogleFonts } = require(`${G}/fetch-css-from-google-fonts`);
const { getFallbackFontOverrideMetrics } = require(`${G}/get-fallback-font-override-metrics`);

// family: Google Fonts 上の名前 / dir: 保存先 / variable: CSS 変数名 / weights: 読み込む太さ("variable" は可変フォント)
const FONTS = [
  { family: "Afacad", dir: "afacad", variable: "--font-afacad", weights: ["variable"] },
  { family: "Noto Sans JP", dir: "noto-sans-jp", variable: "--font-noto-sans-jp", weights: ["400", "700"] },
  // 800 は読み込まない: Figtree の 800 は Avenir Heavy より太いため、800 指定時は 700 で描かせる。
  { family: "Figtree", dir: "figtree", variable: "--font-figtree", weights: ["400", "500", "700"] },
  { family: "Geist Mono", dir: "geist-mono", variable: "--font-geist-mono", weights: ["variable"] },
];

const HEADER = `/*
 * サイトで使うフォントを、ビルド中に Google Fonts へ取りに行かずリポジトリから配る。
 * 以前は next/font/google がビルドのたびに取得しており、取得に失敗すると CI が落ちていた。
 * このファイルは scripts/fetch-fonts.mjs が生成する。手で直さず、スクリプトを直して実行し直す。
 *
 * 中身は next/font/google が取得していたものと同じ:
 * - 各 @font-face と woff2 は Google Fonts の CSS API が返したものをそのまま保存(unicode-range で必要な文字の分だけ読む)
 * - "〜 Fallback" は next/font が作っていた代替フォント(読み込み前の仮表示で行の高さがずれないよう Arial を補正)
 * - 変数(--font-*)は以前 body のクラスで付いていたものと同じ値
 * ライセンスは各フォルダの OFL.txt(SIL Open Font License 1.1)。
 */
`;

const outDir = path.join(root, "app/fonts");
// 途中で失敗しても app/fonts/ が壊れないよう、全部を一時フォルダに落としてから最後に入れ替える。
const tmpDir = fs.mkdtempSync(path.join(outDir, ".tmp-"));
process.on("exit", () => fs.rmSync(tmpDir, { recursive: true, force: true }));
// Ctrl+C では exit が呼ばれないため、ここで終了させて上の片付けを走らせる
process.on("SIGINT", () => process.exit(130));
let css = HEADER;
for (const f of FONTS) {
  const url = getGoogleFontsUrl(f.family, getFontAxes(f.family, f.weights, ["normal"], undefined), "swap");
  let faces = (await fetchCSSFromGoogleFonts(url, f.family, false)).split("body {", 1)[0];
  const dir = path.join(tmpDir, f.dir);
  fs.mkdirSync(dir, { recursive: true });
  const urls = [...new Set([...faces.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]))];
  for (const u of urls) {
    // Google はまれに /l/font?kit=... という都度生成の URL を返す。保存名が壊れるので止めて、時間をおいて取り直す。
    if (!/^https:\/\/fonts\.gstatic\.com\/s\/[^?"']+\.woff2$/.test(u)) {
      throw new Error(`想定外の URL が返った(時間をおいて再実行する): ${u}`);
    }
    const res = await fetch(u);
    if (!res.ok) throw new Error(`${u}: ${res.status}`);
    const name = u.split("/").pop();
    fs.writeFileSync(path.join(dir, name), Buffer.from(await res.arrayBuffer()));
    faces = faces.split(u).join(`./${f.dir}/${name}`);
  }
  // 書式が変わって外部 URL が残ったり、1 つも保存できなかったりしたら、入れ替えずに止める
  if (urls.length === 0 || /url\(\s*["']?https?:/.test(faces)) {
    throw new Error(`${f.family}: Google の返した CSS の書式が想定と違う(フォントを保存できていない)`);
  }
  const m = getFallbackFontOverrideMetrics(f.family);
  css += `/* ===== ${f.family} ===== */\n${faces.trim()}\n`;
  css += `@font-face {\n  font-family: '${f.family} Fallback';\n  src: local("${m.fallbackFont}");\n`;
  css += `  ascent-override: ${m.ascentOverride};\n  descent-override: ${m.descentOverride};\n`;
  css += `  line-gap-override: ${m.lineGapOverride};\n  size-adjust: ${m.sizeAdjust};\n}\n\n`;
  console.log(`${f.family}: ${urls.length} files`);
}
css += `body {\n${FONTS.map((f) => `  ${f.variable}: '${f.family}', '${f.family} Fallback';\n`).join("")}}\n`;
// 全部そろったので入れ替える(各フォルダの OFL.txt は残し、woff2 だけ差し替える)
for (const f of FONTS) {
  const dir = path.join(outDir, f.dir);
  fs.mkdirSync(dir, { recursive: true });
  for (const file of fs.readdirSync(dir)) if (file.endsWith(".woff2")) fs.rmSync(path.join(dir, file));
  for (const file of fs.readdirSync(path.join(tmpDir, f.dir))) {
    fs.renameSync(path.join(tmpDir, f.dir, file), path.join(dir, file));
  }
}
fs.writeFileSync(path.join(outDir, "fonts.css"), css);
