"use client";

import { type FC, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";
import { DEFAULT_IMAGE, parseScreenshots, parseThumbnail } from "@/lib/work-content";
import WorkDetailHeader, { HeroShotsSkeleton, type WorkToolItem } from "./WorkDetailHeader";
import WorkDetailContent from "./WorkDetailContent";
import WorkBreadcrumb from "./WorkBreadcrumb";
import WorkPagerCard from "./WorkPagerCard";
import SideMenuBar from "./SideMenuBar";
import WorkToc, { useWorkToc } from "./WorkToc";
import { useWorkCategoryHues } from "@/src/lib/work-category-colors";
import { loadPublishedWorksOrder, releasePublishedWorksOrder, type PublishedWorkItem } from "@/src/lib/published-works-order";

type Work = Tables<"works">;
type OrderItem = PublishedWorkItem;

// 画面に出す文言。Supabase の英文(TypeError: Failed to fetch など)はそのまま出さない
const NOT_FOUND_MESSAGE = "この作品は見つかりませんでした。公開が終わったか、URL が違う可能性があります。";
const LOAD_FAILED_MESSAGE = "作品を読み込めませんでした。通信状況を確かめて、ページを再読み込みしてください。";

/**
 * 取得の失敗を「作品が無い」と「読み込めない」に分ける。
 * PGRST116 = 該当 0 行(.single())、22P02 = ID が uuid の形でない。どちらも URL の作品が存在しない
 */
const isNotFoundError = (error: { code?: string } | null) => !error || error.code === "PGRST116" || error.code === "22P02";

type WorkDetailClientProps = {
  /** クエリ文字列 ?id= から受け取った Work ID */
  id: string | null;
};

const WorkDetailSkeleton: FC = () => (
  <div role="status" className="flex w-full flex-col gap-12">
    <span className="sr-only">読み込み中…</span>
    <div className="flex h-[var(--work-header-h)] items-center justify-between">
      <div className="h-4 w-40 motion-safe:animate-pulse rounded bg-surface-light" />
      <div className="h-4 w-16 motion-safe:animate-pulse rounded bg-surface-light" />
    </div>
    <div className="flex justify-center">
      <HeroShotsSkeleton />
    </div>
    {/* WorkDetailHeader と同じ形: カテゴリ + タイトル → gap-12 → メタ表（左右 16px 内側・5 行 × 40px + 上下の枠線 2px） */}
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-4">
        <div className="h-5 w-16 motion-safe:animate-pulse rounded bg-surface-light" />
        <div className="h-10 w-2/3 motion-safe:animate-pulse rounded bg-surface-light" />
      </div>
      <div className="px-4">
        <div className="h-[202px] w-full motion-safe:animate-pulse rounded-r8 bg-surface-light" />
      </div>
    </div>
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <div className="h-9 w-32 motion-safe:animate-pulse rounded bg-surface-light" />
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-4 w-full motion-safe:animate-pulse rounded bg-surface-light" />
        <div className="h-4 w-full motion-safe:animate-pulse rounded bg-surface-light" />
        <div className="h-4 w-11/12 motion-safe:animate-pulse rounded bg-surface-light" />
        <div className="h-4 w-2/3 motion-safe:animate-pulse rounded bg-surface-light" />
      </div>
    </div>
  </div>
);

const WorkDetailClient: FC<WorkDetailClientProps> = ({ id }) => {
  const router = useRouter();
  const hues = useWorkCategoryHues();
  const hueOf = (name: string | null) => (name ? hues[name] ?? null : null);
  const [work, setWork] = useState<Work | null>(null);
  const [contents, setContents] = useState<string[]>([]);
  const [tools, setTools] = useState<WorkToolItem[]>([]);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { items: tocItems, activeIndex: tocActive, scrollTo: scrollToToc } = useWorkToc(contentRef, work?.id ?? null);

  useEffect(() => {
    let cancelled = false;
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);

      if (!id) {
        if (!cancelled) {
          setError("作品が指定されていません。URL が正しいかご確認ください。");
          setLoading(false);
        }
        return;
      }

      const [
        { data: workData, error: workError },
        { data: contentRows },
        { data: toolRows },
      ] = await Promise.all([
        supabase.from("works").select("*").eq("id", id).eq("is_published", true).single(),
        supabase
          .from("work_contents")
          .select("sort_order, contents_vocab(label)")
          .eq("work_id", id)
          .order("sort_order"),
        supabase
          .from("work_tools")
          .select("sort_order, tools_vocab(name, icon_url, slug)")
          .eq("work_id", id)
          .order("sort_order"),
      ]);

      if (cancelled) return;

      if (workError || !workData) {
        if (workError && !isNotFoundError(workError)) console.error("Failed to fetch work:", workError);
        setError(isNotFoundError(workError) ? NOT_FOUND_MESSAGE : LOAD_FAILED_MESSAGE);
        setWork(null);
        setLoading(false);
        return;
      }

      setWork(workData);
      setContents(
        (contentRows ?? [])
          .map((r) => (r.contents_vocab as { label: string } | null)?.label)
          .filter((l): l is string => Boolean(l))
      );
      setTools(
        (toolRows ?? [])
          .map((r) => r.tools_vocab as WorkToolItem | null)
          .filter((t): t is WorkToolItem => Boolean(t?.name))
          .map((t) => ({ name: t.name, icon_url: t.icon_url, slug: t.slug }))
      );
      setLoading(false);
    };

    fetchDetail();
    // id 変更（前後ナビ）時は先頭へスクロール。globals.css の scroll-behavior: smooth だと
    // スケルトン(画面より高い)の途中で止まってから戻るため instant を指定する
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // 前後ナビ用の並び順は全 Works で共通のため初回のみ取得する（ナビのたびに再取得しない）。
  // 本文の作品カード（WorkCardEmbed）もこの結果を引くため、カードごとの取得（本文の後の第 2 波）が出ない
  useEffect(() => {
    let cancelled = false;
    const request = loadPublishedWorksOrder();
    request.then((data) => {
      if (!cancelled) setOrder(data ?? []);
    });
    return () => {
      cancelled = true;
      releasePublishedWorksOrder(request);
    };
  }, []);

  // タブ名を作品ごとに変える（metadata は静的エクスポートで全作品共通の「Works」になるため、読み込み後に上書きする）。
  // document.title への代入は <title> の文字ノードを差し替え、React が持つノードが外れて
  // 別ページへ移っても題名が戻らなくなる。既存の文字ノードの値だけを書き換え、戻すのは React の更新に任せる
  const workTitle = work?.title.trim();
  // 読み込み中・見つからない・題名が空のときは共通の題名に戻す（前の作品名を残さない）
  useEffect(() => {
    const next = workTitle ? `${workTitle} | Yu Tomita` : "Works | Yu Tomita";
    const node = document.querySelector("head > title")?.firstChild;
    if (node?.nodeType === Node.TEXT_NODE) node.nodeValue = next;
    else document.title = next;
  }, [workTitle]);

  const handleBack = () => router.push("/#works");

  const workHref = (targetId: string) => `/works?id=${targetId}`;

  const renderBody = () => {
    if (loading) return <WorkDetailSkeleton />;

    if (error || !work) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <p role="alert" className="text-[15px] text-fg-muted">{error ?? NOT_FOUND_MESSAGE}</p>
          <button
            type="button"
            onClick={handleBack}
            className="rounded-full border border-border px-4 py-2 text-[13px] text-fg-muted transition-colors hover:border-border-light hover:text-fg"
          >
            ‹ Works 一覧へ戻る
          </button>
        </div>
      );
    }

    const screenshots = parseScreenshots(work.hero_screenshots);
    const idx = id ? order.findIndex((o) => o.id === id) : -1;
    const prev = idx > 0 ? order[idx - 1] : undefined;
    const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : undefined;
    const showNav = idx >= 0 && order.length > 1;

    return (
      <>
        {/* ヘッダーは上部固定。z-20 は本文中の z-10（Tooltip など）より上、
            WorkVizModal(z-50) / ScreenshotLightbox(z-60) より下。帯の透明部分は後ろの本文を押せるよう
            pointer-events-none にし、囲み（パンくず・件数）だけ WorkBreadcrumb 側で auto に戻す */}
        <div className="pointer-events-none sticky top-0 z-20">
          <WorkBreadcrumb
            title={work.title}
            index={idx}
            total={idx < 0 ? 0 : order.length}
            prevHref={prev ? workHref(prev.id) : undefined}
            nextHref={next ? workHref(next.id) : undefined}
          />
        </div>
        <WorkDetailHeader work={work} contents={contents} tools={tools} screenshots={screenshots} categoryHue={hueOf(work.category)} />
        <div ref={contentRef}>
          <WorkDetailContent work={work} />
        </div>

        {showNav && (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {prev && (
                <WorkPagerCard
                  direction="prev"
                  category={prev.category}
                  categoryHue={hueOf(prev.category)}
                  thumbnail={prev.thumbnail_url ?? DEFAULT_IMAGE}
                  composedThumbnail={parseThumbnail(prev.thumbnail)}
                  serviceName={prev.hero_brand}
                  title={prev.title}
                  href={workHref(prev.id)}
                />
              )}
              {next && (
                <div className={prev ? "h-full" : "h-full md:col-start-2"}>
                  <WorkPagerCard
                    direction="next"
                    category={next.category}
                    categoryHue={hueOf(next.category)}
                    thumbnail={next.thumbnail_url ?? DEFAULT_IMAGE}
                    composedThumbnail={parseThumbnail(next.thumbnail)}
                    serviceName={next.hero_brand}
                    title={next.title}
                    href={workHref(next.id)}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </>
    );
  };

  return (
    <div data-work-detail className="relative flex min-h-screen items-start bg-surface text-fg">
      {/* Side Menu（lg 以上のみ表示） */}
      {/* z-40: ホバーで 216px に広がるメニューを目次(z-30)より上に出す。モーダル(z-50 / z-60)よりは下 */}
      <div className="sticky top-0 shrink-0 z-40 hidden w-[96px] lg:block">
        <SideMenuBar activeSection="works" hrefBase="/" />
      </div>
      {/* 目次は画面左端に固定。z-30 は固定ヘッダー(z-20)より上、SideMenuBar(z-40)・モーダル(z-50 / z-60)より下。
          lg 未満は本文カラム左の余白(32px / md 40px)に線が収まり、lg 以上は SideMenuBar(96px)の右に置く */}
      {work && !loading && (
        <div className="fixed left-0 top-1/2 z-30 -translate-y-1/2 lg:left-[112px]">
          <WorkToc key={work.id} items={tocItems} activeIndex={tocActive} onSelect={scrollToToc} />
        </div>
      )}
      {/* z-index を付けない。付けるとここがスタックコンテキストになり、内側で開く
          WorkVizModal(z-50) / ScreenshotLightbox(z-60) が他の層より
          下に沈む（2026-09-11 に実測） */}
      <main className="relative flex min-w-0 flex-1 flex-col items-center">
        {/* カラム */}
        <div className="mx-auto flex w-full max-w-main flex-col gap-12 px-8 py-20 md:px-10 lg:px-6 xl:px-0">
          {renderBody()}
        </div>
      </main>
    </div>
  );
};

export default WorkDetailClient;
