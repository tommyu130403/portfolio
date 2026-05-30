import fs from "fs";
import path from "path";
import { StyleguideLayout, type LogoData } from "./StyleguideLayout";
import { OwnerGate } from "@/components/OwnerGate";

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

/** public/logos/ のファイル一覧から LogoData を生成する */
function getLogoList(): LogoData[] {
  const dir = path.join(process.cwd(), "public", "logos");
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".svg"))
      .map((f) => {
        const name = f.replace(".svg", "");
        const label = name.charAt(0).toUpperCase() + name.slice(1);
        return { name, label };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

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

  const logos = getLogoList();

  return (
    <OwnerGate>
      <StyleguideLayout iconSets={iconSets} logos={logos} />
    </OwnerGate>
  );
}
