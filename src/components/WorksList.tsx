"use client";

import type { FC } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import type { Tables, TablesInsert } from "@/src/types/supabase";
import WorkCard from "@/components/WorkCard";

type Work = Tables<"works">;

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80";

/** ダミーデータ（Supabase にデータがない場合にシード） */
const SEED_WORKS: TablesInsert<"works">[] = [
  {
    title: "キャリアチケットスカウトサービスの立ち上げ（ベータ版リリース）",
    category: "プラットフォーム開発",
    thumbnail_url: DEFAULT_IMAGE,
    role: null,
    period: null,
    sections: null,
    sort_order: 0,
  },
  {
    title: "キャリアチケットスカウト正規版",
    category: "プラットフォーム開発",
    thumbnail_url: DEFAULT_IMAGE,
    role: null,
    period: null,
    sections: null,
    sort_order: 1,
  },
  {
    title: "ECサイトリニューアル",
    category: "組織開発",
    thumbnail_url: DEFAULT_IMAGE,
    role: null,
    period: null,
    sections: null,
    sort_order: 2,
  },
  {
    title: "ECサイトリニューアル",
    category: "Webデザイン",
    thumbnail_url: DEFAULT_IMAGE,
    role: null,
    period: null,
    sections: null,
    sort_order: 3,
  },
  {
    title: "ECサイトリニューアル",
    category: "Webデザイン",
    thumbnail_url: DEFAULT_IMAGE,
    role: null,
    period: null,
    sections: null,
    sort_order: 4,
  },
];

export const WorksList: FC = () => {
  const router = useRouter();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workSkillsMap, setWorkSkillsMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const fetchWorks = async () => {
      setLoading(true);
      setError(null);

      const [{ data, error: fetchError }, { data: workSkillsRows }] = await Promise.all([
        supabase.from("works").select("*").order("sort_order", { ascending: true }),
        supabase
          .from("work_skills")
          .select("work_id, sort_order, skills_vocab(label)")
          .order("sort_order"),
      ]);

      // Build per-work skills map（カードのタグ表示用）
      const skillsMap: Record<string, string[]> = {};
      for (const row of workSkillsRows ?? []) {
        const label = (row.skills_vocab as { label: string } | null)?.label;
        if (label) {
          skillsMap[row.work_id] = [...(skillsMap[row.work_id] ?? []), label];
        }
      }
      setWorkSkillsMap(skillsMap);

      if (fetchError) {
        console.error("Failed to fetch works:", fetchError);
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        const { error: insertError } = await supabase.from("works").insert(SEED_WORKS);

        if (insertError) {
          console.error("Failed to seed works:", insertError);
          setError(insertError.message);
        } else {
          const { data: refetched } = await supabase
            .from("works")
            .select("*")
            .order("sort_order", { ascending: true });
          setWorks(refetched ?? []);
        }
      } else {
        setWorks(data);
      }

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

  return (
    <div className="flex flex-wrap gap-[16px]">
      {works.map((work) => (
        <WorkCard
          key={work.id}
          category={work.category ?? "カテゴリなし"}
          title={work.title}
          tags={workSkillsMap[work.id] ?? []}
          image={work.thumbnail_url ?? DEFAULT_IMAGE}
          onClick={() => openWork(work.id)}
        />
      ))}
    </div>
  );
};
