# AGENTS.md

## Cursor Cloud specific instructions

### Overview
Next.js 16 (App Router) で構築された日本語のポートフォリオサイト。主要セクション: ヒーロー、自己紹介、経歴、プロジェクト、スキル。

### Services
| Service | Command | Port |
|---|---|---|
| Next.js dev server | `npm run dev` | 3000 |

### Key commands
- **Dev server**: `npm run dev` (localhost:3000)
- **Lint**: `npm run lint` (ESLint)
- **Build**: `npm run build` (static export in production)
- See `package.json` scripts for full list.

### Notes
- Supabase（クラウド）はスキルデータ取得に使われるが、メインページはハードコードデータで動作するため、`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` がなくても開発可能。
- `next.config.ts` は `NODE_ENV=production` 時のみ `basePath: '/portfolio'` と `output: 'export'` を適用。開発時はこれらは無効。
- テストファイルは存在しない。lint (`npm run lint`) が主な静的チェック手段。
- Node.js v20以上が必要（CIはv20を使用）。
