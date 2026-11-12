import type { Metadata } from "next";
import Link from "next/link";

/**
 * 存在しない URL を開いたときのページ（静的エクスポートでは 404.html になり、GitHub Pages が返す）。
 * Next.js 既定の英語の 404 の代わりに、日本語で存在しないことを伝え、TOP へ戻る手段を置く。
 * ログイン前でも読めるよう AuthGate では包まない（データは読まない）。
 */
export const metadata: Metadata = {
  title: "ページが見つかりません",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center text-fg">
      <h1 className="text-[20px] font-bold">ページが見つかりません</h1>
      <p className="text-[15px] text-fg-muted">お探しのページは存在しないか、移動した可能性があります。</p>
      <Link
        href="/"
        className="rounded-full border border-border px-4 py-2 text-[13px] text-fg-muted transition-colors hover:border-border-light hover:text-fg"
      >
        ‹ TOP へ戻る
      </Link>
    </main>
  );
}
