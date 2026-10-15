"use client";

import { type FC, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";
import { parseScreenshots } from "@/lib/work-content";
import WorkDetailHeader, { type WorkToolItem } from "./WorkDetailHeader";
import WorkDetailContent from "./WorkDetailContent";
import WorkBreadcrumb from "./WorkBreadcrumb";
import WorkPagerCard from "./WorkPagerCard";
import { DEFAULT_IMAGE } from "@/src/components/WorksList";

type Work = Tables<"works">;
type OrderItem = { id: string; title: string; category: string | null; thumbnail_url: string | null };

type WorkDetailClientProps = {
  /** クエリ文字列 ?id= から受け取った Work ID */
  id: string | null;
};

const WorkDetailClient: FC<WorkDetailClientProps> = ({ id }) => {
  const router = useRouter();
  const [work, setWork] = useState<Work | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [tools, setTools] = useState<WorkToolItem[]>([]);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        supabase.from("works").select("*").eq("id", id).single(),
        supabase
          .from("work_skills")
          .select("sort_order, skills_vocab(label)")
          .eq("work_id", id)
          .order("sort_order"),
        supabase
          .from("work_tools")
          .select("sort_order, tools_vocab(name, icon_url)")
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
          .map((r) => r.tools_vocab as { name: string; icon_url: string | null } | null)
          .filter((t): t is { name: string; icon_url: string | null } => Boolean(t?.name))
          .map((t) => ({ name: t.name, icon_url: t.icon_url }))
      );
      setLoading(false);
    };

    fetchDetail();
    // id 変更（前後ナビ）時は先頭へスクロール
    if (typeof window !== "undefined") window.scrollTo(0, 0);
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
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setOrder(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBack = () => router.push("/#works");

  const goTo = (targetId: string) => router.push(`/works?id=${targetId}`);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-system-900 text-[17px] text-white/50">
        読み込み中…
      </div>
    );
  }

  if (error || !work) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-system-900 px-6 text-center">
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
    <div className="relative min-h-screen bg-surface text-white">
      {/* z-index を付けない。付けるとここがスタックコンテキストになり、内側で開く
          WorkVizModal(z-50) / ScreenshotLightbox(z-60) が他の層より
          下に沈む（2026-09-11 に実測） */}
      <main className="relative flex min-w-0 flex-col items-center">
        {/* カラム */}
        <div className="mx-auto flex w-full max-w-main flex-col gap-12 px-6 py-20 xl:px-0">
          <WorkBreadcrumb
            title={work.title}
            index={idx}
            total={idx < 0 ? 0 : order.length}
            onBack={handleBack}
            onPrev={prev ? () => goTo(prev.id) : undefined}
            onNext={next ? () => goTo(next.id) : undefined}
          />
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
                    onClick={() => goTo(prev.id)}
                  />
                )}
                {next && (
                  <div className={prev ? "h-full" : "h-full md:col-start-2"}>
                    <WorkPagerCard
                      direction="next"
                      category={next.category}
                      thumbnail={next.thumbnail_url ?? DEFAULT_IMAGE}
                      title={next.title}
                      onClick={() => goTo(next.id)}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default WorkDetailClient;
