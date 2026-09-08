/**
 * Design Tokens — single source of truth
 *
 * Derived from Figma variable collections:
 *   Color.json / Container.json / Radius.json / Size.json / Typo.json
 *
 * RGBA (0–1) values in Figma JSON are converted to HEX with Math.round(v * 255).
 *
 * Usage:
 *   import { tokens } from '@/lib/design-tokens'
 *
 *   tokens.color.main[100]              // '#48F4BE'
 *   tokens.color.system[900]            // '#212121'
 *   tokens.radius[8]                    // '8px'
 *   tokens.size[16]                     // 16
 *   tokens.container.desktop.width.side // 256
 *   tokens.typo.body.jp                 // 'Noto Sans JP'
 *
 * Tailwind utilities (generated via @theme in globals.css):
 *   bg-main-100 / text-main-100 / border-main-100
 *   bg-system-900 / text-system-500
 *   rounded-r2 / rounded-r8 / rounded-r40  (prefix "r" to avoid collision)
 */

// ─── Color ────────────────────────────────────────────────────────────────────

/**
 * Figma 実値との照合状況（Master「Design」ページ node 20:702 配下を get_variable_defs で取得）
 *
 * VERIFIED 2026-09-08（Master の実ノードが使用しており、値の一致を確認した）
 *   System: 300 / 500 / 600 / 700 / 800 / 825 / 875 / 900 / White
 *   Main:   base / 050 / 100 / 200 / 300 / 700
 *   Semantic: Main/Primary・Text/Body/Main・Text/Body/Sub・Background/Default・
 *             Background/Light・Border/Default・Border/Light
 *   Container: Screen/Width 1440・Desktop/Height/Screen 1024・Main/Max 800・
 *              Main/Min 728・Desktop/Width/Side 256
 *   TextStyle: Title/PJ・Headline/01/JP・Headline/02/JP・Headline/02/EN・
 *              Body/01/JP/Regular・Body/02/JP/Regular・Body/02/JP/Bold・
 *              Body/03/JP/Regular・Body/03/EN/Regular・Caption/01/JP
 *   Effect: shadow・shadow-wisper
 *
 * 未照合（Library には変数として存在するが Master のどのノードも使っていないため値が取れない）
 *   System: 025 / 075 / 150 / 250 / 350 / 400 / 450 / 550 / 650 / 750 / 850 / 925 / 950 / 1000 / Black
 *   Main:   400 / 500 / 600 ／ danger 全段 ／ warning 全段
 *   Semantic: Text/Caption・Border/Main・Action/hover の不透明度
 *             （Action/hover は get_variable_defs が #FFFFFF しか返さず α を持たない）
 *   TextStyle: Title/EN・Headline/01/EN・Body/01/JP/Bold・Body/01/EN・Body/02/EN・
 *              Body/03/JP/Bold・Caption/01/EN・Caption/02/JP・Caption/02/EN
 *   これらの現在値は docs/requests/20260908-styleguide-figma-sync.md 付録 A の実測値が出所。
 *   MCP からは列挙できないため、実際に使うときに個別確認する（2026-09-08 ユーザー合意）。
 *
 * 取得方法の注記: get_variable_defs は fileKey + nodeId を直接渡せば取れる。
 * Figma デスクトップでの選択は不要（2026-09-08 に実証）。ただし返るのは
 * 「そのノードが実際に使っている変数」だけなので、未使用のトークンは取得できない。
 */

export const color = {
  /** Primary brand green scale */
  main: {
    "050": "#B3FFE7",
    "100": "#48F4BE",
    "200": "#39C89B",
    "300": "#2B9E7A",
    "400": "#1E765A",
    "500": "#11503C",
    "600": "#062D20",
    "700": "#02140D",
    base: "#48F4BE", // alias for main.100
  },
  /** Error / destructive red-pink scale */
  danger: {
    "100": "#FACBD4",
    "200": "#F792A9",
    "300": "#F4487E",
    "400": "#C1235B",
    "500": "#84153C",
    "600": "#4D0820",
    "700": "#29020E",
    base: "#F4487E", // alias for danger.300
  },
  /** Warning yellow-green scale */
  warning: {
    "100": "#D4F448",
    "200": "#AFCA3A",
    "300": "#8BA12C",
    "400": "#697A1F",
    "500": "#495613",
    "600": "#2B3408",
    "700": "#101402",
    base: "#D4F448", // alias for warning.100
  },
  /**
   * Neutral grayscale + pure black / white
   *
   * `1000` と `black` はどちらも #000000 だが役割が違う。Figma の Color コレクションに
   * System/1000 と System/Black が別々に存在するため、実装でも別キーとして持つ。
   *   - `1000`  グレースケールの最終段。Figma の System/1000 に追従する（将来値が変わりうる）
   *   - `black` 純黒の固定値。段階の一部ではなく、黒であること自体に意味がある場面で使う
   * 迷ったらグレースケールの延長として `1000` を使う。
   */
  system: {
    "025": "#FDFDFD",
    "050": "#FAFAFA",
    "075": "#F8F8F8",
    "100": "#F5F5F5",
    "150": "#F2F2F2",
    "200": "#EEEEEE",
    "250": "#E7E7E7",
    "300": "#E0E0E0",
    "350": "#CFCFCF",
    "400": "#BDBDBD",
    "450": "#AEAEAE",
    "500": "#9E9E9E",
    "550": "#8A8A8A",
    "600": "#757575",
    "650": "#6B6B6B",
    "700": "#616161",
    "750": "#525252",
    "800": "#424242",
    "825": "#3A3A3A",
    "850": "#323232",
    "875": "#292929",
    "900": "#212121",
    "925": "#191919",
    "950": "#111111",
    "1000": "#000000", // グレースケール最終段（Figma System/1000 に追従）
    black: "#000000",  // 純黒の固定値（Figma System/Black）
    white: "#FFFFFF",
  },
} as const;

/**
 * HEX（#RRGGBB）に不透明度を付けた 8 桁 HEX を返す。
 * 受け取るもの: primitive の HEX と 0〜1 の不透明度 / 返すもの: `#RRGGBBAA`
 * Figma の α 付き semantic を primitive の参照のまま書くために使う。
 * リテラルで rgba(...) を書くと、参照元の primitive を変えてもここだけ旧色が残る。
 */
function withAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0").toUpperCase()}`;
}

export type ColorGroup = keyof typeof color;
export type ColorScale<G extends ColorGroup> = keyof (typeof color)[G];

// ─── Semantic Color（Figma Semantic コレクション）─────────────────────────────
// primitive を意味ベースで参照するエイリアス層。
// キー名は Tailwind ユーティリティとして自然に読める形へ調整（エルゴノミック命名）。
// 右側コメントに対応する Figma の semantic 名を併記する。

export const semantic = {
  /** Main/Primary — ブランドアクセント */
  primary: color.main.base, //                       Figma: Main/Primary
  /** Main/Secondary — ブランドアクセントのサブカラー */
  secondary: color.main["300"], //                    Figma: Main/Secondary
  /** Text/Body/Main — 本文の主要テキスト */
  fg: color.system.white, //                          Figma: Text/Body/Main
  /** Text/Body/Sub — 補助・弱めテキスト */
  fgMuted: color.system["500"], //                    Figma: Text/Body/Sub
  /** Text/Caption — キャプション用テキスト */
  fgCaption: color.system["400"], //                  Figma: Text/Caption
  /** Background/Default — 標準サーフェス（カード等） */
  surface: color.system["900"], //                    Figma: Background/Default
  /** Background/Light — 一段明るいサーフェス */
  surfaceLight: color.system["875"], //               Figma: Background/Light
  /** Border/Default — 標準ボーダー */
  border: color.system["825"], //                     Figma: Border/Default
  /** Border/Light — コントラストの高い（目立つ）ボーダー */
  borderLight: color.system["800"], //                Figma: Border/Light
  /** Border/Main — ブランドカラーのボーダー */
  borderMain: withAlpha(color.main["100"], 0.4), //   Figma: Border/Main（main-100 の 40%）
  /** Action/hover — 白5%の半透明オーバーレイ */
  actionHover: "rgba(255, 255, 255, 0.05)", //        Figma: Action/hover
} as const;

export type SemanticKey = keyof typeof semantic;

// ─── Shadow（Figma Effect トークン）──────────────────────────────────────────

export const shadow = {
  /** Figma: shadow-wisper（淡い影） */
  wisper: "0 1px 3px 0 rgba(0, 0, 0, 0.10)",
  /** Figma: shadow（標準のドロップシャドウ） */
  base: "1px 1px 16px 2px rgba(0, 0, 0, 0.25)",
} as const;

export type ShadowKey = keyof typeof shadow;

// ─── Radius ───────────────────────────────────────────────────────────────────

export const radius = {
  2:  "2px",
  4:  "4px",
  8:  "8px",
  16: "16px",
  40: "40px",
  80: "80px",
} as const;

export type RadiusKey = keyof typeof radius;

// ─── Size (spacing scale, px) ─────────────────────────────────────────────────

export const size = {
  1:   1,
  2:   2,
  4:   4,
  8:   8,
  12:  12,
  16:  16,
  24:  24,
  32:  32,
  40:  40,
  48:  48,
  56:  56,
  64:  64,
  72:  72,
  80:  80,
  96:  96,
  120: 120,
  160: 160,
  200: 200,
  320: 320,
  400: 400,
  560: 560,
  640: 640,
  720: 720,
} as const;

export type SizeKey = keyof typeof size;

// ─── Container（Figma Variables「Device」コレクションと同期）────────────────────
// Source of truth: Figma の Device コレクション（モード: desktop / tablet / Mobile）。
//   Screen.Width  = VariableID:153:281 / Screen.Height = VariableID:153:285
//   Main.Max      = VariableID:153:283 / Main.Min      = VariableID:153:284
//   Side          = VariableID:153:282 / Breakpoints   = VariableID:148:300
// Figma 側の変数を更新したら、この値も合わせて更新する。

export const container = {
  desktop: {
    width: {
      screen:  1440,
      mainMax:  800,  // Device/desktop Main.Max
      mainMin:  728,
      side:     256,
    },
    height: {
      screen: 1024,
    },
  },
  /** iPad Pro 12.9" portrait (1024px) / 11" landscape (1194px) */
  tablet: {
    width: {
      screen:  1024,
      mainMax:  704,  // 1024 - sidebar(256) - padding(64)
      mainMin:  480,
      side:      96,
    },
    height: {
      screen: 1366,   // iPad Pro 12.9" landscape
    },
  },
  mobile: {
    width: {
      screen:  390,
      mainMax: 390,   // Device/Mobile Main.Max（モバイルは全幅）
      mainMin: 390,
      side:     96,
    },
    height: {
      screen: 844,
    },
  },
} as const;

/** Device プレビュー等で列挙するためのモードキー（Figma Device コレクションのモードに対応） */
export type DeviceMode = keyof typeof container;

// ─── Typography ───────────────────────────────────────────────────────────────

export const typo = {
  /** Special フォント（Figma Typo/Special/EN）。指定箇所のみ使用 */
  special: {
    en: "Afacad",
  },
  /** Body フォント（Figma Typo/Body）。全要素の既定 */
  body: {
    jp: "Noto Sans JP",
    en: "Avenir",
  },
} as const;

// ─── Text Style（Figma Typo コレクションの命名済み text style）────────────────
// size: px / weight: font-weight / lineHeight: 倍率（Figma の 100% → 1, 150% → 1.5）。
//   Figma の行間 AUTO は "normal"
// letterSpacing: em（Figma の % 表記 3 → 0.03em, 5 → 0.05em）/ lang: 想定言語のフォント
//   lang "jp" → typo.body.jp (Noto Sans JP) / "en" → typo.body.en (Avenir) / "special-en" → typo.special.en (Afacad)

export const textStyle = {
  "title-pj":         { figma: "Title/PJ",              lang: "jp",         size: 34, weight: 700, lineHeight: "normal", letterSpacing: 0.03 },
  "title-en":         { figma: "Title/EN",              lang: "en",         size: 38, weight: 800, lineHeight: "normal", letterSpacing: 0.03 },
  "headline-01-jp":   { figma: "Headline/01/JP",        lang: "jp",         size: 24, weight: 700, lineHeight: 1.5,      letterSpacing: 0.05 },
  "headline-01-en":   { figma: "Headline/01/EN",        lang: "en",         size: 24, weight: 800, lineHeight: "normal", letterSpacing: 0.05 },
  "headline-02-jp":   { figma: "Headline/02/JP",        lang: "jp",         size: 17, weight: 700, lineHeight: "normal", letterSpacing: 0.05 },
  "headline-02-en":   { figma: "Headline/02/EN",        lang: "special-en", size: 20, weight: 700, lineHeight: 1.5,      letterSpacing: 0.05 },
  "body-01-jp":       { figma: "Body/01/JP/Regular",    lang: "jp",         size: 15, weight: 400, lineHeight: 1.5,      letterSpacing: 0.03 },
  "body-01-jp-bold":  { figma: "Body/01/JP/Bold",       lang: "jp",         size: 15, weight: 700, lineHeight: 1.5,      letterSpacing: 0.03 },
  "body-01-en":       { figma: "Body/01/EN/Regular",    lang: "en",         size: 17, weight: 400, lineHeight: "normal", letterSpacing: 0 },
  "body-02-jp":       { figma: "Body/02/JP/Regular",    lang: "jp",         size: 13, weight: 400, lineHeight: 1.5,      letterSpacing: 0.03 },
  "body-02-jp-bold":  { figma: "Body/02/JP/Bold",       lang: "jp",         size: 13, weight: 700, lineHeight: 1.5,      letterSpacing: 0.03 },
  "body-02-en":       { figma: "Body/02/EN/Regular",    lang: "en",         size: 15, weight: 400, lineHeight: "normal", letterSpacing: 0 },
  "body-03-jp":       { figma: "Body/03/JP/Regular",    lang: "jp",         size: 11, weight: 400, lineHeight: 1.5,      letterSpacing: 0.03 },
  "body-03-jp-bold":  { figma: "Body/03/JP/Bold",       lang: "jp",         size: 11, weight: 700, lineHeight: 1.5,      letterSpacing: 0.03 },
  "body-03-en":       { figma: "Body/03/EN/Regular",    lang: "en",         size: 13, weight: 400, lineHeight: "normal", letterSpacing: 0 },
  "caption-01-jp":    { figma: "Caption/01/JP",         lang: "jp",         size: 10, weight: 400, lineHeight: "normal", letterSpacing: 0.03 },
  "caption-01-en":    { figma: "Caption/01/EN",         lang: "en",         size: 12, weight: 400, lineHeight: "normal", letterSpacing: 0 },
  "caption-02-jp":    { figma: "Caption/02/JP",         lang: "jp",         size: 9,  weight: 400, lineHeight: "normal", letterSpacing: 0.03 },
  "caption-02-en":    { figma: "Caption/02/EN",         lang: "en",         size: 11, weight: 400, lineHeight: "normal", letterSpacing: 0 },
} as const;

export type TextStyleKey = keyof typeof textStyle;

// ─── Breakpoints ──────────────────────────────────────────────────────────────

/** Tailwind responsive prefix reference: lg = tablet, xl = desktop（Device/Breakpoints と同期） */
export const breakpoint = {
  /** 390px — Device/Mobile Breakpoints */
  mobile:   390,
  /** 1024px — Tailwind `lg`: iPad Pro 12.9" portrait baseline */
  tablet:  1024,
  /** 1280px — Tailwind `xl`: standard desktop baseline */
  desktop: 1280,
} as const;

// ─── Aggregate export ─────────────────────────────────────────────────────────

export const tokens = { color, semantic, shadow, radius, size, container, typo, textStyle, breakpoint } as const;
export type Tokens = typeof tokens;
