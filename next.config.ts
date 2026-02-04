import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // 静的HTML出力
  basePath: '/portfolio', // リポジトリ名
  images: { unoptimized: true }, // 画像最適化無効
};

export default nextConfig;
