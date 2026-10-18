"use client";

import { type FC, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";
import { DEFAULT_IMAGE, parseScreenshots } from "@/lib/work-content";
import WorkDetailHeader, { type WorkToolItem } from "./WorkDetailHeader";
import WorkDetailContent from "./WorkDetailContent";
import WorkBreadcrumb from "./WorkBreadcrumb";
import WorkPagerCard from "./WorkPagerCard";
import SideMenuBar from "./SideMenuBar";

type Work = Tables<"works">;
type OrderItem = { id: string; title: string; category: string | null; thumbnail_url: string | null };

type WorkDetailClientProps = {
  /** クエリ文字列 ?id= から受け取った Work ID */
  id: string | null;
};

const WorkDetailSkeleton: FC = () => (
  <div role="status" className="flex w-full flex-col gap-12">
    <span className="sr-only">読み込み中…</span>
    <div className="flex h-[var(--work-header-h)] items-center justify-between">
      <div className="h-4 w-40 motion-safe:animate-pulse rounded bg-system-800" />
      <div className="h-4 w-16 motion-safe:animate-pulse rounded bg-system-800" />
    </div>
    <div className="flex justify-center gap-6">
      <div className="aspect-[126/257] w-[126px] motion-safe:animate-pulse rounded-[24px] bg-system-800" />
      <div className="aspect-[126/257] w-[126px] motion-safe:animate-pulse rounded-[24px] bg-system-800" />
    </div>
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className="h-5 w-16 motion-safe:animate-pulse rounded bg-system-800" />
          <div className="h-10 w-2/3 motion-safe:animate-pulse rounded bg-system-800" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-14 motion-safe:animate-pulse rounded-full bg-system-800" />
          <div className="h-6 w-14 motion-safe:animate-pulse rounded-full bg-system-800" />
          <div className="h-6 w-14 motion-safe:animate-pulse rounded-full bg-system-800" />
        </div>
      </div>
      <div className="h-[120px] w-full motion-safe:animate-pulse rounded-r8 bg-system-800" />
    </div>
    <div className="h-px bg-border" />
    {/* 本文（WorkSections）と同じく容器幅 720px で 2 列に切り替える */}
    <div className="@container">
      <div className="flex flex-col gap-4 @min-[720px]:flex-row">
      <div className="h-5 w-24 shrink-0 motion-safe:animate-pulse rounded bg-system-800 @min-[720px]:w-[160px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="h-4 w-full motion-safe:animate-pulse rounded bg-system-800" />
        <div className="h-4 w-full motion-safe:animate-pulse rounded bg-system-800" />
        <div className="h-4 w-11/12 motion-safe:animate-pulse rounded bg-system-800" />
        <div className="h-4 w-2/3 motion-safe:animate-pulse rounded bg-system-800" />
      </div>
      </div>
    </div>
  </div>
);

const WorkDetailClient: FC<WorkDetailClientProps> = ({ id }) => {
  const router = useRouter();
  const [work, setWork] = useState<Work | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [tools, setTools] = useState<WorkToolItem[]>([]);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);

      if (!id) {
        if (!cancelled) {
          setError("Work ID が指定されていません。");
          setLoading(false);
        }
        return;
      }

      const [
        { data: workData, error: workError },
        { data: skillRows },
        { data: toolRows },
      ] = await Promise.all([
        supabase.from("works").select("*").eq("id", id).eq("is_published", true).single(),
        supabase
          .from("work_skills")
          .select("sort_order, skills_vocab(label)")
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
        setError(workError?.message ?? "Work が見つかりませんでした。");
        setWork(null);
        setLoading(false);
        return;
      }

      setWork(workData);
      setSkills(
        (skillRows ?? [])
          .map((r) => (r.skills_vocab as { label: string } | null)?.label)
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
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("works")
      .select("id, title, category, thumbnail_url")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error: orderError }) => {
        if (orderError) console.error("Failed to fetch works order:", orderError);
        if (!cancelled) setOrder(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBack = () => router.push("/#works");

  const workHref = (targetId: string) => `/works?id=${targetId}`;

  const renderBody = () => {
    if (loading) return <WorkDetailSkeleton />;

    if (error || !work) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <p className="text-[15px] text-white/70">{error ?? "Work が見つかりませんでした。"}</p>
          <button
            type="button"
            onClick={handleBack}
            className="rounded-full border border-system-800 px-4 py-2 text-[13px] text-system-500 transition-colors hover:border-system-500 hover:text-white"
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
        {/* ヘッダーは上部固定。z-20 は本文中の z-10（FlowchartEmbed の拡大ボタン・Tooltip）より上、
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
        <WorkDetailHeader work={work} skills={skills} tools={tools} screenshots={screenshots} />
        <WorkDetailContent work={work} />

        {showNav && (
          <>
            <div className="h-px bg-border" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {prev && (
                <WorkPagerCard
                  direction="prev"
                  category={prev.category}
                  thumbnail={prev.thumbnail_url ?? DEFAULT_IMAGE}
                  title={prev.title}
                  href={workHref(prev.id)}
                />
              )}
              {next && (
                <div className={prev ? "h-full" : "h-full md:col-start-2"}>
                  <WorkPagerCard
                    direction="next"
                    category={next.category}
                    thumbnail={next.thumbnail_url ?? DEFAULT_IMAGE}
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
    <div data-work-detail className="relative flex min-h-screen items-start bg-surface text-white">
      {/* Side Menu（lg 以上のみ表示） */}
      <div
        className="sticky top-0 shrink-0 z-[2] hidden lg:block"
        style={{ width: sidebarCollapsed ? 96 : 256, transition: "width 300ms ease-in-out" }}
      >
        <SideMenuBar
          activeSection="works"
          hrefBase="/"
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      </div>
      {/* z-index を付けない。付けるとここがスタックコンテキストになり、内側で開く
          WorkVizModal(z-50) / ScreenshotLightbox(z-60) が他の層より
          下に沈む（2026-09-11 に実測） */}
      <main className="relative flex min-w-0 flex-1 flex-col items-center">
        {/* カラム */}
        <div className="mx-auto flex w-full max-w-main flex-col gap-12 px-6 py-20 xl:px-0">
          {renderBody()}
        </div>
      </main>
    </div>
  );
};

export default WorkDetailClient;
