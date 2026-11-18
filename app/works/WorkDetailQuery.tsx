"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import WorkDetailClient from "@/components/WorkDetailClient";
import { AuthGate } from "@/components/AuthGate";
import { WorkLayoutProvider } from "@/components/WorkLayoutContext";
import { parseLayoutParam, readStoredLayout, storeLayout } from "@/lib/work-detail-layout";

const noopSubscribe = () => () => {};

/**
 * クエリ文字列（?id=xxx）から Work ID を読み取り、認証ゲート越しに詳細を描画する。
 * useSearchParams() を使うため Client Component として分離し、
 * page.tsx（Server Component）側で metadata を export できるようにしている。
 *
 * レイアウトは ?layout=v1|v2 が最優先で、付いていればブラウザのタブの間だけ覚える（確認用の補助）。
 * 付いていないときは覚えた値を使い、何も無ければ既定の定数（WORK_DETAIL_LAYOUT）のまま。
 */
export default function WorkDetailQuery() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const param = parseLayoutParam(searchParams.get("layout"));
  // 保存値は useSyncExternalStore で読む: サーバー描画・ハイドレーション中は null（= 既定）を返し、
  // ブラウザでは sessionStorage を読む。ハイドレーションの不一致を起こさず、読めない環境でも null になるだけ
  const stored = useSyncExternalStore(noopSubscribe, readStoredLayout, () => null);
  useEffect(() => {
    if (param) storeLayout(param);
  }, [param]);
  const layout = param ?? stored;
  // layout が null のときも常にプロバイダーで包む（値が null なら既定の定数に落ちる）。包みを出し入れすると詳細が作り直されるため
  return (
    <WorkLayoutProvider layout={layout}>
      <AuthGate>
        <WorkDetailClient id={id} />
      </AuthGate>
    </WorkLayoutProvider>
  );
}
