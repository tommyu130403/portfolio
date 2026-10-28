"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

type HueMap = Record<string, number | null>;

let cached: Promise<HueMap> | null = null;
const listeners = new Set<() => void>();

/** カテゴリ名 → 色相。取得は 1 回だけ共有する。失敗したときは控えを捨て、次の呼び出しで取り直す */
export function fetchWorkCategoryHues(): Promise<HueMap> {
  if (!cached) {
    cached = (async () => {
      const { data, error } = await supabase.from("work_categories").select("name, color_hue");
      if (error) {
        console.error("work_categories の色取得に失敗:", error);
        cached = null;
        return {};
      }
      const map: HueMap = {};
      for (const row of data ?? []) map[row.name] = row.color_hue;
      return map;
    })();
  }
  return cached;
}

/** admin でカテゴリの追加・改名・色変更・削除をしたあとに呼ぶ。控えを捨て、表示中の部品に取り直させる */
export function invalidateWorkCategoryHues(): void {
  cached = null;
  for (const notify of listeners) notify();
}

export function useWorkCategoryHues(): HueMap {
  const [hues, setHues] = useState<HueMap>({});
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchWorkCategoryHues().then((m) => {
        if (!cancelled) setHues(m);
      });
    };
    load();
    listeners.add(load);
    return () => {
      cancelled = true;
      listeners.delete(load);
    };
  }, []);
  return hues;
}
