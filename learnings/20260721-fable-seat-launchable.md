# fable モデルはこのアカウントで実起動可能

- 文脈: 検証駆動オーケストレーション構成の実装で、fable-verifier 席が実際に呼べるかが最大の不確実性だった（外れると席設計が変わる）。
- 観測: Agent tool を `model: fable` で起動し、probe が `PROBE RESULT: Claude Code on Fable 5 (claude-fable-5) / fable-probe-ok` を返した。probe の echo stdout も一致。
- 結論: `fable-verifier` を `model: fable` のまま採用してよい。opus フォールバックへの読み替えは不要。将来 fable が使えない環境では CLAUDE.md §6-3 の注記どおり opus に読み替える。
- 事実確認: VERIFIED（2026-07-21、実起動して観測）。
