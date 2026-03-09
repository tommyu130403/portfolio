import SideMenuBar from "@/components/SideMenuBar";
import Headline from "@/components/Headline";
import HistoryItem from "@/components/HistoryItem";
import ProjectCard from "@/components/ProjectCard";
import TabBar from "@/components/TabBar";
import SkillsRadarChart from "@/src/components/SkillsRadarChart";
import Icon from "@/components/Icon";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=800&q=80";
const PROJECT_IMAGE =
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80";

const SKILL_TABS = [
  { id: "people", label: "People Management", icon: { set: "Peoples" as const, name: "every-user" } },
  { id: "product-design", label: "Product Design", icon: { set: "Edit" as const, name: "writing-fluently" } },
  { id: "product-management", label: "Product Management", icon: { set: "Abstract" as const, name: "coordinate-system" } },
];

const CAREER = [
  {
    role: "シニアUI/UXデザイナー",
    company: "株式会社デザインスタジオ",
    period: "2022年4月 - 現在",
    description:
      "大手企業向けのWebアプリケーションやモバイルアプリのUI/UXデザインを担当。デザインシステムの構築やデザインチームのマネジメントにも従事。",
  },
  {
    role: "UI/UXデザイナー",
    company: "株式会社クリエイティブ",
    period: "2019年4月 - 2022年3月",
    description: "スタートアップ向けのプロダクトデザインに携わり、0→1のプロダクト開発を経験。",
  },
];

const PROJECTS = [
  {
    category: "プラットフォーム開発",
    title: "キャリアチケットスカウトサービスの立ち上げ（ベータ版リリース）",
    tags: ["UI Design", "Project Management"],
    image: PROJECT_IMAGE,
  },
  {
    category: "プラットフォーム開発",
    title: "キャリアチケットスカウト正規版",
    tags: ["UI Design", "UX Research"],
    image: PROJECT_IMAGE,
  },
  {
    category: "組織開発",
    title: "ECサイトリニューアル",
    tags: ["UI Design", "Product Design"],
    image: PROJECT_IMAGE,
  },
  {
    category: "Webデザイン",
    title: "ECサイトリニューアル",
    tags: ["UI Design", "Webデザイン"],
    image: PROJECT_IMAGE,
  },
  {
    category: "Webデザイン",
    title: "ECサイトリニューアル",
    tags: ["UI Design", "Webデザイン", "UX Research"],
    image: PROJECT_IMAGE,
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen items-start bg-[#212121] text-white">
      {/* Side Menu */}
      <div className="sticky top-0 shrink-0 z-[2]">
        <SideMenuBar />
      </div>

      {/* Main content */}
      <main className="relative z-[1] flex flex-1 items-start overflow-hidden">
        <div className="flex w-full flex-col items-center gap-[120px] overflow-clip px-10 py-20">
          {/* Hero */}
          <section className="flex w-full max-w-[916px] min-w-[728px] items-center gap-20">
            <div className="flex flex-1 flex-col gap-6">
              <div className="flex flex-col gap-2">
                <p className="text-[16px] leading-6 text-white">Product Designer</p>
                <p className="text-[60px] leading-[60px] tracking-[0.26px] text-[#b3ffe7]">
                  山田 太郎
                </p>
                <p className="text-[20px] leading-7 tracking-[-0.45px] text-white">Taro Yamada</p>
              </div>
              <p className="text-[17px] leading-relaxed tracking-[0.85px] text-white">
                ユーザー体験を最優先に考え、美しく使いやすいデザインを創造します。5年以上の経験を活かし、ビジネスゴールとユーザーニーズを両立するソリューションを提供します。
              </p>
              <button className="flex items-center gap-2 text-[16px] font-semibold leading-6 tracking-[-0.31px] text-[#48f4be]">
                View more
                <Icon set="Arrows" name="right" className="h-5 w-5" />
              </button>
            </div>
            <div className="relative aspect-square max-h-[400px] max-w-[400px] flex-1 overflow-hidden rounded-[32px]">
              <img src={HERO_IMAGE} alt="Profile" className="h-full w-full object-cover" />
            </div>
          </section>

          {/* Introduction */}
          <section className="w-full max-w-[916px] min-w-[728px]">
            <Headline label="Introduction" title="自己紹介" />
            <div className="flex flex-col gap-4 text-[17px] leading-relaxed tracking-[0.85px] text-white">
              <p>
                こんにちは。UI/UXデザイナーの山田太郎です。東京を拠点に、Webサイト、モバイルアプリケーション、ブランディングなど、幅広いデジタルプロダクトのデザインを手がけています。
              </p>
              <p>
                美大でグラフィックデザインを学んだ後、デジタル領域に興味を持ち、UI/UXデザインの世界に飛び込みました。ユーザーリサーチから始まり、情報設計、ビジュアルデザイン、プロトタイピング、ユーザビリティテストまで、デザインプロセス全体に関わることを大切にしています。
              </p>
              <p>
                デザインは問題解決の手段であると考えており、常にユーザーの課題とビジネスの目標の両方を意識しながら制作を進めています。また、開発チームとの密なコミュニケーションを通じて、実現可能性の高いデザインソリューションを提供することを心がけています。
              </p>
            </div>
          </section>

          {/* Career */}
          <section className="w-full max-w-[916px] min-w-[728px]">
            <Headline label="Career" title="経歴" />
            <div className="flex flex-col gap-10">
              <p className="text-[17px] leading-relaxed tracking-[0.85px] text-white">
                こんにちは。UI/UXデザイナーの山田太郎です。東京を拠点に、Webサイト、モバイルアプリケーション、ブランディングなど、幅広いデジタルプロダクトのデザインを手がけています。
              </p>
              <div className="flex flex-col gap-8">
                {CAREER.map((item) => (
                  <HistoryItem key={item.role + item.company} {...item} />
                ))}
              </div>
            </div>
          </section>

          {/* Projects */}
          <section className="w-full max-w-[916px] min-w-[728px]">
            <Headline label="Projects" title="プロジェクト" />
            <div className="flex flex-wrap gap-8">
              {PROJECTS.map((project, i) => (
                <ProjectCard key={i} {...project} />
              ))}
            </div>
          </section>

          {/* Skills */}
          <section className="mb-10 w-full max-w-[916px] min-w-[728px]">
            <Headline label="Skills" title="スキル" />
            <div className="flex flex-col items-center gap-10">
              <TabBar tabs={SKILL_TABS} defaultActiveId="product-design" />
              <SkillsRadarChart />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
