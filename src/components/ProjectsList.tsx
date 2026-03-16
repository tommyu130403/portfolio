"use client";

import type { FC } from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";
import ProjectCard from "@/components/ProjectCard";
import Modal from "@/components/Modal";
import ProjectModalContent from "@/components/ProjectModalContent";

type ProjectRow = Tables<"projects">;

// project_skills / project_tools の JOIN 結果を含むローカル型
type ProjectWithSkills = ProjectRow & {
  skillLabels: string[];
  toolLabels: string[];
};

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80";

/** ダミーデータ（Supabase にデータがない場合にシード） */
const SEED_PROJECTS: Tables<"projects">[] = [
  {
    id: crypto.randomUUID(),
    title: "キャリアチケットスカウトサービスの立ち上げ（ベータ版リリース）",
    category: "プラットフォーム開発",
    thumbnail_url: DEFAULT_IMAGE,
    role: null,
    period: null,
    sections: null,
    sort_order: 0,
    created_at: null,
  },
  {
    id: crypto.randomUUID(),
    title: "キャリアチケットスカウト正規版",
    category: "プラットフォーム開発",
    thumbnail_url: DEFAULT_IMAGE,
    role: null,
    period: null,
    sections: null,
    sort_order: 1,
    created_at: null,
  },
  {
    id: crypto.randomUUID(),
    title: "ECサイトリニューアル",
    category: "組織開発",
    thumbnail_url: DEFAULT_IMAGE,
    role: null,
    period: null,
    sections: null,
    sort_order: 2,
    created_at: null,
  },
];

export type ProjectsListProps = {
  /** サイドバー折りたたみ時は true。Modal のオフセット計算に使用 */
  sidebarCollapsed?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProjectWithSkills(row: any): ProjectWithSkills {
  const skillLabels: string[] = (row.project_skills ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((ps: any) => ps.skills_vocab?.label ?? "")
    .filter(Boolean);

  const toolLabels: string[] = (row.project_tools ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((pt: any) => pt.tools_vocab?.name ?? "")
    .filter(Boolean);

  return { ...row, skillLabels, toolLabels };
}

export const ProjectsList: FC<ProjectsListProps> = ({ sidebarCollapsed = false }) => {
  const [projects, setProjects] = useState<ProjectWithSkills[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("projects")
        .select("*, project_skills(skill_id, sort_order, skills_vocab(label)), project_tools(tool_id, sort_order, tools_vocab(name))")
        .order("sort_order", { ascending: true });

      if (fetchError) {
        console.error("Failed to fetch projects:", fetchError);
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        const { error: insertError } = await supabase
          .from("projects")
          .insert(SEED_PROJECTS);

        if (insertError) {
          console.error("Failed to seed projects:", insertError);
          setError(insertError.message);
        } else {
          const { data: refetched } = await supabase
            .from("projects")
            .select("*, project_skills(skill_id, sort_order, skills_vocab(label)), project_tools(tool_id, sort_order, tools_vocab(name))")
            .order("sort_order", { ascending: true });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setProjects((refetched ?? []).map((r: any) => toProjectWithSkills(r)));
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setProjects(data.map((r: any) => toProjectWithSkills(r)));
      }

      setLoading(false);
    };

    fetchProjects();
  }, []);

  const handleClose = () => setSelectedIndex(null);

  const handlePrev = () => {
    setSelectedIndex((prev) =>
      prev === null ? null : (prev - 1 + projects.length) % projects.length
    );
  };

  const handleNext = () => {
    setSelectedIndex((prev) =>
      prev === null ? null : (prev + 1) % projects.length
    );
  };

  if (loading) {
    return (
      <div className="flex flex-wrap gap-[32px] text-[17px] text-white/50">
        プロジェクトを読み込み中…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-500/40 bg-red-900/20 p-4 text-sm text-red-200">
        プロジェクトの取得に失敗しました: {error}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-wrap gap-[32px] text-[17px] text-white/50">
        プロジェクトがありません。
      </div>
    );
  }

  const selectedProject =
    selectedIndex !== null ? projects[selectedIndex] : null;

  return (
    <>
      <div className="flex flex-wrap gap-[32px]">
        {projects.map((project, i) => (
          <ProjectCard
            key={project.id}
            category={project.category ?? "カテゴリなし"}
            title={project.title}
            tags={project.skillLabels}
            image={project.thumbnail_url ?? DEFAULT_IMAGE}
            onClick={() => setSelectedIndex(i)}
          />
        ))}
      </div>

      {selectedProject && (
        <Modal
          onClose={handleClose}
          sidebarOffset={sidebarCollapsed ? 88 : 256}
          carousel
          onPrev={handlePrev}
          onNext={handleNext}
          currentIndex={selectedIndex ?? 0}
          total={projects.length}
        >
          <ProjectModalContent
            project={selectedProject}
            skills={selectedProject.skillLabels}
            tools={selectedProject.toolLabels}
          />
        </Modal>
      )}
    </>
  );
};
