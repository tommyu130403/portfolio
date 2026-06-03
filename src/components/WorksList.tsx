"use client";

import type { FC } from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import type { Tables, TablesInsert } from "@/src/types/supabase";
import WorkCard from "@/components/WorkCard";
import Modal from "@/components/Modal";
import WorkModalContent from "@/components/WorkModalContent";

type Work             = Tables<"works">;
type SkillExperience  = Tables<"skill_experience">;

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

export type WorksListProps = {
  /** サイドバー折りたたみ時は true。Modal のオフセット計算に使用 */
  sidebarCollapsed?: boolean;
};

export const WorksList: FC<WorksListProps> = ({ sidebarCollapsed = false }) => {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [skillExperienceRows, setSkillExperienceRows] = useState<SkillExperience[]>([]);
  const [workSkillsMap, setWorkSkillsMap] = useState<Record<string, string[]>>({});
  const [workToolsMap, setWorkToolsMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const fetchWorks = async () => {
      setLoading(true);
      setError(null);

      const [
        { data, error: fetchError },
        { data: skillExperience },
        { data: workSkillsRows },
        { data: workToolsRows },
      ] = await Promise.all([
        supabase
          .from("works")
          .select("*")
          .order("sort_order", { ascending: true }),
        supabase
          .from("skill_experience")
          .select("*")
          .order("sort_order", { ascending: true }),
        supabase
          .from("work_skills")
          .select("work_id, sort_order, skills_vocab(label)")
          .order("sort_order"),
        supabase
          .from("work_tools")
          .select("work_id, sort_order, tools_vocab(name)")
          .order("sort_order"),
      ]);

      // Build per-work maps
      const skillsMap: Record<string, string[]> = {};
      for (const row of workSkillsRows ?? []) {
        const label = (row.skills_vocab as { label: string } | null)?.label;
        if (label) {
          skillsMap[row.work_id] = [...(skillsMap[row.work_id] ?? []), label];
        }
      }
      setWorkSkillsMap(skillsMap);

      const toolsMap: Record<string, string[]> = {};
      for (const row of workToolsRows ?? []) {
        const name = (row.tools_vocab as { name: string } | null)?.name;
        if (name) {
          toolsMap[row.work_id] = [...(toolsMap[row.work_id] ?? []), name];
        }
      }
      setWorkToolsMap(toolsMap);

      if (fetchError) {
        console.error("Failed to fetch works:", fetchError);
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        const { error: insertError } = await supabase
          .from("works")
          .insert(SEED_WORKS);

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

      setSkillExperienceRows((skillExperience ?? []) as SkillExperience[]);

      setLoading(false);
    };

    fetchWorks();
  }, []);

  // Career カードの Works リンクから発火される遷移イベントを受け、
  // 該当 Works のモーダルを開く（works ロード後に再バインド）。
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ workId?: string }>).detail?.workId;
      if (!id) return;
      const idx = works.findIndex((w) => w.id === id);
      if (idx >= 0) setSelectedIndex(idx);
    };
    window.addEventListener("portfolio:open-work", handler);
    return () => window.removeEventListener("portfolio:open-work", handler);
  }, [works]);

  const handleClose = () => setSelectedIndex(null);

  const handlePrev = () => {
    setSelectedIndex((prev) =>
      prev === null ? null : (prev - 1 + works.length) % works.length
    );
  };

  const handleNext = () => {
    setSelectedIndex((prev) =>
      prev === null ? null : (prev + 1) % works.length
    );
  };

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

  const selectedWork =
    selectedIndex !== null ? works[selectedIndex] : null;

  return (
    <>
      <div className="flex flex-wrap gap-[16px]">
        {works.map((work, i) => (
          <WorkCard
            key={work.id}
            category={work.category ?? "カテゴリなし"}
            title={work.title}
            tags={workSkillsMap[work.id] ?? []}
            image={work.thumbnail_url ?? DEFAULT_IMAGE}
            onClick={() => setSelectedIndex(i)}
          />
        ))}
      </div>

      {selectedWork && (
        <Modal
          onClose={handleClose}
          sidebarOffset={sidebarCollapsed ? 88 : 256}
          carousel
          onPrev={handlePrev}
          onNext={handleNext}
          currentIndex={selectedIndex ?? 0}
          total={works.length}
        >
          <WorkModalContent
            work={selectedWork}
            skills={workSkillsMap[selectedWork.id] ?? []}
            tools={workToolsMap[selectedWork.id] ?? []}
          />
        </Modal>
      )}
    </>
  );
};
