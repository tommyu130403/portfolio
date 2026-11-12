"use client";

import { useEffect, useRef, useState } from "react";
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

// 作品詳細からブラウザの「戻る」で帰ったとき、押したカードを画面内に戻すための記録。
// トップは経歴・作品をマウント後に読み込むため、戻った直後はページが短く、
// ブラウザ(Next.js)が戻した位置ではカードが画面の外に出る(段階 3 の C5)。
const RETURN_WORK_KEY = "portfolio:return-work-id";
// 履歴の移動(戻る・進む)でトップに来たか。popstate で立て、画面のどこかを押したら下ろす。
// パンくず・メニュー等のリンクはクリックを伴い popstate は起きないので、カードへは合わせない。
// ページを開き直す形の「戻る」(bfcache 外の再読み込み)は popstate が来ないため、読み込みの種類で初期値を決める。
// マウント時に読むだけで書き換えないので、開発時に effect が 2 回走っても結果は同じ
let arrivedByHistory = false;
if (typeof window !== "undefined") {
  arrivedByHistory =
    (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)
      ?.type === "back_forward";
  window.addEventListener("popstate", () => {
    arrivedByHistory = true;
  });
  window.addEventListener(
    "click",
    (e) => {
      arrivedByHistory = false;
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      try {
        if (link.closest("#works")) {
          // 作品カードを押したら、戻ってきたときに合わせる先として作品 ID を覚えておく
          const workId = workIdFromHref(link.href);
          if (workId) sessionStorage.setItem(RETURN_WORK_KEY, workId);
        } else if (!workIdFromHref(link.href)) {
          // 作品詳細以外へのリンク(パンくず・メニュー等)で移ったら、その先から戻っても古いカードへ合わせない。
          // 前後の作品へのリンクは作品詳細の中の移動なので残す
          sessionStorage.removeItem(RETURN_WORK_KEY);
        }
      } catch {
        // 保存できなくても遷移はそのまま
      }
    },
    true
  );
}

/** 作品カードの href(…/works?id=<id>)から作品 ID を取り出す */
function workIdFromHref(href: string): string | null {
  try {
    const url = new URL(href, window.location.href);
    return url.pathname.replace(/\/$/, "").endsWith("/works") ? url.searchParams.get("id") : null;
  } catch {
    return null;
  }
}

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

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuOverlayRef = useRef<HTMLDivElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  // メニューの節リンクで閉じたときは ☰ へ戻さない(移動先の節から Tab を続けられるように)
  const menuClosedByLinkRef = useRef(false);

  // オーバーレイ表示中は Esc で閉じ、背面スクロールをロックする。
  // 開いたら選択の位置を「閉じる」へ移し、Tab はメニューの中で循環させる(aria-modal のため裏の画面へ抜けない)。
  // 閉じたら ☰ へ戻す
  useEffect(() => {
    if (!mobileMenuOpen) return;
    menuClosedByLinkRef.current = false;
    const overlay = menuOverlayRef.current;
    // Contact などのダイアログがメニューの手前に開いている間は、キー操作をそちらに任せる
    const otherDialogOpen = () => document.querySelectorAll('[role="dialog"][aria-modal="true"]').length > 1;
    const onKey = (e: KeyboardEvent) => {
      if (otherDialogOpen()) return;
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        return;
      }
      if (e.key !== "Tab" || !overlay) return;
      const focusables = Array.from(
        overlay.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((el) => el.getClientRects().length > 0);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!overlay.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    // 開くときは visibility を即時に切り替えている(下の className)ので、この時点で focus() が効く
    menuCloseRef.current?.focus({ preventScroll: true });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // 選択の位置がメニューの中(閉じると inert で外れる)かページ全体にあるときだけ ☰ へ戻す
      const active = document.activeElement;
      if (menuClosedByLinkRef.current) return;
      if (!active || active === document.body || overlay?.contains(active)) {
        menuButtonRef.current?.focus({ preventScroll: true });
      }
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
  // 作品詳細から「戻る」で帰ったときは、ハッシュより押したカードを優先して同じ仕組みで合わせる
  useEffect(() => {
    let returnWorkId: string | null = null;
    if (arrivedByHistory) {
      try {
        returnWorkId = sessionStorage.getItem(RETURN_WORK_KEY);
      } catch {
        // 保存領域が使えない環境では合わせない
      }
    }

    // /#% のような壊れたハッシュで decodeURIComponent が投げるとページ全体が落ちる
    let id = "";
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      if (!returnWorkId) return;
    }
    if (!id && !returnWorkId) return;

    const findCard = () =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>("#works a[href]")).find(
        (a) => workIdFromHref(a.href) === returnWorkId
      );

    // html の scroll-behavior: smooth のままだと合わせ直しのたびにアニメーションが割り込む
    // カードはまだ読み込み中なら見つからないので、高さが変わるたびに探し直す
    const align = () => {
      if (returnWorkId) {
        findCard()?.scrollIntoView({ block: "center", behavior: "instant" });
        return;
      }
      document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "instant" });
    };
    const resizeObserver = new ResizeObserver(align);
    // カードの出現はタブが裏にあると ResizeObserver(描画に連動)で拾えないため、要素の追加でも合わせる
    const mutationObserver = returnWorkId ? new MutationObserver(align) : null;
    const userEvents = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    const stop = () => {
      resizeObserver.disconnect();
      mutationObserver?.disconnect();
      window.clearTimeout(timer);
      userEvents.forEach((e) => window.removeEventListener(e, stop));
    };

    // カードへ戻すときは、遅い回線でもログイン確認と作品の読み込みが終わるまで待てるよう長めにとる
    const timer = window.setTimeout(stop, returnWorkId ? 15000 : 5000);
    align();
    resizeObserver.observe(document.body);
    // 作品一覧の中だけを見る(ページ全体だと、フェードインや画像の差し替えのたびに無駄に合わせ直す)
    mutationObserver?.observe(document.getElementById("works") ?? document.body, {
      childList: true,
      subtree: true,
    });
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
          ref={menuButtonRef}
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
          ref={menuOverlayRef}
          inert={!mobileMenuOpen}
          className={[
            "fixed inset-0 z-[60] lg:hidden duration-300 ease-in-out",
            // 開くときは visibility を動かさず即時に visible にする(動かすと最初のフレームが hidden のままで、選択の位置を中へ移せない)。
            // 閉じるときだけ visibility も遅らせ、フェードアウトを見せる
            mobileMenuOpen ? "visible opacity-100 transition-opacity" : "invisible opacity-0 transition-[opacity,visibility]",
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
              if ((e.target as HTMLElement).closest("a")) {
                menuClosedByLinkRef.current = true;
                setMobileMenuOpen(false);
              }
            }}
          >
            <SideMenuBar
              activeSection={activeSection}
              collapsed={false}
            />
          </div>
          {/* 閉じるボタン */}
          <button
            ref={menuCloseRef}
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
