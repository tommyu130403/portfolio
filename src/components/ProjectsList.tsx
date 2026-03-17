"use client";

import type { FC } from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import type { Tables, TablesInsert } from "@/src/types/supabase";
import ProjectCard from "@/components/ProjectCard";
import Modal from "@/components/Modal";
import ProjectModalContent from "@/components/ProjectModalContent";

type Project          = Tables<"projects">;
type SkillExperience  = Tables<"skill_experience">;

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80";

/** ダミーデータ（Supabase にデータがない場合にシード） */
const SEED_PROJECTS: TablesInsert<"projects">[] = [
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

export type ProjectsListProps = {
  /** サイドバー折りたたみ時は true。Modal のオフセット計算に使用 */
  sidebarCollapsed?: boolean;
};

export const ProjectsList: FC<ProjectsListProps> = ({ sidebarCollapsed = false }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [skillExperienceRows, setSkillExperienceRows] = useState<SkillExperience[]>([]);
  const [projectSkillsMap, setProjectSkillsMap] = useState<Record<string, string[]>>({});
  const [projectToolsMap, setProjectToolsMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      setError(null);

      const [
        { data, error: fetchError },
        { data: skillExperience },
        { data: projectSkillsRows },
        { data: projectToolsRows },
      ] = await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .order("sort_order", { ascending: true }),
        supabase
          .from("skill_experience")
          .select("*")
          .order("sort_order", { ascending: true }),
        supabase
          .from("project_skills")
          .select("project_id, sort_order, skills_vocab(label)")
          .order("sort_order"),
        supabase
          .from("project_tools")
          .select("project_id, sort_order, tools_vocab(name)")
          .order("sort_order"),
      ]);

      // Build per-project maps
      const skillsMap: Record<string, string[]> = {};
      for (const row of projectSkillsRows ?? []) {
        const label = (row.skills_vocab as { label: string } | null)?.label;
        if (label) {
          skillsMap[row.project_id] = [...(skillsMap[row.project_id] ?? []), label];
        }
      }
      setProjectSkillsMap(skillsMap);

      const toolsMap: Record<string, string[]> = {};
      for (const row of projectToolsRows ?? []) {
        const name = (row.tools_vocab as { name: string } | null)?.name;
        if (name) {
          toolsMap[row.project_id] = [...(toolsMap[row.project_id] ?? []), name];
        }
      }
      setProjectToolsMap(toolsMap);

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
            .select("*")
            .order("sort_order", { ascending: true });
          setProjects(refetched ?? []);
        }
      } else {
        setProjects(data);
      }

      setSkillExperienceRows((skillExperience ?? []) as SkillExperience[]);

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
            tags={projectSkillsMap[project.id] ?? []}
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
            skills={projectSkillsMap[selectedProject.id] ?? []}
            tools={projectToolsMap[selectedProject.id] ?? []}
          />
        </Modal>
      )}
    </>
  );
};
