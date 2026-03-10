import type { NextConfig } from "next";

const basePath = process.env.NODE_ENV === 'production' ? '/portfolio' : '';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  basePath,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  // textlint の一部ルール (kuromoji 等) は webpack でバンドルせず
  // Node.js ランタイムの require に任せる
  serverExternalPackages: [
    "kuromoji",
    "textlint-rule-no-doubled-joshi",
    "@textlint/kernel",
    "@textlint/textlint-plugin-text",
    "textlint-rule-ja-no-abusage",
    "textlint-rule-ja-no-mixed-period",
    "textlint-rule-ja-no-redundant-expression",
    "textlint-rule-no-nfd",
  ],
};

export default nextConfig;