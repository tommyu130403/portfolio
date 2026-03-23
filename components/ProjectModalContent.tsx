import type { FC, ReactNode } from "react";
import React from "react";
import Icon from "./Icon";
import Tag from "./Tag";
import type { Tables } from "@/src/types/supabase";

type Project = Tables<"projects">;
type Section = { heading: string; body: string };

/** Markdown の `![alt](url)` と段落区切り（空行）をレンダリングするコンポーネント */
const SectionBodyRenderer: FC<{ body: string }> = ({ body }) => {
  const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

  const paragraphs = body.split(/\n{2,}/);

  return (
    <>
      {paragraphs.map((para, pi) => {
        const parts: ReactNode[] = [];
        let last = 0;
        let m: RegExpExecArray | null;
        IMG_RE.lastIndex = 0;
        while ((m = IMG_RE.exec(para)) !== null) {
          const before = para.slice(last, m.index);
          if (before) {
            parts.push(
              <React.Fragment key={`t-${pi}-${last}`}>
                {before.split("\n").map((line, li, arr) => (
                  <React.Fragment key={li}>
                    {line}
                    {li < arr.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </React.Fragment>
            );
          }
          parts.push(
            <img
              key={`img-${pi}-${m.index}`}
              src={m[2]}
              alt={m[1]}
              className="my-4 max-w-full rounded-[12px] block"
            />
          );
          last = m.index + m[0].length;
        }
        const tail = para.slice(last);
        if (tail) {
          parts.push(
            <React.Fragment key={`t-${pi}-tail`}>
              {tail.split("\n").map((line, li, arr) => (
                <React.Fragment key={li}>
                  {line}
                  {li < arr.length - 1 && <br />}
                </React.Fragment>
              ))}
            </React.Fragment>
          );
        }
        const hasOnlyImages = parts.every(
          (p) => React.isValidElement(p) && p.type === "img"
        );
        return hasOnlyImages ? (
          <div key={pi}>{parts}</div>
        ) : (
          <p key={pi} className="text-[17px] leading-[1.5] tracking-[0.85px] text-white">
            {parts}
          </p>
        );
      })}
    </>
  );
};

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80";

type ProjectModalContentProps = {
  project: Project;
  skills?: string[];
  tools?: string[];
};

const ProjectModalContent: FC<ProjectModalContentProps> = ({ project, skills = [], tools = [] }) => {
  const sections = (project.sections ?? []) as Section[];
  const infoRows = [
    {
      key: "role",
      label: "役割",
      icon: <Icon set="Peoples" name="people" className="w-4 h-4 shrink-0" />,
      content: project.role ? (
        <p className="text-[15px] leading-[24px] tracking-[0.3px] text-white">
          {project.role}
        </p>
      ) : null,
    },
    {
      key: "period",
      label: "期間",
      icon: <Icon set="Time" name="calendar-three" className="w-4 h-4 shrink-0" />,
      content: project.period ? (
        <p className="text-[15px] leading-[24px] tracking-[0.3px] text-white whitespace-nowrap">
          {project.period}
        </p>
      ) : null,
    },
    {
      key: "skills",
      label: "スキル",
      icon: <Icon set="Charts" name="viencharts" className="w-4 h-4 shrink-0" />,
      content:
        skills.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {skills.map((skill) => (
              <Tag key={skill} label={skill} variant="small" />
            ))}
          </div>
        ) : null,
    },
    {
      key: "tools",
      label: "ツール",
      icon: <Icon set="Base" name="tool" className="w-4 h-4 shrink-0" />,
      content:
        tools.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {tools.map((tool) => (
              <Tag key={tool} label={tool} variant="small" />
            ))}
          </div>
        ) : null,
    },
  ].filter((row) => row.content !== null);

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

      {/* Project summary table */}
      <div className="flex flex-col gap-[1px] rounded-[8px] overflow-hidden bg-[#212121]">
        {infoRows.map((row) => (
          <div key={row.key} className="flex gap-[2px] items-stretch">
            <div className="w-[104px] min-h-[40px] px-4 py-[10px] bg-[#1a1a1a]">
              <div className="flex items-center gap-2">
                {row.icon}
                <p className="text-[12px] font-bold leading-[18px] tracking-[0.36px] text-[#9e9e9e] whitespace-nowrap">
                  {row.label}
                </p>
              </div>
            </div>
            <div className="flex-1 min-h-[40px] px-4 py-2 bg-[#1a1a1a] flex items-center">
              {row.content}
            </div>
          </div>
        ))}
      </div>

      {/* Sections */}
      {sections.map((section, i) => (
        <div key={i} className="flex flex-col gap-4">
          <p className="text-[24px] font-bold leading-[1.5] tracking-[1.2px] text-white pb-2">
            {section.heading}
          </p>
          <SectionBodyRenderer body={section.body} />
        </div>
      ))}
    </div>
  );
};

export default ProjectModalContent;
