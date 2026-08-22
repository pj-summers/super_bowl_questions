# Super Bowl Questions V2 — Technical Plan

## 1. Objective
Implement V2 as an incremental evolution of the existing Next.js + Supabase + Vercel app.

Do not rebuild from scratch.
Do not replace the stack.
Do not introduce architecture that core V2 does not need.

## 2. Existing data model
### `games`
Current shape includes:
- `id uuid primary key`
- `code text unique not null`
- `title text not null`
- `is_locked boolean not null default false`
- `created_at timestamptz not null default now()`

### `players`
Current shape includes:
- `id uuid primary key`
- `game_id uuid not null`
- `user_id uuid not null`
- `display_name text not null`
- `created_at timestamptz not null default now()`
- FK to `games(id)` with cascade delete
- unique index on `(game_id, lower(display_name))`
- index on `(game_id, user_id)`

### `questions`
Current shape includes:
- `id uuid primary key`
- `game_id uuid not null`
- `prompt text not null`
- `options jsonb not null`
- `correct_option text null`
- `sort_order integer not null default 0`
- FK to `games(id)` with cascade delete

### `answers`
Current shape includes:
- `id uuid primary key`
- `player_id uuid not null`
- `question_id uuid not null`
- `option text not null`
- `updated_at timestamptz not null default now()`
- unique `(player_id, question_id)`
- FK to `players(id)` cascade delete
- FK to `questions(id)` cascade delete
- trigger updating `updated_at`

## 3. Schema migration
Core V2 requires only additive changes.

### Add `games.status`
Recommended migration:

```sql
alter table public.games
add column status text not null default 'pregame';

alter table public.games
add constraint games_status_check
check (status in ('pregame', 'live', 'completed'));
```

Keep `is_locked` during V2 development for V1 compatibility.

V2 should use `status` as the primary lifecycle field.
Where necessary during the transition:
- `pregame` generally corresponds to `is_locked = false`
- `live` generally corresponds to `is_locked = true`
- `completed` should remain locked/read-only

Do not drop `is_locked` in core V2.

### Add `questions.resolved_at`
Recommended migration:

```sql
alter table public.questions
add column resolved_at timestamp with time zone null;
```

When a question is first resolved:
- set `correct_option`
- set `resolved_at = now()`

When editing the correct answer after initial resolution:
- preserve the original `resolved_at` unless the implementation explicitly unresolves and then re-resolves the question

## 4. Database strategy
Use the existing long-lived Supabase project.

Rationale:
- existing schema is already multi-game
- `players` and `questions` are scoped by `game_id`
- `answers` are scoped through player/question foreign keys
- historical games can safely coexist with new games

Create a separate V2 development/test game row rather than cloning the entire database.

Database changes must remain additive during V2 development.

## 5. Game identity and invite URLs
Keep internal game UUIDs and existing unique `code` behavior.

V2 invite routes should remove the need for users to manually type a code.

Preferred route shape:
- `/join/[gameIdentifier]`

The identifier may initially map to the existing unique `games.code` if that avoids unnecessary schema changes.
Do not add a new slug column unless clearly needed.

## 6. Player identity
Use lightweight browser persistence plus existing `players.user_id` / player records.

### Same-device return
Persist a game-specific local player association.

Preferred conceptual storage:
- key includes game identity
- value stores player ID and/or anonymous user ID needed to restore player context

Do not rely only on a global `lastName` value across all games.

### Returning screen
If a valid locally remembered player belongs to the current game:
- fetch player
- show `Welcome back, [name]`
- actions: Continue / Not [name]?

`Not [name]?` clears only local identity for the current game.

### Cross-device recovery
On join-by-name:
1. Normalize/trim input.
2. Check for existing player in current game using case-insensitive name behavior consistent with the DB constraint.
3. If no player exists, create one.
4. If a player exists, do not create a duplicate. Show recovery confirmation.
5. `Continue as [name]` locally associates this browser with the existing player.
6. `Use a different name` returns to name entry.

No player auth/PIN is required.

## 7. Route strategy
Preserve existing routes where practical to reduce risk.

Current conceptual routes include:
- `/game/[code]`
- `/leaderboard/[code]`
- `/stats/[code]`
- `/answers/[code]`
- `/admin/[code]`
- `/champions`

Recommended approach:
- keep `/leaderboard/[code]`
- keep `/stats/[code]`
- keep `/admin/[code]`
- keep `/champions`
- evolve `/game/[code]` into the primary state-aware player experience where practical
- add `/join/[code]` (or identifier) for frictionless entry
- add a recap route, e.g. `/recap/[code]`
- add a personal recap route or query/player segment only if needed after implementation review

Do not rename existing routes solely for aesthetics.

`/answers/[code]` may be absorbed into or repurposed by the new Picks/Results experience if that reduces duplication. This should be handled in the relevant milestone, not preemptively.

## 8. State-aware app shell
Replace the current generic nav behavior with a shared state-aware shell.

### Pregame
Primary player experience emphasizes Picks / Pregame Home.

### Live
Persistent mobile bottom nav:
- Home
- Leaders
- Picks
- Stats

### Completed
Recap becomes the default experience.

Champions remains accessible outside the four-item live nav.

## 9. Shared component plan
Introduce reusable V2 components gradually. Suggested boundaries:

### Layout / navigation
- `AppShell`
- `MobileBottomNav`
- `GameHeader`
- `GameStateGuard` or equivalent state-aware routing helper

### Pregame
- `JoinForm`
- `ReturningPlayerCard`
- `QuestionCard`
- `QuestionProgress`
- `QuestionReviewList`
- `PregameHome`
- `CompletionCard`

### Live
- `RankHero`
- `RecentResults`
- `RecentResultCard`
- `MiniLeaderboard`
- `PicksSummary`
- `LeaderboardTable/List`
- `PlayerCard`
- `PickResultRow/Card`
- `QuestionDistributionCard`
- `HeadlineStats`

### Postgame
- `RecapHero`
- `Podium`
- `RecapStatGrid`
- `ScoreDistribution`
- `PersonalRecapPreview`
- `PersonalRecapHero`

### Admin
- `PregameReadiness`
- `PlayerCompletionList`
- `ResolveQuestionCard`
- `ResolveConfirmation`

These are suggested boundaries, not mandatory names. Do not create abstraction layers without a clear reuse benefit.

## 10. Polling strategy
Core V2 uses lightweight polling rather than Realtime subscriptions.

During Live Mode:
- refetch relevant game/result/leaderboard/stat data approximately every 10 seconds
- avoid overlapping requests
- stop polling when component unmounts
- stop or reduce polling when game is no longer Live
- keep manual refetch possible after admin actions where useful

Do not introduce Supabase Realtime as part of core V2.

## 11. Scoring
Scoring remains:
- 1 point per correctly answered resolved question
- 0 for incorrect
- 0 for unanswered
- unresolved questions do not count toward current score

Shared rank behavior:
- equal scores share rank
- next rank skips appropriately (`1, 2, 2, 4`)

Use one shared scoring/ranking implementation across:
- Game Day Home
- Leaderboard
- Admin final review
- Recap
- Personal Recap

Avoid duplicating ranking logic in multiple page components.

## 12. Recent Results
Source:
- questions with non-null `correct_option`
- sorted by `resolved_at desc`
- latest 3

Each result joins:
- current player answer
- crowd answer counts/distribution

Display:
- correct answer
- player's answer or No Answer
- correctness state
- crowd accuracy

## 13. Crowd stats
Crowd distributions must be hidden during Pregame.

Once game status is Live or Completed:
- aggregate answers by question/option
- calculate percentages using the appropriate player/answer denominator

Be explicit about denominators:
- answer distribution can use players with an answer for that question, or all players if `No Answer` is represented explicitly
- crowd accuracy should be defined consistently across Home, Picks, Stats, and Recap

Preferred approach for core consistency:
- denominator = total players in the game
- unanswered players count as not correct for crowd-accuracy metrics
- distribution UI may include `No Answer` if useful, or use answered-only option shares if explicitly labeled

Do not silently vary definitions between pages.

## 14. Recap calculations
Core final-state calculations should be centralized in reusable utility/server functions.

### Group accuracy
Define as:
- total correct scored player-question outcomes / total possible player-question outcomes for resolved questions

Unanswered = not correct.

### Easiest question
Resolved question with highest percentage of players correct.

### Hardest question
Resolved question with lowest percentage of players correct.

### Biggest consensus
Question/option with highest player selection share.

### Biggest consensus miss
Resolved question where the most popular selected option was incorrect, prioritized by highest consensus share.

### Most divided question
Question whose answer distribution is most even.
Implementation may use a simple deterministic metric such as lowest maximum-option share or highest entropy, but the chosen formula must be documented before coding this statistic.

### Score distribution
Bucket or chart final player scores in a responsive visualization.
Choose bucket boundaries based on actual score range or a simple documented scheme.

### Personal best/rare pick
Among the player's correct answers, choose the answer selected by the smallest percentage of players.

### Popular miss
Among player's incorrect answers, choose the missed question with the highest crowd-correct percentage or highest correct-answer popularity; define one formula and reuse it.

Do not add historical-rank-dependent recap calculations.

## 15. Existing question workflow
Do not modify how the owner creates/populates questions unless a future explicit task requests it.

Player-facing answer UI changes do not imply a new Admin question builder.

## 16. Admin scoring
Admin continues to set `correct_option` manually.

Resolution write should:
- update `correct_option`
- set `resolved_at` if null

Edit result should:
- update `correct_option`
- keep existing `resolved_at`

Locking should:
- set V2 `status = 'live'`
- retain/update `is_locked = true` for V1 compatibility as appropriate

Unlocking should:
- set V2 `status = 'pregame'`
- retain/update `is_locked = false` as appropriate

Completing/publishing should:
- set `status = 'completed'`
- remain locked/read-only

## 17. Styling architecture
Use the existing styling approach where practical.
Do not introduce a large UI framework solely for V2.

Create a small shared design system with:
- spacing
- typography hierarchy
- card surfaces
- borders/radii
- neutral palette
- primary accent
- success/error states
- mobile touch-target standards

Player UI should be designed at phone widths first and expand gracefully.

## 18. Security and data exposure
Core V2 intentionally uses lightweight player identity.

Behavioral privacy rule:
- Pregame: hide other players' answers and crowd distributions
- Live/Completed: locked predictions are visible within the game

Do not add player login/auth.
Do not expose secret Supabase service-role credentials client-side.
Continue to respect existing RLS/security architecture in the repo.

## 19. V1 compatibility constraints
During core V2:
- do not drop `games.is_locked`
- do not delete historical game data
- do not rewrite Past Champs data
- do not mutate previous-game questions/answers as part of V2 setup
- do not require V1 code on `main` to understand V2-only columns

All schema additions should allow old code to continue reading existing columns.
