"use client";

import { type FC, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";
import { parseScreenshots } from "@/lib/work-content";
import WorkDetailLeftPanel, { type WorkToolItem } from "./WorkDetailLeftPanel";
import WorkDetailContent from "./WorkDetailContent";
import { ButtonFunction } from "./ButtonFunction";

type Work = Tables<"works">;

type WorkDetailClientProps = {
  /** クエリ文字列 ?id= から受け取った Work ID */
  id: string | null;
};

const WorkDetailClient: FC<WorkDetailClientProps> = ({ id }) => {
  const router = useRouter();
  const [work, setWork] = useState<Work | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [tools, setTools] = useState<WorkToolItem[]>([]);
  const [order, setOrder] = useState<string[]>([]);
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
      .select("id")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setOrder((data ?? []).map((r) => r.id));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBack = () => router.push("/#works");

  const goTo = (delta: number) => {
    if (!id || order.length < 2) return;
    const idx = order.indexOf(id);
    if (idx < 0) return;
    const nextId = order[(idx + delta + order.length) % order.length];
    router.push(`/works?id=${nextId}`);
  };

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
  const showNav = order.length > 1;

  return (
    <div className="relative min-h-screen bg-system-900 text-white">
      <div className="mx-auto flex w-full max-w-[1520px] flex-col items-start justify-center gap-10 px-6 lg:flex-row lg:items-stretch lg:px-10">
        <WorkDetailLeftPanel
          work={work}
          skills={skills}
          tools={tools}
          screenshots={screenshots}
          onBack={handleBack}
        />

        {/* 縦罫線 */}
        <div className="hidden w-px shrink-0 self-stretch bg-system-800 lg:block" aria-hidden />

        <WorkDetailContent work={work} />
      </div>

      {/* 前後ナビ（画面端・固定） */}
      {showNav && (
        <>
          <div className="fixed left-2 top-1/2 z-40 -translate-y-1/2">
            <ButtonFunction direction="left" onClick={() => goTo(-1)} aria-label="前のWork" />
          </div>
          <div className="fixed right-2 top-1/2 z-40 -translate-y-1/2">
            <ButtonFunction direction="right" onClick={() => goTo(1)} aria-label="次のWork" />
          </div>
        </>
      )}
    </div>
  );
};

export default WorkDetailClient;
