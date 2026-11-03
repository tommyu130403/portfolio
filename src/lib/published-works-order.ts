"use client";

import { supabase } from "@/src/lib/supabase";
import type { Json } from "@/src/types/supabase";

export type PublishedWorkItem = {
  id: string;
  title: string;
  category: string | null;
  thumbnail_url: string | null;
  thumbnail: Json | null;
  hero_brand: string | null;
};

let current: Promise<PublishedWorkItem[] | null> | null = null;

/**
 * 公開中の作品の並び（前後ナビ用）を取り、作品詳細が開いている間だけ共有する。
 * 本文の作品カード（WorkCardEmbed）は同じ項目を使うので、1 件ずつ取り直さずにここから引く。失敗時は null
 */
export function loadPublishedWorksOrder(): Promise<PublishedWorkItem[] | null> {
  const request = Promise.resolve(
    supabase
      .from("works")
      .select("id, title, category, thumbnail_url, thumbnail, hero_brand")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
  ).then(({ data, error }) => {
    if (error) {
      console.error("Failed to fetch works order:", error);
      return null;
    }
    return data ?? [];
  }, (error: unknown) => {
    // 例外で落ちても null にする。本文の作品カードはこれを待つため、拒否のままだと読み込み中で止まる
    console.error("Failed to fetch works order:", error);
    return null;
  });
  current = request;
  return request;
}

/** 作品詳細を閉じたときに呼ぶ。admin のプレビューなど別の画面に古い一覧を持ち越さない */
export function releasePublishedWorksOrder(request: Promise<PublishedWorkItem[] | null>): void {
  if (current === request) current = null;
}

/** 作品詳細が取得した一覧。詳細の外では null */
export function sharedPublishedWorksOrder(): Promise<PublishedWorkItem[] | null> | null {
  return current;
}
