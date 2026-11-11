"use client";

import { useEffect, useState } from "react";
import SideMenuBar, { type SideMenuSectionId } from "@/components/SideMenuBar";
import Headline from "@/components/Headline";
import CareerGanttChart from "@/components/CareerGanttChart";
import { WorksList } from "@/src/components/WorksList";
import SkillsCardGrid from "@/src/components/SkillsCardGrid";
import { AuthGate } from "@/components/AuthGate";
import ProtectedImage from "@/components/ProtectedImage";
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
  // lg 未満のモバイルナビ（ハンバーガー → オーバーレイ）の開閉状態
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // オーバーレイ表示中は Esc で閉じ、背面スクロールをロックする
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Contact などのダイアログがメニューの手前に開いている間は、Esc でそちらだけを閉じる
      if (document.querySelectorAll('[role="dialog"][aria-modal="true"]').length > 1) return;
      setMobileMenuOpen(false);
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
      // 順次表示は loading=false を合図に始まるため、通信が例外で終わっても必ず解除する
      // (解除されないとセクションが透明のまま残る)
      try {
        const [profileRes, careerRes] = await Promise.all([
          supabase.from("profile").select("*").eq("id", 1).single(),
          supabase.from("career_items").select("*").order("sort_order", { ascending: true }),
        ]);
        if (profileRes.data) setProfile(profileRes.data);
        if (profileRes.error) setProfileError(true);
        if (careerRes.data) setCareer(careerRes.data);
        if (careerRes.error) setCareerError(true);
      } catch {
        setProfileError(true);
        setCareerError(true);
      } finally {
        setLoading(false);
      }
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

  // 読み込み中はスケルトン(仮の灰色表示)が出るため、読み込みが終わってからフェードインを始める。
  // 待たないと、スケルトンが現れた直後に実データへ差し替わってパッと変わってしまう。
  // ただし通信が返ってこないとページ全体が透明のまま残るため、5 秒で待つのをやめる(スケルトンのまま表示)
  const [revealReady, setRevealReady] = useState(false);
  useEffect(() => {
    if (!loading) {
      setRevealReady(true);
      return;
    }
    const timer = window.setTimeout(() => setRevealReady(true), 5000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!revealReady) return;
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("main [data-reveal]:not(.is-revealed)")
    );
    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.classList.add("is-revealed"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        // 同じタイミングで見えた要素は DOM 順に 0,1,2… と時間差をつける
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => entry.target as HTMLElement)
          .sort((a, b) =>
            a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
          );
        visible.forEach((el, i) => {
          el.style.setProperty("--reveal-order", String(i));
          el.classList.add("is-revealed");
          observer.unobserve(el);
        });
      },
      // 下端に余白を取ると、ページ最下部の短い要素(スキルの読み込みエラー文など)が
      // 最後までスクロールしても判定線を越えず表示されないため、画面端で判定する
      { threshold: 0 }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // 5 秒で先に始めた場合、後から届いたデータで増えた要素(一言紹介など)も拾うため loading でもかけ直す
  }, [revealReady, loading]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const TRIGGER_OFFSET = 120;

    let raf = 0;
    const measure = () => {
      raf = 0;
      let current: SideMenuSectionId = SECTION_IDS[0];
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= TRIGGER_OFFSET) current = id;
      }
      setActiveSection(current);
    };
    // スクロール中は 1 フレームに 1 回だけ測る
    const updateActive = () => {
      if (raf) return;
      raf = requestAnimationFrame(measure);
    };

    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateActive);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="flex min-h-screen items-start bg-surface text-white">
        {/* Side Menu（lg 以上のみ表示） */}
        <div className="sticky top-0 shrink-0 z-[2] hidden w-[96px] lg:block">
          <SideMenuBar activeSection={activeSection} />
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
        {/* 常に描画し、開閉は opacity / translate で動かす(閉じている間は inert + invisible で操作・読み上げ対象外) */}
        <div
          inert={!mobileMenuOpen}
          className={[
            "fixed inset-0 z-[60] lg:hidden transition-[opacity,visibility] duration-300 ease-in-out",
            mobileMenuOpen ? "visible opacity-100" : "invisible opacity-0",
          ].join(" ")}
          // 閉じている間は dialog として数えない(Modal の「最前面のダイアログ」判定に混ざらないように)
          role={mobileMenuOpen ? "dialog" : undefined}
          aria-modal={mobileMenuOpen ? true : undefined}
          aria-label="ナビゲーション"
        >
          {/* 背景（クリックで閉じる） */}
          <div
            className="absolute inset-0 bg-black/25"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* パネル: 既存 SideMenuBar を展開状態で再利用。ナビリンククリックで閉じる */}
          <div
            className={[
              "absolute inset-y-0 left-0 w-[216px] transition-transform duration-300 ease-in-out",
              mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
            ].join(" ")}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setMobileMenuOpen(false);
            }}
          >
            <SideMenuBar
              activeSection={activeSection}
              collapsed={false}
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

      {/* Main content */}
      <main className="relative z-[1] flex flex-1 items-start overflow-hidden">
        <div className="flex w-full flex-col items-center gap-[120px] px-6 lg:px-8 xl:px-10 py-20">
          {/* Hero */}
          <section className="flex w-full max-w-main flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-16">
            <div data-reveal="" className="relative aspect-square w-[120px] flex-none sm:w-auto sm:flex-1 max-w-[200px] max-h-[200px] shrink-0 overflow-hidden rounded-[32px]">
              {loading ? (
                <div className="h-full w-full animate-pulse bg-surface-light" />
              ) : (
                <ProtectedImage src={profile?.hero_image_url ?? ""} alt="Profile" fetchPriority="high" className="h-full w-full object-cover" />
              )}
            </div>
            {/* 肩書: 職種・英語名・一言紹介（Figma Master 47:210・2026-11-09）。職種 Afacad 14px・名前 Afacad Bold 46px 字間 5%・行間 100%・Main/050。一言紹介 Body/01/JP/Regular・Secondary（2026-11-11 作品本文に合わせて変更） */}
            <div className="flex flex-1 flex-col gap-4 sm:pt-3">
              <div data-reveal="" className="flex flex-col gap-3">
                <p className="font-sans text-[14px] leading-none tracking-[0.03em] text-main-050">
                  {loading ? <span className="inline-block h-4 w-32 animate-pulse rounded bg-surface-light" /> : profile?.title}
                </p>
                <h1 className="font-sans text-[46px] font-bold leading-none tracking-[0.05em] text-main-050">
                  {loading ? <span className="inline-block h-[46px] w-64 animate-pulse rounded bg-surface-light" /> : profile?.name_en || profile?.name_jp}
                </h1>
              </div>
              {profile?.bio && <p data-reveal="" className="text-body-01-jp text-fg-muted">{profile.bio}</p>}
            </div>
          </section>

          {/* Introduction */}
          <section id="introduction" className="w-full max-w-main">
            <div data-reveal=""><Headline label="自己紹介" title="Introduction" /></div>
            <div data-reveal="" className="flex flex-col gap-10 text-body-01-jp text-fg-muted">
              <div className="flex flex-col gap-4">
                {loading ? (
                  <div className="h-16 w-full animate-pulse rounded bg-surface-light" />
                ) : profileError ? (
                  <p role="alert">自己紹介を読み込めませんでした。</p>
                ) : introduction.length > 0 ? (
                  introduction.map((paragraph, index) => <p key={index}>{paragraph}</p>)
                ) : (
                  <p>自己紹介はまだ登録されていません。</p>
                )}
              </div>
              {/* 価値観（Figma Master 1241:7589・Tag-single の上書き）: 「# 」付き・Noto 12px・字間 5%・Main/base 文字・Main α10 地・余白 8・角丸 4・gap 8 で折り返し */}
              <ul className="flex flex-wrap gap-2" role="list">
                {["説明責任を果たす (透明性)", "あらゆる専門性によって最適解を模索する (異能の掛け算)", "ビジネスを作る (UXの証明)"].map((value) => (
                  // Figma は行間 100%（1 行で高さ 28）。スマホ幅で長い値が折り返すと行が重なって見えるため、行間 1.4・上下 6px（1 行で約 29）にしている
                  <li key={value} className="rounded-r4 bg-main-100/10 px-2 py-[6px] text-[12px] leading-[1.4] tracking-[0.05em] text-primary">
                    # {value}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Career */}
          <section id="career" className="w-full max-w-main">
            <div data-reveal=""><Headline label="経歴" title="Career" /></div>
            <div data-reveal="" className="flex flex-col gap-6">
              {/* リード文（profile.career_lead）。文字は Introduction の段落と同じ。空なら出さない */}
              {!loading && profile?.career_lead?.trim() && (
                <p className="whitespace-pre-line text-body-01-jp text-fg-muted">{profile.career_lead.trim()}</p>
              )}
              {loading ? (
                <div className="flex flex-col gap-3">
                  <span className="inline-block h-16 w-3/4 animate-pulse rounded-[10px] bg-surface-light" />
                  <span className="inline-block h-16 w-2/3 animate-pulse rounded-[10px] bg-surface-light" style={{ marginLeft: "20%" }} />
                  <span className="inline-block h-16 w-1/2 animate-pulse rounded-[10px] bg-surface-light" style={{ marginLeft: "40%" }} />
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
            <div data-reveal=""><Headline label="制作・企画" title="Works" /></div>
            <div data-reveal=""><WorksList /></div>
          </section>

          {/* Skills */}
          {/* 他の4セクションと同じく section 自体に max-w-main を持たせる。
              内側の div で幅を作ると section の実幅が親いっぱい（1104px）になり、
              セクションの境界とコンテンツの境界がずれる */}
          <section id="skills" className="w-full max-w-main">
            <div data-reveal=""><Headline label="スキル" title="Skills" /></div>
            <div data-reveal=""><SkillsCardGrid /></div>
          </section>
        </div>
      </main>
    </div>
  );
}
