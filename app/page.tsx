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
const DEFAULT_CAREER_LEAD =
  "こんにちは。UI/UXデザイナーの山田太郎です。 東京を拠点に、Webサイト、モバイルアプリケーション、ブランディングなど、 幅広いデジタルプロダクトのデザインを手がけています。";

type Profile = Tables<"profile">;
type CareerItem = Tables<"career_items">;

export default function Home() {
  const [activeSection, setActiveSection] = useState<SideMenuSectionId>("introduction");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // SSR との不一致を防ぐため、ウィンドウ幅による初期値はハイドレーション後に設定する
  useEffect(() => {
    setSidebarCollapsed(window.innerWidth < 1024);
  }, []);
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
          <section className="flex w-full max-w-[916px] items-center gap-16">
            <div className="relative aspect-square flex-1 max-w-[200px] max-h-[200px] shrink-0 overflow-hidden rounded-[32px]">
              {loading ? (
                <div className="h-full w-full animate-pulse bg-[#424242]" />
              ) : (
                <img src={profile?.hero_image_url} alt="Profile" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex flex-1 flex-col gap-6">
              <div className="flex flex-col gap-2">
                <p className="text-[16px] leading-6 text-[#9e9e9e]">
                  {loading ? <span className="inline-block h-4 w-32 animate-pulse rounded bg-[#424242]" /> : profile?.title}
                </p>
                <div className="flex items-end gap-2 text-[#b3ffe7]">
                  <p className="font-mplus text-[46px] leading-[60px] tracking-[0.26px]">
                    {loading ? <span className="inline-block h-[60px] w-64 animate-pulse rounded bg-[#424242]" /> : profile?.name_jp}
                  </p>
                  <p className="text-[20px] leading-7 tracking-[-0.45px]">
                    {loading ? <span className="inline-block h-6 w-40 animate-pulse rounded bg-[#424242]" /> : profile?.name_en}
                  </p>
                </div>
              </div>
              <p className="text-[15px] leading-[1.5] tracking-[0.45px] text-white">
                {loading ? (
                  <span className="inline-block h-20 w-full animate-pulse rounded bg-[#424242]" />
                ) : profile?.bio}
              </p>
            </div>
          </section>

          {/* Introduction */}
          <section id="introduction" className="w-full max-w-[916px]">
            <Headline label="Introduction" title="自己紹介" />
            <div className="flex flex-col gap-10 text-[15px] leading-[1.5] tracking-[0.45px] text-white">
              {/* Opening paragraphs */}
              <div className="flex flex-col gap-4">
                <p>こんにちは。プロダクトデザイナーの山田太郎です。 大学では主にIoTの分野を中心に人間工学やHCD(人間中心設計)を学びものづくり全般に関わる専門性を学び、新卒で入社したレバレジーズではWebサイト・アプリケーションの設計と開発、CROの改善など、 幅広いデジタルプロダクトのグロースに携わってきました。</p>
                <p>デザインは問題解決の手段であると考えており、 常にユーザーの課題とビジネスの目標の両方を意識しながらデザイン制作を行ってきました。 開発チームやセールスチームといったあらゆる専門性との密なコミュニケーションを通じて、「最適解」を徹底的に模索することを心がけています。</p>
              </div>

              {/* My Philosophy */}
              <div className="flex flex-col gap-6">
                <div className="flex items-start gap-2 w-full">
                  <div className="flex items-center self-stretch py-2">
                    <div className="w-[3px] h-full rounded-[2px] bg-[#48f4be]" />
                  </div>
                  <p className="flex-1 font-bold leading-none tracking-[1.2px] text-white">
                    <span className="text-[24px] leading-[1.5]">My Philosophy </span>
                    <span className="font-mplus text-[12px] leading-[1.5] tracking-[0.6px]">大事にしていること</span>
                  </p>
                </div>
                <ul className="list-disc leading-none pl-[22.5px] flex flex-col gap-0">
                  <li><span className="leading-[1.5]">説明責任を果たす (透明性)</span></li>
                  <li><span className="leading-[1.5]">あらゆる専門性によって最適解を模索する (異能の掛け算)</span></li>
                  <li><span className="leading-[1.5]">ビジネスを作る (UXの証明)</span></li>
                </ul>
              </div>

              {/* My Aspirations */}
              <div className="flex flex-col gap-6">
                <div className="flex items-start gap-2 w-full">
                  <div className="flex items-center self-stretch py-2">
                    <div className="w-[3px] h-full rounded-[2px] bg-[#48f4be]" />
                  </div>
                  <p className="flex-1 font-bold leading-none tracking-[1.2px] text-white">
                    <span className="text-[24px] leading-[1.5]">My Aspirations </span>
                    <span className="font-mplus text-[12px] leading-[1.5] tracking-[0.6px]">挑戦したいこと</span>
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <p>キャリアのほとんどを「キャリアチケット」プロダクトに貢献してきました。立ち上げからグロースに至るまで自ら志願して関わり続けてきたのは、この事業が持つ価値に深く共感し、市場の課題を解決できるプロダクトだと信じることができていたからです。何より、その価値を自分たちで定義し高め合おうとする組織の文化に非常に誇りをもっていました。</p>
                  <p>どのようなステージやプロダクトであっても、常に「開拓者」であり続け、プロダクトの真の価値を問い続け、関係者全員が同じ方向を向いていけるようなチームを築いていくことが私の使命であると考えています。</p>
                </div>
              </div>
            </div>
          </section>

          {/* Career */}
          <section id="career" className="w-full max-w-[916px]">
            <Headline label="Career" title="経歴" />
            <div className="flex flex-col gap-6">
              <p className="text-[15px] leading-[1.5] tracking-[0.45px] text-white">
                {loading ? (
                  <span className="inline-block h-12 w-full animate-pulse rounded bg-[#424242]" />
                ) : (
                  (profile?.career_lead ?? "").trim() || DEFAULT_CAREER_LEAD
                )}
              </p>
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
                <div className="w-full max-w-[916px]">
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
