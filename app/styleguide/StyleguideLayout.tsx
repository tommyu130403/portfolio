"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import Tag from "@/components/Tag";
import Headline from "@/components/Headline";
import ButtonAction from "@/components/ButtonAction";
import { ButtonFunction } from "@/components/ButtonFunction";
import TabBar from "@/components/TabBar";
import HistoryItem from "@/components/HistoryItem";
import ProjectCard from "@/components/ProjectCard";
import SideMenuBar from "@/components/SideMenuBar";
import { color, radius, size, container, typo, breakpoint } from "@/lib/design-tokens";

// ─── 型 ───────────────────────────────────────────────
export type IconSetData = { name: string; icons: string[] };

// ─── ナビゲーション ────────────────────────────────────
const NAV_SECTIONS = [
  { id: "colors",     label: "Colors",      labelJa: "カラー" },
  { id: "typography", label: "Typography",  labelJa: "タイポグラフィ" },
  { id: "tokens",     label: "Tokens",      labelJa: "その他のトークン" },
  { id: "icons",      label: "Icons",       labelJa: "アイコン" },
  { id: "components", label: "Components",  labelJa: "コンポーネント" },
] as const;

// ─── タイポグラフィスケール ───────────────────────────────
const TYPOGRAPHY_SCALE = [
  { size: "40",  weight: "700", tracking: "2px",    sample: "プロジェクトタイトル",    usage: "モーダル大見出し" },
  { size: "32",  weight: "400", tracking: "1.6px",  sample: "セクションタイトル",      usage: "Headline" },
  { size: "24",  weight: "700", tracking: "1.2px",  sample: "コンテンツ見出し",        usage: "モーダルセクション" },
  { size: "20",  weight: "400", tracking: "0px",    sample: "役職名・経歴タイトル",    usage: "HistoryItem 役職" },
  { size: "17",  weight: "400", tracking: "0.85px", sample: "本文テキスト / Body",     usage: "説明文・本文全般" },
  { size: "16",  weight: "700", tracking: "0px",    sample: "ボタンラベル / Button",   usage: "ButtonAction" },
  { size: "14",  weight: "400", tracking: "0.7px",  sample: "サブテキスト / Small",    usage: "会社名・TabBar" },
  { size: "12",  weight: "400", tracking: "0.6px",  sample: "ラベル / Caption / Tag",  usage: "カテゴリ・タグ" },
] as const;

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

      {/* タイプスケール */}
      <SubHeading>Type Scale</SubHeading>
      <div className="flex flex-col divide-y divide-[#2a2a2a]">
        {TYPOGRAPHY_SCALE.map(({ size: fs, weight, tracking, sample, usage }) => (
          <div key={fs} className="flex flex-col gap-2 py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <p className="font-mono text-[16px] text-white">{fs}px</p>
                <p className="font-mono text-[10px] text-[#616161]">
                  weight:{weight} · tracking:{tracking}
                </p>
              </div>
              <p className="shrink-0 text-[11px] text-[#616161]">{usage}</p>
            </div>
            <p
              className="truncate text-white"
              style={{ fontSize: `${fs}px`, fontWeight: weight, letterSpacing: tracking, lineHeight: 1.4 }}
            >
              {sample}
            </p>
          </div>
        ))}
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

      {/* ── Container ── */}
      <SubHeading>Container</SubHeading>
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
            { label: "Tablet / Sidebar Width",    token: "container.tablet.width.side",     value: container.tablet.width.side },
            { label: "Mobile / Screen Width",     token: "container.mobile.width.screen",   value: container.mobile.width.screen },
            { label: "Mobile / Screen Height",    token: "container.mobile.height.screen",  value: container.mobile.height.screen },
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

function ComponentsSection() {
  return (
    <section id="components" className="scroll-mt-8">
      <SectionTitle label="Components" title="コンポーネント" />
      <div className="flex flex-col gap-12">
        <ComponentPreview title="Tag" description="スキル・ツール表示用バッジ">
          <Tag label="UI Design" />
          <Tag label="UX Research" />
          <Tag label="Project Management" />
        </ComponentPreview>

        <ComponentPreview title="Headline" description="セクション見出し。英語ラベル + 日本語タイトル + アクセントライン">
          <div className="w-full"><Headline label="Projects" title="プロジェクト" /></div>
        </ComponentPreview>

        <ComponentPreview title="ButtonAction" description="CTA ボタン。Primary / Secondary の 2 バリアント">
          <ButtonAction label="Primary Button" type="primary" />
          <ButtonAction label="Secondary Button" type="secondary" />
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

        <ComponentPreview title="ProjectCard" description="プロジェクト一覧カード。クリックでモーダルを開く">
          <ProjectCard
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
            <SideMenuBar activeSection="projects" collapsed={false} />
          </div>
        </ComponentPreview>
      </div>
    </section>
  );
}

// ─── メインレイアウト ───────────────────────────────────

export function StyleguideLayout({ iconSets }: { iconSets: IconSetData[] }) {
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
          <a href="/" className="mb-1 block text-[12px] tracking-[0.6px] text-[#48f4be] hover:underline">
            ← Portfolio
          </a>
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
