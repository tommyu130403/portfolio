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
    black: "#000000",
    white: "#FFFFFF",
  },
} as const;

export type ColorGroup = keyof typeof color;
export type ColorScale<G extends ColorGroup> = keyof (typeof color)[G];

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

// ─── Container ────────────────────────────────────────────────────────────────

export const container = {
  desktop: {
    width: {
      screen:  1440,
      mainMax:  916,
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
      side:      88,  // collapsed sidebar
    },
    height: {
      screen: 1366,   // iPad Pro 12.9" landscape
    },
  },
  mobile: {
    width: {
      screen: 390,
    },
    height: {
      screen: 844,
    },
  },
} as const;

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

// ─── Breakpoints ──────────────────────────────────────────────────────────────

/** Tailwind responsive prefix reference: lg = tablet, xl = desktop */
export const breakpoint = {
  /** 1024px — Tailwind `lg`: iPad Pro 12.9" portrait baseline */
  tablet:  1024,
  /** 1280px — Tailwind `xl`: standard desktop baseline */
  desktop: 1280,
} as const;

// ─── Aggregate export ─────────────────────────────────────────────────────────

export const tokens = { color, radius, size, container, typo, breakpoint } as const;
export type Tokens = typeof tokens;
