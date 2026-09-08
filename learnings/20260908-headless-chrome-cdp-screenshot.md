# ブラウザペインが非表示のときの目視証拠はヘッドレス Chrome + CDP で撮る

- 日付: 2026-09-08
- 文脈: フォーカスリングとプレースホルダ色の是正(PR: fix/20260908-a11y-focus-placeholder)で、実描画のスクショが要った

## 事実(実測)
1. Claude_Browser の `screenshot` は、ペインが非表示(`tabs_context` が "currently hidden")だと真っ黒の画像を返す。`tabs_select` で前面に出しても変わらない。スクロール系の操作は 30 秒でタイムアウトする。JS 実行(`javascript_tool`)は非表示でも動く。
2. 同ペインの `key: "Tab"` は DOM の Tab 順どおりに進まなかった(サイドバーの `a` を飛ばして本文奥のボタンに着地)。キーボード操作の検証には使えない。
3. 代替: `/Applications/Google Chrome.app` を `--headless=new --remote-debugging-port=9333` で起動し、Node 22+ の組み込み `WebSocket` で CDP を直接叩く。依存追加なし(§2-2 に触れない)。
   - `Emulation.setFocusEmulationEnabled` を有効にしないと `:focus-visible` が偽のまま(ヘッドレスはウィンドウ非アクティブ扱い)
   - `Input.dispatchKeyEvent` で Tab を送ると本物のキーボードフォーカスになる。`el.focus({focusVisible:true})` でも可
   - `transition-all duration-300` が付いた要素は、フォーカス直後に computed style を読むと遷移前の値(box-shadow 0px)が返る。700ms 以上待ってから読む
   - `Page.captureScreenshot` の `clip` で必要な領域だけ切り出せる
4. `.next/static/chunks/*.css` に対象ユーティリティが「存在する」ことは置換の証拠にならない。Tailwind v4 が `docs/**/*.md` と `_to_delete/` も走査していて、文書に書かれたクラス名(置換前の値を含む)が全部 CSS に乗る。ソース側の grep と実描画で裏を取る。

## 運用
- 見た目の確認(memory: verify-visuals-via-live-preview)は、ペインが黒いときにあきらめず、ヘッドレス Chrome で撮る。スクリプトの雛形はこのセッションの scratchpad `shot.mjs`(約 45 行: 新規タブ → navigate → load 待ち → Tab 送出 → `Runtime.evaluate` → `captureScreenshot`)。
- dev サーバーと同時に動かしてよい(ただのクライアント)。終わったら `pkill -f remote-debugging-port=9333`。
