"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import ServiceLogo from "@/components/ServiceLogo";
import { WORK_CATEGORY_PRESET_HUES } from "@/lib/work-category-color";
import Tag from "@/components/Tag";
import Tooltip from "@/components/Tooltip";
import { TableGrid, TableKeyValue } from "@/components/Table";
import Headline from "@/components/Headline";
import ButtonAction from "@/components/ButtonAction";
import { ButtonFunction } from "@/components/ButtonFunction";
import { BUTTON_FUNCTION_ICON } from "@/lib/figma-button-variants";
import TabBar from "@/components/TabBar";
import WorkCard from "@/components/WorkCard";
import InfoCard from "@/components/InfoCard";
import { MarkdownBody } from "@/components/WorkMarkdown";
import WorkBreadcrumb from "@/components/WorkBreadcrumb";
import WorkPagerCard from "@/components/WorkPagerCard";
import WorkToc, { type WorkTocItem } from "@/components/WorkToc";
import WorkThumbnail from "@/components/WorkThumbnail";
import ProtectedImage from "@/components/ProtectedImage";
import { PhoneMock, LaptopMock } from "@/components/DeviceMock";
import WorkDetailHeader from "@/components/WorkDetailHeader";
import WorkDetailContent from "@/components/WorkDetailContent";
import SideMenuBar from "@/components/SideMenuBar";
import RichMarkdownEditor from "@/components/RichMarkdownEditor";
import { WorkProcessChart, WorkStakeholderDiagram } from "@/components/WorkViz";
import WorkVizModal from "@/components/WorkVizModal";
import FlowchartView from "@/components/FlowchartView";
import Modal from "@/components/Modal";
import { color, semantic, shadow, radius, size, container, typo, textStyle, breakpoint } from "@/lib/design-tokens";
import type { FlowchartData } from "@/lib/flowchart";
import type { Tables } from "@/src/types/supabase";
import type { WorkThumbnailData } from "@/lib/work-content";

// 構成サムネイル（WorkThumbnail / WorkCard / WorkPagerCard）のプレビュー用サンプル
const THUMB_SHOT_DESKTOP = "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=800&q=80";
const THUMB_SHOT_MOBILE = "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=400&q=80";
const THUMB_LOGO = "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80";
const SAMPLE_THUMBNAILS: WorkThumbnailData[] = [
  { layout: "a1", logo_url: THUMB_LOGO, desktop_url: THUMB_SHOT_DESKTOP, mobile_urls: [THUMB_SHOT_MOBILE], capture_urls: [], brand: null },
  { layout: "a2", logo_url: null, desktop_url: THUMB_SHOT_DESKTOP, mobile_urls: [], capture_urls: [], brand: null },
  { layout: "a3", logo_url: null, desktop_url: null, mobile_urls: [THUMB_SHOT_MOBILE, ""], capture_urls: [], brand: null },
  { layout: "d", logo_url: null, desktop_url: null, mobile_urls: [], capture_urls: [THUMB_SHOT_DESKTOP, THUMB_SHOT_DESKTOP], brand: null },
  /* d で資料が 1 枚だけのとき（右に大きく 1 枚） */
  { layout: "d", logo_url: THUMB_LOGO, desktop_url: null, mobile_urls: [], capture_urls: ["", THUMB_SHOT_DESKTOP], brand: null },
  /* ブランド地（白基調＋主色・副色のうすいグラデ、ロゴ未設定ならサービスのロゴ） */
  { layout: "a1", logo_url: null, desktop_url: THUMB_SHOT_DESKTOP, mobile_urls: [THUMB_SHOT_MOBILE], capture_urls: [], brand: "careerticket-scout" },
  { layout: "d", logo_url: null, desktop_url: null, mobile_urls: [], capture_urls: [THUMB_SHOT_DESKTOP, THUMB_SHOT_DESKTOP], brand: "hataractive" },
];
const SAMPLE_THUMB_TITLE = "キャリアチケットスカウトサービスの立ち上げ";
const SAMPLE_THUMB_SERVICE = "Career Ticket";
const FIGURE_SAMPLE_MD = `::: figure 図版の枠の見出し | 補足文はここに入ります
::: beforeafter 施策① | 導線の見直し
before: スカウトを受信 → サービス LP → [!新規登録（情報を再入力）] → 予約
note: LP → 登録で大半のユーザーが離脱
after: 送客スカウトを受信 → [+送客 URL から予約ページへ直接]
note: LP と再登録をスキップ
:::
::: flow 送客フロー highlight=3
- 対象を抽出
- スカウトを一括送信
- 予約ページへ直接遷移
:::
::: bars base=1.0 max=1.4
- 優先度 4 | 最もアクティブ | 1.3 | 約1.3倍 | up
- 優先度 3 |  | 0.9 | 約0.9倍
- 優先度 2 | 非アクティブ中心 | 0.7 | 約0.7倍 | down
legend: 白線＝リリース前の水準
:::
::: grid cols=2
::: card 考察
通常のカード。
:::
---
::: card tone=accent 次の一手
強調カード（tone=accent）。
:::
:::
::: caption 出典: サンプル
:::
`;

// Works 詳細ページのプレビュー用サンプルデータ
const SAMPLE_WORK_DETAIL = {
  id: "sample",
  is_published: true,
  title: "キャリアチケットスカウトサービスの立ち上げ",
  category: "プラットフォーム開発",
  thumbnail_url: "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=800&q=80",
  thumbnail: null,
  role: "リードUI/UXデザイナー・プロジェクトマネージャー",
  period: "2023年4月 - 2023年9月（6ヶ月）",
  start_date: null,
  end_date: null,
  is_current: false,
  timeline: null,
  stakeholders: null,
  stakeholders_legacy: null,
  hero_brand: null,
  hero_screenshots: [
    // 横長の 1 枚目はノート PC 枠、縦長の 2 枚目はスマホ枠で描かれる（WorkDetailHeader が縦横で判定）
    "https://images.unsplash.com/photo-1551650975-87deedd944c3?auto=format&fit=crop&w=800&h=500&q=80",
    "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=400&q=80",
  ],
  hero_layout: null,
  hero_bg_color: null,
  sections: [
    { heading: "概要", body: "### 背景\n市場のニーズに応えるため、新規スカウトサービスを立ち上げました。\n\n### 課題\n既存フローでは候補者と企業のマッチング精度に課題がありました。" },
    { heading: "見出し01", body: "本文テキスト Body01。プロジェクトで取り組んだ施策の詳細を記載します。" },
    {
      heading: "本文ブロック（検証用）",
      body: "本文テキスト Body01。画像ブロックの直前の段落です。\n\n![補足テキスト（キャプション）](https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=800&q=80){width=320 align=left}\n画像の右に並ぶ本文テキスト。Figma Master 994:5656 の画像ブロックに相当します。\n\n### 見出し02\n- 箇条書き1\n- 箇条書き2\n\n> 引用テキスト\n\n---\n\n::: grid cols=2 gap=4\n左セル\n---\n右セル\n:::\n\n```ts\nconst example = true;\n```\n\n::: caption 表やグリッドの下に置く補足文",
    },
  ],
  stakeholder_breakdown: "事業責任者1・プロジェクトマネージャー1・デザイナー2・エンジニア4",
  career_item_id: null,
  sort_order: 0,
  created_at: null,
} as Tables<"works">;

// ヒーロー構成（works.hero_layout）ごとの見本。画像は SAMPLE_WORK_DETAIL.hero_screenshots の横長・縦長と同じものを使い回す
const HERO_SAMPLE_PC = "https://images.unsplash.com/photo-1551650975-87deedd944c3?auto=format&fit=crop&w=800&h=500&q=80";
const HERO_SAMPLE_SP = "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=400&q=80";
const HERO_LAYOUT_SAMPLES: { label: string; hero_layout: string | null; hero_screenshots: string[] }[] = [
  { label: "none（設定なし。公開ページでは何も出さない）", hero_layout: "none", hero_screenshots: [] },
  { label: "sp2（SP 2台）", hero_layout: "sp2", hero_screenshots: [HERO_SAMPLE_SP, HERO_SAMPLE_SP] },
  { label: "pcsp（PC + SP）", hero_layout: "pcsp", hero_screenshots: [HERO_SAMPLE_PC, HERO_SAMPLE_SP] },
  { label: "pc（PC のみ）", hero_layout: "pc", hero_screenshots: [HERO_SAMPLE_PC] },
  { label: "images ×1（枠なし 1 枚）", hero_layout: "images", hero_screenshots: [HERO_SAMPLE_PC, "", ""] },
  { label: "images ×3（枠なし 3 枚・OOUI と同じ階段状の重ね）", hero_layout: "images", hero_screenshots: [HERO_SAMPLE_PC, HERO_SAMPLE_SP, HERO_SAMPLE_PC] },
];

const SAMPLE_FLOWCHART: FlowchartData = {
  nodes: [
    { id: "start", kind: "start", label: "開始", x: 20, y: 145 },
    {
      id: "card",
      kind: "card",
      label: "リサーチ結果",
      sublabel: "ユーザーの課題を整理し、\n優先度をカードで可視化",
      x: 245,
      y: 35,
      w: 320,
      h: 160,
      fontSize: 18,
      textAlign: "left",
      verticalAlign: "top",
      divider: "vertical",
      color: "primary",
    },
    {
      id: "step",
      kind: "step",
      label: "ユーザー調査",
      sublabel: "課題と期待を整理",
      x: 285,
      y: 245,
      fontSize: 12,
      textAlign: "right",
      color: "secondary",
    },
    { id: "end", kind: "end", label: "方針決定", x: 620, y: 145 },
    {
      id: "note",
      kind: "note",
      label: "補足メモ（note）",
      sublabel: "破線枠・Background/Light",
      x: 20,
      y: 245,
      fontSize: 12,
      textAlign: "left",
    },
  ],
  edges: [
    {
      id: "start-card",
      source: "start",
      sourceHandle: "right",
      target: "card",
      targetHandle: "left",
      sourceMarker: "circle",
      targetMarker: "arrow",
    },
    {
      id: "card-step",
      source: "card",
      sourceHandle: "bottom",
      target: "step",
      targetHandle: "top",
      targetMarker: "circle",
    },
    {
      id: "step-end",
      source: "step",
      sourceHandle: "right",
      target: "end",
      targetHandle: "left",
    },
  ],
};

// ─── 型 ───────────────────────────────────────────────
export type IconSetData = { name: string; icons: string[] };
export type LogoData = { name: string; label: string };

// ─── ナビゲーション ────────────────────────────────────
const NAV_SECTIONS = [
  { id: "colors",     label: "Colors",      labelJa: "カラー" },
  { id: "typography", label: "Typography",  labelJa: "タイポグラフィ" },
  { id: "tokens",     label: "Tokens",      labelJa: "その他のトークン" },
  { id: "icons",      label: "Icons",       labelJa: "アイコン" },
  { id: "logos",      label: "Logos",       labelJa: "サービスロゴ" },
  { id: "components", label: "Components",  labelJa: "コンポーネント" },
] as const;

// ─── Semantic カラー（Figma Semantic コレクション → primitive 参照）─────────
// label = エルゴノミック命名のキー / twExample = 代表的な Tailwind ユーティリティ
// figma = 対応する Figma semantic 名 / ref = 参照先 primitive の説明
// cls は実際にスウォッチへ適用する literal な Tailwind ユーティリティ（v4 の生成検出 = source 内の
// literal 文字列が対象。これにより semantic 変数が tree-shake されず実際に出力・動作する）。
const SEMANTIC_SWATCHES = [
  { kind: "bg",     cls: "bg-primary",          token: "semantic.primary",      value: semantic.primary,      figma: "Main/Primary",       ref: "main-base" },
  { kind: "bg",     cls: "bg-secondary",        token: "semantic.secondary",    value: semantic.secondary,    figma: "Main/Secondary",     ref: "main-300" },
  { kind: "text",   cls: "text-fg",             token: "semantic.fg",           value: semantic.fg,           figma: "Text/Body/Primary",   ref: "system-300" },
  { kind: "text",   cls: "text-fg-muted",       token: "semantic.fgMuted",      value: semantic.fgMuted,      figma: "Text/Body/Secondary", ref: "system-500" },
  { kind: "text",   cls: "text-fg-caption",     token: "semantic.fgCaption",    value: semantic.fgCaption,    figma: "Text/Caption",        ref: "system-500" },
  { kind: "text",   cls: "text-fg-subtle",      token: "semantic.fgSubtle",     value: semantic.fgSubtle,     figma: "Text/Body/Tertiary",  ref: "system-700" },
  { kind: "text",   cls: "text-fg-link",        token: "semantic.fgLink",       value: semantic.fgLink,       figma: "Text/Link",           ref: "main-base" },
  { kind: "text",   cls: "text-fg-link-hover",  token: "semantic.fgLinkHover",  value: semantic.fgLinkHover,  figma: "Text/Link-hover",     ref: "main-050" },
  { kind: "bg",     cls: "bg-surface",          token: "semantic.surface",      value: semantic.surface,      figma: "Background/Default", ref: "system-925" },
  { kind: "bg",     cls: "bg-surface-light",    token: "semantic.surfaceLight", value: semantic.surfaceLight, figma: "Background/Light",   ref: "system-875" },
  { kind: "bg",     cls: "bg-thumbnail",        token: "semantic.thumbnail",    value: semantic.thumbnail,    figma: "（未登録）",          ref: "system-950" },
  { kind: "border", cls: "border-border",       token: "semantic.border",       value: semantic.border,       figma: "Border/Default",     ref: "system-825" },
  { kind: "border", cls: "border-border-light", token: "semantic.borderLight",  value: semantic.borderLight,  figma: "Border/Light",       ref: "system-800" },
  { kind: "border", cls: "border-border-main",  token: "semantic.borderMain",   value: semantic.borderMain,   figma: "Border/Main",        ref: "main-100 40%" },
  { kind: "bg",     cls: "bg-action-hover",     token: "semantic.actionHover",  value: semantic.actionHover,  figma: "Action/hover",       ref: "white 5%" },
] as const;

// ─── タイポグラフィ（textStyle トークンから生成）────────────────────────────
// lang → フォントファミリー（CSS 変数経由で next/font を当てる）とサンプル文字
// font-family は app/globals.css の @utility 側が持つ。ここはサンプル文字だけ。
const TYPO_LANG = {
  jp: { sample: "本文テキスト サンプル" },
  en: { sample: "Body Text Sample" },
  "special-en": { sample: "Special Heading" },
} as const;

// textStyle のキー → app/globals.css の @utility クラス名。
// Tailwind v4 のスキャナは `text-${key}` のような連結を検出しないため、literal で持つ。
// ここに並んでいること自体が「15 種のユーティリティが実際に生成されている」ことの担保になる。
const TEXT_STYLE_CLASS: Record<keyof typeof textStyle, string> = {
  "title-pj":        "text-title-pj",
  "title-en":        "text-title-en",
  "body-01-jp":      "text-body-01-jp",
  "body-01-jp-bold": "text-body-01-jp-bold",
  "body-01-en":      "text-body-01-en",
  "body-02-jp":      "text-body-02-jp",
  "body-02-jp-bold": "text-body-02-jp-bold",
  "body-02-en":      "text-body-02-en",
  "body-03-jp":      "text-body-03-jp",
  "body-03-jp-bold": "text-body-03-jp-bold",
  "body-03-en":      "text-body-03-en",
  "caption-01-jp":   "text-caption-01-jp",
  "caption-01-en":   "text-caption-01-en",
  "caption-02-jp":   "text-caption-02-jp",
  "caption-02-en":   "text-caption-02-en",
};

// ─── 共通サブコンポーネント ────────────────────────────
function SectionTitle({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="mb-1 text-[12px] tracking-[0.6px] text-primary">{label}</p>
      <p className="text-[32px] leading-[1.5] tracking-[1.6px] text-white">{title}</p>
      <div className="mt-3 h-[2px] w-10 rounded bg-border-light" />
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[13px] font-semibold tracking-[0.65px] text-fg-muted uppercase">
      {children}
    </p>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-border-light bg-surface p-6">
      {children}
    </div>
  );
}

function TokenBadge({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-[#1a1a1a] px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
      {children}
    </code>
  );
}

// ─── セクション: Colors ────────────────────────────────

/**
 * スウォッチの並び順を数値の明度順に揃える。
 * Object.entries は "025" のような先頭ゼロ付きキーを整数扱いしないため、
 * そのまま渡すと 100…1000 の後ろに 025 / 050 / 075 が回ってしまう。
 * 数値キーは昇順、base / black / white などの非数値キーは定義順のまま末尾へ置く。
 */
function orderedShades(group: Record<string, string>): [string, string][] {
  const entries = Object.entries(group) as [string, string][];
  const numeric = entries.filter(([k]) => /^\d+$/.test(k)).sort((a, b) => Number(a[0]) - Number(b[0]));
  const named = entries.filter(([k]) => !/^\d+$/.test(k));
  return [...numeric, ...named];
}

const COLOR_GROUPS = [
  {
    key: "main" as const,
    label: "Main",
    desc: "ブランドアクセントカラー（グリーン系）",
    tailwindPrefix: "main",
    shades: orderedShades(color.main),
  },
  {
    key: "danger" as const,
    label: "Danger",
    desc: "エラー・破壊的アクション（赤ピンク系）",
    tailwindPrefix: "danger",
    shades: orderedShades(color.danger),
  },
  {
    key: "warning" as const,
    label: "Warning",
    desc: "警告・注意（黄緑系）",
    tailwindPrefix: "warning",
    shades: orderedShades(color.warning),
  },
  {
    key: "system" as const,
    label: "System",
    desc: "ニュートラルグレースケール（1000 と black は同値。1000 はグレースケール最終段で Figma System/1000 に追従、black は純黒の固定値）",
    tailwindPrefix: "system",
    shades: orderedShades(color.system),
  },
] as const;

function ColorsSection() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (hex: string) => {
    navigator.clipboard.writeText(hex).then(() => {
      setCopied(hex);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <section id="colors" className="scroll-mt-8">
      <SectionTitle label="Colors" title="カラー" />
      <p className="mb-8 text-[13px] text-system-700">
        Tailwind クラス例: <TokenBadge>bg-main-100</TokenBadge>{" "}
        <TokenBadge>text-system-500</TokenBadge>{" "}
        <TokenBadge>border-danger-base</TokenBadge>
        　　クリックで HEX をコピー
      </p>

      <div className="flex flex-col gap-10">
        {COLOR_GROUPS.map(({ label, desc, tailwindPrefix, shades }) => (
          <div key={label}>
            <div className="mb-4 flex items-baseline gap-3">
              <SubHeading>{label}</SubHeading>
              <p className="text-[11px] text-system-700">{desc}</p>
            </div>

            {/* スウォッチ横スクロール行 */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {shades.map(([shade, hex]) => {
                const twClass = `bg-${tailwindPrefix}-${shade}`;
                const tokenKey = `color.${label.toLowerCase()}.${shade}`;
                const isCopied = copied === hex;
                return (
                  <button
                    key={shade}
                    type="button"
                    onClick={() => copy(hex)}
                    title={`${tokenKey}\n${hex}\n${twClass}`}
                    className="group flex w-[90px] shrink-0 flex-col gap-2 rounded-[8px] border border-transparent p-2 text-left transition-colors hover:border-border-light hover:bg-[#1a1a1a]"
                  >
                    <div
                      className="h-10 w-full rounded-[6px] border border-white/10"
                      style={{ backgroundColor: hex }}
                    />
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-medium text-white">{shade}</p>
                      <p className="font-mono text-[10px] text-system-700">
                        {isCopied ? "✓ コピー" : hex.toUpperCase()}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Semantic（primitive を意味ベースで参照するエイリアス層） */}
        <div>
          <div className="mb-4 flex items-baseline gap-3">
            <SubHeading>Semantic</SubHeading>
            <p className="text-[11px] text-system-700">
              意味ベースのエイリアス（Figma Semantic コレクション）。値は primitive を参照
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SEMANTIC_SWATCHES.map(({ kind, cls, token, value, figma, ref }) => (
              <button
                key={token}
                type="button"
                onClick={() => copy(value)}
                title={`${token}\n${value}\nFigma: ${figma}`}
                className="group flex items-center gap-3 rounded-[8px] border border-transparent p-2 text-left transition-colors hover:border-border-light hover:bg-[#1a1a1a]"
              >
                {/* チェッカーボード背景（半透明色を可視化）の上に literal ユーティリティで実描画 */}
                <div
                  className="h-10 w-10 shrink-0 overflow-hidden rounded-[6px] border border-white/10 bg-[length:8px_8px]"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg,#333 25%,transparent 25%),linear-gradient(-45deg,#333 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#333 75%),linear-gradient(-45deg,transparent 75%,#333 75%)",
                    backgroundPosition: "0 0,0 4px,4px -4px,-4px 0",
                  }}
                >
                  {kind === "bg" && <div className={`h-full w-full ${cls}`} />}
                  {kind === "text" && (
                    <div className={`flex h-full w-full items-center justify-center bg-surface text-[16px] font-bold ${cls}`}>
                      Ag
                    </div>
                  )}
                  {kind === "border" && <div className={`h-full w-full border-2 bg-surface ${cls}`} />}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-[12px] font-medium text-white">{figma}</p>
                  <p className="font-mono text-[10px] text-system-700">
                    {copied === value ? "✓ コピー" : `${value} → ${ref}`}
                  </p>
                  <TokenBadge>{cls}</TokenBadge>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── セクション: Typography ────────────────────────────

function TypographySection() {
  return (
    <section id="typography" className="scroll-mt-8">
      <SectionTitle label="Typography" title="タイポグラフィ" />

      {/* フォントファミリー（Typo トークン） */}
      <p className="mb-3 text-[12px] text-system-700">
        Figma Typo コレクションの3変数（Special/EN・Body/JP・Body/EN）+ Figma に対応変数が無い実装ローカルの
        フォント3件。実装ローカルの3件は Figma と同期されないので、デザイン側の正としては扱わない。
      </p>
      <div className="mb-10 grid grid-cols-2 gap-4">
        {(
          [
            { role: "Special / EN", family: typo.special.en, token: "typo.special.en", cssVar: "--font-afacad",       cls: "",           sample: "Special Heading" },
            { role: "Body / JP",    family: typo.body.jp,    token: "typo.body.jp",    cssVar: "--font-noto-sans-jp", cls: "",           sample: "本文テキスト" },
            { role: "Body / EN",    family: typo.body.en,    token: "typo.body.en",    cssVar: undefined,             cls: "font-en",    sample: "Body Text" },
            { role: "Body / EN 代替（Avenir の無い端末）", family: "Figtree", token: "—（Figma 変数なし）", cssVar: "--font-figtree", cls: "", sample: "Body Text" },
            // font-guide は @theme inline 定義のため CSS 変数として出力されない（ユーティリティにインライン展開される）。
            // そのためこの1件だけは class 経由で当てる。
            { role: "実装ローカル / Guide（font-guide）", family: "Afacad → Noto Sans JP", token: "—（Figma 変数なし）", cssVar: undefined, cls: "font-guide", sample: "Guide ガイド" },
          ] as const
        ).map(({ role, family, token, cssVar, cls, sample }) => (
          <div
            key={role}
            className="flex flex-col gap-3 rounded-[10px] border border-border-light bg-surface p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-fg-muted">{role}</p>
              <TokenBadge>{token}</TokenBadge>
            </div>
            {/* CSS変数経由で参照することでnext/fontのローカルフォントが正しく当たる */}
            <p
              className={`truncate text-[22px] text-white ${cls}`}
              style={cls ? undefined : { fontFamily: cssVar ? `var(${cssVar})` : family }}
            >
              {sample}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-[12px] text-system-700">{family}</p>
              {cssVar && <TokenBadge>{cssVar}</TokenBadge>}
              {cls && <TokenBadge>{cls}</TokenBadge>}
            </div>
          </div>
        ))}
      </div>

      {/* タイプスケール（Figma Typo コレクションの命名済み text style） */}
      <SubHeading>Text Styles</SubHeading>
      <p className="mb-4 text-[12px] text-system-700">
        Figma の命名済み text style。JS からは <TokenBadge>tokens.textStyle[&quot;body-02-jp&quot;]</TokenBadge>、
        クラスからは <TokenBadge>text-body-02-jp</TokenBadge>（app/globals.css の <TokenBadge>@utility</TokenBadge>）で参照。
        lineHeight は px か <TokenBadge>normal</TokenBadge>。Noto の AUTO は Figma 実測 px（round(1.2×size)）、Avenir は
        <TokenBadge>title-en</TokenBadge> の 52px 以外は <TokenBadge>normal</TokenBadge>。倍率160%の style は、Figma
        が描く size×1.6 の端数切り上げ px（24 / 20.8→21 / 17.6→18）で持つ。letterSpacing は em（Figma 3% → 0.03em）。
      </p>
      <div className="flex flex-col divide-y divide-[#2a2a2a]">
        {(Object.entries(textStyle) as [string, (typeof textStyle)[keyof typeof textStyle]][]).map(
          ([key, ts]) => {
            // font-family は @utility 側が持つため、ここではサンプル文字だけ使う
            const langInfo = TYPO_LANG[ts.lang];
            return (
              <div key={key} className="flex flex-col gap-2 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-baseline gap-3">
                    <p className="font-mono text-[16px] text-white">{ts.size}px</p>
                    <p className="font-mono text-[10px] text-system-700">
                      weight:{ts.weight} · lh:{ts.lineHeight} · tracking:{ts.letterSpacing}em · {ts.lang.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <TokenBadge>{TEXT_STYLE_CLASS[key as keyof typeof textStyle]}</TokenBadge>
                    <p className="text-[11px] text-system-700">{ts.figma}</p>
                  </div>
                </div>
                <p className={`truncate text-white ${TEXT_STYLE_CLASS[key as keyof typeof textStyle]}`}>
                  {langInfo.sample}
                </p>
              </div>
            );
          },
        )}
      </div>
    </section>
  );
}

// ─── セクション: Tokens（Radius / Size / Container）────

function TokensSection() {
  return (
    <section id="tokens" className="scroll-mt-8">
      <SectionTitle label="Tokens" title="その他のトークン" />

      {/* ── Radius ── */}
      <SubHeading>Radius</SubHeading>
      <p className="mb-4 text-[12px] text-system-700">
        Tailwind クラス例: <TokenBadge>rounded-r8</TokenBadge>{" "}
        <TokenBadge>rounded-r40</TokenBadge>
      </p>
      <div className="mb-12 flex flex-wrap gap-4">
        {(Object.entries(radius) as [string, string][]).map(([key, val]) => (
          <div
            key={key}
            className="flex flex-col items-center gap-3"
          >
            <div
              className="h-16 w-16 border-2 border-primary bg-surface"
              style={{ borderRadius: val }}
            />
            <div className="text-center">
              <p className="font-mono text-[13px] text-white">{val}</p>
              <TokenBadge>rounded-r{key}</TokenBadge>
            </div>
          </div>
        ))}
      </div>

      {/* ── Size ── */}
      <SubHeading>Size / Spacing Scale</SubHeading>
      <p className="mb-4 text-[12px] text-system-700">
        スペーシングスケール（px）。Tailwind ではそのまま <TokenBadge>text-[16px]</TokenBadge>{" "}
        等の任意値で参照、または <TokenBadge>tokens.size[16]</TokenBadge> から JS 参照。
      </p>
      <div className="mb-12 flex flex-col gap-2">
        {(Object.entries(size) as [string, number][]).map(([key, val]) => (
          <div key={key} className="flex items-center gap-4">
            <p className="w-[40px] shrink-0 text-right font-mono text-[12px] text-fg-muted">
              {val}px
            </p>
            <div
              className="h-[6px] rounded-full bg-primary/60"
              style={{ width: Math.min(val, 720) }}
            />
          </div>
        ))}
      </div>

      {/* ── Shadow（Figma Effect トークン） ── */}
      <SubHeading>Shadow</SubHeading>
      <p className="mb-4 text-[12px] text-system-700">
        Tailwind クラス例: <TokenBadge>shadow-base</TokenBadge>{" "}
        <TokenBadge>shadow-wisper</TokenBadge>
      </p>
      <div className="mb-12 flex flex-wrap gap-6">
        {(Object.entries(shadow) as [string, string][]).map(([key, val]) => (
          <div key={key} className="flex flex-col items-center gap-3">
            <div
              className="h-20 w-32 rounded-[8px] border border-[#2a2a2a] bg-surface"
              style={{ boxShadow: val }}
            />
            <div className="text-center">
              <TokenBadge>shadow-{key}</TokenBadge>
              <p className="mt-1 max-w-[160px] font-mono text-[9px] leading-tight text-system-700">{val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Container（Figma Variables「Device」コレクションと同期） ── */}
      <SubHeading>Container / Device</SubHeading>
      <p className="mb-4 text-[12px] text-system-700">
        Figma の Device コレクション（desktop / tablet / Mobile モード）と同期。
        本文エディタのデバイス幅プレビューもこの値を参照する。
        サイトの最大表示幅は <TokenBadge>--container-main</TokenBadge>（globals.css）→
        {" "}<TokenBadge>max-w-main</TokenBadge> ユーティリティで Desktop / Main Width Max と同値。
      </p>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { label: "Desktop / Screen Width",    token: "container.desktop.width.screen",  value: container.desktop.width.screen },
            { label: "Desktop / Screen Height",   token: "container.desktop.height.screen", value: container.desktop.height.screen },
            { label: "Desktop / Main Width Max",  token: "container.desktop.width.mainMax", value: container.desktop.width.mainMax },
            { label: "Desktop / Main Width Min",  token: "container.desktop.width.mainMin", value: container.desktop.width.mainMin },
            { label: "Desktop / Sidebar Width",   token: "container.desktop.width.side",    value: container.desktop.width.side },
            { label: "Tablet / Screen Width",     token: "container.tablet.width.screen",   value: container.tablet.width.screen },
            { label: "Tablet / Screen Height",    token: "container.tablet.height.screen",  value: container.tablet.height.screen },
            { label: "Tablet / Main Width Max",   token: "container.tablet.width.mainMax",  value: container.tablet.width.mainMax },
            { label: "Tablet / Main Width Min",   token: "container.tablet.width.mainMin",  value: container.tablet.width.mainMin },
            { label: "Tablet / Sidebar Width",    token: "container.tablet.width.side",     value: container.tablet.width.side },
            { label: "Mobile / Screen Width",     token: "container.mobile.width.screen",   value: container.mobile.width.screen },
            { label: "Mobile / Screen Height",    token: "container.mobile.height.screen",  value: container.mobile.height.screen },
            { label: "Mobile / Main Width Max",   token: "container.mobile.width.mainMax",  value: container.mobile.width.mainMax },
            { label: "Mobile / Main Width Min",   token: "container.mobile.width.mainMin",  value: container.mobile.width.mainMin },
            { label: "Mobile / Sidebar Width",    token: "container.mobile.width.side",     value: container.mobile.width.side },
          ] as const
        ).map(({ label, token, value }) => (
          <div
            key={token}
            className="flex items-center justify-between rounded-[8px] border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3"
          >
            <div>
              <p className="text-[12px] text-white">{label}</p>
              <TokenBadge>{token}</TokenBadge>
            </div>
            <p className="font-mono text-[16px] font-semibold text-primary">{value}px</p>
          </div>
        ))}
      </div>
      {/* ── Breakpoints ── */}
      <SubHeading>Breakpoints</SubHeading>
      <p className="mb-4 text-[12px] text-system-700">
        Tailwind レスポンシブプレフィックス:
        {" "}<TokenBadge>lg:</TokenBadge> = tablet (1024px〜)
        {" "}<TokenBadge>xl:</TokenBadge> = desktop (1280px〜)
      </p>
      <div className="mb-12 grid grid-cols-2 gap-3">
        {(Object.entries(breakpoint) as [string, number][]).map(([key, val]) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-[8px] border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3"
          >
            <div>
              <p className="text-[12px] capitalize text-white">{key}</p>
              <TokenBadge>breakpoint.{key}</TokenBadge>
            </div>
            <p className="font-mono text-[16px] font-semibold text-primary">{val}px</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── セクション: Icons ─────────────────────────────────

function IconsSection({ iconSets }: { iconSets: IconSetData[] }) {
  const [search, setSearch] = useState("");
  const [copiedIcon, setCopiedIcon] = useState<string | null>(null);

  const copyIconName = (name: string) => {
    navigator.clipboard.writeText(name).then(() => {
      setCopiedIcon(name);
      setTimeout(() => setCopiedIcon(null), 1200);
    });
  };

  return (
    <section id="icons" className="scroll-mt-8">
      <SectionTitle label="Icons" title="アイコン" />
      <div className="mb-8">
        <input
          type="text"
          placeholder="アイコン名で検索…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-[400px] rounded-[8px] border border-border-light bg-surface px-4 py-2.5 text-[14px] text-white outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-12">
        {iconSets.map(({ name: setName, icons }) => {
          const filtered = search
            ? icons.filter((n) => n.toLowerCase().includes(search.toLowerCase()))
            : icons;
          if (filtered.length === 0) return null;
          return (
            <div key={setName}>
              <div className="mb-4 flex items-center gap-3">
                <p className="text-[16px] font-semibold text-white">{setName}</p>
                <span className="rounded-full bg-[#2a2a2a] px-2.5 py-0.5 text-[11px] text-fg-muted">
                  {filtered.length}
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
                {filtered.map((iconName) => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => copyIconName(iconName)}
                    title={iconName}
                    className="group flex flex-col items-center gap-2 rounded-[8px] border border-transparent p-3 text-center transition-colors hover:border-border-light hover:bg-surface"
                  >
                    <Icon set={setName as "Base"} name={iconName} className="h-6 w-6 shrink-0" />
                    <p className="w-full truncate text-[10px] text-fg-muted group-hover:text-white">
                      {copiedIcon === iconName ? "✓" : iconName}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── セクション: Service Logos ─────────────────────────

function ServiceLogosSection({ logos }: { logos: LogoData[] }) {
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const copy = (name: string) => {
    navigator.clipboard.writeText(name).then(() => {
      setCopiedName(name);
      setTimeout(() => setCopiedName(null), 1200);
    });
  };

  return (
    <section id="logos" className="scroll-mt-8">
      <SectionTitle label="Logos" title="サービスロゴ" />
      <p className="mb-6 text-[13px] text-system-700">
        <code className="rounded bg-[#1a1a1a] px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
          {"<ServiceLogo name=\"figma\" className=\"h-8 w-8\" />"}
        </code>
        　　クリックで name をコピー
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
        {logos.map(({ name, label }) => (
          <button
            key={name}
            type="button"
            onClick={() => copy(name)}
            title={name}
            className="group flex flex-col items-center gap-3 rounded-[8px] border border-transparent p-4 text-center transition-colors hover:border-border-light hover:bg-surface"
          >
            <ServiceLogo name={name} className="h-8 w-8 shrink-0" />
            <p className="w-full truncate text-[11px] text-fg-muted group-hover:text-white">
              {copiedName === name ? "✓" : label}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

// ─── セクション: Components ────────────────────────────

function ComponentPreview({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[17px] font-semibold text-white">{title}</p>
        {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
      </div>
      <Card>
        <div className="flex flex-wrap items-start gap-4">{children}</div>
      </Card>
    </div>
  );
}

function MarkdownEditorDemo({ defaultMode, controlled }: { defaultMode?: "edit" | "split" | "preview"; controlled?: boolean }) {
  // controlled のときはモードを親が持ち、外のボタンからも切り替えられることを示す
  const [mode, setMode] = useState<"edit" | "split" | "preview">(defaultMode ?? "split");
  const [md, setMd] = useState(
    "# プロジェクト概要\n\n本文テキストを **太字** や *斜体*、[リンク](https://example.com) 付きで入力できます。\n\n### 見出し02\n\n- 箇条書き\n- 項目",
  );
  return (
    <div className="w-full">
      {controlled && (
        <p className="mb-2 text-[11px] text-fg-muted">
          親が持つモード: {mode}
          <button type="button" onClick={() => setMode("edit")} className="ml-3 rounded-[6px] border border-border-light px-2 py-0.5 text-fg-muted hover:text-white">
            外から編集モードへ
          </button>
        </p>
      )}
      {controlled ? (
        <RichMarkdownEditor value={md} onChange={setMd} mode={mode} onModeChange={setMode} className="h-[420px]" />
      ) : (
        <RichMarkdownEditor value={md} onChange={setMd} defaultMode={defaultMode} className="h-[420px]" />
      )}
    </div>
  );
}

function FigmaOnlyPreview({ title, figma, description }: {
  title: string;
  figma: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[17px] font-semibold text-white">{title}</p>
        {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
      </div>
      <div className="rounded-[12px] border border-dashed border-border p-6">
        <p className="text-[13px] text-fg-muted">
          Figma Library にはあるが実装が無い（Figma: {figma}）
        </p>
      </div>
    </div>
  );
}

const SAMPLE_TOC_ITEMS: WorkTocItem[] = [
  { label: "概要", level: 1 },
  { label: "背景と課題", level: 1 },
  { label: "現状の整理", level: 2 },
  { label: "とても長い見出しのサンプルとても長い見出しのサンプルとても長い見出しのサンプル", level: 2 },
  { label: "取り組み", level: 1 },
  { label: "設計方針", level: 2 },
  { label: "成果", level: 1 },
  { label: "振り返り", level: 1 },
];

function WorkTocDemo() {
  const [activeIndex, setActiveIndex] = useState(1);
  return (
    <div className="relative h-[360px] w-full">
      <div className="absolute left-0 top-1/2 -translate-y-1/2">
        <WorkToc items={SAMPLE_TOC_ITEMS} activeIndex={activeIndex} onSelect={setActiveIndex} />
      </div>
    </div>
  );
}

function ModalDemo() {
  const [open, setOpen] = useState(false);
  const [carousel, setCarousel] = useState(false);
  const [fit, setFit] = useState(false);
  const [index, setIndex] = useState(0);
  const total = 3;
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[8px] border border-border px-3 py-1.5 text-[13px] text-fg-muted transition-colors hover:border-system-700 hover:text-white"
        >
          Modal を開く
        </button>
        <label className="flex items-center gap-2 text-[13px] text-fg-muted">
          <input
            type="checkbox"
            checked={carousel}
            onChange={(e) => setCarousel(e.target.checked)}
          />
          carousel バリアント
        </label>
        <label className="flex items-center gap-2 text-[13px] text-fg-muted">
          <input
            type="checkbox"
            checked={fit}
            onChange={(e) => setFit(e.target.checked)}
          />
          width=content
        </label>
      </div>
      {open && (
        <Modal
          onClose={() => setOpen(false)}
          carousel={carousel}
          currentIndex={index}
          total={total}
          width={fit ? "content" : "full"}
          onPrev={carousel ? () => setIndex((i) => (i - 1 + total) % total) : undefined}
          onNext={carousel ? () => setIndex((i) => (i + 1) % total) : undefined}
        >
          <div className="p-8 text-white">
            <p className="text-[17px] font-semibold">
              Modal コンテンツ（{index + 1} / {total}）
            </p>
            <p className="mt-2 text-[13px] text-fg-muted">
              children にコンテンツを差し込む全画面オーバーレイ。carousel=true で prev/next とドット表示が付く。
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function WorkVizModalDemo() {
  const [kind, setKind] = useState<"timeline" | "stakeholders" | null>(null);
  return (
    <div className="flex w-full flex-wrap gap-3">
      <button
        type="button"
        onClick={() => setKind("timeline")}
        className="rounded-[8px] border border-border-light px-3 py-1.5 text-[13px] text-fg-muted transition-colors hover:border-system-700 hover:text-white"
      >
        Timeline モーダルを開く
      </button>
      <button
        type="button"
        onClick={() => setKind("stakeholders")}
        className="rounded-[8px] border border-border-light px-3 py-1.5 text-[13px] text-fg-muted transition-colors hover:border-system-700 hover:text-white"
      >
        Stakeholder モーダルを開く
      </button>
      {kind && (
        <WorkVizModal
          kind={kind}
          period={{ start: { year: 2024, month: 4 }, end: { year: 2024, month: 6 }, isCurrent: false }}
          timeline={{ totalUnits: 16, phases: [
            { label: "Research", start: 1, span: 3, raci: ["R", "A"] },
            { label: "Design", start: 3, span: 4, raci: ["C"] },
            { label: "Stakeholder Interview & Synthesis", start: 16, span: 1, raci: ["R", "A", "C"] },
            { label: "Development", start: 7, span: 6, raci: ["I"] },
            { label: "QA", start: 13, span: 3, raci: ["R"] },
          ] }}
          stakeholders={{ v: 2, layers: [
            { name: "Product", note: null, icon: "Abstract/application-one", cards: [
              { kind: "role", name: "General Manager", note: "1名", me: false },
              { kind: "role", name: "Product Manager", note: "1名", me: true },
            ] },
            { name: "Engineering", note: "実装・コードレビュー", icon: null, cards: [
              { kind: "role", name: "Site Reliability Engineer with a very long title", note: "1名", me: false },
              { kind: "role", name: "エンジニア", note: "5名", me: false, teams: [
                { name: "チームA", headcount: 2 },
                { name: "チームB", headcount: 3 },
              ] },
              { kind: "org", title: "Platform Team・3名", rows: [
                { text: "Tech Lead", me: false },
                { text: "Frontend Engineer ×2", me: true },
              ] },
            ] },
          ] }}
          onClose={() => setKind(null)}
        />
      )}
    </div>
  );
}

/** カテゴリ色の見本: プリセット 8 色（D案）と仮のカテゴリ名を 1 対 1 で組にする */
const CATEGORY_HUE_SAMPLES = ["Platform", "Business System", "Consumer App", "Website", "Design System", "Research", "Branding", "New Business"].map(
  (label, i) => ({ label, hue: WORK_CATEGORY_PRESET_HUES[i] as number })
);

function ComponentsSection() {
  return (
    <section id="components" className="scroll-mt-8">
      <SectionTitle label="Components" title="コンポーネント" />
      <div className="flex flex-col gap-12">
        <ComponentPreview title="ProtectedImage" description="Portfolio ストレージの画像は認証後に署名付きURLで表示。ローカル画像や外部画像はそのまま表示する">
          <ProtectedImage src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logos/figma.svg`} alt="Figma" className="h-8 w-8" />
        </ComponentPreview>
        <ComponentPreview title="Headline" description="見出しコンポーネント。default は Library SectionTitle 20:37（JP ラベル 12px mint-050 + Title/EN 38px Avenir Heavy・Text/Body/Primary、下余白 24）。sub / section / コンテンツ見出し 01・02（Library 304:302・同形）">
          <div className="w-full"><Headline label="制作・企画" title="Works" /></div>
          <div className="w-full"><Headline title="見出し" variant="sub" /></div>
          <div className="w-full"><Headline title="Section（34px Avenir Heavy 白）" variant="section" /></div>
          <div className="w-full"><Headline title="見出し 01（Headline type=02・16px Bold・文字 #9E9E9E Text/Body/Secondary・横線 System/700・h3）" variant="markdown-h1" /></div>
          <div className="w-full"><Headline title="見出し 02（01 と同形・h3・Library Headline type=02 304:302）" variant="markdown-h2" /></div>
          <div className="w-full"><Headline title="背景と課題（section-aside・22px Bold 白 + 右罫線。作品詳細のセクション見出し）" variant="section-aside" /></div>
        </ComponentPreview>

        <ComponentPreview title="Work詳細タイポグラフィ" description="Work詳細モーダル本文のタイポ体系（Figma 457:2366）。markdown 記法と対応。">
          <div className="flex w-full flex-col gap-3">
            <p className="font-en text-[34px] font-extrabold leading-[1.2] text-white">見出し01（# / Headline type=01・作品詳細ではセクション見出し・22px Noto Bold 白 + 右罫線。Headline section-aside）</p>
            <Headline title="見出し02（### / Headline type=02・横線＋Noto Bold 16px #9E9E9E）" variant="markdown-h2" />
            <Headline title="旧見出し（## / 見出し02 と同形・エディタのボタンなし）" variant="markdown-h1" />
            <p className="text-[15px] leading-[22px] tracking-[0.45px] text-fg">Body01（通常段落 / Noto Regular 15px text-fg = Text/Body/Primary #E0E0E0）</p>
            <p className="border-l-2 border-border-light pl-3 text-[13px] leading-[21px] tracking-[0.39px] text-system-400">引用 blockquote（&gt; / 13px system-400 #BDBDBD・左ボーダー）</p>
            <p className="text-[12px] leading-[18px] tracking-[0.03em] text-fg-caption">補足テキスト（画像キャプション / ::: caption / 12px・行の高さ 18px text-fg-caption。作品本文の中だけ）</p>
            <p className="text-[15px] leading-[24px] tracking-[0.45px] text-fg">
              インラインコード（<code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.88em] text-main-050">code</code>）
            </p>
            <div className="flex flex-col gap-2">
              <p className="text-caption-01-jp text-fg-caption">コードブロック（```）</p>
              <pre className="overflow-x-auto rounded-[12px] border border-[#2a2a2a] bg-[#0a0a0a] p-4 font-mono text-[13px] leading-[1.6] text-system-300">
                <code>{"const example = true;"}</code>
              </pre>
            </div>
          </div>
        </ComponentPreview>

        <ComponentPreview title="ButtonAction" description="CTA ボタン。Primary / Secondary / Ghost の 3 バリアント">
          <ButtonAction label="Primary Button" type="primary" />
          <ButtonAction label="Secondary Button" type="secondary" />
          <ButtonAction label="Ghost Button" type="ghost" />
          <ButtonAction label="With Icon" type="primary" iconRight={{ set: "Arrows", name: "right" }} />
        </ComponentPreview>

        <ComponentPreview title="ButtonFunction" description="アイコンのみのアクションボタン。Border on / off バリアント。hover で背景 白 2%・アイコンとラベル文字が白、Border on は枠が Border/Light（Library 120:395）">
          <ButtonFunction direction="left"  border="on"  aria-label="Left border-on" />
          <ButtonFunction direction="right" border="on"  aria-label="Right border-on" />
          <ButtonFunction direction="left"  border="off" aria-label="Left border-off" />
          <ButtonFunction direction="right" border="off" aria-label="Right border-off" />
          <ButtonFunction border="on" aria-label="Custom icon">
            <Icon set="Base" name="home" tintColor="currentColor" className={`h-5 w-5 ${BUTTON_FUNCTION_ICON}`} />
          </ButtonFunction>
        </ComponentPreview>

        <ComponentPreview title="Tag" description="作品の制作内容・カテゴリ・ツール表示用バッジ。default / small(bg black/25・11px white。作品詳細の Tools 代替表示用)/ content(作品の制作内容タグ。border 1px・10px fg-muted)/category（Library Tag-single 552:650: bg main-600・p8・r4・13px・字間 3%・text-box-trim・size=sm は 10px/高さ 23（作品カード・前後ナビ）。hue（カテゴリ色の色相。D案: 背景 oklch(0.30 0.06 h)・文字 oklch(0.88 0.09 h)。未指定は Main/600 地））/ tool(border付き・10px #9e9e9e。スキル展開パネル用・アイコン前置)。tool は filled(bg-surface で塗る・作品詳細の役割)と count(人数バッジ付き・作品詳細の関係者)を任意指定できる">
          <div className="flex flex-wrap gap-2 items-center">
            <Tag label="UI Design" />
            <Tag label="UX Research" />
            <Tag label="Project Management" />
          </div>
          <div className="flex flex-wrap gap-2 items-center mt-2 p-2 rounded bg-system-900">
            <Tag label="UI Design" variant="small" />
            <Tag label="UX Research" variant="small" />
          </div>
          <div className="flex flex-wrap gap-2 items-center mt-2 p-2 rounded bg-system-900">
            <Tag label="UI Design" variant="content" />
            <Tag label="UX Research" variant="content" />
          </div>
          <div className="flex flex-wrap gap-2 items-center mt-2 p-2 rounded bg-system-900">
            <Tag label="機能開発" variant="category" />
            <Tag label="機能開発" variant="category" size="sm" />
            <Tag label="Feature" variant="category" size="card" />
          </div>
          <div className="flex flex-wrap gap-2 items-center mt-2 p-2 rounded bg-system-900">
            {CATEGORY_HUE_SAMPLES.map(({ hue, label }) => (
              <Tag key={hue} label={label} variant="category" size="card" hue={hue} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center mt-2 p-2 rounded bg-system-900">
            <Tag label="Figma" variant="tool" prefix={<ServiceLogo name="figma" className="w-4 h-4 shrink-0 object-contain" />} />
            <Tag label="GitHub" variant="tool" prefix={<ServiceLogo name="github" className="w-4 h-4 shrink-0 object-contain" />} />
            <Tag label="Next.js" variant="tool" prefix={<Icon set="Components" name="page" tintColor="#9E9E9E" className="w-4 h-4 shrink-0" />} />
          </div>
          <div className="flex flex-wrap gap-2 items-center mt-2 p-2 rounded bg-system-900">
            <Tag label="デザインリード" variant="tool" filled />
            <Tag label="エンジニア" variant="tool" filled count={3} />
          </div>
        </ComponentPreview>

        <ComponentPreview title="Table" description="本文 markdown に挿入できる表（Library 188:355）。外枠 1px Border・角丸 8px。項目-値（TableKeyValue）はコンテナ幅 480px 以上で横（ラベル列は内容幅・高さ 40px）、480px 未満で縦積み。グリッド（TableGrid）は 1 行目が見出し（12px Bold）・列は等幅（最小 96px）・収まらないときは枠内で横スクロール。480px 未満では行ごとに「見出し / 値」を縦積みにする（スマホで多列表を横スクロールさせない）。markdown では「| 項目 | 値 |」の行、または 2 行目に「| --- | --- |」を置いた表で書く">
          <div className="flex w-full max-w-main flex-col gap-6">
            <TableKeyValue
              rows={[
                { label: "期間", value: "2023.04 – 2024.03" },
                { label: "役割", value: "UI デザイン / フロントエンド実装" },
                { label: "体制", value: "デザイナー 2 名、エンジニア 4 名" },
              ]}
            />
            <div className="w-[320px] max-w-full">
              <TableKeyValue
                rows={[
                  { label: "期間", value: "2023.04 – 2024.03" },
                  { label: "役割", value: "UI デザイン / フロントエンド実装" },
                ]}
              />
            </div>
            <TableGrid
              header={["見出し1", "見出し2", "見出し3"]}
              rows={[
                ["内容", "内容", "内容"],
                ["内容", "内容", "内容"],
              ]}
            />
          </div>
        </ComponentPreview>

        <ComponentPreview title="Tooltip" description="アイコンの下に出る名前ラベル。hover とキーボード focus で表示（Library Tooltip 60:558: bg-surface・border・余白 10/12・角丸 4・影 shadow-base・10px・white/80）。作品詳細の Tools 一覧で使用">
          <div className="pb-8">
            <Tooltip label="Figma">
              <ServiceLogo name="figma" className="h-4 w-4 shrink-0 object-contain" />
            </Tooltip>
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="SideMenuBar"
          description="サイドナビゲーション。Figma Master 62:545 / Library 55-296 準拠。角丸なし・右境界線は inside stroke(after 疑似要素)。Social はロゴのみ(GitHub / YOUTRUST、リンク先未設定)。既定は折りたたみ(96px)で、ホバー / キーボードフォーカス時に 216px(最も幅の広い中身に合わせて 8 の倍数へ切り上げ)へ展開しページ内容に重なる(内容は動かない)。collapsed prop で状態を固定できる(モバイルのオーバーレイは collapsed={false})。トグルボタンなし"
        >
          <div className="flex flex-wrap gap-8">
            <div className="overflow-hidden rounded-[12px] border border-border-light">
              <SideMenuBar activeSection="works" collapsed={false} />
            </div>
            <div className="overflow-hidden rounded-[12px] border border-border-light">
              <SideMenuBar activeSection="works" collapsed />
            </div>
          </div>
        </ComponentPreview>

        <FigmaOnlyPreview
          title="Tooltip"
          figma="Tooltip(slot)"
          description="ホバー時の補足表示コンポーネント。Figma Component ページには存在するが実装が無い"
        />

        <ComponentPreview title="TabBar" description="タブ切り替えコンポーネント（Figma 70:441）">
          <TabBar
            tabs={[
              { id: "all",    label: "すべて",   icon: { set: "Base",  name: "all-application" } },
              { id: "design", label: "デザイン", icon: { set: "Edit",  name: "writing-fluently" } },
              { id: "dev",    label: "開発",     icon: { set: "Edit",  name: "code" } },
            ]}
            defaultActiveId="all"
          />
        </ComponentPreview>

        <FigmaOnlyPreview
          title="Chart"
          figma="RadarChart / Legend"
          description="スキルレーダーチャートと凡例。Figma Component ページには存在するが styleguide 未掲載"
        />

        <ComponentPreview
          title="Modal"
          description="全画面オーバーレイモーダル(components/Modal.tsx)。ボタンで開閉するデモ用パターン。carousel バリアントで prev/next とドット表示に切り替え可能（Figma 120:383）。Escape で閉じる／開くとモーダルへフォーカス、閉じると開いたボタンへ戻る／width=&quot;content&quot; で中身の幅（上限 800px）"
        >
          <ModalDemo />
        </ComponentPreview>

        <ComponentPreview title="Card" description="制作・企画(Works)一覧カード。Figma の Card に対応。href を渡すとカード全体がリンク(<a>)になり詳細ページ(/works?id=)へ遷移。⌘+クリック・中クリックで別タブに開ける。幅は容器に従うため、実ページ（本文 800px の 3 列）と同じ 256px を与えている。通常時は影なし(Figma では内側の影が外枠の clip で切れて画面に出ない)。ホバー時は背景 Action/hover・枠 Border/Light・影 shadow-base（Library Card Status=hover。href 指定時のみ）。切り替えは 300ms ease-out で、ホバーするカード共通（lib/hover-card.ts の HOVER_CARD。WorkPagerCard・スキルカードも同じ）。Figma Master 494:1363。カテゴリチップ・期間・作品名・制作内容タグ。画像は thumbnail（構成）があれば WorkThumbnail、無ければ image、無ければ既定画像">
          {/* WorkCard は w-full。ラッパを外すとプレビューの容器いっぱいに伸びて実寸を表さない */}
          <div className="w-[256px] max-w-full">
          <WorkCard
            category="機能開発"
            title="ECサイトリニューアル"
            period="2023.4 - 2023.9"
            contents={["Product Design", "BtoC", "SaaS", "Mobile Application"]}
            image="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80"
            href="/works?id=sample"
          />
          </div>
          {/* thumbnail（構成サムネイル）あり: 画像エリアに WorkThumbnail を描く。image は無視される */}
          <div className="w-[256px] max-w-full">
          <WorkCard
            category="プラットフォーム開発"
            title="キャリアチケットスカウトサービスの立ち上げ"
            period="2023.4 - 2023.9"
            contents={["Product Design", "BtoB", "SaaS"]}
            thumbnail={SAMPLE_THUMBNAILS[0]}
            serviceName="Career Ticket"
            href="/works?id=sample"
          />
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="WorkThumbnail"
          description="構成サムネイル（works.thumbnail）。4 レイアウト・1280×720 基準を cqw で縮尺・空き枠は斜線・ロゴがあればロゴだけ（高さ揃え・見切れなし）、無ければサービス名（未設定は「Service」）・ブランド指定（careerticket-scout の a1 / hataractive の d はブランド地の例）があれば白基調にブランド色のうすいグラデ・ロゴ未設定ならサービスのロゴ・d は資料 1 枚なら右に大きく 1 枚、2 枚なら 1 枚目が手前。Figma のマスターは Library の WorkThumbnail（構成案 v2 準拠）"
        >
          <div className="flex w-full flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {SAMPLE_THUMBNAILS.map((t, i) => (
                <div key={i} className="relative aspect-video w-[339px] max-w-full overflow-hidden rounded-[14px]">
                  <WorkThumbnail
                    layout={t.layout}
                    logoUrl={t.logo_url}
                    desktopUrl={t.desktop_url}
                    mobileUrls={t.mobile_urls}
                    captureUrls={t.capture_urls}
                    serviceName={SAMPLE_THUMB_SERVICE}
                    brand={t.brand}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              {SAMPLE_THUMBNAILS.map((t, i) => (
                <div key={i} className="relative aspect-video w-[128px] overflow-hidden">
                  <WorkThumbnail
                    layout={t.layout}
                    logoUrl={t.logo_url}
                    desktopUrl={t.desktop_url}
                    mobileUrls={t.mobile_urls}
                    captureUrls={t.capture_urls}
                    serviceName={SAMPLE_THUMB_SERVICE}
                    brand={t.brand}
                  />
                </div>
              ))}
            </div>
          </div>
        </ComponentPreview>

        <SubHeading>実装のみ(Figma に対応コンポーネントなし)</SubHeading>

        <ComponentPreview
          title="InfoCard"
          description="作品本文の `::: card` で挿入する汎用カード。見出しは任意、本文は Markdown。Figma 未作成(実装先行)"
        >
          <div className="flex w-[360px] max-w-full flex-col gap-4">
            <InfoCard title="見出しあり">
              <p className="text-[13px] leading-[21px] tracking-[0.39px] text-white">本文テキストがここに入ります。</p>
            </InfoCard>
            <InfoCard>
              <p className="text-[13px] leading-[21px] tracking-[0.39px] text-white">見出しなしのカード。</p>
            </InfoCard>
            <InfoCard title="tone=accent（次の一手など）" tone="accent">
              <p className="text-[13px] leading-[21px] tracking-[0.39px] text-white">Border/Main・main-100 の薄い地・見出しは primary。`::: card tone=accent 見出し` で書く。</p>
            </InfoCard>
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="WorkFigure（図版ブロック）"
          description="作品本文の `::: figure`（枠。panel 地 system-900・角丸 16・中に任意の本文ブロック）/ `::: beforeafter`（上罫線で区切った Before/After の行。ラベル 96px・After は main-100 文字。注記は地なしの色文字）/ `::: flow`（横フロー。highlight=N で強調）/ `::: bars`（横棒グラフ。up=secondary・down=danger-500・flat=system-750、base= で白い基準線）と、`::: card tone=accent`。560px 未満（本文コンテナ幅）はステップが縦積み（矢印 ↓）になる。手順の強調は good=main-100・bad=danger-300 の淡いトーン（地 10%・枠 60%）。Figma: Library WorkFigure 578:582"
        >
          <div className="w-[704px] max-w-full">
            <MarkdownBody md={FIGURE_SAMPLE_MD} />
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="RichMarkdownEditor"
          description="Work 本文編集用のリッチ Markdown エディタ。生 Markdown ＋ 編集 / 分割 / プレビュー の3モード。プレビューは公開側と同一の WorkMarkdown レンダラで描画。onUploadImage を渡すと本文欄への画像の貼り付けでアップロードでき、貼り付けた画像はアップロード後に画像ダイアログ（配置・横幅・倍率）を経て挿入される。defaultMode（edit か split か preview、既定は split）で表示モードの初期値を指定できる。mode と onModeChange を渡すとモードを外から制御できる（作品エディタがプレビューの見出しボタンで編集モードへ戻すのに使う）"
        >
          <MarkdownEditorDemo />
        </ComponentPreview>

        <ComponentPreview
          title="RichMarkdownEditor（defaultMode=edit）"
          description="表示モードの初期値を編集のみにした例。作品エディタのように、本文欄の外側に公開ページ全体のプレビューを置く場合に使う。モード切替ボタンで分割・プレビューへは従来どおり切り替えられる"
        >
          <MarkdownEditorDemo defaultMode="edit" />
        </ComponentPreview>

        <ComponentPreview
          title="RichMarkdownEditor（mode / onModeChange で外から制御）"
          description="モードを親の状態で持つ例。エディタ内の切替ボタンは onModeChange を呼び、親からも切り替えられる。作品エディタはこれを使って、プレビュー表示中に右側の見出しボタンが押されたら編集モードへ戻している"
        >
          <MarkdownEditorDemo defaultMode="preview" controlled />
        </ComponentPreview>

        <ComponentPreview
          title="FlowchartView"
          description="React Flowを使った読み取り専用ダイアグラム。全オブジェクト共通の標準・Primary（ミント塗り）・Secondary（ミント枠＋濃緑背景）配色、文字サイズ・整列・カード仕切り・線端マーカー・可変サイズに対応。ボーダー基調（影なし・全ノード Surface + Border/Light 1px）"
        >
          <div className="h-[420px] w-full overflow-hidden rounded-[14px] border border-border bg-[#1a1a1a] p-2">
            <FlowchartView data={SAMPLE_FLOWCHART} />
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="WorkProcessChart"
          description="Work 詳細の Timeline（Figma _Process）。メタ表の全画面ボタン → WorkVizModal 内に works.timeline を描画。目盛りは作品の期間から作る絶対日付の 2 段表示（3 か月以下は 年月 / 週、4 か月以上は 年 / 月）。ツールチップの見出しは工程名。Phase 列なし・フェーズ名はバーの中の右端・RACI 12px"
        >
          <div className="w-full">
            <WorkProcessChart
              period={{ start: { year: 2024, month: 4 }, end: { year: 2024, month: 6 }, isCurrent: false }}
              data={{ totalUnits: 12, phases: [
                { label: "Research", start: 1, span: 3, raci: ["R", "A"], note: { title: "調査", body: "ヒアリングを実施" } },
                { label: "Design", start: 3, span: 4, raci: ["C"] },
                { label: "Development", start: 7, span: 4, raci: ["I"] },
                { label: "QA", start: 9, span: 2, raci: ["R"] },
                { label: "Launch Preparation", start: 11, span: 2, raci: ["A"] },
                { label: "Release", start: 12, span: 1, raci: ["I"] },
              ] }}
            />
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="WorkProcessChart（月モード）"
          description="期間が 4 か月以上のとき。上段が年、下段が月。幅が足りないラベルは間引かれる"
        >
          <div className="w-full">
            <WorkProcessChart
              period={{ start: { year: 2024, month: 4 }, end: { year: 2024, month: 12 }, isCurrent: false }}
              data={{ totalUnits: 36, phases: [
                { label: "Research", start: 1, span: 8, raci: ["R", "A"], note: { body: "ヒアリングと競合調査" } },
                { label: "Design", start: 9, span: 12, raci: ["C"] },
                { label: "Development", start: 21, span: 16, raci: ["R"] },
              ] }}
            />
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="WorkStakeholderDiagram"
          description="層ごとにロールカード／組織カードを並べる。メタ表の全画面ボタン → WorkVizModal 内に works.stakeholders を描画"
        >
          <div className="w-full">
            <WorkStakeholderDiagram
              data={{ v: 2, layers: [
                { name: "意思決定", note: "合意・要件確認", icon: "Peoples/every-user", cards: [
                  { kind: "role", name: "最終合意者", note: "2名", me: false },
                  { kind: "role", name: "PO（要件確認者）", note: "1名", me: false },
                ] },
                { name: "マネジメント", note: "進行・管理", icon: "Abstract/application-one", cards: [
                  { kind: "role", name: "PjM（プロジェクトマネージャー）", note: "PJ の立ち上げ・初動の進行", me: true },
                  { kind: "role", name: "PJ 全体管理", note: "進行・工数管理（API 実装と兼務）", me: false },
                ] },
                { name: "設計", note: "外部設計", icon: "Components/tree-list", cards: [
                  { kind: "role", name: "外部設計", note: "デザイナー 1名", me: false },
                  { kind: "role", name: "外部設計レビュー", note: "デザイナー視点での確認", me: true },
                ] },
                { name: "開発", note: "実装・コードレビュー", icon: "Edit/code", cards: [
                  { kind: "role", name: "エンジニア", note: "5名", me: false, teams: [
                    { name: "チームA", headcount: 2 },
                    { name: "チームB", headcount: 3 },
                  ] },
                  { kind: "org", title: "スカウト（CTS）・4名", rows: [
                    { text: "学生側 主実装", me: false },
                    { text: "学生側 コードレビュー", me: false },
                    { text: "企業側・管理画面 主実装", me: false },
                    { text: "企業側・管理画面 コードレビュー", me: false },
                  ] },
                  { kind: "org", title: "エージェント（CTA）・2名", rows: [
                    { text: "API コードレビュー ×2", me: false },
                  ] },
                  { kind: "org", title: "顧客管理基盤・2名＋兼務", rows: [
                    { text: "API 主実装（全体管理が兼務）", me: false },
                    { text: "API レビュー ×2", me: false },
                  ] },
                ] },
              ] }}
            />
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="WorkVizModal"
          description="メタ表の全画面ボタンで開く Timeline / Stakeholder モーダル（Figma 839:3499 / 848:2944）。汎用 Modal を流用し見出し＋viz を描画。幅は timeline・stakeholder とも full"
        >
          <WorkVizModalDemo />
        </ComponentPreview>

        <ComponentPreview
          title="WorkDetailHeader"
          description="Works 詳細ページの上部ブロック(Figma 787:9916 / _ProjectContents)。デバイスモック(最大 2 枚。横長の画像はノート PC 枠・縦長はスマホ枠。PC 1 枚 + スマホ 1 枚のときは Library の WorkThumbnail a1 にならいスマホを PC の右下に実寸寄りの倍率で重ねる。Figma 側は未同期)/ カテゴリ・タイトル / 制作内容・Tools(タイトル直下の1行)/ メタ表(期間・役割・関係者＋Timeline・Stakeholder の全画面ボタン)"
        >
          <div className="rounded-[12px] border border-border-light bg-surface px-6">
            <WorkDetailHeader
              work={SAMPLE_WORK_DETAIL}
              contents={["UI Design", "UX Research", "PJ Management"]}
              tools={[{ name: "Figma", icon_url: null }, { name: "React", icon_url: null }]}
              screenshots={(SAMPLE_WORK_DETAIL.hero_screenshots ?? []) as string[]}
            />
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="WorkDetailHeader（ヒーロー構成 hero_layout）"
          description="管理画面の「ヒーロー構成」で選ぶ 5 種類。none は何も出さず、sp2 / pcsp / pc は画像の縦横を調べず構成どおりの端末枠で描く（URL 末尾の #browser でブラウザバー付き）。images は枠なしで 1〜3 枚（2〜3 枚は OOUI 勉強会のヒーローと同じく 16:9 の札を階段状に重ねる）。hero_layout が null の作品は従来どおり画像の縦横で自動判定する（上の WorkDetailHeader）"
        >
          <div className="flex flex-col gap-6">
            {HERO_LAYOUT_SAMPLES.map((s) => (
              <div key={s.label} className="flex flex-col gap-2">
                <p className="text-[12px] text-fg-muted">{s.label}</p>
                <div className="rounded-[12px] border border-border-light bg-surface p-6">
                  <WorkDetailHeader
                    work={{ ...SAMPLE_WORK_DETAIL, hero_layout: s.hero_layout, hero_screenshots: s.hero_screenshots }}
                    contents={[]}
                    tools={[]}
                    screenshots={s.hero_screenshots}
                  />
                </div>
              </div>
            ))}
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="WorkDetailHeader（onEdit 付き・admin プレビュー用）"
          description="admin の作品エディタ右側プレビュー専用。onEdit を渡すと、ヒーロー・カテゴリ/タイトル・制作内容/ツール・期間・役割・関係者の各領域に編集ボタン（円形・鉛筆アイコン）が重なる。押すと左カラムの該当入力欄へ移動して強調する。公開ページでは渡さないので見た目は変わらない"
        >
          <div className="rounded-[12px] border border-border-light bg-surface px-6">
            <WorkDetailHeader
              work={SAMPLE_WORK_DETAIL}
              contents={["UI Design", "UX Research", "PJ Management"]}
              tools={[{ name: "Figma", icon_url: null }, { name: "React", icon_url: null }]}
              screenshots={(SAMPLE_WORK_DETAIL.hero_screenshots ?? []) as string[]}
              onEdit={() => {}}
            />
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="WorkBreadcrumb"
          description="作品詳細の先頭ヘッダー（Library 414:296）。高さ 56px。パンくずは Background/Default（bg-surface = system-925 #191919・不透明）＋ぼかし＋1px 枠（border #3A3A3A）の囲みに入れる。件数は囲みなしで、地の色の縁取り（text-shadow）で後ろを通る本文から読み分ける。作品詳細では上部固定（sticky）。md 以上は「Works / 作品名」で、囲みの内側に左右 8px を足して文字から枠までを左右ほぼ同じ(15・16px)にする。md 未満は「‹ Works」。件数と前後矢印は全幅で出す。先頭は前矢印なし・最後は次矢印なし・1 件のみは件数も矢印も出さない。実寸 800px"
        >
          <div className="flex w-full max-w-main flex-col gap-6">
            <WorkBreadcrumb title="キャリアチケットスカウトサービス" index={2} total={8} prevHref="#" nextHref="#" />
            <WorkBreadcrumb title="キャリアチケットスカウトサービス" index={0} total={8} nextHref="#" />
            <WorkBreadcrumb title="キャリアチケットスカウトサービス" index={0} total={1} />
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="WorkPagerCard"
          description="作品詳細の末尾にある前後ナビのカード。Prev は左寄せ、Next は右寄せ。カテゴリが無ければ行ごと省略、作品名は 2 行で省略。thumbnail ありは md 以上だけ画像（幅 128px）をカードの端まで広げて左（Next は右）に置く。md 未満は画像なしと同じ見た目。composedThumbnail（構成サムネイル）ありは 128px 枠に 16:9 で縦中央・上下は system-950。実ページと同じく md 以上で 2 列。direction を省くと方向の行（矢印＋Prev / Next）を出さない形になり、作品本文の `::: workcard id=<作品 id>` の作品カードに使う（Figma Master 973:2191・幅 394px 上限・公開中の作品のみ表示）"
        >
          <div className="flex w-full max-w-main flex-col gap-6">
            <WorkPagerCard direction="prev" category="プラットフォーム開発" title="キャリアチケットスカウトサービス" href="#" />
            <WorkPagerCard direction="next" category="プラットフォーム開発" title="キャリアチケットスカウトサービス" href="#" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <WorkPagerCard direction="prev" category="UI デザイン" title="社内向け管理ツールの刷新" href="#" />
              <WorkPagerCard direction="next" category="プラットフォーム開発" title="キャリアチケットスカウトサービス" href="#" />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <WorkPagerCard direction="prev" category="UI デザイン" title="社内向け管理ツールの刷新" thumbnail="/window.svg" href="#" />
              <WorkPagerCard direction="next" category="プラットフォーム開発" title="キャリアチケットスカウトサービス" thumbnail="/window.svg" href="#" />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <WorkPagerCard direction="prev" category="プラットフォーム開発" title={SAMPLE_THUMB_TITLE} composedThumbnail={SAMPLE_THUMBNAILS[0]} serviceName={SAMPLE_THUMB_SERVICE} href="#" />
              <WorkPagerCard direction="next" category="プラットフォーム開発" title={SAMPLE_THUMB_TITLE} composedThumbnail={SAMPLE_THUMBNAILS[0]} serviceName={SAMPLE_THUMB_SERVICE} href="#" />
            </div>
            <div className="w-full max-w-[394px]">
              <WorkPagerCard category="UI デザイン" title="社内向け管理ツールの刷新（direction なし・作品本文の作品カード）" thumbnail="/window.svg" href="#" />
            </div>
            <WorkPagerCard direction="next" title="とても長い作品名のサンプルとても長い作品名のサンプルとても長い作品名のサンプルとても長い作品名のサンプルとても長い作品名のサンプル" href="#" />
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="WorkToc"
          description="作品詳細の目次（シークエリア）。閉じた状態は見出しごとの短い横線の縦並びで、いま読んでいる見出しの線だけ primary 色。開いた状態は見出し名を並べた暗い角丸パネル（長い見出しは省略表示、小見出しはインデント）。マウスはホバーで開閉するポップオーバー、キーボード（Enter / Space）も同じポップオーバー。タッチ・ペンは線の列をタップすると左から出るドロワー（1 行 44px 以上・背景タップ / × / Esc で閉じる）。ポップオーバーは Esc・外側タップで閉じ、見出しを選ぶとそこへスクロールして閉じる。見出しが 1 つ以下なら何も出さない。位置は呼び出し側で決める（実ページは画面左端に固定）"
        >
          <WorkTocDemo />
        </ComponentPreview>

        <ComponentPreview
          title="DeviceMock"
          description="スクリーンショットを入れるデバイス枠。PhoneMock は iPhone 風（既定幅 126px・className で上書き。枠の高さは画像の比率に合わせ、切り取らない。作品詳細の上部は最大2枚横並び）。LaptopMock はノートPC風（黒ベゼルの画面＋土台・親の幅いっぱい・実機比率(蓋 92%・ベゼル 3%・土台は全幅)で画面は 16:10 固定、画像は上端から切り取り）で、ブラウザバー（赤黄緑の点＋中央の URL）は任意。PhoneMock も browser で iOS Safari 風の下部バー（URL 表示＋アイコン列）を重ねられる（画像下端の帯を隠す用途）。作品本文には `::: mockup phone src=<url> [src=<url>]` / `::: mockup laptop src=<url> [browser] [url=example.com]` で挿入する（url を書くとバーも出る・本文のスマホは幅 180px・ノートPCは最大 640px）。Figma のマスターはまだ無い"
        >
          <div className="flex w-full flex-col gap-8">
            <div className="flex items-start gap-6">
              <PhoneMock src="https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=400&q=80" className="w-[180px]" />
              <PhoneMock src="https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=400&q=80" className="w-[180px]" browser url="example.com" />
            </div>
            <div className="w-full max-w-[640px]">
              <LaptopMock src="https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=800&q=80" />
            </div>
            <div className="w-full max-w-[640px]">
              <LaptopMock src="https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=800&q=80" browser url="example.com" />
            </div>
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="WorkDetailContent（onEditSection 付き・admin プレビュー用）"
          description="admin の作品エディタ右側プレビュー専用。onEditSection を渡すと、各セクション見出しの右上に編集ボタンが重なり、押すと本文エディタの該当見出し行にカーソルが移る。見出しが空のセクションは見出しなしと表示してボタンだけ残す。公開ページでは渡さない"
        >
          <div className="w-full rounded-[12px] border border-border-light bg-surface px-6">
            <WorkDetailContent work={SAMPLE_WORK_DETAIL} onEditSection={() => {}} />
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="WorkDetailContent"
          description="Works 詳細ページの本文（800px カラム）。セクションは 1 カラム（Claude Design「Works 詳細 1カラム 提案」B案）: 見出し（Library Headline type=01・22px Bold 白 + 右へ伸びる罫線）→ 32px → 本文 markdown。セクション間は 80px で、区切りは見出しの罫線が兼ねる。上部ブロック（メタ表）との間は 48px で罫線は引かない。本文ブロックはカラムの左右 16px 内側（幅 768）。本文の文字色は text-fg（Text/Body/Primary #E0E0E0）。align=left の画像は画像 200・角丸 16 → gap 24 → 右列（本文 15px → キャプション 12px、gap 8）。図版・表の中の文字は 13px（Body/02）・出典は 12px で、作品本文の中だけ 11px/10px から上げている（読みやすさ監査 S8）。見出しは作品名 h1・セクション h2・## と ### は同格の h3。見出し02→本文 24 / 小ブロック間 40"
        >
          <div className="w-full rounded-[12px] border border-border-light bg-surface px-6">
            <WorkDetailContent work={SAMPLE_WORK_DETAIL} />
          </div>
        </ComponentPreview>
      </div>
    </section>
  );
}

// ─── メインレイアウト ───────────────────────────────────

export function StyleguideLayout({ iconSets, logos }: { iconSets: IconSetData[]; logos: LogoData[] }) {
  const [activeId, setActiveId] = useState<string>("colors");
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );
    NAV_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a]">

      {/* ─── サイドバー ─────────────────────────── */}
      <aside className="sticky top-0 flex h-screen w-[220px] shrink-0 flex-col border-r border-[#2a2a2a] bg-[#0a0a0a] px-4 py-8">
        <div className="mb-8 px-2">
          <Link href="/" className="mb-1 block text-[12px] tracking-[0.6px] text-primary hover:underline">
            ← Portfolio
          </Link>
          <p className="text-[20px] font-semibold text-white">Style Guide</p>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_SECTIONS.map(({ id, label, labelJa }) => {
            const isActive = activeId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => scrollToSection(id)}
                className={[
                  "flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left transition-colors",
                  isActive
                    ? "bg-[rgba(72,244,190,0.08)] text-white"
                    : "text-fg-muted hover:bg-[#1a1a1a] hover:text-white",
                ].join(" ")}
              >
                {isActive && <span className="h-4 w-[2px] shrink-0 rounded-full bg-primary" />}
                <span className={["flex flex-col", isActive ? "" : "pl-[10px]"].join(" ")}>
                  <span className="text-[14px] leading-[1.4]">{label}</span>
                  <span className="text-[11px] text-system-700">{labelJa}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ─── メインコンテンツ ─────────────────────── */}
      <main ref={mainRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[900px] px-12 py-12">
          <div className="mb-16">
            <p className="text-[12px] tracking-[0.6px] text-primary">Design System</p>
            <p className="mt-1 text-[40px] font-bold tracking-[2px] text-white">Style Guide</p>
            <p className="mt-3 text-[14px] text-fg-muted">
              カラー・タイポグラフィ・スペーシング・アイコン・コンポーネントのデザイントークンとUIパターンをまとめたリファレンスです。
            </p>
          </div>

          <div className="flex flex-col gap-24">
            <ColorsSection />
            <TypographySection />
            <TokensSection />
            <IconsSection iconSets={iconSets} />
            <ServiceLogosSection logos={logos} />
            <ComponentsSection />
          </div>

          <div className="mt-24 border-t border-[#2a2a2a] pt-8">
            <p className="text-[12px] text-system-800">Portfolio Style Guide</p>
          </div>
        </div>
      </main>
    </div>
  );
}
