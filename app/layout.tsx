import type { Metadata } from "next";
// フォントはリポジトリに同梱したものを配る(取得元・ライセンスは app/fonts/fonts.css の冒頭)。
// 英字: Afacad / 日本語本文: Noto Sans JP / Avenir の代替: Figtree / 等幅: Geist Mono
import "./fonts/fonts.css";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

// GitHub Pages プロジェクトサイト（basePath: /portfolio）を想定した公開URL。
// 実際のデプロイ先が異なる場合はここを差し替える。
const siteUrl = "https://tommyu130403.github.io/portfolio";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Yu Tomita — Portfolio",
    template: "%s | Yu Tomita",
  },
  description:
    "Yu Tomita のポートフォリオ。プロダクトデザインとフロントエンド開発を横断した制作・企画の実績、経歴、スキルをまとめています。",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "Yu Tomita — Portfolio",
    title: "Yu Tomita — Portfolio",
    description:
      "プロダクトデザインとフロントエンド開発を横断した制作・企画の実績、経歴、スキルをまとめたポートフォリオ。",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Yu Tomita — Portfolio",
    description:
      "プロダクトデザインとフロントエンド開発を横断した制作・企画の実績をまとめたポートフォリオ。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // globals.css の scroll-behavior: smooth を、Next.js が画面切り替え中だけ外せるようにする目印
    <html lang="ja" data-scroll-behavior="smooth">
      <body
        className="antialiased"
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
