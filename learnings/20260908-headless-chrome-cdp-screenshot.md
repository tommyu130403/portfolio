# ブラウザペインが非表示のときの目視証拠はヘッドレス Chrome + CDP で撮る

- 文脈: フォーカスリングとプレースホルダ色の是正（PR #83）で実描画のスクショが要ったが、Claude_Browser のペインが非表示だった。
- 観測: `tabs_context` が "currently hidden" のとき `screenshot` は真っ黒の画像を返し、`tabs_select` で前面に出しても変わらない。スクロール系の操作は 30 秒でタイムアウトする。JS 実行（`javascript_tool`）は非表示でも動く。同ペインの `key: "Tab"` は DOM の Tab 順どおりに進まず、サイドバーの `a` を飛ばして本文奥のボタンに着地した。`/Applications/Google Chrome.app` を `--headless=new --remote-debugging-port=9333` で起動し、Node 22+ の組み込み `WebSocket` で CDP を直接叩くと撮れた（依存追加なし）。ヘッドレスはウィンドウ非アクティブ扱いなので `Emulation.setFocusEmulationEnabled` を有効にしないと `:focus-visible` が偽のまま。`Input.dispatchKeyEvent` で Tab を送ると本物のキーボードフォーカスになる。`transition-all duration-300` が付いた要素はフォーカス直後に computed style を読むと遷移前の値（box-shadow 0px）が返り、700ms 待つと正しい値になった。
- 結論: ペインが黒いときはあきらめず `scripts/shot.mjs`（新規タブ → navigate → load 待ち → `TABS=N` で Tab 送出 → `Runtime.evaluate` → `Page.captureScreenshot` の clip）で撮る。dev サーバーと同時に動かしてよい（ただのクライアント）。終わったら `pkill -f remote-debugging-port=9333`。
- 事実確認: VERIFIED（2026-09-08、実行して観測）。
