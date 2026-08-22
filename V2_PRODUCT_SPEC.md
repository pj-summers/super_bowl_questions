# Super Bowl Questions V2 — Product Specification

## 1. Product goal
V2 should make the existing Super Bowl Questions game feel cleaner, more professional, easier to use, and more engaging throughout the game without changing the core premise.

The product lifecycle is:

**Pregame → Live → Postgame**

The core player loop remains:
1. Join the game.
2. Make pregame predictions.
3. Follow standings and results live during the Super Bowl.
4. View a polished recap after the game.

## 2. Product principles
- Reduce friction before adding complexity.
- Keep the core game familiar.
- Make the app worth reopening throughout the game.
- Make postgame results fun to revisit and share.
- Keep V2 technically realistic in the existing Next.js + Supabase + Vercel stack.
- Do not redesign workflows that already work well for the owner.

## 3. Brand and visual direction
Brand name: **Super Bowl Questions**.

Visual direction:
- clean
- light
- neutral
- modern sports app
- mobile-first
- strong typography and large sports-data numbers
- restrained accent usage
- card-based interface
- green/red used primarily for correct/incorrect states
- celebratory treatment reserved for completion, winners, and recap moments

Do not use:
- team-specific colors as the app theme
- matchup-specific redesigns
- official-team-logo-dependent layouts
- overly playful party-game styling
- broadcast/ESPN imitation as the primary design language

## 4. Game states
Each game has three explicit states:

### Pregame
Players can join and edit predictions.

### Live
Predictions are locked and read-only. Leaderboard, crowd distributions, player cards, and live results are visible.

### Completed
Final results are published and the recap becomes the primary experience.

The owner manually controls state transitions.

## 5. Joining and player identity
### Invite
Players receive one direct invite URL for the game. They should never need to manually type a game code.

Use a human-readable game identifier/slug where practical.

Admin should be able to expose:
- Copy Invite Link
- Show QR Code

### First-time player
The join page asks only for the player's name.

Example flow:
- Super Bowl Questions
- Super Bowl LXI
- name input
- Join Game

### Same-device returning player
The browser remembers the player's game-specific identity.

Show:
- `Welcome back, PJ`
- `Continue`
- `Not PJ?`

`Not PJ?` only clears the local association for that game. It does not delete the player or answers.

### Cross-device recovery
If a user enters a display name that already exists in the game, show:
- `[Name] is already playing.`
- `Continue as [Name]`
- `Use a different name`

Core V2 intentionally uses lightweight name-based recovery. Do not add PINs, passwords, or player accounts.

## 6. Pregame prediction experience
All questions are created by the owner before the game using the existing question workflow.

### Card Mode
Default answering mode is one question at a time.

Each question screen includes:
- question number / total
- progress indicator
- prompt
- large tappable options
- selected-answer state
- autosave feedback
- Back
- Next
- View All

Selecting an answer autosaves immediately but does **not** automatically advance.
The player advances using Next.

### View All
View All is a navigation/review screen, not a second answering UI.

It includes:
- total answered count
- unanswered count
- All / Unanswered filtering
- original question order
- selected answer summary for answered questions
- visible unanswered state

Tapping a question returns the player to Card Mode on that question.

### Completion
There is no Submit button.

When all questions are answered:
- completion is automatic
- show a celebratory `You're All Set` state
- clarify that picks are saved
- clarify that picks remain editable until lock

### Returning before lock
After the first completion celebration, subsequent pregame visits land on a simple Pregame Home showing:
- player completion status
- picks lock time/countdown if configured
- total player count
- Review My Picks
- access to Champions

Do not show crowd answer distributions before picks lock.

## 7. Locking predictions
Admin manually triggers Lock Picks.

Before confirming, show:
- total players
- number complete
- number incomplete
- warning if any players have unanswered questions

On lock:
- existing answers become read-only
- unanswered questions remain unanswered
- app state changes to Live
- live bottom navigation appears
- crowd answer distributions become visible
- all players' locked cards become viewable within that game

Admin may manually unlock picks as an emergency safety valve.

## 8. Live navigation
On mobile, use persistent bottom navigation with exactly four primary destinations:
- Home
- Leaders
- Picks
- Stats

Champions remains available elsewhere in the app but is not a primary live tab.

## 9. Game Day Home
This is the flagship live screen.

### Hero
Current rank is the most visually prominent piece of information.

Show:
- rank
- total player count
- score/points
- points behind first place where applicable
- number of resolved questions / total

Core V2 does not require rank movement arrows.

### Recent Results
Always show the three most recently resolved questions based on `resolved_at`.

For each result show:
- question/prompt
- correct answer
- current player's answer
- correct/incorrect/no-answer state
- crowd accuracy for that question

Include `View All Results` or equivalent navigation into the player's full Picks/Results view.

Do not implement `Since You Last Checked` state.

### Mini leaderboard
Show:
- Top 5
- plus current player if they are outside the Top 5

If the current player is already Top 5, do not duplicate them.

### Picks summary
Keep this compact.

Show counts such as:
- still in play
- correct
- missed
- unanswered when applicable

Provide `View My Picks`.

Do not duplicate the full Picks page on Home.

### Refresh behavior
During Live Mode, automatically refetch relevant data approximately every 10 seconds.

Do not require Supabase Realtime/WebSockets for core V2.

## 10. Picks page — Live
Read-only after lock.

Filters:
- All
- Still Alive
- Decided

Preserve original question order.

Resolved question rows/cards show:
- player's pick
- correct answer
- correct/incorrect/no-answer state
- crowd accuracy

Unresolved questions show:
- player's locked pick
- Not Decided state

Unanswered locked questions display `No Answer` and score zero points.

## 11. Leaderboard
Leaderboard rows should be simple and mobile-readable.

Show:
- shared rank
- player display name
- score

Highlight the current player's row.

### Shared ranks
Equal scores receive the same rank.

Example:
- 1
- 2
- 2
- 4

No artificial tiebreaker.

### Player cards
Every player row is tappable after picks lock.

Player detail shows:
- rank
- score
- correct count
- missed count
- unanswered count if applicable
- unresolved count
- full prediction card

Filters may include:
- All
- Correct
- Missed
- Still Alive

All locked unresolved picks are visible to other players once the game is Live.

## 12. Stats page
Purpose: answer `What did everybody predict?`

Show:
- player count
- resolved/total questions
- question-centric answer distributions

Filters:
- All
- Decided
- Still Alive

For each question, display answer-option percentages/counts.
For resolved questions, visually identify the correct answer and overall crowd accuracy.

Headline stats may include:
- Biggest Consensus
- Most Divided
- Toughest Question So Far

These must be derivable from current/final answer data and must not require rank history.

## 13. Admin — Pregame
Preserve existing Admin access behavior.
Do not add host authentication or a PIN.

Pregame dashboard should emphasize readiness:
- total players
- complete players
- incomplete players
- total picks made / possible picks
- player list with completion counts
- All / Complete / Incomplete filtering
- Copy Invite Link
- Show QR Code
- Lock Picks

Basic player management:
- Rename Player
- Remove Player

Do not add automatic duplicate merging.

## 14. Admin — Live scoring
Manual scoring only.

Show:
- resolved / total questions
- Unresolved / Resolved / All filters
- original question order

For unresolved questions:
- compact question card
- tappable answer options
- selecting a result opens a confirmation step

Flow:
1. Tap correct answer.
2. Confirm resolution.
3. Save `correct_option`.
4. Set `resolved_at`.
5. Player-facing pages reflect result on next poll.

Resolved questions show:
- selected correct answer
- crowd correct count / percentage
- Edit Result

Do not add:
- auto scoring
- suggested NFL data
- automatic question ordering
- void functionality

Every question is expected to resolve to one correct answer.

## 15. End Game and publishing
Admin manually ends the game.

Flow:
1. End Game
2. Final review
3. Publish Results

Before publishing, the owner can verify final standings/results.

On Publish Results:
- game enters Completed state
- recap becomes live/default postgame experience
- final standings are read-only
- final champion/co-champions are reflected in the current game result

Existing historical Champions page data should not be reworked. Only apply shared global styling as needed.

## 16. Group Recap
The postgame default page is one polished, responsive, scrollable, shareable web page generated dynamically from final Supabase data.

It should feel like a `Super Bowl Questions Wrapped` without requiring historical rank snapshots.

Core sections:
- Champion / co-champions
- Final podium
- player count
- question count
- total picks
- group accuracy
- easiest question
- hardest question
- biggest consensus
- biggest consensus miss
- most divided question
- score distribution
- compact current-player recap
- final standings preview / link
- link to Champions

Do not include core awards that require historical leaderboard state, such as:
- biggest comeback
- biggest riser
- time spent in first
- lead-change count

## 17. Personal Recap
Each player gets a dedicated personal recap plus a compact preview on the Group Recap.

Show:
- player name
- final shared rank
- total players
- score
- accuracy
- correct count
- missed count
- unanswered count where applicable
- rare/best correct pick
- popular miss where applicable
- crowd-alignment/contrarian-style summary if it can be defined cleanly from final data
- question-by-question final results

Design the hero section to be screenshot-friendly.

Do not add native social integrations.

## 18. Champions
Existing Past Champs page remains in the product.

Core V2 should not attempt to reconstruct missing historical data such as:
- scores
- field sizes
- prior full recaps
- all-time player profiles

Only update styling as needed to match the V2 design system.

## 19. Explicitly out of scope for core V2
- public self-service hosting
- host accounts
- player accounts/auth
- automatic NFL data/scoring
- Supabase Realtime requirement
- rank movement
- rank-history storage
- paths to victory
- live activity feed based on rank history
- new question builder
- question categories
- variable points
- voided questions
- official team-logo dependency
- team-themed app redesigns
- social API integrations
