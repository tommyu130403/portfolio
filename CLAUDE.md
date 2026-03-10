# Portfolio Project - Claude Guidelines

## Project Overview
Next.js portfolio site. Components are in `/components/`, pages in `/app/`.

## Commit Rules

Format: `<type>: <description>`

| Type | Usage |
|------|-------|
| `feat` | New feature or component |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `style` | Styling, CSS changes |
| `chore` | Build config, dependencies |
| `docs` | Documentation only |

Example: `feat: HistoryItemコンポーネントを追加`

## Branch Rules

Format: `<type>/<yyyymmdd>-<description>`

| Type | Usage |
|------|-------|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `refactor/` | Refactoring |
| `chore/` | Maintenance |
| `temp/` | Work content not yet decided |

Examples:
- `feat/20260310-project-card-component`
- `fix/20260310-icon-path`
- `refactor/20260310-extract-page-components`

Main branch: `main`

When creating a new branch, always update main first:
```bash
git checkout main
git pull origin main
git checkout -b <type>/<yyyymmdd>-<description>
```

## Style Guide Auto-Update Rules

When making changes that affect the following files, **always update the style guide** (`app/styleguide/StyleguideLayout.tsx`) in the same task:

| Trigger | Required action |
|---------|----------------|
| New file added to `components/` | Add import + `<ComponentPreview>` entry to `ComponentsSection` |
| Existing component props / variants changed | Update the corresponding `<ComponentPreview>` example in `ComponentsSection` |
| `lib/design-tokens.ts` token added / removed | Update the relevant section in `StyleguideLayout.tsx` (Colors / Tokens) |
| `app/globals.css` `@theme` block changed | Verify the color / radius swatches in the style guide still reflect the values |

No update is needed when:
- Only internal component logic changes (no prop API or visual change)
- Changes are inside `app/` pages unrelated to the design system

## Project Structure

```
app/          - Next.js pages
components/   - Reusable UI components
src/components/ - Additional components (SkillsRadarChart)
public/       - Static assets
```
