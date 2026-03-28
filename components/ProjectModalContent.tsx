import type { FC, ReactNode } from "react";
import React from "react";
import Headline from "./Headline";
import Icon from "./Icon";
import Tag from "./Tag";
import type { Tables } from "@/src/types/supabase";

type Project = Tables<"projects">;
type Section = { heading: string; body: string };

/** Markdown の見出し（# / ##）・画像・段落をレンダリングするコンポーネント */
const SectionBodyRenderer: FC<{ body: string }> = ({ body }) => {
  const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const renderParagraph = (para: string, key: string) => {
    const parts: ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    IMG_RE.lastIndex = 0;
    while ((m = IMG_RE.exec(para)) !== null) {
      const before = para.slice(last, m.index);
      if (before) {
        parts.push(
          <React.Fragment key={`${key}-t-${last}`}>
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
          key={`${key}-img-${m.index}`}
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
        <React.Fragment key={`${key}-tail`}>
          {tail.split("\n").map((line, li, arr) => (
            <React.Fragment key={li}>
              {line}
              {li < arr.length - 1 && <br />}
            </React.Fragment>
          ))}
        </React.Fragment>
      );
    }
    const hasOnlyImages = parts.every((p) => React.isValidElement(p) && p.type === "img");
    return hasOnlyImages ? (
      <div key={key}>{parts}</div>
    ) : (
      <p key={key} className="text-[15px] leading-[1.5] tracking-[0.45px] text-white">
        {parts}
      </p>
    );
  };

  type RawBlock = { t: "para"; node: ReactNode } | { t: "h2"; text: string };
  const lines = body.split("\n");
  const rawBlocks: RawBlock[] = [];
  let paragraphLines: string[] = [];
  const flushParagraph = () => {
    const paragraph = paragraphLines.join("\n").trim();
    if (paragraph) rawBlocks.push({ t: "para", node: renderParagraph(paragraph, `p-${rawBlocks.length}`) });
    paragraphLines = [];
  };
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith("# ")) {
      flushParagraph();
      paragraphLines.push(line.slice(2).trim());
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      rawBlocks.push({ t: "h2", text: line.slice(3).trim() });
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      continue;
    }
    paragraphLines.push(line);
  }
  flushParagraph();

  // Group into top-level paras and Section02 sub-sections (gap-2 = 8px)
  type Segment =
    | { type: "paras"; nodes: ReactNode[] }
    | { type: "section02"; h2: string; nodes: ReactNode[] };
  const segments: Segment[] = [];
  let topParas: ReactNode[] = [];
  for (const block of rawBlocks) {
    if (block.t === "h2") {
      if (topParas.length > 0) { segments.push({ type: "paras", nodes: topParas }); topParas = []; }
      segments.push({ type: "section02", h2: block.text, nodes: [] });
    } else {
      const last = segments[segments.length - 1];
      if (last?.type === "section02") last.nodes.push(block.node);
      else topParas.push(block.node);
    }
  }
  if (topParas.length > 0) segments.push({ type: "paras", nodes: topParas });

  return (
    <div className="flex flex-col gap-6">
      {segments.map((seg, i) =>
        seg.type === "paras" ? (
          <React.Fragment key={i}>{seg.nodes}</React.Fragment>
        ) : (
          <div key={i} className="flex flex-col gap-2">
            <p className="text-[20px] font-bold leading-[1.5] tracking-[1px] text-white w-full">
              {seg.h2}
            </p>
            <div className="flex flex-col gap-4">{seg.nodes}</div>
          </div>
        )
      )}
    </div>
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
        <p className="text-[11px] leading-[1.5] tracking-[0.33px] text-white">
          {project.role}
        </p>
      ) : null,
    },
    {
      key: "period",
      label: "期間",
      icon: <Icon set="Time" name="calendar-three" className="w-4 h-4 shrink-0" />,
      content: project.period ? (
        <p className="text-[11px] leading-[1.5] tracking-[0.33px] text-white whitespace-nowrap">
          {project.period}
        </p>
      ) : null,
    },
    {
      key: "skills",
      label: "スキル",
      icon: <Icon set="Charts" name="radar-chart" className="w-4 h-4 shrink-0" />,
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
      icon: <Icon set="Industry" name="spanner" className="w-4 h-4 shrink-0" />,
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
    <div className="flex flex-col gap-16 p-10">
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
          <p className="text-[15px] tracking-[0.45px] text-[var(--color-main-100)]">
            {project.category}
          </p>
        )}
        <p className="text-[32px] font-bold leading-normal tracking-[0.96px] text-white">
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
                <p className="text-[11px] font-bold leading-[1.5] tracking-[0.33px] text-[#9e9e9e] whitespace-nowrap">
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
        <div key={i} className="flex flex-col gap-6">
          <Headline title={section.heading} variant="markdown-h1" />
          <SectionBodyRenderer body={section.body} />
        </div>
      ))}
    </div>
  );
};

export default ProjectModalContent;
