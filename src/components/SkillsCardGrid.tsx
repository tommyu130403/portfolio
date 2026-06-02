"use client";

import { useEffect, useId, useState } from "react";
import Icon from "@/components/Icon";
import type { IconProps } from "@/components/Icon";
import ServiceLogo from "@/components/ServiceLogo";
import Tag from "@/components/Tag";
import { supabase } from "@/src/lib/supabase";

// ──────────────────────────────────────────────
// 4-step proficiency scale（バー点灯色は習熟度で段階的に変化＝Figma準拠）
// ──────────────────────────────────────────────
const SKILL_LEVELS = [
  { n: 1, en: "Beginner",     bar: "#11503C" }, // main/500
  { n: 2, en: "Intermediate", bar: "#1E765A" }, // main/400
  { n: 3, en: "Advanced",     bar: "#2B9E7A" }, // main/300
  { n: 4, en: "Expert",       bar: "#48F4BE" }, // main/100
];

// Map existing segments scale (1–10) to 4-step proficiency
function segmentsToLevel(segments: number): number {
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
  "illustrator", "photoshop", "google-analytics", "asana", "vscode",
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

function resolveLogoSlug(tool: { name: string; slug?: string | null }): string | null {
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
      <Icon set={icon.set} name={icon.name} tintColor="#9E9E9E" className="w-4 h-4 shrink-0" />
    );
  }
  return <Tag variant="tool" label={tool.name} prefix={prefix} />;
}

// ──────────────────────────────────────────────
// Data types
// ──────────────────────────────────────────────
type SkillRowConfig = {
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

type SkillCardConfig = {
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
  const [{ data: cards }, { data: rows }, { data: links }] = await Promise.all([
    supabase.from("skill_cards").select("*").order("sort_order", { ascending: true }),
    supabase.from("skill_experience").select("*").order("sort_order", { ascending: true }),
    supabase
      .from("skill_experience_tools")
      .select("experience_id, tools_vocab(name, slug, category)")
      .order("sort_order", { ascending: true }),
  ]);

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
              background: on ? litColor : "rgba(0,0,0,0.25)",
              border: on ? "none" : "1px solid rgba(255,255,255,0.08)",
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
// ──────────────────────────────────────────────
function SkillRow({ skill }: { skill: SkillRowConfig }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const level = segmentsToLevel(skill.segments);
  const levelInfo = SKILL_LEVELS[level - 1];
  const isExpert = level === 4;

  return (
    <div
      className={`group transition-[border-radius] duration-200 ${
        open ? "rounded-[16px] bg-white/5" : "rounded-[10px] hover:rounded-[16px] hover:bg-white/5"
      }`}
    >
      {/* _SkillVaule — 常時表示。クリックで開閉 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-2 p-3 text-left"
      >
        {/* 左: アイコン + ラベル */}
        <span className="flex flex-1 min-w-0 items-center gap-3 pr-4">
          <Icon
            set={skill.icon.set}
            name={skill.icon.name}
            tintColor="#B3FFE7"
            className="w-4 h-4 shrink-0"
          />
          <span className="flex-1 min-w-0 line-clamp-2 break-words text-[13px] leading-[1.4] text-white">
            {skill.label}
          </span>
        </span>

        {/* 右: レベル + chevron */}
        <span className="flex shrink-0 items-center gap-2">
          <span className="flex items-center gap-2">
            <SegBar level={level} />
            <span
              className="font-guide w-20 text-right text-[12px] whitespace-nowrap"
              style={{ color: isExpert ? "#48F4BE" : "#9E9E9E", fontWeight: isExpert ? 700 : 400 }}
            >
              {levelInfo.en}
            </span>
          </span>
          {/* Button/Function — default では不可視、hover/active で表示 */}
          <span
            aria-hidden
            className={`grid h-4 w-4 place-items-center rounded-lg p-1 transition-opacity duration-150 ${
              open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <Icon set="Arrows" name={open ? "up" : "down"} tintColor="#9E9E9E" className="w-3 h-3" />
          </span>
        </span>
      </button>

      {/* 展開パネル — grid-rows トランジションで高さアニメ。
          折りたたみ時は aria-hidden でアクセシビリティツリーから除外（高さは0fr） */}
      <div
        id={panelId}
        aria-hidden={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-4 border-t border-white/5 px-8 pt-4 pb-3">
            <div className="flex flex-col gap-1">
              {skill.labelNote && (
                <span className="font-noto text-[10px] tracking-[0.3px]" style={{ color: "#757575" }}>
                  {skill.labelNote}
                </span>
              )}
              {skill.description && (
                <p
                  className="font-noto text-[13px] leading-[1.5] tracking-[0.39px] whitespace-pre-line"
                  style={{ color: "#9E9E9E" }}
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
function SkillCard({ card }: { card: SkillCardConfig }) {
  return (
    <div
      className="overflow-clip"
      style={{
        background: "#1A1A1A",
        borderRadius: 14,
        padding: 40,
        boxShadow: "0 1px 1.5px rgba(0,0,0,0.1), 0 1px 1px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* CategoryCard — ヘッダー */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Icon set={card.icon.set} name={card.icon.name} tintColor="#48F4BE" className="w-6 h-6 shrink-0" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="text-[20px] font-bold leading-[28px] text-white">{card.title}</span>
          <span
            className="font-noto text-[13px] leading-[1.5] tracking-[0.39px]"
            style={{ color: "#757575" }}
          >
            {card.titleJP}
          </span>
        </div>
      </div>

      {/* items 容器 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 24 }}>
        {card.skills.map((skill) => (
          <SkillRow key={skill.id} skill={skill} />
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

  useEffect(() => {
    fetchSkillCards().then((data) => {
      setCards(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start">
        {[0, 1].map((col) => (
          <div key={col} className="flex min-w-0 flex-1 flex-col gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-[300px] animate-pulse rounded-[14px] bg-[#1a1a1a]" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Figma 同様、2 列をそれぞれ独立した縦スタックとして配置する。
  // こうすることで一方のカードを展開しても、もう一方の列のカード高さに影響しない。
  // （CSS grid だと同一行のカードが高さを揃えてしまうため不可）
  const mid = Math.ceil(cards.length / 2);
  const columns = [cards.slice(0, mid), cards.slice(mid)];

  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start">
      {columns.map((col, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-6">
          {col.map((card) => (
            <SkillCard key={card.id} card={card} />
          ))}
        </div>
      ))}
    </div>
  );
}
