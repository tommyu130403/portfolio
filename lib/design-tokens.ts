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
  /** Neutral grayscale + pure black / white */
  system: {
    "050": "#FAFAFA",
    "100": "#F5F5F5",
    "200": "#EEEEEE",
    "300": "#E0E0E0",
    "400": "#BDBDBD",
    "500": "#9E9E9E",
    "600": "#757575",
    "700": "#616161",
    "800": "#424242",
    "900": "#212121",
    "1000": "#1A1A1A", // Figma System/1000（Background/Dark の参照元）
    black: "#000000",
    white: "#FFFFFF",
  },
} as const;

export type ColorGroup = keyof typeof color;
export type ColorScale<G extends ColorGroup> = keyof (typeof color)[G];

// ─── Semantic Color（Figma Semantic コレクション）─────────────────────────────
// primitive を意味ベースで参照するエイリアス層。
// キー名は Tailwind ユーティリティとして自然に読める形へ調整（エルゴノミック命名）。
// 右側コメントに対応する Figma の semantic 名を併記する。

export const semantic = {
  /** Main/Primary — ブランドアクセント */
  primary: color.main.base, //                       Figma: Main/Primary
  /** Text/Body/Main — 本文の主要テキスト */
  fg: color.system.white, //                          Figma: Text/Body/Main
  /** Text/Body/Sub — 補助・弱めテキスト */
  fgMuted: color.system["500"], //                    Figma: Text/Body/Sub
  /** Background/Default — 標準サーフェス（カード等） */
  surface: color.system["900"], //                    Figma: Background/Default
  /** Background/Dark — 一段暗いサーフェス */
  surfaceDark: color.system["1000"], //               Figma: Background/Dark
  /** Border/Default — 標準ボーダー */
  border: color.system["800"], //                     Figma: Border/Default
  /** Border/Light — コントラストの高い（目立つ）ボーダー */
  borderStrong: color.system["500"], //               Figma: Border/Light
  /** Background/Light-α5 — 白5%の半透明オーバーレイ */
  overlayLight: "rgba(255, 255, 255, 0.05)", //       Figma: Background/Light-α5
  /** Background/Dark-α25 — 黒25%の半透明オーバーレイ */
  overlayDark: "rgba(0, 0, 0, 0.25)", //              Figma: Background/Dark-α25
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
      mainMax: 1024,  // Device/desktop Main.Max
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
  /** Section headings / labels */
  guide: {
    jp: "Mplus 1p",
    en: "Afacad",
  },
  /** Body text */
  body: {
    jp: "Noto Sans JP",
    en: "Avenir",
  },
} as const;

// ─── Text Style（Figma Typo コレクションの命名済み text style）────────────────
// size: px / weight: font-weight / lineHeight: 倍率（Figma の 100% → 1, 150% → 1.5）
// letterSpacing: em（Figma の % 表記 3 → 0.03em, 5 → 0.05em）/ lang: 想定言語のフォント
//   lang "jp" → typo.body.jp (Noto Sans JP) / "en" → typo.body.en (Avenir)

export const textStyle = {
  "title-pj":       { figma: "Title/PJ",          lang: "jp", size: 40, weight: 700, lineHeight: 1.0, letterSpacing: 0.03 },
  "headline-01-jp": { figma: "Headline/01/JP",    lang: "jp", size: 24, weight: 700, lineHeight: 1.5, letterSpacing: 0.05 },
  "headline-02-jp": { figma: "Headline/02/JP",    lang: "jp", size: 20, weight: 700, lineHeight: 1.5, letterSpacing: 0.05 },
  "headline-02-en": { figma: "Headline/02/EN",    lang: "en", size: 20, weight: 800, lineHeight: 1.0, letterSpacing: 0.05 },
  "headline-03-jp": { figma: "Headline/03/JP",    lang: "jp", size: 17, weight: 700, lineHeight: 1.0, letterSpacing: 0.05 },
  "body-01-jp":     { figma: "Body/01/JP/Regular", lang: "jp", size: 15, weight: 400, lineHeight: 1.5, letterSpacing: 0.03 },
  "body-02-jp":     { figma: "Body/02/JP/Regular", lang: "jp", size: 13, weight: 400, lineHeight: 1.5, letterSpacing: 0.03 },
  "body-02-jp-bold":{ figma: "Body/02/JP/Bold",    lang: "jp", size: 13, weight: 700, lineHeight: 1.5, letterSpacing: 0.03 },
  "body-03-jp":     { figma: "Body/03/JP/Regular", lang: "jp", size: 11, weight: 400, lineHeight: 1.5, letterSpacing: 0.03 },
  "body-03-en":     { figma: "Body/03/EN/Regular", lang: "en", size: 13, weight: 400, lineHeight: 1.0, letterSpacing: 0 },
  "caption-01-jp":  { figma: "Caption/01/JP",      lang: "jp", size: 10, weight: 400, lineHeight: 1.0, letterSpacing: 0.03 },
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
