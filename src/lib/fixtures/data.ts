import type { Tables } from "@/src/types/supabase";

const PLACEHOLDER = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/images/fixture-placeholder.svg`;

const CREATED_AT = "2026-01-01T00:00:00Z";

const C1 = "00000000-0000-4000-8000-000000000001";
const C2 = "00000000-0000-4000-8000-000000000002";
const W1 = "00000000-0000-4000-8000-000000000101";
const W2 = "00000000-0000-4000-8000-000000000102";
const W3 = "00000000-0000-4000-8000-000000000103";
const W4 = "00000000-0000-4000-8000-000000000104";
const V1 = "00000000-0000-4000-8000-000000000201";
const V2 = "00000000-0000-4000-8000-000000000202";
const V3 = "00000000-0000-4000-8000-000000000203";
const V4 = "00000000-0000-4000-8000-000000000204";
const T1 = "00000000-0000-4000-8000-000000000301";
const T2 = "00000000-0000-4000-8000-000000000302";
const T3 = "00000000-0000-4000-8000-000000000303";
const T4 = "00000000-0000-4000-8000-000000000304";
const S1 = "00000000-0000-4000-8000-000000000401";
const S2 = "00000000-0000-4000-8000-000000000402";
const E1 = "00000000-0000-4000-8000-000000000501";
const E2 = "00000000-0000-4000-8000-000000000502";
const E3 = "00000000-0000-4000-8000-000000000503";
const E4 = "00000000-0000-4000-8000-000000000504";
const F1 = "00000000-0000-4000-8000-000000000601";

const workBase = {
  hero_bg_color: null,
  hero_brand: null,
  stakeholder_breakdown: null,
  stakeholders: null,
  timeline: null,
  period: null,
  thumbnail_url: PLACEHOLDER,
  role: "デザイン・開発",
  created_at: CREATED_AT,
} as const;

export const FIXTURE_TABLES: {
  profile: Tables<"profile">[];
  career_items: Tables<"career_items">[];
  works: Tables<"works">[];
  contents_vocab: Tables<"contents_vocab">[];
  work_contents: Tables<"work_contents">[];
  tools_vocab: Tables<"tools_vocab">[];
  work_tools: Tables<"work_tools">[];
  skill_cards: Tables<"skill_cards">[];
  skill_experience: Tables<"skill_experience">[];
  skill_experience_tools: Tables<"skill_experience_tools">[];
  flowcharts: Tables<"flowcharts">[];
} = {
  profile: [
    {
      id: 1,
      name_jp: "テスト 太郎",
      name_en: "Test Taro",
      title: "Product Designer",
      bio: "フィクスチャ表示用のサンプルプロフィールです。",
      hero_image_url: PLACEHOLDER,
      introduction: [
        "Supabase に接続していないため、ローカルのダミーデータを表示しています。",
        "2 段落目のサンプルです。",
      ],
      updated_at: null,
    },
  ],
  career_items: [
    {
      id: C1,
      company: "サンプル株式会社A",
      role: "プロダクトデザイナー",
      period: "2022.04 - 現在",
      description: "Next.js / TypeScript でプロダクト開発。",
      is_current: true,
      start_date: "2022-04-01",
      end_date: null,
      sort_order: 1,
      company_id: null,
      role_id: null,
      created_at: CREATED_AT,
    },
    {
      id: C2,
      company: "サンプル株式会社B",
      role: "Webデザイナー",
      period: "2019.04 - 2022.03",
      description: "UIデザイン・コーディングを担当。",
      is_current: false,
      start_date: "2019-04-01",
      end_date: "2022-03-31",
      sort_order: 2,
      company_id: null,
      role_id: null,
      created_at: CREATED_AT,
    },
  ],
  works: [
    {
      ...workBase,
      id: W1,
      title: "サンプル作品A",
      category: "Web",
      career_item_id: C1,
      is_published: true,
      sort_order: 1,
      start_date: "2023-04-01",
      end_date: "2023-09-01",
      is_current: false,
      hero_screenshots: [PLACEHOLDER, PLACEHOLDER],
      sections: [
        {
          heading: "概要",
          body: `### 背景\nフィクスチャ用の本文です。\n\n::: flowchart id=${F1}`,
        },
      ],
    },
    {
      ...workBase,
      id: W2,
      title: "サンプル作品B",
      category: "Mobile",
      career_item_id: C1,
      is_published: true,
      sort_order: 2,
      start_date: "2024-01-01",
      end_date: null,
      is_current: true,
      hero_screenshots: null,
      sections: [
        {
          heading: "概要",
          body: `関連作品のリンクカードの例です。\n\n::: workcard id=${W1}`,
        },
      ],
    },
    {
      ...workBase,
      id: W3,
      title: "サンプル作品C",
      category: "Design System",
      career_item_id: C2,
      is_published: true,
      sort_order: 3,
      start_date: "2021-10-01",
      end_date: "2022-03-01",
      is_current: false,
      hero_screenshots: null,
      sections: [],
    },
    {
      ...workBase,
      id: W4,
      title: "非公開のサンプル作品",
      category: "Web",
      career_item_id: C2,
      is_published: false,
      sort_order: 4,
      start_date: null,
      end_date: null,
      is_current: false,
      hero_screenshots: null,
      sections: null,
    },
  ],
  contents_vocab: [
    { id: V1, label: "Product Design", sort_order: 1, created_at: CREATED_AT },
    { id: V2, label: "Web Application", sort_order: 2, created_at: CREATED_AT },
    { id: V3, label: "Mobile Application", sort_order: 3, created_at: CREATED_AT },
    { id: V4, label: "Design System Construction", sort_order: 4, created_at: CREATED_AT },
  ],
  work_contents: [
    { work_id: W1, content_id: V1, sort_order: 0 },
    { work_id: W1, content_id: V2, sort_order: 1 },
    { work_id: W2, content_id: V1, sort_order: 0 },
    { work_id: W2, content_id: V3, sort_order: 1 },
    { work_id: W3, content_id: V4, sort_order: 0 },
    { work_id: W4, content_id: V1, sort_order: 0 },
  ],
  tools_vocab: [
    { id: T1, name: "Figma", slug: "figma", category: "Design Tools", icon_url: null, created_at: CREATED_AT },
    { id: T2, name: "React", slug: "react", category: "Frontend Frameworks & UI Libraries", icon_url: null, created_at: CREATED_AT },
    { id: T3, name: "Next.js", slug: "nextjs", category: "Frontend Frameworks & UI Libraries", icon_url: null, created_at: CREATED_AT },
    { id: T4, name: "Asana", slug: null, category: "Project Management", icon_url: null, created_at: CREATED_AT },
  ],
  work_tools: [
    { work_id: W1, tool_id: T1, sort_order: 0 },
    { work_id: W1, tool_id: T2, sort_order: 1 },
    { work_id: W1, tool_id: T3, sort_order: 2 },
    { work_id: W2, tool_id: T1, sort_order: 0 },
    { work_id: W3, tool_id: T1, sort_order: 0 },
    { work_id: W3, tool_id: T4, sort_order: 1 },
  ],
  skill_cards: [
    {
      id: S1,
      title: "Product Design",
      title_jp: "ユーザー中心の設計とシステム構築",
      icon_set: "Components",
      icon_name: "platte",
      sort_order: 0,
      created_at: null,
    },
    {
      id: S2,
      title: "Frontend & Engineering",
      title_jp: "エンジニアとの協業と実装力",
      icon_set: "Edit",
      icon_name: "code",
      sort_order: 1,
      created_at: null,
    },
  ],
  skill_experience: [
    {
      id: E1,
      card_id: S1,
      label: "UI Design & Visuals",
      label_note: "UIデザイン",
      label_short: null,
      icon_set: "Edit",
      icon_name: "writing-fluently",
      segments: 10,
      level: "Expert",
      description: null,
      sort_order: 0,
    },
    {
      id: E2,
      card_id: S1,
      label: "Research & Strategy",
      label_note: "リサーチ＆戦略",
      label_short: null,
      icon_set: "Office",
      icon_name: "file-search",
      segments: 7,
      level: "Advanced",
      description: null,
      sort_order: 1,
    },
    {
      id: E3,
      card_id: S2,
      label: "HTML / CSS / JavaScript (TypeScript)",
      label_note: "基礎技術",
      label_short: null,
      icon_set: "Hardware",
      icon_name: "i-mac",
      segments: 10,
      level: "Expert",
      description: "フィクスチャ用の説明文です。",
      sort_order: 0,
    },
    {
      id: E4,
      card_id: S2,
      label: "Framework / Library (React / Next.js)",
      label_note: "モダンフレームワーク",
      label_short: null,
      icon_set: "Others",
      icon_name: "toolkit",
      segments: 5,
      level: "Intermediate",
      description: null,
      sort_order: 1,
    },
  ],
  skill_experience_tools: [
    { experience_id: E1, tool_id: T1, sort_order: 0 },
    { experience_id: E2, tool_id: T4, sort_order: 0 },
    { experience_id: E4, tool_id: T2, sort_order: 0 },
    { experience_id: E4, tool_id: T3, sort_order: 1 },
  ],
  flowcharts: [
    {
      id: F1,
      title: "サンプルフロー",
      description: null,
      created_at: null,
      updated_at: null,
      data: {
        nodes: [
          { id: "start", kind: "start", label: "開始", x: 120, y: 40 },
          { id: "step", kind: "step", label: "処理", x: 100, y: 190 },
          { id: "end", kind: "end", label: "終了", x: 120, y: 350 },
        ],
        edges: [
          { id: "start-step", source: "start", target: "step", sourceHandle: "bottom", targetHandle: "top" },
          { id: "step-end", source: "step", target: "end", sourceHandle: "bottom", targetHandle: "top" },
        ],
      },
    },
  ],
};
