"use client";

import { useEffect, useState } from "react";
import SideMenuBar, { type SideMenuSectionId } from "@/components/SideMenuBar";
import Headline from "@/components/Headline";
import HistoryItem from "@/components/HistoryItem";
import { ProjectsList } from "@/src/components/ProjectsList";
import TabBar from "@/components/TabBar";
import SkillsRadarChart from "@/src/components/SkillsRadarChart";
import SkillsCardGrid from "@/src/components/SkillsCardGrid";
import { ButtonAction } from "@/components/ButtonAction";
import { PasswordGate } from "@/components/PasswordGate";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/supabase";

const SKILL_TABS = [
  { id: "experience-chart", label: "Experience Chart", icon: { set: "Charts" as const, name: "chart-histogram-one" } },
  { id: "level-chart", label: "Level Chart", icon: { set: "Charts" as const, name: "radar-chart" } },
];

const SECTION_IDS: SideMenuSectionId[] = ["introduction", "career", "projects", "skills"];

type Profile = Tables<"profile">;
type CareerItem = Tables<"career_items">;

export default function Home() {
  const [activeSection, setActiveSection] = useState<SideMenuSectionId>("introduction");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    typeof window !== "undefined" && window.innerWidth < 1024,
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [career, setCareer] = useState<CareerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillsTabId, setSkillsTabId] = useState("experience-chart");

  // Supabase からプロフィール・経歴を取得
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const fetchData = async () => {
      const [profileRes, careerRes] = await Promise.all([
        supabase.from("profile").select("*").eq("id", 1).single(),
        supabase.from("career_items").select("*").order("sort_order", { ascending: true }),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      if (careerRes.data) setCareer(careerRes.data);
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const TRIGGER_OFFSET = 120;

    const updateActive = () => {
      let current: SideMenuSectionId = SECTION_IDS[0];
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= TRIGGER_OFFSET) current = id;
      }
      setActiveSection(current);
    };

    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    return () => window.removeEventListener("scroll", updateActive);
  }, []);

  return (
    <PasswordGate>
      <div className="flex min-h-screen items-start bg-[#212121] text-white">
        {/* Side Menu */}
        <div
          className="sticky top-0 shrink-0 z-[2]"
          style={{ width: sidebarCollapsed ? 96 : 256, transition: "width 300ms ease-in-out" }}
        >
          <SideMenuBar
            activeSection={activeSection}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />
        </div>

      {/* Main content */}
      <main className="relative z-[1] flex flex-1 items-start overflow-hidden">
        <div className="flex w-full flex-col items-center gap-[120px] px-6 lg:px-8 xl:px-10 py-20">
          {/* Hero */}
          <section className="flex w-full max-w-[916px] items-center gap-6 lg:gap-12 xl:gap-20">
            <div className="flex flex-1 flex-col gap-6">
              <div className="flex flex-col gap-2">
                <p className="text-[16px] leading-6 text-white">
                  {loading ? <span className="inline-block h-4 w-32 animate-pulse rounded bg-[#424242]" /> : profile?.title}
                </p>
                <p className="font-mplus text-[60px] leading-[60px] tracking-[0.26px] text-[#b3ffe7]">
                  {loading ? <span className="inline-block h-[60px] w-64 animate-pulse rounded bg-[#424242]" /> : profile?.name_jp}
                </p>
                <p className="text-[20px] leading-7 tracking-[-0.45px] text-white">
                  {loading ? <span className="inline-block h-6 w-40 animate-pulse rounded bg-[#424242]" /> : profile?.name_en}
                </p>
              </div>
              <p className="text-[17px] leading-relaxed tracking-[0.85px] text-white">
                {loading ? (
                  <span className="inline-block h-20 w-full animate-pulse rounded bg-[#424242]" />
                ) : profile?.bio}
              </p>
              <ButtonAction
                label="View more"
                type="ghost"
                iconRight={{ set: "Arrows", name: "down-small" }}
              />
            </div>
            <div className="relative aspect-square w-[200px] lg:w-[300px] xl:w-[400px] shrink-0 overflow-hidden rounded-[32px]">
              {loading ? (
                <div className="h-full w-full animate-pulse bg-[#424242]" />
              ) : (
                <img src={profile?.hero_image_url} alt="Profile" className="h-full w-full object-cover" />
              )}
            </div>
          </section>

          {/* Introduction */}
          <section id="introduction" className="w-full max-w-[916px]">
            <Headline label="Introduction" title="自己紹介" />
            <div className="flex flex-col gap-4 text-[17px] leading-relaxed tracking-[0.85px] text-white">
              {loading ? (
                <>
                  <span className="inline-block h-16 w-full animate-pulse rounded bg-[#424242]" />
                  <span className="inline-block h-16 w-full animate-pulse rounded bg-[#424242]" />
                  <span className="inline-block h-16 w-full animate-pulse rounded bg-[#424242]" />
                </>
              ) : (
                ((profile?.introduction ?? []) as string[]).map((para, i) => <p key={i}>{para}</p>)
              )}
            </div>
          </section>

          {/* Career */}
          <section id="career" className="w-full max-w-[916px]">
            <Headline label="Career" title="経歴" />
            <div className="flex flex-col gap-0">
              {loading ? (
                <>
                  <span className="inline-block h-24 w-full animate-pulse rounded bg-[#424242]" />
                  <span className="inline-block h-24 w-full animate-pulse rounded bg-[#424242]" />
                </>
              ) : (
                career.map((item, idx) => (
                  <HistoryItem
                    key={item.id}
                    {...item}
                    timeline={
                      idx === 0 ? "end" : idx === career.length - 1 ? "start" : "middle"
                    }
                  />
                ))
              )}
            </div>
          </section>

          {/* Projects */}
          <section id="projects" className="w-full max-w-[916px]">
            <Headline label="Projects" title="プロジェクト" />
            <ProjectsList sidebarCollapsed={sidebarCollapsed} />
          </section>

          {/* Skills */}
          <section id="skills" className="mb-10 w-full">
            {/* 見出し+タブ: 他セクションと同じ最大幅・中央寄せ */}
            <div className="mx-auto w-full max-w-[916px]">
              <Headline label="Skills" title="スキル" />
            </div>
            <div className="flex flex-col items-center gap-10 w-full">
              <TabBar
                tabs={SKILL_TABS}
                defaultActiveId="experience-chart"
                onChange={setSkillsTabId}
              />
              {skillsTabId === "level-chart" ? (
                <SkillsRadarChart />
              ) : (
                <div className="self-start -ml-6 lg:-ml-8 xl:-ml-10 w-[calc(100%+48px)] lg:w-[calc(100%+64px)] xl:w-[calc(100%+80px)]">
                  <SkillsCardGrid />
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
    </PasswordGate>
  );
}
