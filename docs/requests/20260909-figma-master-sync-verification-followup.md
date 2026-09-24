# Figma Master 同期 — 不合格是正・再検証プロンプト

以下を新しいセッションの最初のメッセージとしてそのまま使用する。

```text
portfolio リポジトリ（/Users/tommyu/Dev/portfolio）で、Figma Master 同期
PR #88 / #89 / #90 の独立検証で見つかった不合格2件を是正し、未確認2件を
再検証してほしい。今回は実装者として最小限の修正を行い、最後に別コンテキストの
QA検証も実施すること。

【最初に全文を読む】
1. docs/20260909-figma-master-sync-verification-report.md
2. docs/20260909-figma-master-sync-test-spec.md
3. docs/requests/20260908-figma-master-sync.md
   - §6と各Phaseの「未達・未確認」を必ず読む
4. learnings/20260908-headless-chrome-cdp-screenshot.md

【対象】
- ブランチ: style/20260908-figma-master-layout
- PR #88 / #89 / #90 の変更がすべて載っている
- 実データのWork:
  http://localhost:3000/works?id=c5b71719-c894-4678-9785-26887c0021b3

【今回の必須対応】
1. L-4（VERIFIED FAIL）
   - 1440pxでsection#skillsのmaxWidthがnone、幅1104pxだった。
   - 期待値は各<section>のmaxWidth 800px。
   - 内側だけでなくsection自体の責務を確認すること。
   - Figmaまたはページ構造上、sectionを800pxにすることが意図と衝突する場合は、
     勝手に仕様を変えず、根拠を示して判断を求めること。

2. W-12（VERIFIED FAIL）
   - 54文字のroleでscrollWidth 585 > clientWidth 576となり9px溢れた。
   - title属性には全文が入っている。
   - 3行固定、行高40px、右端の24×24ボタン、title全文保持を壊さず、
     scrollWidth === clientWidthにすること。
   - 再現文字列:
     リードUI/UXデザイナー・プロジェクトマネージャーとして情報設計・検証・実装連携・品質保証まで一貫して担当

3. R-5（未確認）
   - 固定前後ナビはtabIndex=0、マウスクリックではURL変更とscrollY 0を確認済み。
   - 実ブラウザでTabにより「前のWork」「次のWork」へ到達し、EnterでURLの?id=が
     変わり、scrollYが0になることを確認すること。
   - 再現しない場合は自動操作環境の制約と実装不具合を切り分けること。

4. R-9（未確認）
   - /admin/works/editは現在alert 0、横overflowなし、本文previewあり。
   - WorkSectionsの既定値はgap-[120px] / withDividers=falseである。
   - 比較可能な過去版またはbase commitを同一viewportで描画し、本文previewの
     視覚的な退行がないことを比較すること。裏を取れなければ未確認のままにする。

【保持する回帰条件】
- §4-2 / §4-3のtext style 19種は、19件をスクリプトで機械比較する。
- §4-5 T-8は、text styleと旧text-[Npx] / leading-* / tracking-* /
  font-bold等の併記が0件であることをgrepで確認する。
- §7-3は375 / 768 / 1024 / 1090 / 1280 / 1440の6幅すべてで再実測する。
- §8 R-1のトップページhrefは#introductionのまま維持する。
  /#introductionへ変わったら退行。
- §9の既知の未対応は今回の不合格にしない。修正対象へ混ぜない。

【環境・安全】
- dev serverはPreviewのname: portfolio-devで起動する。Bashからnpm run devを
  直接起動しない。
- dev server稼働中に.nextを消さない。
- buildはNEXT_DIST_DIR=.next-verify npm run checkを使うかworktreeで隔離する。
- prettierを実行しない。
- 次の未追跡ファイルには触らない:
  .codex/config.toml / _to_delete/ / figma-skills-a-plan.js /
  docs/figma-color-token-sync-prompt.md / supabase/.temp/ /
  learnings/20260906-cowork-figma-unreachable.md
- /styleguideのサンプルデータを一時変更したら必ず元へ戻す。
- push、merge、PR作成は依頼者の明示承認なしに行わない。

【検証】
1. NEXT_DIST_DIR=.next-verify npm run check
2. L-4とW-12の再現テスト
3. §7-3の6幅
4. R-1、R-5、R-9
5. git diffとgit statusで一時変更・デバッグ残骸がないことを確認
6. 新規実装をfresh-contextのQA verifierに反証させる

【報告形式】
1. 変更ファイルと変更理由
2. L-4 / W-12 / R-5 / R-9の判定表
   - ID / 判定 / 観測値 / 期待値 / 実行コマンド
3. 回帰テストの実測結果
4. QA verifierの指摘と対応
5. 未確認・残存リスク
6. git diff / git status
7. 総合判定（合格 / 修正必要）

観測できなかったものを合格にしない。スクリーンショットの目視だけで寸法や
computed styleを合格にしない。実装と検証結果を同じ主張として混ぜず、
VERIFIED / REASONED / 未確認を区別すること。
```
