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
  const iconSets = USED_ICON_SETS.map((name) => ({
    name,
    icons: getIconNames(name),
  }));

  return <StyleguideLayout iconSets={iconSets} />;
}
