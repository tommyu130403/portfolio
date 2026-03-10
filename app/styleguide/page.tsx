import fs from "fs";
import path from "path";
import { StyleguideLayout } from "./StyleguideLayout";

export const metadata = {
  title: "Style Guide | Portfolio",
};

/** プロジェクト内で実際に使用しているアイコンセット */
const USED_ICON_SETS = [
  "Base",
  "Arrows",
  "Character",
  "Peoples",
  "Time",
  "Charts",
  "Build",
] as const;

function getIconNames(setName: string): string[] {
  const dir = path.join(process.cwd(), "public", "icons", setName);
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".svg"))
      .map((f) => f.replace(".svg", ""))
      .sort();
  } catch {
    return [];
  }
}

export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <div className="min-h-screen bg-[#212121] flex items-center justify-center">
        <div className="text-center px-8">
          <p className="text-[12px] tracking-[0.6px] text-[#48f4be] mb-2">Portfolio</p>
          <p className="text-white text-[24px] font-semibold mb-4">このページは利用できません</p>
          <p className="text-white/40 text-[14px]">本番環境ではスタイルガイドにアクセスできません。</p>
          <a href="/" className="mt-8 inline-block text-[14px] text-[#48f4be] underline">
            トップページへ戻る
          </a>
        </div>
      </div>
    );
  }

  const iconSets = USED_ICON_SETS.map((name) => ({
    name,
    icons: getIconNames(name),
  }));

  return <StyleguideLayout iconSets={iconSets} />;
}
