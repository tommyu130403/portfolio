# Portfolio Project - Codex Guidelines

**This file is a copy of `CLAUDE.md` for Codex.** `CLAUDE.md` is the source of truth; when the two diverge, fix `CLAUDE.md` first and mirror the change here. Do not add rules that exist only in this file.

Follow it together with the global Codex guidance; when they differ, the more specific safety rule applies.

The gate is one command: `npm run check` (types → lint → build). Commit format, branch naming, and `temp/` commits are enforced mechanically by commitlint, `.husky/pre-push`, and `.claude/hooks/block-temp-commit.sh`.

## 0. Safety and evidence

- Prefer correctness and safety over speed. Report tool output only when it was actually observed; never fabricate command output, errors, or verification results.
- After an irreversible production action, database write, or migration, perform a separate read-only verification and report that observed result.
- Do not delete, initialize, or overwrite ignored files, `.codex/`, `.claude/`, environment files, or other local configuration without explicit user approval. Check whether a file is untracked or locally significant before replacing or deleting it.
- If scope, risk, or the applicable rule is unclear, stop before the consequential action and ask the user. Do not treat a failed tool call as success.

## 1. Project overview

Next.js portfolio site.

```
app/            - Next.js pages
components/     - Reusable UI components
src/components/ - Additional components (including SkillsRadarChart)
lib/            - Design tokens and shared utilities
public/         - Static assets
```

Before changing code, inspect the target and its callers. Define an observable completion condition and the verification method. Keep the solution within the requested scope; avoid speculative features and unnecessary abstraction.

## 2. Execution policy

The following are normally safe to perform autonomously:

- Static analysis, type checks, and existing local test suites.
- CSS/Tailwind visual adjustments, while observing the style-guide rule below.
- Documentation, comments, and type documentation updates.
- A small bug fix confined to one component when its relevant verification passes.

Ask for explicit approval before making these changes or running the associated consequential operation:

- Dependencies or lockfiles.
- Supabase/SQL schema and migrations, database writes, or other production mutations.
- Authentication, security, RLS, or API authorization logic.
- Environment variables, secrets, or build/tooling configuration (for example `tsconfig.json` and GitHub Actions).
- Destructive changes, breaking API/interface changes, or refactors that span multiple components.
- A bug fix that spans multiple components; it is not considered a small autonomous fix.

Never expose or copy secrets from configuration or permission files. A read operation does not authorize a production write.

## 3. Git workflow

Commit format: `<type>: <description>`.

| Type | Usage |
|------|-------|
| `feat` | New feature or component |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `style` | Styling or CSS changes |
| `chore` | Build config or dependencies |
| `docs` | Documentation only |

Branch format: `<type>/<yyyymmdd>-<description>` (`feat`, `fix`, `refactor`, `chore`, or `temp`). The main branch is `main`.

- Do not work directly on `main` unless the user confirms that explicitly; never push changes from `main`.
- Never merge a pull request unless the user explicitly asks.
- When a PR-backed working branch is clean and has no untracked files, ask whether to create a new branch before starting a new, unrelated task.
- If asked to create a branch without a stated work item, use `temp/<yyyymmdd>-work` without a follow-up question.
- Before creating a new work branch, update `main` first:

```bash
git checkout main
git pull origin main
git checkout -b <type>/<yyyymmdd>-<description>
```

- Continue the current branch for ongoing work; do not silently replace or recreate it.
- Do not commit from a `temp/` branch. Rename it to a task-specific branch first. The project hook enforces this mechanically.

## 4. Design system and Figma

When a change triggers one of the following conditions, update `app/styleguide/StyleguideLayout.tsx` in the same task:

| Trigger | Required action |
|---------|-----------------|
| New file under `components/` | Add its import and a `<ComponentPreview>` in `ComponentsSection` |
| Existing component props or variants change | Update its preview example |
| Token added or removed in `lib/design-tokens.ts` | Update the relevant Colors/Tokens section |
| `@theme` in `app/globals.css` changes | Verify the color and radius swatches reflect it |

No style-guide update is needed for internal-only component logic or an unrelated page change under `app/`.

For any design or Figma-driven work, inspect the [Library file](https://www.figma.com/design/KpNwkdFy1usaO1sBR0dycv/Library?node-id=0-1&t=NBs3RMQLsi9pubO0-1) and compare all available implementation definitions, including tokens, variants, styles, layout, spacing, constraints, naming, and hierarchy. Trace instances back to master components and their nested definitions, and reflect observed differences in the implementation within the approved scope. If the design leaves a pattern or structural decision ambiguous, ask the user for the implementation direction before editing.

## 5. Verification and learning

- For code work, run the gate and report its actual exit status: `npm run check` (types → lint → build, ~10s). Do not run the stages separately — the gate is binary. The same command runs in CI (`.github/workflows/check.yml`) and from the Stop hook. The repository currently has no test suite; add a `test` stage to `check` when one is introduced.
- Verify UI changes visually with the local preview when feasible. Do not start a duplicate development server when one is already running.
- For substantive completed work, perform an independent, fresh-context review when the user requests verification or when the change is high-risk. Check the original request, diff, empty/boundary/error cases, and unintended changes. Keep verified facts distinct from reasoned conclusions and assumptions.
- When a delegated builder implements a change, a fresh-context QA verifier must review it before completion is declared.
- Record reusable, observed lessons in `learnings/`: one concise Markdown file per lesson, structured as situation, lesson, and observed evidence. Check for duplicates first; correct or remove lessons shown to be wrong. Promote a lesson into these instructions only after recurrence or independent evidence supports it.

Known implementation failure patterns:

- If an `app/globals.css` `@theme` change does not appear in preview, suspect a stale Turbopack cache before editing unrelated files. Obtain approval before clearing `.next`.
- If Supabase-generated types drift from the implementation, use `npm run update-types` rather than manually rewriting generated types. Treat any remote or production-affecting step as approval-required.
- Do not leave debugging remnants or commented-out legacy code in completed work.

## 6. Task roles and escalation

Use focused roles only when delegation is requested or materially improves a high-risk task. Keep each delegated question bounded and provide only the context needed for that role.

| Role | Responsibility |
|------|----------------|
| Scope planner | Turn an ambiguous request into observable requirements, verification, and non-scope items; do not design or edit. |
| Architect | Compare implementation approaches, critical files, risks, and executable steps; do not edit. |
| Builder | Implement an agreed plan, verify incrementally, and stop if a design decision outside the plan is required. |
| QA verifier | Independently try to disprove completion using the request, diff, boundary conditions, and real commands; do not edit. |
| Shipper | Perform only already-approved mechanical Git/CI work and report actual command output. |
| Second opinion | Independently evaluate one bounded, high-risk question. Use only for a pivotal design trade-off, irreversible/wide-impact decision, or unknown structure not covered by the playbook. |

For every role, label claims as `VERIFIED`, `REASONED`, or `ASSUMED`; unknown items remain unconfirmed. A second opinion is limited to once per task and should not receive the primary agent's conclusion.

## 7. Research and reporting

- Begin research with the question, a primary-source plan, and a separation of fact, assumption, and unknown. Test plausible alternative explanations instead of confirming the user's hypothesis alone.
- Do not infer nonexistence from one search path; vary terminology, time range, actor, and opposing terms before concluding that evidence is absent.
- For time-sensitive or technical claims, use primary sources and state the retrieval date/source when it matters. Do not reconstruct copyrighted works from multiple sources.
- Lead reports with the result. State unverified claims as unverified and show failures plainly.
