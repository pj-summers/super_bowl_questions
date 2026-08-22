# Super Bowl Questions — Codex Instructions

## Purpose
This repository contains **Super Bowl Questions**, a Next.js + Supabase + Vercel application. V2 is an evolution of the working V1 product, not a rewrite.

The authoritative product and technical decisions live in:
- `docs/V2_PRODUCT_SPEC.md`
- `docs/V2_TECHNICAL_PLAN.md`
- `docs/V2_IMPLEMENTATION_PLAN.md`

Read all three before implementing any V2 milestone.

## Core rule
**Do not make product decisions.** Implement only behavior explicitly defined in the V2 specs or in the current task prompt.

If implementation requires an unspecified product or UX decision:
1. Stop that portion of the work.
2. Clearly identify the ambiguity.
3. Explain the minimum decision needed from the owner.
4. Do not invent a default or implement an adjacent feature.

## Scope discipline
- Work only on the milestone explicitly requested.
- Do not opportunistically refactor unrelated code.
- Do not add features because they seem useful.
- Do not rename routes, tables, columns, or components unless the spec explicitly calls for it.
- Do not upgrade dependencies unless required for the requested milestone.
- Do not introduce a new framework, state-management library, UI kit, auth system, realtime architecture, analytics platform, or external API without explicit approval.
- Prefer the smallest change that satisfies the acceptance criteria.

## Existing stack
Keep the existing stack:
- Next.js
- React
- TypeScript
- Supabase
- Vercel

Do not replace these technologies.

## V1 compatibility
V1 is a working product and must remain recoverable.
- Development occurs on `v2-development` or a task branch derived from it.
- Never merge to `main` unless explicitly instructed.
- Database changes must be **additive and backward-compatible** unless explicitly approved otherwise.
- Keep `games.is_locked` during V2 development.
- Preserve the existing question creation/setup workflow.
- Preserve existing historical champion data.

## Database safety
Current core tables:
- `games`
- `players`
- `questions`
- `answers`

Approved core V2 schema additions only:
- `games.status`
- `questions.resolved_at`

Do not delete or rename existing columns as part of core V2.

## Product constraints
Core V2 explicitly does **not** include:
- automatic NFL scoring
- external NFL APIs
- player accounts/login
- email or social authentication
- host PIN/auth redesign
- public self-service hosting
- new question creation workflow
- variable question points
- question categories
- voided questions
- rank-history infrastructure
- paths-to-victory calculations
- realtime WebSocket/Supabase Realtime requirements
- social-media integrations
- matchup/team-specific visual branding

Do not implement these unless the owner explicitly moves them into scope.

## UX philosophy
- Player experience is mobile-first.
- Admin must work well on both phone and desktop.
- Visual direction: clean, light, neutral, modern sports app.
- Brand name: **Super Bowl Questions**.
- Keep the experience simple and low-friction.
- Prefer obvious behavior over clever behavior.

## Quality requirements
For every implementation task:
- Run the relevant tests, linting, and build checks available in the repo.
- Do not claim success if checks fail.
- Summarize every file changed and why.
- Call out any migration or environment-variable change explicitly.
- Flag any risk to V1 compatibility.
- Do not commit secrets, Supabase keys, passwords, or local environment files.

## Completion behavior
At the end of a task, report:
1. What was implemented.
2. What files changed.
3. What validation was run.
4. Any unresolved ambiguity or follow-up that requires owner approval.
