// サーバー専用（ビルド時に fs で public/ を読む）。クライアントコンポーネントからは import しないこと。
import fs from "fs";
import path from "path";
import { ICON_SETS } from "@/components/Icon";
import type { IconCatalog } from "./iconCatalogTypes";

function readSvgNames(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".svg"))
      .map((f) => f.slice(0, -4))
      .sort();
  } catch {
    return [];
  }
}

export function getIconCatalog(): IconCatalog {
  return ICON_SETS.map((set) => ({
    set,
    names: readSvgNames(path.join(process.cwd(), "public", "icons", set)),
  })).filter((e) => e.names.length > 0);
}

export function getLogoSlugs(): string[] {
  return readSvgNames(path.join(process.cwd(), "public", "logos"));
}
