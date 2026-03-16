import type { FC, ReactNode } from "react";
import Icon from "./Icon";
import Tag from "./Tag";
import type { Tables } from "@/src/types/supabase";

type Project = Tables<"projects">;
type Section = { heading: string; body: string };

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80";

const InfoChip: FC<{
  icon: ReactNode;
  label: string;
  children: ReactNode;
}> = ({ icon, label, children }) => (
  <div className="flex h-10 items-center gap-3 rounded-[8px] bg-black/25 px-4 shrink-0">
    <div className="flex items-center gap-2 shrink-0">
      {icon}
      <p className="text-[12px] tracking-[0.6px] text-[#9e9e9e] whitespace-nowrap">
        {label}
      </p>
    </div>
    <div className="w-px self-stretch my-[10px] bg-[#424242]" />
    <div className="flex items-center gap-2">{children}</div>
  </div>
);

type ProjectModalContentProps = {
  project: Project;
  skills?: string[];
  tools?: string[];
};

const ProjectModalContent: FC<ProjectModalContentProps> = ({ project, skills = [], tools = [] }) => {
  const sections = (project.sections ?? []) as Section[];

  return (
    <div className="flex flex-col gap-16">
      {/* Hero image */}
      {project.thumbnail_url && (
        <div className="w-full rounded-[32px] overflow-hidden">
          <img
            src={project.thumbnail_url}
            alt={project.title}
            className="w-full aspect-[728/410] object-cover"
          />
        </div>
      )}

      {/* Title block */}
      <div className="flex flex-col gap-4">
        {project.category && (
          <p className="text-[17px] tracking-[0.85px] text-[#b3ffe7]">
            {project.category}
          </p>
        )}
        <p className="text-[40px] font-bold leading-[48px] tracking-[2px] text-white">
          {project.title}
        </p>
      </div>

      {/* Info chips */}
      <div className="flex flex-wrap gap-4">
        {project.role && (
          <InfoChip
            icon={
              <Icon set="Peoples" name="people" className="h-4 w-6 shrink-0" />
            }
            label="役割"
          >
            <p className="text-[12px] tracking-[0.6px] text-white whitespace-nowrap">
              {project.role}
            </p>
          </InfoChip>
        )}

        {project.period && (
          <InfoChip
            icon={
              <Icon
                set="Time"
                name="calendar-three"
                className="h-4 w-6 shrink-0"
              />
            }
            label="期間"
          >
            <p className="text-[12px] tracking-[0.6px] text-white whitespace-nowrap">
              {project.period}
            </p>
          </InfoChip>
        )}

        {skills.length > 0 && (
          <InfoChip
            icon={
              <Icon
                set="Charts"
                name="radar-chart"
                className="h-4 w-6 shrink-0"
              />
            }
            label="スキル"
          >
            {skills.map((skill) => (
              <Tag key={skill} label={skill} />
            ))}
          </InfoChip>
        )}

        {tools.length > 0 && (
          <InfoChip
            icon={
              <Icon set="Build" name="tool" className="h-4 w-6 shrink-0" />
            }
            label="ツール"
          >
            <div className="flex gap-2 items-center flex-wrap">
              {tools.map((tool) => (
                <span
                  key={tool}
                  className="text-[12px] tracking-[0.6px] text-white whitespace-nowrap"
                >
                  {tool}
                </span>
              ))}
            </div>
          </InfoChip>
        )}
      </div>

      {/* Sections */}
      {sections.map((section, i) => (
        <div key={i} className="flex flex-col gap-4">
          <p className="text-[24px] font-bold leading-[1.5] tracking-[1.2px] text-white pb-2">
            {section.heading}
          </p>
          <p className="text-[17px] leading-[1.5] tracking-[0.85px] text-white">
            {section.body}
          </p>
        </div>
      ))}
    </div>
  );
};

export default ProjectModalContent;
