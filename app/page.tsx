"use client";

import { useEffect, useState } from "react";
import SideMenuBar, { type SideMenuSectionId } from "@/components/SideMenuBar";
import Headline from "@/components/Headline";
// HistoryItem は旧デザイン用として保持: import HistoryItem from "@/components/HistoryItem";
import CareerGanttChart from "@/components/CareerGanttChart";
import { WorksList } from "@/src/components/WorksList";
import SkillsCardGrid from "@/src/components/SkillsCardGrid";
import { ButtonAction } from "@/components/ButtonAction";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";

const SECTION_IDS: SideMenuSectionId[] = ["introduction", "career", "works", "skills"];
const DEFAULT_CAREER_LEAD =
  "こんにちは。UI/UXデザイナーの山田太郎です。 東京を拠点に、Webサイト、モバイルアプリケーション、ブランディングなど、 幅広いデジタルプロダクトのデザインを手がけています。";

type Profile = Tables<"profile">;
type CareerItem = Tables<"career_items">;

export default function Home() {
  const [activeSection, setActiveSection] = useState<SideMenuSectionId>("introduction");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // lg 未満のモバイルナビ（ハンバーガー → オーバーレイ）の開閉状態
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // SSR との不一致を防ぐため、ウィンドウ幅による初期値はハイドレーション後に設定する
  useEffect(() => {
    setSidebarCollapsed(window.innerWidth < 1024);
  }, []);

  // オーバーレイ表示中は Esc で閉じ、背面スクロールをロックする
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileMenuOpen]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [career, setCareer] = useState<CareerItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Supabase からプロフィール・経歴を取得
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const fetchData = async () => {
      const [profileRes, careerRes] = await Promise.all([
        supabase.from("profile").select("*").eq("id", 1).single(),
        supabase.from("career_items").select("*").order("sort_order", { ascending: true }),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      if (careerRes.data) setCareer(careerRes.data);
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const TRIGGER_OFFSET = 120;

    const updateActive = () => {
      let current: SideMenuSectionId = SECTION_IDS[0];
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= TRIGGER_OFFSET) current = id;
      }
      setActiveSection(current);
    };

    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    return () => window.removeEventListener("scroll", updateActive);
  }, []);

  return (
    <AuthGate>
      <div className="flex min-h-screen items-start bg-[#212121] text-white">
        {/* Side Menu（lg 以上のみ表示） */}
        <div
          className="sticky top-0 shrink-0 z-[2] hidden lg:block"
          style={{ width: sidebarCollapsed ? 96 : 256, transition: "width 300ms ease-in-out" }}
        >
          <SideMenuBar
            activeSection={activeSection}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />
        </div>

        {/* モバイル: ハンバーガー（lg 未満のみ表示） */}
        <button
          type="button"
          aria-label="メニューを開く"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(true)}
          className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-[12px] border border-border bg-surface-dark lg:hidden"
        >
          <span className="flex flex-col gap-[4px]">
            <span className="block h-[2px] w-4 rounded bg-white" />
            <span className="block h-[2px] w-4 rounded bg-white" />
            <span className="block h-[2px] w-4 rounded bg-white" />
          </span>
        </button>

        {/* モバイル: オーバーレイ（lg 未満のみ表示） */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-[60] lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="ナビゲーション"
          >
            {/* 背景（クリックで閉じる） */}
            <div
              className="absolute inset-0 bg-overlay-dark"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* パネル: 既存 SideMenuBar を展開状態で再利用。ナビリンククリックで閉じる */}
            <div
              className="absolute inset-y-0 left-0 w-[256px]"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) setMobileMenuOpen(false);
              }}
            >
              <SideMenuBar
                activeSection={activeSection}
                collapsed={false}
                showCollapseToggle={false}
              />
            </div>
            {/* 閉じるボタン */}
            <button
              type="button"
              aria-label="メニューを閉じる"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-[12px] border border-border bg-surface-dark text-[18px] text-white"
            >
              ✕
            </button>
          </div>
        )}

      {/* Main content */}
      <main className="relative z-[1] flex flex-1 items-start overflow-hidden">
        <div className="flex w-full flex-col items-center gap-[120px] px-6 lg:px-8 xl:px-10 py-20">
          {/* Hero */}
          <section className="flex w-full max-w-main items-center gap-16">
            <div className="relative aspect-square flex-1 max-w-[200px] max-h-[200px] shrink-0 overflow-hidden rounded-[32px]">
              {loading ? (
                <div className="h-full w-full animate-pulse bg-[#424242]" />
              ) : (
                <img src={profile?.hero_image_url} alt="Profile" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-6">
              <div className="flex flex-col gap-2">
                <p className="text-[16px] leading-6 text-[#9e9e9e]">
                  {loading ? <span className="inline-block h-4 w-32 animate-pulse rounded bg-[#424242]" /> : profile?.title}
                </p>
                <div className="flex items-end gap-2 text-[#b3ffe7]">
                  <p className="font-mplus text-[46px] leading-[60px] tracking-[0.26px]">
                    {loading ? <span className="inline-block h-[60px] w-64 animate-pulse rounded bg-[#424242]" /> : profile?.name_jp}
                  </p>
                  <p className="text-[20px] leading-7 tracking-[-0.45px]">
                    {loading ? <span className="inline-block h-6 w-40 animate-pulse rounded bg-[#424242]" /> : profile?.name_en}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Introduction */}
          <section id="introduction" className="w-full max-w-main">
            <Headline label="自己紹介" title="Introduction" />
            <div className="flex flex-col gap-10 text-[15px] leading-[1.5] tracking-[0.45px] text-white">
              {/* Opening paragraphs */}
              <div className="flex flex-col gap-4">
                <p>こんにちは。プロダクトデザイナーの山田太郎です。 大学では主にIoTの分野を中心に人間工学やHCD(人間中心設計)を学びものづくり全般に関わる専門性を学び、新卒で入社したレバレジーズではWebサイト・アプリケーションの設計と開発、CROの改善など、 幅広いデジタルプロダクトのグロースに携わってきました。</p>
                <p>デザインは問題解決の手段であると考えており、 常にユーザーの課題とビジネスの目標の両方を意識しながらデザイン制作を行ってきました。 開発チームやセールスチームといったあらゆる専門性との密なコミュニケーションを通じて、「最適解」を徹底的に模索することを心がけています。</p>
              </div>
            </div>
          </section>

          {/* Career */}
          <section id="career" className="w-full max-w-main">
            <Headline label="経歴" title="Career" />
            <div className="flex flex-col gap-6">
              {/* careerLead — デザインソース (sections.jsx) 準拠スタイル */}
              {loading ? (
                <span className="inline-block h-12 w-full animate-pulse rounded bg-[#424242]" />
              ) : (
                <p style={{ fontFamily: "Avenir, var(--font-noto-sans-jp), sans-serif", fontSize: 14.5, lineHeight: 1.9, letterSpacing: ".04em", color: "var(--fg-muted)", margin: 0, maxWidth: 640 }}>
                  {(profile?.career_lead ?? "").trim() || DEFAULT_CAREER_LEAD}
                </p>
              )}
              {loading ? (
                <div className="flex flex-col gap-3">
                  <span className="inline-block h-16 w-3/4 animate-pulse rounded-[10px] bg-[#424242]" />
                  <span className="inline-block h-16 w-2/3 animate-pulse rounded-[10px] bg-[#424242]" style={{ marginLeft: "20%" }} />
                  <span className="inline-block h-16 w-1/2 animate-pulse rounded-[10px] bg-[#424242]" style={{ marginLeft: "40%" }} />
                </div>
              ) : (
                <CareerGanttChart career={career} />
              )}
            </div>
          </section>

          {/* Works */}
          <section id="works" className="w-full max-w-main">
            <Headline label="制作・企画" title="Works" />
            <WorksList />
          </section>

          {/* Skills */}
          <section id="skills" className="mb-10 w-full">
            {/* 見出し+タブ: 他セクションと同じ最大幅・中央寄せ */}
            <div className="mx-auto w-full max-w-main">
              <Headline label="スキル" title="Skills" />
            </div>
            <div className="w-full max-w-main mx-auto">
              <SkillsCardGrid />
            </div>
          </section>
        </div>
      </main>
    </div>
    </AuthGate>
  );
}
