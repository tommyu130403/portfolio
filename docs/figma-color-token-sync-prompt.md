# Figma カラートークン同期 実装プロンプト

対象: Figma Library の Color 変数を増やした / 変えたときに、実装側トークンへ反映する作業。
実行環境: **ローカルの Claude Code**（`mcp__figma__*` が使える環境）。Cowork では実行不可（末尾「環境の制約」参照）。

---

## 1. 前提（毎回確認する）

- Figma Library: https://www.figma.com/design/KpNwkdFy1usaO1sBR0dycv/Library
- 実装側の定義ファイル
  - `lib/design-tokens.ts` … 単一の真実。`color.main / danger / warning / system` の4グループ
  - `app/globals.css` … `@theme` 内の `--color-*` と、セマンティック変数（`--color-primary` / `--color-fg` / `--color-surface` など）
  - `app/styleguide/StyleguideLayout.tsx` … Colors セクションのスウォッチ（CLAUDE.md §4 の同期ルールで更新必須）
- Figma → 実装の変換規則: RGBA(0–1) を `Math.round(v * 255)` で HEX 化（`lib/design-tokens.ts` 冒頭コメント）

---

## 2. Claude Code に貼るプロンプト（Figma → 実装）

```
Figma Library のカラー変数を増やしたので、実装側のデザイントークンへ反映してほしい。

【手順】
1. Figma Dev Mode MCP で Library ファイルの Color コレクションを取得する。
   - ファイル: https://www.figma.com/design/KpNwkdFy1usaO1sBR0dycv/Library?node-id=347-1004
   - `get_variable_defs` で Color コレクションの「全変数」を取得すること。
     選択中ノードに紐づく変数だけで判断しない（CLAUDE.md §5-1）。
2. 取得した Figma 側の色定義と、実装側の以下3ファイルを1件ずつ突き合わせ、差分表を先に出す。
   - lib/design-tokens.ts の `color`
   - app/globals.css の `@theme` 内 `--color-*`
   - app/styleguide/StyleguideLayout.tsx の Colors セクション
   差分表の列: 変数名 / Figma値 / 実装値 / 判定（新規・変更・削除・一致）
3. 差分表を提示して合意を取ってから実装に入る。特に以下は勝手に決めない:
   - 新しい色グループが増えた場合の命名（例: `info` / `success` を作るか）
   - `base` エイリアスをどのスケールに置くか
   - セマンティック変数（--color-primary 等）に新色を紐づけるかどうか
4. 合意後、3ファイルを同じ命名・同じ並び順で更新する。
   - RGBA(0–1) → HEX は Math.round(v * 255)
   - 既存トークンの値は、Figma に差分がない限り触らない
5. 検証:
   - `npx tsc --noEmit`
   - `npm run build`
   - /styleguide を開き、増えた色のスウォッチが表示されることを目視確認
   - 既存の色が意図せず変わっていないか git diff で確認

【禁止】
- Figma を確認せずに色を推測して追加すること
- 差分表の提示前にファイルを編集すること
```

---

## 3. 逆方向（実装 → Figma）が必要な場合

実装側で色を増やして Figma 変数に書き戻したい場合、**AI から自動では書き込めない**。

| 手段 | 可否 | 備考 |
|------|------|------|
| Figma Dev Mode MCP | ✗ | `get_variable_defs` などは読み取り専用。変数を作る API は無い |
| Figma REST API `POST /v1/files/:key/variables` | ✗ | Variables 書き込み API は Enterprise プラン限定 |
| Figma アプリで手動追加 | ○ | 数が少ないならこれが最短 |
| Figma プラグイン（Tokens Studio / Variables Import-Export 等） | ○ | JSON を書き出して一括インポート |

プラグイン経由でやる場合は、Claude Code に「`lib/design-tokens.ts` の `color` を Figma Variables インポート用 JSON に変換して」と依頼すれば変換ファイルは作れる。Figma への取り込み自体は手作業。

---

## 4. 環境の制約（2026-09-06 時点で確認済み）

Cowork（クラウドセッション）からは Figma に一切到達できない。

- Cowork セッションに `mcp__figma__*` が無い（ローカルの Claude Code のみ設定済み: `.claude/settings.local.json`）
- クラウド側シェルから `api.figma.com` / `www.figma.com` へ接続不可（egress 遮断・HTTP 000）
- ローカル VM 側シェル（device_bash）からも同様に接続不可
- 内蔵ブラウザから `FIGMA_ACCESS_TOKEN` を使った API 呼び出しはセキュリティ分類器がブロック

→ Figma を参照する作業は **ローカルの Claude Code** で行う。Cowork は「実装ルールの整備」「プロンプト設計」「Figma 非依存のコード作業」に使う。
