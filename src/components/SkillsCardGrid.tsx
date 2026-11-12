"use client";

import { useEffect, useId, useState } from "react";
import Icon from "@/components/Icon";
import type { IconProps } from "@/components/Icon";
import ServiceLogo from "@/components/ServiceLogo";
import Tag from "@/components/Tag";
import { HOVER_CARD } from "@/lib/hover-card";
import { supabase } from "@/src/lib/supabase";

// ──────────────────────────────────────────────
// 4-step proficiency scale（バー点灯色は習熟度で段階的に変化＝Figma準拠）
// ──────────────────────────────────────────────
export const SKILL_LEVELS = [
  { n: 1, en: "Beginner",     bar: "var(--color-main-500)" }, // main/500
  { n: 2, en: "Intermediate", bar: "var(--color-main-400)" }, // main/400
  { n: 3, en: "Advanced",     bar: "var(--color-main-300)" }, // main/300
  { n: 4, en: "Expert",       bar: "var(--color-main-100)" }, // main/100
];

// Map existing segments scale (1–10) to 4-step proficiency
export function segmentsToLevel(segments: number): number {
  return Math.min(4, Math.max(1, Math.ceil(segments / 2.5)));
}

type IconRef = { set: NonNullable<IconProps["set"]>; name: string };

// ──────────────────────────────────────────────
// Tool icon resolution (§3)
//   1. slug（DB の tools_vocab.slug、無ければツール名→slug マップ）に対応する
//      public/logos/<slug>.svg があれば <ServiceLogo>
//   2. 無ければツールのカテゴリーに対応する既存アイコンでフォールバック
// ──────────────────────────────────────────────
// public/logos/ に実在する slug（モノクロームのツールロゴ）
const LOGO_SLUGS = new Set([
  "figma", "github",
  "illustrator", "photoshop", "google-analytics", "google-optimize", "asana", "vscode",
  "react", "nextjs", "html", "css", "javascript", "typescript",
  "docker", "vue", "vite", "webpack",
]);

// ツール名 → ロゴ slug（DB の slug が未設定でも名前から解決できるようにする）
const TOOL_NAME_TO_SLUG: Record<string, string> = {
  "Figma": "figma",
  "Github": "github",
  "GitHub": "github",
  "Illustrator": "illustrator",
  "Photoshop": "photoshop",
  "Google Analytics": "google-analytics",
  "Google Optimize": "google-optimize",
  "Asana": "asana",
  "Visual Studio Code": "vscode",
  "React": "react",
  "Next.js": "nextjs",
  "HTML": "html",
  "CSS": "css",
  "JavaScript": "javascript",
  "TypeScript": "typescript",
  "Docker": "docker",
  "Vue": "vue",
  "Vite": "vite",
  "Webpack": "webpack",
};

export function resolveLogoSlug(tool: { name: string; slug?: string | null }): string | null {
  const slug = tool.slug || TOOL_NAME_TO_SLUG[tool.name];
  return slug && LOGO_SLUGS.has(slug) ? slug : null;
}

const TOOL_CATEGORY_ICON: Record<string, IconRef> = {
  "Frontend Frameworks & UI Libraries": { set: "Components", name: "page" },
  "Source Control & Developer Platforms": { set: "Connect", name: "pull-requests" },
  "Design Tools": { set: "Components", name: "platte" },
  "Analytics & Research": { set: "Charts", name: "chart-line" },
  "Project Management": { set: "Components", name: "checklist" },
};
const FALLBACK_TOOL_ICON: IconRef = { set: "Base", name: "system" };

type ToolRef = {
  name: string;
  /** ロゴ解決用。public/logos/<slug>.svg を参照 */
  slug?: string | null;
  /** ロゴ未整備時のカテゴリーアイコン・フォールバック用 */
  category?: string | null;
};

function ToolTag({ tool }: { tool: ToolRef }) {
  let prefix;
  const logoSlug = resolveLogoSlug(tool);
  if (logoSlug) {
    prefix = <ServiceLogo name={logoSlug} className="w-4 h-4 shrink-0 object-contain" />;
  } else {
    const icon = (tool.category && TOOL_CATEGORY_ICON[tool.category]) || FALLBACK_TOOL_ICON;
    prefix = (
      <Icon set={icon.set} name={icon.name} tintColor="var(--color-fg-muted)" className="w-4 h-4 shrink-0" />
    );
  }
  return <Tag variant="tool" label={tool.name} prefix={prefix} />;
}

// ──────────────────────────────────────────────
// Data types
// ──────────────────────────────────────────────
export type SkillRowConfig = {
  id: string;
  /** スキル行アイコン（16×16・淡色） */
  icon: IconRef;
  label: string;
  /** 展開時の JP 短ラベル */
  labelNote?: string;
  /** 展開時の説明文。改行（\n）と「・」箇条書きを含みうる（pre-line で描画） */
  description?: string;
  segments: number;
  tools: ToolRef[];
};

export type SkillCardConfig = {
  id: string;
  icon: IconRef;
  title: string;
  titleJP: string;
  skills: SkillRowConfig[];
};

// ──────────────────────────────────────────────
// Supabase fetch — skill_cards + skill_experience + tools
//   行アイコン: icon_set/icon_name、ツール: skill_experience_tools → tools_vocab
// ──────────────────────────────────────────────
type ToolVocabLink = {
  experience_id: string;
  tools_vocab: { name: string; slug: string | null; category: string | null } | null;
};

async function fetchSkillCards(): Promise<SkillCardConfig[]> {
  const [cardsResult, rowsResult, linksResult] = await Promise.all([
    supabase.from("skill_cards").select("*").order("sort_order", { ascending: true }),
    supabase.from("skill_experience").select("*").order("sort_order", { ascending: true }),
    supabase
      .from("skill_experience_tools")
      .select("experience_id, tools_vocab(name, slug, category)")
      .order("sort_order", { ascending: true }),
  ]);

  const failure = [cardsResult, rowsResult, linksResult].find((result) => result.error);
  if (failure?.error) throw new Error(failure.error.message);
  const cards = cardsResult.data;
  const rows = rowsResult.data;
  const links = linksResult.data;

  if (!cards) return [];

  const visibleCards = cards.filter((card) => {
    const t = card.title?.trim() ?? "";
    const tj = card.title_jp?.trim() ?? "";
    return t !== "Skill Vocab" && t !== "Tool Vocab" && tj !== "スキル辞書" && tj !== "ツール辞書";
  });

  // experience_id → tools[]
  const toolsByExp = new Map<string, ToolRef[]>();
  for (const link of (links ?? []) as unknown as ToolVocabLink[]) {
    const tv = link.tools_vocab;
    if (!tv) continue;
    const arr = toolsByExp.get(link.experience_id) ?? [];
    arr.push({ name: tv.name, slug: tv.slug, category: tv.category });
    toolsByExp.set(link.experience_id, arr);
  }

  return visibleCards.map((card) => ({
    id: card.id,
    icon: { set: card.icon_set as IconRef["set"], name: card.icon_name },
    title: card.title,
    titleJP: card.title_jp,
    skills: (rows ?? [])
      .filter((r) => r.card_id === card.id)
      .map((r) => ({
        id: r.id,
        icon: { set: (r.icon_set ?? "Base") as IconRef["set"], name: r.icon_name ?? "system" },
        label: r.label,
        labelNote: r.label_note ?? undefined,
        description: r.description ?? undefined,
        segments: r.segments,
        tools: toolsByExp.get(r.id) ?? [],
      })),
  }));
}

// ──────────────────────────────────────────────
// SegBar — 4-segment proficiency bar (18×6)
// ──────────────────────────────────────────────
function SegBar({ level }: { level: number }) {
  const litColor = SKILL_LEVELS[level - 1].bar;
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {[1, 2, 3, 4].map((i) => {
        const on = i <= level;
        return (
          <div
            key={i}
            style={{
              width: 18,
              height: 6,
              borderRadius: 999,
              flexShrink: 0,
              background: on ? litColor : "color-mix(in srgb, var(--color-system-black) 25%, transparent)",
              border: on ? "none" : "1px solid color-mix(in srgb, var(--color-system-white) 8%, transparent)",
              boxSizing: "border-box",
            }}
          />
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────
// SkillRow — accordion row (3 states: default / hover / active)
//   開閉状態は親（SkillCard）が持つ。カード内で同時に開くのは1つだけ
// ──────────────────────────────────────────────
function SkillRow({
  skill,
  open,
  onToggle,
}: {
  skill: SkillRowConfig;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const level = segmentsToLevel(skill.segments);
  const levelInfo = SKILL_LEVELS[level - 1];

  return (
    <div
      className={`relative flex flex-col rounded-[16px] px-px after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border after:content-[''] ${HOVER_CARD} ${
        open ? "bg-action-hover after:border-border-light" : "after:border-border hover:after:border-border-light"
      }`}
    >
      {/* _SkillVaule — 常時表示。クリックで開閉。
          見出しは開閉どちらでも閉じた高さ 64 のまま(Figma の開いた状態 y13 / 罫線 y53 には寄せない)。
          外側の min-h + 上下中央にすると、1 行の見出しが開いた瞬間に 7px 跳ねる */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-16 w-full items-center justify-between px-3 py-[13px] text-left"
      >
        {/* 左: アイコン + ラベル */}
        <span className="flex flex-1 min-w-0 items-center gap-3 pr-4">
          <Icon
            set={skill.icon.set}
            name={skill.icon.name}
            tintColor="var(--color-main-050)"
            className="w-4 h-4 shrink-0"
          />
          <span className="font-en flex-1 min-w-0 line-clamp-2 break-words text-[13px] leading-normal text-fg">
            {skill.label}
          </span>
        </span>

        {/* 右: レベル + chevron */}
        <span className="flex shrink-0 items-center gap-2">
          {/* Figma _SkilllItem (Master 502:1344) はセグメントバーのみでレベルを表す。
              文字表記は視覚的には出さず、読み上げ用にだけ残す。 */}
          <span className="flex items-center gap-2">
            <SegBar level={level} />
            <span className="sr-only">{levelInfo.en}</span>
          </span>
          {/* Button/Function — Figma では閉じた状態でも常時表示(24×24・p6・r8) */}
          <span
            aria-hidden
            className="grid h-6 w-6 shrink-0 place-items-center rounded-lg p-1.5"
          >
            <Icon set="Arrows" name={open ? "up" : "down"} tintColor="var(--color-fg-muted)" className="w-3 h-3" />
          </span>
        </span>
      </button>

      {/* 展開パネル — grid-rows トランジションで高さアニメ。
          折りたたみ時は aria-hidden でアクセシビリティツリーから除外。
          罫線は見出しの下端(閉じた高さと同じ y64)に置き、閉じている間は透明・開くと色だけ付く。
          開閉中に罫線も見出しも動かない */}
      <div
        id={panelId}
        aria-hidden={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          {/* 上罫線は Figma では inside なので pt = 16−1。
              pb13 = 項目の py13（外枠は ::after で位置に入らない）。罫線は見出し下端の y64(Figma 733:2902 の y53 より 11 下・意図的) */}
          <div
            className={`flex flex-col gap-4 border-t px-8 pt-[15px] pb-[13px] transition-colors duration-300 ${
              open ? "border-border" : "border-transparent"
            }`}
          >
            <div className="flex flex-col gap-1">
              {skill.labelNote && (
                <span className="font-body text-[10px] leading-[12px] tracking-[0.3px]" style={{ color: "var(--color-fg-muted)" }}>
                  {skill.labelNote}
                </span>
              )}
              {skill.description && (
                <p
                  className="font-body text-[13px] leading-[21px] tracking-[0.39px] whitespace-pre-line"
                  style={{ color: "var(--color-fg-muted)" }}
                >
                  {skill.description}
                </p>
              )}
            </div>
            {skill.tools.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {skill.tools.map((tool, i) => (
                  <ToolTag key={i} tool={tool} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// SkillCard
// ──────────────────────────────────────────────
export function SkillCard({ card }: { card: SkillCardConfig }) {
  // 開いている項目の id。カード内で同時に開くのは1つだけ（開いている項目を押すと閉じる・初期は全部閉じ）
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div
      // Figma (Master 502:1344) はカード余白が上下左右 24。375/390 幅ではスキル名の折返し切れを防ぐため、640px 未満だけ左右余白を 16 に詰める（Figma にモバイル画面なし）
      className="overflow-clip px-4 py-6 sm:p-6"
      style={{
        borderRadius: 16,
        // Figma は塗りなしの枠に drop-shadow → 中身の形に落ちる影。box-shadow だと箱の下辺に線が出る
        filter: "drop-shadow(0 1px 1.5px color-mix(in srgb, var(--color-system-black) 10%, transparent)) drop-shadow(0 1px 1px color-mix(in srgb, var(--color-system-black) 10%, transparent))",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* CategoryCard — ヘッダー */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div className="flex shrink-0 py-1">
          <Icon set={card.icon.set} name={card.icon.name} tintColor="var(--color-main-100)" className="w-6 h-6 shrink-0" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="[font-family:var(--font-afacad),var(--font-noto-sans-jp),sans-serif] text-[20px] font-bold leading-[1.5] tracking-[0.05em] text-fg">{card.title}</span>
          <span
            className="font-body text-[13px] leading-[21px] tracking-[0.39px]"
            style={{ color: "var(--color-fg-muted)" }}
          >
            {card.titleJP}
          </span>
        </div>
      </div>

      {/* items 容器 — Figma (Master 502:1344) は 1 カード内をスキル項目 1 列（352px・高さ64・gap 8）で縦に並べる。 */}
      <div className="flex flex-col gap-2 pt-6">
        {card.skills.map((skill) => (
          <SkillRow
            key={skill.id}
            skill={skill}
            open={openId === skill.id}
            onToggle={() => setOpenId((cur) => (cur === skill.id ? null : skill.id))}
          />
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// SkillsCardGrid — アコーディオン式スキルセクション
// ──────────────────────────────────────────────
export default function SkillsCardGrid() {
  const [cards, setCards] = useState<SkillCardConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchSkillCards()
      .then((data) => { if (active) setCards(data); })
      .catch((failure: unknown) => {
        // 原因の英文(TypeError など)は console に出し、画面には日本語だけを出す
        console.error("Failed to fetch skills:", failure);
        if (active) setError("スキルを読み込めませんでした。通信状況を確かめて、ページを再読み込みしてください。");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2 xl:gap-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[274px] animate-pulse rounded-[14px] bg-surface-light" />
        ))}
      </div>
    );
  }

  if (error) return <p className="text-[13px] text-danger-300" role="alert">{error}</p>;

  // Figma (Master 502:1344) はカテゴリカード（400px・余白24）を本文幅 800px に 2×2 で並べ、
  // カード内のスキル項目は 1 列。2×2 のときカード間の gap は無し（カードの余白が間隔になる）。1 列のときは従来どおり 24 空ける。
  // 2 列にするのは本文幅が 800px に達する xl (1280px) 以上のときだけ。
  return (
    <div className="grid w-full grid-cols-1 items-start gap-6 xl:grid-cols-2 xl:gap-0">
      {cards.map((card) => (
        <SkillCard key={card.id} card={card} />
      ))}
    </div>
  );
}
