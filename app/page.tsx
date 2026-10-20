"use client";

import { useEffect, useState } from "react";
import SideMenuBar, { type SideMenuSectionId } from "@/components/SideMenuBar";
import Headline from "@/components/Headline";
import CareerGanttChart from "@/components/CareerGanttChart";
import { WorksList } from "@/src/components/WorksList";
import SkillsCardGrid from "@/src/components/SkillsCardGrid";
import { AuthGate } from "@/components/AuthGate";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";

const SECTION_IDS: SideMenuSectionId[] = ["introduction", "career", "works", "skills"];

type Profile = Tables<"profile">;
type CareerItem = Tables<"career_items">;

export default function Home() {
  return (
    <AuthGate>
      <HomeContent />
    </AuthGate>
  );
}

function HomeContent() {
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
  const [profileError, setProfileError] = useState(false);
  const [careerError, setCareerError] = useState(false);
  // Supabase からプロフィール・経歴を取得
  useEffect(() => {
    const fetchData = async () => {
      const [profileRes, careerRes] = await Promise.all([
        supabase.from("profile").select("*").eq("id", 1).single(),
        supabase.from("career_items").select("*").order("sort_order", { ascending: true }),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      if (profileRes.error) setProfileError(true);
      if (careerRes.data) setCareer(careerRes.data);
      if (careerRes.error) setCareerError(true);
      setLoading(false);
    };
    fetchData();
  }, []);

  const introduction = Array.isArray(profile?.introduction)
    ? profile.introduction.filter((paragraph): paragraph is string =>
        typeof paragraph === "string" && paragraph.trim().length > 0
      )
    : [];

  // 別ページから /#works 等で来たとき、Next.js のクライアント遷移はデータ読み込み前の高さで
  // 位置を決める(または移動しない)ため、経歴・作品・スキルが読み込まれて伸びた分だけずれる。
  // 読み込みで高さが変わる間はハッシュの位置に合わせ直し、ユーザーが操作したらやめる
  useEffect(() => {
    // /#% のような壊れたハッシュで decodeURIComponent が投げるとページ全体が落ちる
    let id: string;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    if (!id) return;

    // html の scroll-behavior: smooth のままだと合わせ直しのたびにアニメーションが割り込む
    const align = () =>
      document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "instant" });
    const resizeObserver = new ResizeObserver(align);
    const userEvents = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    const stop = () => {
      resizeObserver.disconnect();
      window.clearTimeout(timer);
      userEvents.forEach((e) => window.removeEventListener(e, stop));
    };

    const timer = window.setTimeout(stop, 5000);
    align();
    resizeObserver.observe(document.body);
    userEvents.forEach((e) => window.addEventListener(e, stop, { passive: true }));
    return stop;
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
    <div className="flex min-h-screen items-start bg-surface text-white">
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
          className="fixed left-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-[12px] border border-border bg-surface-light lg:hidden"
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
              className="absolute inset-0 bg-black/25"
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
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-[12px] border border-border bg-surface-light text-[18px] text-white"
            >
              ✕
            </button>
          </div>
        )}

      {/* Main content */}
      <main className="relative z-[1] flex flex-1 items-start overflow-hidden">
        <div className="flex w-full flex-col items-center gap-[120px] px-6 lg:px-8 xl:px-10 py-20">
          {/* Hero */}
          <section className="flex w-full max-w-main flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-16">
            <div className="relative aspect-square w-[120px] flex-none sm:w-auto sm:flex-1 max-w-[200px] max-h-[200px] shrink-0 overflow-hidden rounded-[32px]">
              {loading ? (
                <div className="h-full w-full animate-pulse bg-system-800" />
              ) : (
                <img src={profile?.hero_image_url} alt="Profile" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex flex-1 flex-col">
              <div className="flex flex-col gap-2">
                <p className="font-en text-[16px] leading-6 tracking-[-0.3125px] text-fg-muted">
                  {loading ? <span className="inline-block h-4 w-32 animate-pulse rounded bg-system-800" /> : profile?.title}
                </p>
                <div className="flex flex-wrap items-end gap-x-2 gap-y-0 text-main-050">
                  <p className="font-noto text-[46px] leading-[60px] tracking-[0.2637px]">
                    {loading ? <span className="inline-block h-[60px] w-64 animate-pulse rounded bg-system-800" /> : profile?.name_jp}
                  </p>
                  <p className="font-en text-[20px] leading-7 tracking-[-0.4492px]">
                    {loading ? <span className="inline-block h-6 w-40 animate-pulse rounded bg-system-800" /> : profile?.name_en}
                  </p>
                </div>
                {profile?.bio && <p className="text-[15px] leading-6 text-fg-muted">{profile.bio}</p>}
              </div>
            </div>
          </section>

          {/* Introduction */}
          <section id="introduction" className="w-full max-w-main">
            <Headline label="自己紹介" title="Introduction" />
            <div className="flex flex-col gap-10 text-[15px] leading-[24px] tracking-[0.45px] text-white">
              <div className="flex flex-col gap-4">
                {loading ? (
                  <div className="h-16 w-full animate-pulse rounded bg-system-800" />
                ) : profileError ? (
                  <p role="alert">自己紹介を読み込めませんでした。</p>
                ) : introduction.length > 0 ? (
                  introduction.map((paragraph, index) => <p key={index}>{paragraph}</p>)
                ) : (
                  <p>自己紹介はまだ登録されていません。</p>
                )}
              </div>
              {/* Figma の点は本文と同じ 13px の「•」を字下げ 19.5px の中央に置いたもの。list-disc は 5×5 の図形になるため不使用 */}
              <ul className="list-none text-[13px] leading-[21px] tracking-[0.39px] text-fg-muted" role="list">
                <li className="relative ms-[19.5px]">
                  <span aria-hidden className="absolute top-0 left-[-19.5px] w-[19.5px] text-center">•</span>
                  説明責任を果たす (透明性)
                </li>
                <li className="relative ms-[19.5px]">
                  <span aria-hidden className="absolute top-0 left-[-19.5px] w-[19.5px] text-center">•</span>
                  あらゆる専門性によって最適解を模索する (異能の掛け算)
                </li>
                <li className="relative ms-[19.5px]">
                  <span aria-hidden className="absolute top-0 left-[-19.5px] w-[19.5px] text-center">•</span>
                  ビジネスを作る (UXの証明)
                </li>
              </ul>
            </div>
          </section>

          {/* Career */}
          <section id="career" className="w-full max-w-main">
            <Headline label="経歴" title="Career" />
            <div className="flex flex-col gap-6">
              {loading ? (
                <div className="flex flex-col gap-3">
                  <span className="inline-block h-16 w-3/4 animate-pulse rounded-[10px] bg-system-800" />
                  <span className="inline-block h-16 w-2/3 animate-pulse rounded-[10px] bg-system-800" style={{ marginLeft: "20%" }} />
                  <span className="inline-block h-16 w-1/2 animate-pulse rounded-[10px] bg-system-800" style={{ marginLeft: "40%" }} />
                </div>
              ) : careerError ? (
                <p className="text-[13px] text-danger-300" role="alert">経歴を読み込めませんでした。</p>
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
          {/* 他の4セクションと同じく section 自体に max-w-main を持たせる。
              内側の div で幅を作ると section の実幅が親いっぱい（1104px）になり、
              セクションの境界とコンテンツの境界がずれる */}
          <section id="skills" className="w-full max-w-main">
            <Headline label="スキル" title="Skills" />
            <SkillsCardGrid />
          </section>
        </div>
      </main>
    </div>
  );
}
