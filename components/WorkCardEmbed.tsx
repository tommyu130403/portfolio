"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import { DEFAULT_IMAGE } from "@/lib/work-content";
import WorkPagerCard from "./WorkPagerCard";

type EmbedWork = {
  category: string | null;
  title: string;
  thumbnail_url: string | null;
};

/**
 * 作品本文に埋め込む、他の作品へのリンクカード（`::: workcard id=<uuid>`）。公開中の作品だけ表示する。
 * 見た目は前後ナビと同じ WorkPagerCard（Figma Master 973:2191）。本文中なので方向の行（Prev / Next）は出さない
 */
export default function WorkCardEmbed({ id }: { id: string }) {
  const pathname = usePathname();
  const [result, setResult] = useState<{
    id: string;
    work: EmbedWork | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: row, error } = await supabase
        .from("works")
        .select("category, title, thumbnail_url")
        .eq("id", id)
        .eq("is_published", true)
        .maybeSingle();
      if (!active) return;
      setResult({ id, work: error || !row ? null : row });
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const loading = result?.id !== id;
  const work = result?.id === id ? result.work : null;

  if (loading) {
    return (
      <div
        className="mb-4 mt-10 w-full max-w-[394px]"
        aria-label="作品カードを読み込み中"
      >
        <div className="h-[80px] w-full animate-pulse rounded-r8 border border-border bg-surface-light" />
      </div>
    );
  }

  if (!work) return null;

  // admin のプレビュー内ではクリックで遷移させない（編集中の内容が失われるため）
  const inAdmin = pathname?.startsWith("/admin") ?? false;

  return (
    // 幅は Figma の 394px を上限に容器へ従う（grid のセル内ではセル幅）。
    // admin ではリンクのクリックを捕捉段階で打ち消す（WorkPagerCard は常に Link のため）
    <div
      className="mb-4 mt-10 w-full max-w-[394px]"
      onClickCapture={inAdmin ? (e) => e.preventDefault() : undefined}
    >
      <WorkPagerCard
        category={work.category}
        title={work.title}
        thumbnail={work.thumbnail_url ?? DEFAULT_IMAGE}
        href={`/works?id=${id}`}
      />
    </div>
  );
}
