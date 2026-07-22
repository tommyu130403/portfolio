import type { Metadata } from "next";
import { Afacad, Geist_Mono, Noto_Sans_JP, M_PLUS_1p } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

// 英字フォント: Afacad (variable font, 400–700)
const afacad = Afacad({
  variable: "--font-afacad",
  subsets: ["latin"],
  display: "swap",
});

// 日本語見出しフォント: M PLUS 1p (typo.guide.jp)
const mplusOnep = M_PLUS_1p({
  variable: "--font-mplus-1p",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

// 日本語本文フォント: Noto Sans JP (typo.body.jp)
const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html lang="ja">
      <body
        className={`${afacad.variable} ${mplusOnep.variable} ${notoSansJP.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
