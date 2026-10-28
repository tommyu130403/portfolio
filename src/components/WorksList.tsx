"use client";

import type { FC } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";
import WorkCard from "@/components/WorkCard";
import { DEFAULT_IMAGE, parseThumbnail } from "@/lib/work-content";
import { workPeriodLabel } from "@/lib/work-period";

type Work = Tables<"works">;

export const WorksList: FC = () => {
  const router = useRouter();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workContentsMap, setWorkContentsMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const fetchWorks = async () => {
      setLoading(true);
      setError(null);

      const [{ data, error: fetchError }, { data: workContentsRows }] = await Promise.all([
        supabase.from("works").select("*").eq("is_published", true).order("sort_order", { ascending: true }),
        supabase
          .from("work_contents")
          .select("work_id, sort_order, contents_vocab(label)")
          .order("sort_order"),
      ]);

      // 作品ごとの制作内容マップ（カードのタグ表示用）
      const contentsMap: Record<string, string[]> = {};
      for (const row of workContentsRows ?? []) {
        const label = (row.contents_vocab as { label: string } | null)?.label;
        if (label) {
          contentsMap[row.work_id] = [...(contentsMap[row.work_id] ?? []), label];
        }
      }
      setWorkContentsMap(contentsMap);

      if (fetchError) {
        console.error("Failed to fetch works:", fetchError);
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setWorks(data ?? []);

      setLoading(false);
    };

    fetchWorks();
  }, []);

  const openWork = (workId: string) => router.push(`/works?id=${workId}`);

  // Career カードの Works リンクから発火される遷移イベントを受け、該当 Works 詳細へ遷移する。
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ workId?: string }>).detail?.workId;
      if (id) router.push(`/works?id=${id}`);
    };
    window.addEventListener("portfolio:open-work", handler);
    return () => window.removeEventListener("portfolio:open-work", handler);
  }, [router]);

  if (loading) {
    return (
      <div className="flex flex-wrap gap-[32px] text-[17px] text-white/50">
        制作・企画を読み込み中…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-500/40 bg-red-900/20 p-4 text-sm text-red-200">
        制作・企画の取得に失敗しました: {error}
      </div>
    );
  }

  if (works.length === 0) {
    return (
      <div className="flex flex-wrap gap-[32px] text-[17px] text-white/50">
        制作・企画がありません。
      </div>
    );
  }

  // Figma (Master 50:174) は本文幅 800px を 3 列（カード 256px・gap 16）で並べる。
  // 1 列 → sm(640px) で 2 列 → xl(1280px) で 3 列。xl の境目はユーザー判断（Skills の 2 列化と同じ）。
  // カード幅は容器に従うので、本文幅 800px のとき Figma と同じ 256px になる。
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {works.map((work) => (
        <WorkCard
          key={work.id}
          category={work.category}
          title={work.title}
          contents={workContentsMap[work.id] ?? []}
          period={workPeriodLabel(work)}
          image={work.thumbnail_url ?? DEFAULT_IMAGE}
          thumbnail={parseThumbnail(work.thumbnail)}
          serviceName={work.hero_brand}
          onClick={() => openWork(work.id)}
        />
      ))}
    </div>
  );
};
