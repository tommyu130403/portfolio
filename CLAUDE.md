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

Format: `<type>/<description>`

| Type | Usage |
|------|-------|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `refactor/` | Refactoring |
| `chore/` | Maintenance |

Examples:
- `feat/project-card-component`
- `fix/icon-path`
- `refactor/extract-page-components`

Main branch: `main`

## Project Structure

```
app/          - Next.js pages
components/   - Reusable UI components
src/components/ - Additional components (SkillsRadarChart)
public/       - Static assets
```
