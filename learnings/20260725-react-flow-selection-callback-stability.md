# React Flow の選択コールバックは参照と更新値を安定させる

- 文脈: React Flow エディタで `onSelectionChange` にインライン関数を渡し、毎回新しい選択オブジェクトを state に設定していた。
- 観測: ノード追加後に `Maximum update depth exceeded` が発生した。コールバックを `useCallback` で固定し、選択 ID が変わった場合だけ state を更新すると再現せず、保存・再読み込み・ノード選択を完了できた。
- 結論: React Flow の選択変更を React state に同期する場合は、コールバック参照を固定し、前回値と同一なら state 更新を返さない。
- 事実確認: VERIFIED（2026-07-25、ブラウザ操作とコンソールログで観測）。
