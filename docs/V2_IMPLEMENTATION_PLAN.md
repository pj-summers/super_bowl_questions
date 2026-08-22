# Super Bowl Questions V2 — Codex Implementation Plan

## Working method
Implement **one milestone at a time**.

For every milestone:
1. Read `AGENTS.md`, `V2_PRODUCT_SPEC.md`, and `V2_TECHNICAL_PLAN.md`.
2. Implement only the milestone scope.
3. Do not implement later milestones early.
4. Run available validation.
5. Summarize changed files and behavior.
6. Stop if a new product decision is required.
7. Owner reviews the result before the next milestone begins.

## Milestone 0 — Safety and baseline
### Goal
Establish a known-good V2 development baseline without changing player behavior.

### Scope
- confirm work is on `v2-development` or a branch derived from it
- document current environment assumptions
- confirm current app builds/runs before V2 changes
- identify existing shared scoring/player/game-loading utilities
- do not change production behavior

### Acceptance criteria
- current V1-equivalent app builds successfully on the V2 branch
- no schema changes yet
- no route redesign yet
- Codex reports current relevant architecture and any blockers

### Do not
- refactor UI
- add dependencies
- change database
- rename routes

---

## Milestone 1 — Additive V2 game-state foundation
### Goal
Add the minimum schema and code foundation for Pregame / Live / Completed plus resolved timestamps.

### Scope
- add migration for `games.status`
- add migration for `questions.resolved_at`
- preserve `games.is_locked`
- add typed game-status handling in application code
- add reusable helpers for reading current game lifecycle state
- keep current UX visually unchanged where possible

### Acceptance criteria
- migrations are additive and checked into the repo
- allowed statuses are only `pregame`, `live`, `completed`
- existing V1 fields remain intact
- app can read game status safely
- existing pages still build

### Do not
- redesign navigation yet
- rewrite player flow
- remove `is_locked`
- modify question creation workflow

---

## Milestone 2 — Shared V2 visual foundation and state-aware shell
### Goal
Create the modern sports-app design foundation and state-aware navigation without rebuilding feature pages yet.

### Scope
- introduce shared V2 design tokens/styles/components
- create state-aware app shell
- implement Live bottom nav: Home / Leaders / Picks / Stats
- keep Champions accessible outside primary live nav
- ensure mobile-first responsiveness
- preserve Admin usability on desktop/mobile

### Acceptance criteria
- clean light neutral visual direction
- mobile nav has exactly four live items
- state-aware shell can distinguish Pregame / Live / Completed
- desktop does not break
- no team-specific branding

### Do not
- implement recap content yet
- implement new predictions yet
- add UI framework unless already present/required

---

## Milestone 3 — Frictionless join and returning-player identity
### Goal
Eliminate manual game-code entry and make returning players effortless.

### Scope
- add `/join/[gameIdentifier]` using existing game code/identifier unless schema change is explicitly approved
- first-time name-only join
- persist game-specific local player identity
- returning screen: `Welcome back, [Name]` + Continue + Not [Name]?
- `Not [Name]?` clears only local association for that game
- cross-device/name recovery confirmation for existing names
- avoid duplicate player creation

### Acceptance criteria
- player never manually enters a game code after opening invite URL
- same-device player is recognized reliably
- name collision offers Continue as existing player / Use different name
- no PIN/account/auth introduced
- existing DB unique-name constraint is respected

### Do not
- introduce email/login
- alter players schema unless an unforeseen blocker is reported first
- allow Not [Name]? to delete server data

---

## Milestone 4 — Pregame Card Mode + View All
### Goal
Replace the dropdown-heavy player prediction UX with the locked V2 answering experience.

### Scope
- one-question-at-a-time Card Mode
- large tappable options
- autosave on selection
- manual Next / Back
- visible saved state
- progress indicator
- View All review/navigation screen
- All / Unanswered filter
- tapping review item opens that question in Card Mode
- 31/31 completion celebration
- no Submit button
- simple returning Pregame Home after completion
- hide crowd distributions while Pregame

### Acceptance criteria
- answering is mobile-friendly
- answer selection saves without explicit Save button
- selection does not auto-advance
- View All is not a duplicate answering interface
- users can edit until game locks
- incomplete players are supported

### Do not
- change owner question-creation workflow
- add categories
- add variable points

---

## Milestone 5 — Admin Pregame readiness + lifecycle controls
### Goal
Give the owner a reliable pregame control center and transition into Live mode safely.

### Scope
- readiness summary
- total / complete / incomplete players
- per-player answered count
- filters: All / Complete / Incomplete
- Copy Invite Link
- Show QR Code
- Rename Player
- Remove Player with confirmation
- Lock Picks confirmation showing incomplete players
- Unlock Picks safety action
- update both V2 status and legacy lock field consistently

### Acceptance criteria
- owner can see exactly who is incomplete
- locking makes player picks read-only
- unlocking restores Pregame editability
- no data loss when renaming
- player removal is explicit and confirmed

### Do not
- add host auth/PIN
- add duplicate auto-merge

---

## Milestone 6 — Live scoring + polling foundation
### Goal
Make manual scoring fast, safe, and reflected automatically in player screens.

### Scope
- Admin Live Control with Unresolved / Resolved / All filters
- original question order
- answer selection + confirmation
- resolve writes `correct_option` and initial `resolved_at`
- Edit Result preserves existing `resolved_at`
- resolved cards show crowd correct count/percentage
- add reusable ~10-second Live polling behavior

### Acceptance criteria
- owner can resolve/edit questions quickly
- accidental one-tap scoring is prevented by confirmation
- no void flow
- player-facing data can refresh automatically while Live
- polling cleans up correctly and does not stack requests

### Do not
- add Supabase Realtime
- add NFL APIs
- add auto scoring
- add smart question ordering

---

## Milestone 7 — Game Day Home
### Goal
Build the flagship live player dashboard.

### Scope
- rank hero
- total players
- current score
- points behind first
- resolved / total questions
- latest three resolved questions ordered by `resolved_at`
- each recent result shows correct answer, player answer, status, crowd accuracy
- mini leaderboard: Top 5 + current player when outside Top 5
- compact picks summary
- live polling integration

### Acceptance criteria
- current rank visually dominates
- no rank-movement feature required
- Recent Results always reflects latest three resolved questions
- current player is never duplicated in mini leaderboard
- Home remains concise and mobile-first

### Do not
- implement Since You Last Checked
- implement activity feed
- implement rank history

---

## Milestone 8 — Full Leaders + Player Cards + Picks
### Goal
Complete the core live competition and personal-results views.

### Scope
#### Leaderboard
- shared-rank calculation
- current-player highlight
- tappable player rows

#### Player detail
- rank
- score
- correct/missed/unanswered/still-alive counts
- full locked prediction card
- filters where useful

#### Picks
- All / Still Alive / Decided
- original question order
- resolved correct answer
- player's pick
- crowd accuracy
- No Answer state

### Acceptance criteria
- ties show ranks like 1,2,2,4
- all locked picks visible after lock
- unresolved picks are viewable
- unanswered picks score zero and display No Answer

### Do not
- add friend system
- add privacy controls beyond locked Pregame behavior

---

## Milestone 9 — Stats redesign
### Goal
Turn Stats into a polished question-centric crowd-prediction view.

### Scope
- All / Decided / Still Alive
- answer distributions per question
- correct-answer treatment when resolved
- crowd accuracy
- headline stats:
  - Biggest Consensus
  - Most Divided
  - Toughest Question So Far

### Acceptance criteria
- distributions are hidden during Pregame
- calculations are consistent with shared utility definitions
- page is usable on mobile with 31 questions
- headline metrics have documented formulas

### Decision gate
Before implementing `Most Divided`, Codex must use the formula explicitly approved in the technical plan/task. If not specified, report ambiguity instead of choosing one.

---

## Milestone 10 — End Game / Publish flow
### Goal
Create a deliberate transition from Live to Completed.

### Scope
- End Game action
- final review screen
- Publish Results action
- set game status to Completed
- keep picks/results read-only
- show champion or co-champions based on shared final rank

### Acceptance criteria
- no automatic game-end detection
- owner gets final sanity-check opportunity
- equal top scores produce co-champions
- Completed state routes players toward Recap

### Do not
- rewrite historical Past Champs records

---

## Milestone 11 — Group Recap
### Goal
Build the permanent shareable postgame dashboard.

### Scope
- recap hero / champion(s)
- final podium
- total players
- total questions
- total picks
- group accuracy
- easiest question
- hardest question
- biggest consensus
- biggest consensus miss
- most divided question using approved formula
- score distribution
- current-player recap preview
- final standings preview/link
- Champions link

### Acceptance criteria
- recap is generated dynamically from final database data
- responsive and screenshot-friendly
- works without rank-history snapshots
- no manual report generation required

### Do not
- add biggest comeback/riser/time-in-first unless separately approved

---

## Milestone 12 — Personal Recap
### Goal
Give every participant a polished individualized final summary.

### Scope
- screenshot-friendly hero
- final rank / field size
- score / accuracy
- correct / missed / unanswered
- rarest correct pick
- popular miss using approved formula
- crowd-alignment/contrarian summary only if formula is explicitly defined
- final question-by-question results

### Acceptance criteria
- current player can reach personal recap directly from Group Recap
- calculations use centralized final-data utilities
- no historical-rank dependency
- no social API integration

### Decision gate
If a `contrarian score` formula has not been explicitly approved by the owner, omit it or report the ambiguity. Do not invent one.

---

## Milestone 13 — Champions styling + final polish
### Goal
Make the existing Champions page visually consistent and prepare V2 for real game-day use.

### Scope
- shared V2 styling applied to Champions without changing historical data model
- accessibility pass
- mobile QA
- desktop QA
- loading/error/empty states
- polling resilience
- navigation consistency
- final visual spacing/typography polish

### Acceptance criteria
- no historical champ data fabricated
- all core player flows work at common phone widths
- Admin works on phone and desktop
- build/lint/tests pass

---

## Milestone 14 — Final regression and launch readiness
### Goal
Validate the full lifecycle against a test game before any production merge.

### Required scenario
Run an end-to-end simulated game:
1. create/use a V2 test game
2. join multiple test players
3. test same-device return
4. test Not [Name]?
5. test existing-name cross-device recovery
6. answer partial and complete cards
7. verify Pregame crowd privacy
8. verify incomplete-player Admin warnings
9. lock picks
10. verify Live navigation
11. resolve several questions
12. verify automatic polling updates
13. verify Recent Results
14. verify ties/shared ranks
15. verify other-player locked cards
16. verify Stats distributions
17. verify No Answer behavior
18. edit a resolved result
19. End Game
20. Publish Results
21. verify Group Recap
22. verify Personal Recap
23. verify Champions still works

### Acceptance criteria
- no core-flow blockers
- V1 data remains untouched
- no destructive migration
- no production secrets committed
- owner reviews final diff before merge to `main`

## Deferred backlog — do not implement during core milestones
- rank movement
- rank-history snapshots
- biggest riser/faller
- lead-change tracking
- paths to victory
- advanced live activity feed
- automatic NFL data/scoring
- public self-service hosting
- host/player account systems
- historical all-time player profiles
