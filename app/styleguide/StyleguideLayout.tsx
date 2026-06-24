"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import ServiceLogo from "@/components/ServiceLogo";
import Tag from "@/components/Tag";
import Headline from "@/components/Headline";
import ButtonAction from "@/components/ButtonAction";
import { ButtonFunction } from "@/components/ButtonFunction";
import TabBar from "@/components/TabBar";
import HistoryItem from "@/components/HistoryItem";
import WorkCard from "@/components/WorkCard";
import WorkDetailLeftPanel from "@/components/WorkDetailLeftPanel";
import WorkDetailContent from "@/components/WorkDetailContent";
import SideMenuBar from "@/components/SideMenuBar";
import RichMarkdownEditor from "@/components/RichMarkdownEditor";
import { WorkProcessChart, WorkStakeholderDiagram } from "@/components/WorkViz";
import { color, semantic, shadow, radius, size, container, typo, textStyle, breakpoint } from "@/lib/design-tokens";
import type { Tables } from "@/src/types/supabase";

// Works 詳細ページのプレビュー用サンプルデータ
const SAMPLE_WORK_DETAIL = {
  id: "sample",
  title: "キャリアチケットスカウトサービスの立ち上げ",
  category: "プラットフォーム開発",
  thumbnail_url: "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=800&q=80",
  role: "リードUI/UXデザイナー・プロジェクトマネージャー",
  period: "2023年4月 - 2023年9月（6ヶ月）",
  timeline: null,
  stakeholders: null,
  hero_brand: null,
  hero_screenshots: [
    "https://images.unsplash.com/photo-1551650975-87deedd944c3?auto=format&fit=crop&w=400&q=80",
    "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=400&q=80",
  ],
  hero_bg_color: null,
  sections: [
    { heading: "概要", body: "### 背景\n市場のニーズに応えるため、新規スカウトサービスを立ち上げました。\n\n### 課題\n既存フローでは候補者と企業のマッチング精度に課題がありました。" },
    { heading: "見出し01", body: "本文テキスト Body01。プロジェクトで取り組んだ施策の詳細を記載します。" },
  ],
  summary: "求職者と企業をつなぐ新しいスカウト体験を、立ち上げからベータ版リリースまで一貫して設計・推進しました。",
  site_url: "https://example.com",
  site_title: "サイトタイトル",
  site_thumbnail_url: "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?auto=format&fit=crop&w=200&q=80",
  stakeholder_breakdown: "事業責任者(1) | プロジェクトマネージャー(1) | デザイナー(2) | エンジニア(4)",
  career_item_id: null,
  sort_order: 0,
  created_at: null,
} as Tables<"works">;

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
  { kind: "bg",     cls: "bg-primary",           token: "semantic.primary",      value: semantic.primary,      figma: "Main/Primary",        ref: "main-base" },
  { kind: "text",   cls: "text-fg",              token: "semantic.fg",           value: semantic.fg,           figma: "Text/Body/Main",      ref: "system-white" },
  { kind: "text",   cls: "text-fg-muted",        token: "semantic.fgMuted",      value: semantic.fgMuted,      figma: "Text/Body/Sub",       ref: "system-500" },
  { kind: "bg",     cls: "bg-surface",           token: "semantic.surface",      value: semantic.surface,      figma: "Background/Default",  ref: "system-900" },
  { kind: "bg",     cls: "bg-surface-dark",      token: "semantic.surfaceDark",  value: semantic.surfaceDark,  figma: "Background/Dark",     ref: "system-1000" },
  { kind: "border", cls: "border-border",        token: "semantic.border",       value: semantic.border,       figma: "Border/Default",      ref: "system-800" },
  { kind: "border", cls: "border-border-strong", token: "semantic.borderStrong", value: semantic.borderStrong, figma: "Border/Light",        ref: "system-500" },
  { kind: "bg",     cls: "bg-overlay-light",     token: "semantic.overlayLight", value: semantic.overlayLight, figma: "Background/Light-α5", ref: "white 5%" },
  { kind: "bg",     cls: "bg-overlay-dark",      token: "semantic.overlayDark",  value: semantic.overlayDark,  figma: "Background/Dark-α25", ref: "black 25%" },
] as const;

// ─── タイポグラフィ（textStyle トークンから生成）────────────────────────────
// lang → フォントファミリー（CSS 変数経由で next/font を当てる）とサンプル文字
const TYPO_LANG = {
  jp: { cssVar: "--font-noto-sans-jp", sample: "本文テキスト サンプル" },
  en: { cssVar: undefined as string | undefined, family: typo.body.en, sample: "Body Text Sample" },
} as const;

// ─── 共通サブコンポーネント ────────────────────────────
function SectionTitle({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="mb-1 text-[12px] tracking-[0.6px] text-[#48f4be]">{label}</p>
      <p className="text-[32px] leading-[1.5] tracking-[1.6px] text-white">{title}</p>
      <div className="mt-3 h-[2px] w-10 rounded bg-[#424242]" />
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[13px] font-semibold tracking-[0.65px] text-[#9e9e9e] uppercase">
      {children}
    </p>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-[#424242] bg-[#212121] p-6">
      {children}
    </div>
  );
}

function TokenBadge({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-[#1a1a1a] px-1.5 py-0.5 font-mono text-[10px] text-[#9e9e9e]">
      {children}
    </code>
  );
}

// ─── セクション: Colors ────────────────────────────────

const COLOR_GROUPS = [
  {
    key: "main" as const,
    label: "Main",
    desc: "ブランドアクセントカラー（グリーン系）",
    tailwindPrefix: "main",
    shades: Object.entries(color.main) as [string, string][],
  },
  {
    key: "danger" as const,
    label: "Danger",
    desc: "エラー・破壊的アクション（赤ピンク系）",
    tailwindPrefix: "danger",
    shades: Object.entries(color.danger) as [string, string][],
  },
  {
    key: "warning" as const,
    label: "Warning",
    desc: "警告・注意（黄緑系）",
    tailwindPrefix: "warning",
    shades: Object.entries(color.warning) as [string, string][],
  },
  {
    key: "system" as const,
    label: "System",
    desc: "ニュートラルグレースケール",
    tailwindPrefix: "system",
    shades: Object.entries(color.system) as [string, string][],
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
      <p className="mb-8 text-[13px] text-[#616161]">
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
              <p className="text-[11px] text-[#616161]">{desc}</p>
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
                    className="group flex w-[90px] shrink-0 flex-col gap-2 rounded-[8px] border border-transparent p-2 text-left transition-colors hover:border-[#424242] hover:bg-[#1a1a1a]"
                  >
                    <div
                      className="h-10 w-full rounded-[6px] border border-white/10"
                      style={{ backgroundColor: hex }}
                    />
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-medium text-white">{shade}</p>
                      <p className="font-mono text-[10px] text-[#616161]">
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
            <p className="text-[11px] text-[#616161]">
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
                className="group flex items-center gap-3 rounded-[8px] border border-transparent p-2 text-left transition-colors hover:border-[#424242] hover:bg-[#1a1a1a]"
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
                  <p className="font-mono text-[10px] text-[#616161]">
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
      <div className="mb-10 grid grid-cols-2 gap-4">
        {(
          [
            { role: "Guide / JP", family: typo.guide.jp, token: "typo.guide.jp", cssVar: "--font-mplus-1p",     sample: "見出しガイド" },
            { role: "Guide / EN", family: typo.guide.en, token: "typo.guide.en", cssVar: "--font-afacad",       sample: "Heading Guide" },
            { role: "Body / JP",  family: typo.body.jp,  token: "typo.body.jp",  cssVar: "--font-noto-sans-jp", sample: "本文テキスト" },
            { role: "Body / EN",  family: typo.body.en,  token: "typo.body.en",  cssVar: undefined,             sample: "Body Text" },
          ] as const
        ).map(({ role, family, token, cssVar, sample }) => (
          <div
            key={token}
            className="flex flex-col gap-3 rounded-[10px] border border-[#424242] bg-[#212121] p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-[#9e9e9e]">{role}</p>
              <TokenBadge>{token}</TokenBadge>
            </div>
            {/* CSS変数経由で参照することでnext/fontのローカルフォントが正しく当たる */}
            <p
              className="truncate text-[22px] text-white"
              style={{ fontFamily: cssVar ? `var(${cssVar})` : family }}
            >
              {sample}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-[12px] text-[#616161]">{family}</p>
              {cssVar && <TokenBadge>{cssVar}</TokenBadge>}
            </div>
          </div>
        ))}
      </div>

      {/* タイプスケール（Figma Typo コレクションの命名済み text style） */}
      <SubHeading>Text Styles</SubHeading>
      <p className="mb-4 text-[12px] text-[#616161]">
        Figma の命名済み text style。JS からは <TokenBadge>tokens.textStyle[&quot;body-02-jp&quot;]</TokenBadge> で参照。
        lineHeight は倍率（Figma 100% → 1）、letterSpacing は em（Figma 3% → 0.03em）。
      </p>
      <div className="flex flex-col divide-y divide-[#2a2a2a]">
        {(Object.entries(textStyle) as [string, (typeof textStyle)[keyof typeof textStyle]][]).map(
          ([key, ts]) => {
            const langInfo = TYPO_LANG[ts.lang];
            const fontFamily =
              langInfo.cssVar ? `var(${langInfo.cssVar})` : "family" in langInfo ? langInfo.family : undefined;
            return (
              <div key={key} className="flex flex-col gap-2 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-baseline gap-3">
                    <p className="font-mono text-[16px] text-white">{ts.size}px</p>
                    <p className="font-mono text-[10px] text-[#616161]">
                      weight:{ts.weight} · lh:{ts.lineHeight} · tracking:{ts.letterSpacing}em · {ts.lang.toUpperCase()}
                    </p>
                  </div>
                  <p className="shrink-0 text-[11px] text-[#616161]">{ts.figma}</p>
                </div>
                <p
                  className="truncate text-white"
                  style={{
                    fontFamily,
                    fontSize: `${ts.size}px`,
                    fontWeight: ts.weight,
                    letterSpacing: `${ts.letterSpacing}em`,
                    lineHeight: ts.lineHeight,
                  }}
                >
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
      <p className="mb-4 text-[12px] text-[#616161]">
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
              className="h-16 w-16 border-2 border-[#48f4be] bg-[#212121]"
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
      <p className="mb-4 text-[12px] text-[#616161]">
        スペーシングスケール（px）。Tailwind ではそのまま <TokenBadge>text-[16px]</TokenBadge>{" "}
        等の任意値で参照、または <TokenBadge>tokens.size[16]</TokenBadge> から JS 参照。
      </p>
      <div className="mb-12 flex flex-col gap-2">
        {(Object.entries(size) as [string, number][]).map(([key, val]) => (
          <div key={key} className="flex items-center gap-4">
            <p className="w-[40px] shrink-0 text-right font-mono text-[12px] text-[#9e9e9e]">
              {val}px
            </p>
            <div
              className="h-[6px] rounded-full bg-[#48f4be]/60"
              style={{ width: Math.min(val, 720) }}
            />
          </div>
        ))}
      </div>

      {/* ── Shadow（Figma Effect トークン） ── */}
      <SubHeading>Shadow</SubHeading>
      <p className="mb-4 text-[12px] text-[#616161]">
        Tailwind クラス例: <TokenBadge>shadow-base</TokenBadge>{" "}
        <TokenBadge>shadow-wisper</TokenBadge>
      </p>
      <div className="mb-12 flex flex-wrap gap-6">
        {(Object.entries(shadow) as [string, string][]).map(([key, val]) => (
          <div key={key} className="flex flex-col items-center gap-3">
            <div
              className="h-20 w-32 rounded-[8px] border border-[#2a2a2a] bg-[#212121]"
              style={{ boxShadow: val }}
            />
            <div className="text-center">
              <TokenBadge>shadow-{key}</TokenBadge>
              <p className="mt-1 max-w-[160px] font-mono text-[9px] leading-tight text-[#616161]">{val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Container（Figma Variables「Device」コレクションと同期） ── */}
      <SubHeading>Container / Device</SubHeading>
      <p className="mb-4 text-[12px] text-[#616161]">
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
            <p className="font-mono text-[16px] font-semibold text-[#48f4be]">{value}px</p>
          </div>
        ))}
      </div>
      {/* ── Breakpoints ── */}
      <SubHeading>Breakpoints</SubHeading>
      <p className="mb-4 text-[12px] text-[#616161]">
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
            <p className="font-mono text-[16px] font-semibold text-[#48f4be]">{val}px</p>
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
          className="w-full max-w-[400px] rounded-[8px] border border-[#424242] bg-[#212121] px-4 py-2.5 text-[14px] text-white placeholder-[#616161] outline-none focus:border-[#48f4be]"
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
                <span className="rounded-full bg-[#2a2a2a] px-2.5 py-0.5 text-[11px] text-[#9e9e9e]">
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
                    className="group flex flex-col items-center gap-2 rounded-[8px] border border-transparent p-3 text-center transition-colors hover:border-[#424242] hover:bg-[#212121]"
                  >
                    <Icon set={setName as "Base"} name={iconName} className="h-6 w-6 shrink-0" />
                    <p className="w-full truncate text-[10px] text-[#9e9e9e] group-hover:text-white">
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
      <p className="mb-6 text-[13px] text-[#616161]">
        <code className="rounded bg-[#1a1a1a] px-1.5 py-0.5 font-mono text-[10px] text-[#9e9e9e]">
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
            className="group flex flex-col items-center gap-3 rounded-[8px] border border-transparent p-4 text-center transition-colors hover:border-[#424242] hover:bg-[#212121]"
          >
            <ServiceLogo name={name} className="h-8 w-8 shrink-0" />
            <p className="w-full truncate text-[11px] text-[#9e9e9e] group-hover:text-white">
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
        {description && <p className="mt-0.5 text-[13px] text-[#9e9e9e]">{description}</p>}
      </div>
      <Card>
        <div className="flex flex-wrap items-start gap-4">{children}</div>
      </Card>
    </div>
  );
}

function MarkdownEditorDemo() {
  const [md, setMd] = useState(
    "# プロジェクト概要\n\n本文テキストを **太字** や *斜体*、[リンク](https://example.com) 付きで入力できます。\n\n## 見出し01\n\n- 箇条書き\n- 項目",
  );
  return (
    <div className="w-full">
      <RichMarkdownEditor value={md} onChange={setMd} className="h-[420px]" />
    </div>
  );
}

function ComponentsSection() {
  return (
    <section id="components" className="scroll-mt-8">
      <SectionTitle label="Components" title="コンポーネント" />
      <div className="flex flex-col gap-12">
        <ComponentPreview title="Tag" description="スキル・ツール表示用バッジ。default / small（Figma Tag/Small: プロジェクトカード用）/ tool（Slot-Tool: スキル展開パネル用・border付き・アイコン前置）">
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
            <Tag label="Figma" variant="tool" prefix={<ServiceLogo name="figma" className="w-4 h-4 shrink-0 object-contain" />} />
            <Tag label="GitHub" variant="tool" prefix={<ServiceLogo name="github" className="w-4 h-4 shrink-0 object-contain" />} />
            <Tag label="Next.js" variant="tool" prefix={<Icon set="Components" name="page" tintColor="#9E9E9E" className="w-4 h-4 shrink-0" />} />
          </div>
        </ComponentPreview>

        <ComponentPreview title="Headline" description="見出しコンポーネント。default / sub / section / コンテンツ見出し 01・02・03（Library 305:265）">
          <div className="w-full"><Headline label="制作・企画" title="Works" /></div>
          <div className="w-full"><Headline title="見出し" variant="sub" /></div>
          <div className="w-full"><Headline title="Section（34px Avenir Heavy 白）" variant="section" /></div>
          <div className="w-full"><Headline title="見出し 01（24px 白）" variant="markdown-h1" /></div>
          <div className="w-full"><Headline title="見出し 02（20px mint）" variant="markdown-h2" /></div>
          <div className="w-full"><Headline title="HEADLINE 03 (EN / 17px gray)" variant="markdown-h3" /></div>
        </ComponentPreview>

        <ComponentPreview title="Work詳細タイポグラフィ" description="Work詳細モーダル本文のタイポ体系（Figma 457:2366）。markdown 記法と対応。">
          <div className="flex w-full flex-col gap-3">
            <p className="text-[34px] font-extrabold leading-[1.2] text-white">Section（# / 34px Avenir Heavy 白）</p>
            <p className="font-body text-[24px] font-bold leading-[1.5] tracking-[1.2px] text-white">見出し01（## / Noto Bold 24px 白）</p>
            <p className="font-body text-[20px] font-bold leading-[1.5] tracking-[1px] text-main-050">見出し02（### / Noto Bold 20px mint）</p>
            <p className="text-[17px] font-extrabold leading-normal tracking-[0.85px] text-[#9e9e9e]">見出し03（#### / Avenir Heavy 17px gray）</p>
            <p className="text-[15px] leading-[1.5] tracking-[0.45px] text-white">Body01（通常段落 / Noto Regular 15px 白）</p>
            <p className="text-[13px] leading-[1.5] tracking-[0.39px] text-white">Body02（##### / UI「小本文」 / Noto Regular 13px 白）</p>
            <p className="border-l-2 border-[#424242] pl-3 text-[13px] leading-[1.5] tracking-[0.39px] text-system-400">引用 blockquote（&gt; / 13px system-400 #BDBDBD・左ボーダー）</p>
            <p className="text-[10px] leading-[16px] tracking-[0.5px] text-[#9e9e9e]">補足テキスト 10px（画像キャプション / Noto Regular 10px gray）</p>
          </div>
        </ComponentPreview>

        <ComponentPreview title="ButtonAction" description="CTA ボタン。Primary / Secondary / Ghost の 3 バリアント">
          <ButtonAction label="Primary Button" type="primary" />
          <ButtonAction label="Secondary Button" type="secondary" />
          <ButtonAction label="Ghost Button" type="ghost" />
          <ButtonAction label="With Icon" type="primary" iconRight={{ set: "Arrows", name: "right" }} />
        </ComponentPreview>

        <ComponentPreview title="ButtonFunction" description="アイコンのみのアクションボタン。Border on / off バリアント">
          <ButtonFunction direction="left"  border="on"  aria-label="Left border-on" />
          <ButtonFunction direction="right" border="on"  aria-label="Right border-on" />
          <ButtonFunction direction="left"  border="off" aria-label="Left border-off" />
          <ButtonFunction direction="right" border="off" aria-label="Right border-off" />
          <ButtonFunction border="on" aria-label="Custom icon">
            <Icon set="Base" name="home" className="h-5 w-5" />
          </ButtonFunction>
        </ComponentPreview>

        <ComponentPreview title="TabBar" description="タブ切り替えコンポーネント">
          <TabBar
            tabs={[
              { id: "all",    label: "すべて",   icon: { set: "Base",  name: "all-application" } },
              { id: "design", label: "デザイン", icon: { set: "Edit",  name: "pencil" } },
              { id: "dev",    label: "開発",     icon: { set: "Build", name: "code" } },
            ]}
            defaultActiveId="all"
          />
        </ComponentPreview>

        <ComponentPreview title="HistoryItem" description="職歴・学歴タイムラインアイテム">
          <div className="w-full">
            <HistoryItem
              role="Senior Product Designer"
              company="株式会社サンプル"
              period="2022.04 - 現在"
              description="プロダクトデザインリードとして、UX 戦略の立案からプロトタイプ制作まで一貫して担当。デザインシステムの構築を主導し、開発効率を 30% 改善。"
            />
          </div>
        </ComponentPreview>

        <ComponentPreview title="WorkCard" description="制作・企画（Works）一覧カード。クリックで詳細ページ（/works?id=）へ遷移">
          <WorkCard
            category="プラットフォーム開発"
            title="キャリアチケットスカウトサービス"
            tags={["UI Design", "UX Research", "Figma"]}
            image="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80"
          />
        </ComponentPreview>

        <ComponentPreview
          title="SideMenuBar"
          description="サイドナビゲーション。Figma node 55-296 準拠。フラットなアイテム構成（アコーディオン形式は廃止）"
        >
          <div className="overflow-hidden rounded-[12px] border border-[#424242]">
            <SideMenuBar activeSection="works" collapsed={false} />
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="RichMarkdownEditor"
          description="Work 本文編集用のリッチ Markdown エディタ。生 Markdown ＋ 編集 / 分割 / プレビュー の3モード。プレビューは公開側と同一の WorkMarkdown レンダラで描画"
        >
          <MarkdownEditorDemo />
        </ComponentPreview>

        <ComponentPreview
          title="WorkProcessChart"
          description="Work 詳細の Timeline（Figma _Process）。本文の「::: timeline」位置に works.timeline を描画"
        >
          <div className="w-full">
            <WorkProcessChart
              data={{ totalUnits: 8, phases: [
                { label: "Research", start: 1, span: 3, raci: ["R"], progress: 90, note: { title: "調査", body: "ヒアリングを実施" } },
                { label: "Design", start: 3, span: 3, raci: ["R", "A"], progress: 100 },
                { label: "QA", start: 6, span: 3, raci: ["C"], progress: 40 },
              ] }}
            />
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="WorkStakeholderDiagram"
          description="Work 詳細の Stakeholders（Figma _Stakeholder）。本文の「::: stakeholders」位置に works.stakeholders を描画"
        >
          <div className="w-full">
            <WorkStakeholderDiagram
              data={{ groups: [
                { label: "Product", icon: "Components/page", members: [{ label: "General Manager" }, { label: "Product Manager", me: true }] },
                { label: "Designer", icon: "Edit/platte", members: [{ label: "Leader", me: true }, { label: "Member" }] },
              ] }}
            />
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="WorkDetailLeftPanel"
          description="Works 詳細ページの左パネル（Figma 787:9916）。戻りリンク / デバイスモック / カテゴリ・タイトル / サマリー / メタ（期間・役割・体制内訳）/ Skills・Tools / サイトリンクカード"
        >
          <div className="rounded-[12px] border border-[#424242] bg-[#212121] px-6">
            <WorkDetailLeftPanel
              work={SAMPLE_WORK_DETAIL}
              skills={["UI Design", "UX Research", "PJ Management"]}
              tools={[{ name: "Figma", icon_url: null }, { name: "React", icon_url: null }]}
              screenshots={(SAMPLE_WORK_DETAIL.hero_screenshots ?? []) as string[]}
              onBack={() => {}}
            />
          </div>
        </ComponentPreview>

        <ComponentPreview
          title="WorkDetailContent"
          description="Works 詳細ページの右カラム（本文）。見出し01 + 本文 markdown のセクションを横罫線で区切って描画"
        >
          <div className="w-full rounded-[12px] border border-[#424242] bg-[#212121] px-6">
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
          <Link href="/" className="mb-1 block text-[12px] tracking-[0.6px] text-[#48f4be] hover:underline">
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
                    : "text-[#9e9e9e] hover:bg-[#1a1a1a] hover:text-white",
                ].join(" ")}
              >
                {isActive && <span className="h-4 w-[2px] shrink-0 rounded-full bg-[#48f4be]" />}
                <span className={["flex flex-col", isActive ? "" : "pl-[10px]"].join(" ")}>
                  <span className="text-[14px] leading-[1.4]">{label}</span>
                  <span className="text-[11px] text-[#616161]">{labelJa}</span>
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
            <p className="text-[12px] tracking-[0.6px] text-[#48f4be]">Design System</p>
            <p className="mt-1 text-[40px] font-bold tracking-[2px] text-white">Style Guide</p>
            <p className="mt-3 text-[14px] text-[#9e9e9e]">
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
            <p className="text-[12px] text-[#424242]">Portfolio Style Guide</p>
          </div>
        </div>
      </main>
    </div>
  );
}
