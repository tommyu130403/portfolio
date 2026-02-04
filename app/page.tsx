import Icon from "../components/Icon";
import RadarChart, {
  type RadarChartData,
  type RadarLegendItem,
} from "@/components/SkillsRadarChart";

const PRIMARY_BG = "#212121";
const BORDER_COLOR = "#424242";
const ACCENT = "#48F4BE";
const BODY_SUB = "#9E9E9E";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=800&q=80";
const PROJECT_IMAGE =
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80";

const skillsRadarData: RadarChartData[] = [
  { label: "Information Architecture", value: 0.9, highlighted: true },
  { label: "Interaction Design", value: 0.95, highlighted: true },
  { label: "Visual Design", value: 0.85 },
  { label: "Prototyping", value: 0.8 },
  { label: "Presentation", value: 0.75 },
  { label: "UX Research (Qualitative)", value: 0.7 },
  { label: "UX Research (Quantitative)", value: 0.65 },
  { label: "Strategy", value: 0.8 },
  { label: "Accessibility", value: 0.6 },
  { label: "Facilitation", value: 0.7 },
  { label: "Implementation", value: 0.65 },
  { label: "Writing", value: 0.7 },
];

const skillsLegend: RadarLegendItem[] = [
  {
    label: "現在のスキルレベル",
    color: "#326960",
  },
];

export default function Home() {
  return (
    <div
      className="flex min-h-screen items-start bg-[#212121] text-white"
      style={{ backgroundColor: PRIMARY_BG }}
    >
      {/* Side Menu */}
      <aside
        className="sticky top-0 flex h-screen w-64 flex-col gap-6 rounded-xl border-r border-[#424242] bg-[#212121] p-6"
        style={{ borderColor: BORDER_COLOR, backgroundColor: PRIMARY_BG }}
      >
        <p
          className="text-center text-2xl leading-8 tracking-[0.07px]"
          style={{ color: ACCENT }}
        >
          Portfolio
        </p>

        <div className="flex items-center gap-3">
          <div className="h-11 w-11 overflow-hidden rounded-full bg-slate-500" />
          <div className="flex flex-1 flex-col">
            <span className="text-[10px] uppercase tracking-[0.4px] text-white/50">
              Product Designer
            </span>
            <span className="text-sm text-white/80">Yu Tomita</span>
          </div>
        </div>

        <div
          className="h-px w-full rounded-sm"
          style={{ backgroundColor: BORDER_COLOR }}
        />

        <nav className="flex flex-1 flex-col gap-2 text-sm">
          <p className="px-3 text-[10px] uppercase tracking-[0.4px] text-white/50">
            Profile
          </p>
          <button className="flex w-52 items-center gap-3 rounded-md px-3 py-2 text-[15px] tracking-[0.75px] text-white/50">
            <Icon
              set="Peoples"
              name="user"
              className="h-[18px] w-[18px]"
            />
            Introduction
          </button>
          <button className="flex w-52 items-center gap-3 rounded-md px-3 py-2 text-[15px] tracking-[0.75px] text-[#E0E0E0]">
            <Icon
              set="Edit"
              name="list-top"
              className="h-[18px] w-[18px]"
            />
            Career
          </button>
          <button className="flex w-52 items-center justify-between gap-3 rounded-md bg-white/5 px-3 py-2 text-[15px] tracking-[0.75px] text-[#E0E0E0]">
            <span className="flex items-center gap-3">
              <Icon
                set="Charts"
                name="ranking"
                className="h-[18px] w-[18px]"
              />
              Projects
            </span>
            <Icon
              set="Arrows"
              name="down"
              className="h-4 w-4"
            />
          </button>

          <p className="mt-4 px-3 text-[10px] uppercase tracking-[0.4px] text-white/50">
            Social
          </p>
          <button className="flex w-52 items-center gap-3 rounded-md px-3 py-2 text-[15px] tracking-[0.75px] text-white/50">
            <Icon
              set="Peoples"
              name="user"
              className="h-[18px] w-[18px]"
            />
            Profile
          </button>
        </nav>

        <button className="mt-auto flex w-52 items-center gap-3 rounded-md px-3 py-2 text-[15px] tracking-[0.75px] text-white/50">
          <Icon
            set="Office"
            name="mail"
            className="h-[18px] w-[18px]"
          />
          Contact
        </button>
      </aside>

      {/* Main content */}
      <main className="relative z-[1] flex flex-1 items-start">
        <div className="mx-auto flex min-h-screen w-full max-w-[916px] flex-col gap-[120px] px-10 py-20">
          {/* Hero */}
          <section className="flex gap-20">
            <div className="flex flex-1 flex-col gap-6">
              <div className="flex h-32 flex-col gap-2">
                <p className="text-base leading-6 text-white">Product Designer</p>
                <p
                  className="text-[60px] leading-[60px] tracking-[0.26px]"
                  style={{ color: "#B3FFE7" }}
                >
                  山田 太郎
                </p>
                <p className="text-[20px] leading-7 text-white tracking-[-0.45px]">
                  Taro Yamada
                </p>
              </div>
              <p className="max-w-xl text-[17px] leading-relaxed tracking-[0.85px] text-white">
                ユーザー体験を最優先に考え、美しく使いやすいデザインを創造します。5年以上の経験を活かし、ビジネスゴールとユーザーニーズを両立するソリューションを提供します。
              </p>
              <button className="flex items-center gap-2 text-[16px] leading-6 tracking-[-0.31px] text-[var(--main-base,#48F4BE)]">
                <span className="font-semibold" style={{ color: ACCENT }}>
                  View more
                </span>
                <span className="inline-block h-5 w-5 rounded-full border border-[rgba(72,244,190,0.7)]" />
              </button>
            </div>

            <div className="relative aspect-square max-h-[400px] max-w-[400px] flex-1 overflow-hidden rounded-[32px]">
              <img
                src={HERO_IMAGE}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            </div>
          </section>

          {/* Introduction */}
          <section className="flex flex-col items-center">
            <div className="w-full max-w-[916px] min-w-[728px] space-y-6">
              <div className="space-y-2 pb-6">
                <p
                  className="text-xs tracking-[0.6px]"
                  style={{ color: ACCENT }}
                >
                  Introduction
                </p>
                <p className="text-[32px] tracking-[1.6px]">自己紹介</p>
                <div
                  className="h-[2px] w-10 rounded"
                  style={{ backgroundColor: BORDER_COLOR }}
                />
              </div>
              <div className="space-y-4 text-[17px] leading-relaxed tracking-[0.85px]">
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
            </div>
          </section>

          {/* Career */}
          <section className="flex flex-col items-center">
            <div className="w-full max-w-[916px] min-w-[728px] space-y-10">
              <div className="space-y-2 pb-6">
                <p
                  className="text-xs tracking-[0.6px]"
                  style={{ color: ACCENT }}
                >
                  Career
                </p>
                <p className="text-[32px] tracking-[1.6px]">経歴</p>
                <div
                  className="h-[2px] w-10 rounded"
                  style={{ backgroundColor: BORDER_COLOR }}
                />
              </div>
              <p className="text-[17px] leading-relaxed tracking-[0.85px]">
                こんにちは。UI/UXデザイナーの山田太郎です。東京を拠点に、Webサイト、モバイルアプリケーション、ブランディングなど、幅広いデジタルプロダクトのデザインを手がけています。
              </p>

              <div className="space-y-8">
                <div className="flex gap-6">
                  <div className="flex flex-col items-center gap-2 pt-3">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: ACCENT }}
                    />
                    <span
                      className="h-full w-[2px] rounded bg-[#424242]"
                      style={{ backgroundColor: BORDER_COLOR }}
                    />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-10">
                      <div className="space-y-1">
                        <p
                          className="text-[20px]"
                          style={{ color: ACCENT }}
                        >
                          シニアUI/UXデザイナー
                        </p>
                        <p className="text-sm tracking-[0.7px]" style={{ color: "#B3FFE7" }}>
                          株式会社デザインスタジオ
                        </p>
                      </div>
                      <p
                        className="flex items-center gap-2 text-sm tracking-tight"
                        style={{ color: BODY_SUB }}
                      >
                        2022年4月 - 現在
                      </p>
                    </div>
                    <p className="text-sm leading-relaxed tracking-[0.7px]">
                      大手企業向けのWebアプリケーションやモバイルアプリのUI/UXデザインを担当。デザインシステムの構築やデザインチームのマネジメントにも従事。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Projects */}
          <section className="flex flex-col items-center">
            <div className="w-full max-w-[916px] min-w-[728px] space-y-8">
              <div className="space-y-2 pb-6">
                <p
                  className="text-xs tracking-[0.6px]"
                  style={{ color: ACCENT }}
                >
                  Projects
                </p>
                <p className="text-[32px] tracking-[1.6px]">プロジェクト</p>
                <div
                  className="h-[2px] w-10 rounded"
                  style={{ backgroundColor: BORDER_COLOR }}
                />
              </div>

              <div className="flex flex-wrap gap-8">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex h-[363.5px] w-[280px] flex-col overflow-hidden rounded-[14px] border border-[#424242] bg-[#212121] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]"
                  >
                    <div className="relative aspect-[339/190.6875] w-full">
                      <img
                        src={PROJECT_IMAGE}
                        alt="Project"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-6">
                      <div className="space-y-1">
                        <div className="flex h-5 items-center justify-between">
                          <p className="flex-1 text-[12px] tracking-[0.6px]" style={{ color: "#B3FFE7" }}>
                            プラットフォーム開発
                          </p>
                          <Icon
                            set="Base"
                            name="more"
                            className="h-4 w-4"
                          />
                        </div>
                        <div className="text-[17px] leading-[1.5] tracking-[0.85px]">
                          {i === 1 && (
                            <>
                              <p className="mb-0">キャリアチケットスカウトサービスの立ち上げ</p>
                              <p>(ベータ版リリース)</p>
                            </>
                          )}
                          {i === 2 && (
                            <>
                              <p className="mb-0">キャリアチケットスカウト</p>
                              <p>正規版</p>
                            </>
                          )}
                          {i === 3 && <p>ECサイトリニューアル</p>}
                          {i === 4 && <p>ECサイトリニューアル（別案件）</p>}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <div className="flex items-center justify-center rounded-full bg-[#02140d] px-3 py-[3px]">
                          <p className="text-[12px] leading-4" style={{ color: "#1E765A" }}>
                            UI Design
                          </p>
                        </div>
                        <div className="flex items-center justify-center rounded-full bg-[#02140d] px-3 py-[3px]">
                          <p className="text-[12px] leading-4" style={{ color: "#1E765A" }}>
                            Project Management
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Skills */}
          <section className="mb-10 flex flex-col items-center">
            <div className="w-full max-w-[916px] min-w-[728px] space-y-8">
              <div className="space-y-2 pb-6">
                <p
                  className="text-xs tracking-[0.6px]"
                  style={{ color: ACCENT }}
                >
                  Skills
                </p>
                <p className="text-[32px] tracking-[1.6px]">スキル</p>
                <div
                  className="h-[2px] w-10 rounded"
                  style={{ backgroundColor: BORDER_COLOR }}
                />
              </div>

              {/* Tab bar */}
              <div className="flex w-full items-center gap-3 rounded-lg bg-white/5 px-1 py-1">
                <button className="flex items-center gap-2 rounded-md px-6 py-2 text-sm tracking-[0.7px] text-[#9E9E9E]">
                  <Icon
                    set="Peoples"
                    name="every-user"
                    className="h-[18px] w-[18px]"
                  />
                  People Management
                </button>
                <button className="flex items-center gap-2 rounded-md border border-[#424242] bg-white/5 px-6 py-2 text-sm font-semibold tracking-[0.7px] text-white">
                  <Icon
                    set="Edit"
                    name="writing-fluently"
                    className="h-[18px] w-[18px]"
                  />
                  Product Design
                </button>
              </div>

              {/* Radar chart placeholder */}
              <div className="flex justify-center">
                <div className="flex h-[320px] w-full max-w-[645px] items-center justify-center rounded-2xl border border-[#424242] bg-[#181818] px-6 py-4">
                  <RadarChart data={skillsRadarData} legendItems={skillsLegend} />
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

