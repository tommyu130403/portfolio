# Tailwind v4 は docs/ と _to_delete/ も走査するので「生成 CSS にクラスがある」は置換の証拠にならない

- 文脈: PR #83 / #84 でクラス名を置換したあと、置換先ユーティリティが生成 CSS に実在するかを確認しようとした。
- 観測: `.next/static/chunks/*.css` に、ソース（.ts / .tsx）では 0 件の `placeholder-[#616161]` `placeholder-system-800` `focus-visible:ring-border-light` が出力されていた。発生源は `docs/requests/20260908-a11y-and-app-tokenize.md` と `_to_delete/.pr62-full.diff` に書かれたクラス名。`app/globals.css` は `@import "tailwindcss"` のみで `@source not` が無く、`git check-ignore` で `docs/` `_to_delete/` `learnings/` はどれも ignore されていない。非ソース由来の CSS は 3,351 B（dev ビルドの globals CSS 69,465 B に対して 4.8%、本番チャンク 53,645 B に対して 6.2%）。
- 結論: 置換の成否はソース側の grep と実描画（computed style のヒストグラム）で裏を取り、生成 CSS の有無を根拠にしない。根本対処は `@source not "../docs"` 等で走査対象から外すこと（別タスクで対応中）。
- 事実確認: VERIFIED（2026-09-08、oxide Scanner と生成 CSS の grep で観測）。
