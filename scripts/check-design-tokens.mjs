// 公開ページの文字と色が、デザインのルールどおりに書かれているかを調べる。
// 方針: 色と書体はトークン必須、大きさ・太さ・行間・字間は Figma の数値(自由)。
//   - 色: #hex・rgb()・名前書き(white 等)・Tailwind 標準パレット色・不透明度の接尾辞(bg-x/10)・割合つき color-mix は禁止
//         (色のトークン、または app/globals.css の α 付きトークン(bg-main-100-a10 など)を使う)
//   - 書体: [font-family:...]・font-serif・font: 省略記法・style の fontFamily 直書きは禁止
//         (font-en / font-body / font-noto / font-sans / font-guide / font-mono を使う)
// 違反があれば file:line を表示して exit 1。
// 例外: コメントの中に `token-exception:` を書く(文字列の中は無効)。
//   - 同じ行にあれば、その行を除外
//   - コメントだけの行(コードが無い行)にあれば、次の 1 行も除外(連鎖はしない)
// 使い方: node scripts/check-design-tokens.mjs [調べるルートディレクトリ(省略時はカレント)]
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.argv[2] ?? process.cwd();

const walk = (dir) =>
  !existsSync(dir)
    ? []
    : readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : [p];
      });

const isSource = (p) => /\.(tsx?|jsx?|css)$/.test(p) && !/\.d\.ts$/.test(p);

const libExcluded = new Set(["design-tokens.ts", "service-brands.ts", "work-category-color.ts"]);

const files = [
  ...walk(join(ROOT, "components")).filter((p) => isSource(p) && !p.endsWith("RichMarkdownEditor.tsx")),
  ...walk(join(ROOT, "src")).filter(isSource),
  ...walk(join(ROOT, "lib")).filter((p) => isSource(p) && !libExcluded.has(p.split("/").pop())),
  ...["app/page.tsx", "app/not-found.tsx", "app/layout.tsx"].map((n) => join(ROOT, n)).filter(existsSync),
  ...walk(join(ROOT, "app/works")).filter(isSource),
];

const PALETTE =
  "white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const NAMED =
  "white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|cyan|magenta|silver|gold|navy|teal|lime|aqua|brown|maroon|olive|crimson|coral|salmon|violet|indigo";
const COLOR_UTIL = "bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|fill|stroke|from|to|via|outline|decoration|divide|shadow|text-shadow|accent|caret|placeholder";
const COLOR_KEYS =
  "fill|stroke|stop-?color|stopColor|flood-?color|floodColor|color|background(?:-?[cC]olor|-?[iI]mage)?|border(?:-?[cC]olor)?|outline(?:-?[cC]olor)?|box-?[sS]hadow|text-?[sS]hadow|filter|caret-?[cC]olor|accent-?[cC]olor|text-?[dD]ecoration-?[cC]olor";
// app/globals.css で定義している色の変数名(Tailwind 標準の --color-red-500 などは使わせない)
const DEFINED_COLORS = new Set(
  [...readFileSync(join(ROOT, "app/globals.css"), "utf8").matchAll(/--color-([a-z0-9-]+)\s*:/gi)].map((m) => m[1]),
);
// 例外の目印を書いてよいファイル(オーナー承認済み: ブラウザ枠の信号色・ブランド地)
const MARKER_ALLOWED = new Set(["DeviceMock.tsx", "WorkThumbnail.tsx"]);
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w])/g;

// 各ルールは「コメントを除いたファイル全体」から違反位置(文字の位置)を返す。複数行にまたがる書き方も拾うため。
const rules = [
  {
    name: "書体の直書き",
    find: (t) => [
      ...matchAll(t, /\[font-family:|\[font:|font-\[(?!\d)|(?<![\w-])font-serif(?![\w-])/g),
      ...matchAll(t, /font-family\s*:|["']fontFamily["']|\bfontFamily\s*:/g),
      ...matchAll(t, /(?<![\w-])font\s*:\s*["'`](?!inherit)/g),
    ],
  },
  {
    name: "直書きの色",
    find: (t) => {
      const out = [];
      for (const m of t.matchAll(HEX)) {
        const before = t.slice(Math.max(0, m.index - 40), m.index);
        if (/[\w&/.]$/.test(before)) continue; // URL の断片・文字参照
        if (/\b(href|to|src|id|htmlFor)\s*=\s*\{?\s*["'`]$/.test(before)) continue; // ページ内リンク
        out.push(m.index);
      }
      out.push(...matchAll(t, /(?<![\w-])(rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/g));
      out.push(...matchAll(t, /(?<![\w-])color\(\s*(srgb|srgb-linear|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz)/g));
      return out;
    },
  },
  {
    name: "色の名前書き",
    find: (t) => {
      const out = [];
      // Tailwind の任意値 […] の中(bg-[color:white] / shadow-[0_0_4px_white] など)
      out.push(...matchAll(t, new RegExp(`-\\[[^\\]\\s]*(?<![A-Za-z0-9-])(?:${NAMED})(?![A-Za-z0-9-])[^\\]\\s]*\\]`, "gi")));
      // 任意プロパティ [color:white] など(先頭に - が無い書き方)
      out.push(...matchAll(t, new RegExp(`(?<![\\w\\]-])\\[[a-z-]+:[^\\]\\s]*(?<![A-Za-z0-9-])(?:${NAMED})(?![A-Za-z0-9-])[^\\]\\s]*\\]`, "gi")));
      // fill= / stopColor= / color: / background: / boxShadow: などの値(文字列)の中。複数行にまたがってもよい
      const keyed = new RegExp(`(?<![\\w-])(?:${COLOR_KEYS})\\s*[=:]\\s*\\{?\\s*(["'\`])([^"'\`]*?)\\1`, "g");
      const named = new RegExp(`(?<![A-Za-z0-9-])(?:${NAMED})(?![A-Za-z0-9-])`, "i");
      for (const m of t.matchAll(keyed)) if (named.test(m[2])) out.push(m.index);
      return out;
    },
  },
  {
    name: "定義されていない色の変数(app/globals.css にある --color-* だけ使える)",
    find: (t) => [...t.matchAll(/--color-([a-z0-9-]+)/gi)].filter((m) => !DEFINED_COLORS.has(m[1])).map((m) => m.index),
  },
  {
    name: "割合つきの color-mix(α 付きトークンを使う)",
    find: (t) => matchAll(t, /color-mix\((?:[^()]|\([^()]*\))*?\d+(?:\.\d+)?%/g),
  },
  {
    name: "不透明度の接尾辞(bg-x/10 など。α 付きトークンを使う)",
    find: (t) =>
      matchAll(
        t,
        new RegExp(`(?<![\\w-])(?!text-(?:xs|sm|base|lg|\\dxl)/)(?:${COLOR_UTIL})-[a-z0-9-]+/(?:\\d+|\\[[\\d.]+\\])`, "g"),
      ),
  },
  {
    name: "Tailwind 標準パレットの色",
    find: (t) => {
      const masked = t.replace(/indigo-(050|200|500|700|750|800|850|900|950|base)(?:-a\d+)?(?![\w-])/g, (m) => "_".repeat(m.length));
      return matchAll(masked, new RegExp(`(?<![\\w-])(?:${COLOR_UTIL})-(?:${PALETTE})(?![a-zA-Z])`, "g"));
    },
  },
];

const problems = [];

function matchAll(t, re) {
  return [...t.matchAll(re)].map((m) => m.index);
}

// 1 ファイルを「コード部分」と「コメント部分」に分ける。文字列の中の // や /* は無視する。
function splitLines(text) {
  const out = [];
  let inBlock = false;
  let inTemplate = false;
  for (const line of text.split("\n")) {
    let code = "";
    let comment = "";
    let quote = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const nx = line[i + 1];
      if (inBlock) {
        comment += ch;
        if (ch === "*" && nx === "/") {
          comment += "/";
          i++;
          inBlock = false;
        }
        continue;
      }
      if (inTemplate || quote) {
        code += ch;
        if (ch === "\\" && nx !== undefined) {
          code += nx;
          i++;
        } else if (inTemplate && ch === "`") inTemplate = false;
        else if (quote && ch === quote) quote = null;
        continue;
      }
      // https:// のように直前が : の // は URL(JSX の文章の中など)。コメントではない
      // ただし続きに className= / style= / タグがあれば JSX の文章中の // とみなし、コードとして扱う
      if (ch === "/" && nx === "/" && line[i - 1] !== ":" && !/className=|style=\{|<\/?[A-Za-z]/.test(line.slice(i + 2))) {
        comment += line.slice(i);
        break;
      }
      if (ch === "/" && nx === "*") {
        inBlock = true;
        comment += "/*";
        i++;
        continue;
      }
      // 正規表現リテラル(/^`x`/ など)の中の ` や " を文字列の開始と取り違えないよう、丸ごと読み飛ばす
      if (ch === "/" && /[(,=:[!&|?{};]/.test(code.trimEnd().slice(-1) || ";")) {
        let j = i + 1;
        let inClass = false;
        while (j < line.length && (inClass || line[j] !== "/")) {
          if (line[j] === "\\") j++;
          else if (line[j] === "[") inClass = true;
          else if (line[j] === "]") inClass = false;
          j++;
        }
        if (j < line.length) {
          code += line.slice(i, j + 1);
          i = j;
          continue;
        }
      }
      if (ch === "`") inTemplate = true;
      else if (ch === '"' || ch === "'") quote = ch;
      code += ch;
    }
    out.push({ code, comment });
  }
  return out;
}

for (const file of files) {
  const lines = splitLines(readFileSync(file, "utf8"));
  const markerOk = MARKER_ALLOWED.has(file.split("/").pop());
  if (!markerOk) {
    lines.forEach(({ comment }, ln) => {
      if (comment.includes("token-exception:"))
        problems.push(`${relative(ROOT, file)}:${ln + 1}  [承認されていない例外の目印]  ${comment.trim().slice(0, 110)}`);
    });
  }
  // 行ごとの除外(同じ行の marker、またはコメントだけの行にある marker の次の 1 行)
  const exempt = [];
  let prevCommentOnlyMarker = false;
  lines.forEach(({ code, comment }) => {
    const marker = markerOk && comment.includes("token-exception:");
    const commentOnly = code.replace(/[\s{};,()]/g, "") === "";
    exempt.push(marker || prevCommentOnlyMarker);
    prevCommentOnlyMarker = marker && commentOnly;
  });
  const text = lines.map((l) => l.code).join("\n");
  const lineStarts = [];
  let pos = 0;
  for (const l of lines) {
    lineStarts.push(pos);
    pos += l.code.length + 1;
  }
  const lineOf = (index) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const seen = new Set();
  for (const rule of rules) {
    for (const index of rule.find(text)) {
      const ln = lineOf(index);
      if (exempt[ln]) continue;
      const key = `${ln}:${rule.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      problems.push(`${relative(ROOT, file)}:${ln + 1}  [${rule.name}]  ${lines[ln].code.trim().slice(0, 110)}`);
    }
  }
}

problems.sort();
if (problems.length > 0) {
  console.error(`デザイントークン以外の指定が ${problems.length} 件あります。`);
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(`デザイントークンの検査: ${files.length} ファイル OK`);
