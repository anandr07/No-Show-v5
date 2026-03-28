# No-Show Card Game — Detailed Product Requirements Document

**Version:** 1.0  
**Last Updated:** March 2025  
**Status:** Draft

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Game Modes](#2-game-modes)
3. [Core Game Rules](#3-core-game-rules)
4. [User Authentication](#4-user-authentication)
5. [Screen-by-Screen Specifications](#5-screen-by-screen-specifications)
6. [Game State Machine](#6-game-state-machine)
7. [Validation Rules](#7-validation-rules)
8. [Error Handling & Messages](#8-error-handling--messages)
9. [Edge Cases & Constraints](#9-edge-cases--constraints)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Data Models](#11-data-models)
12. [Acceptance Criteria](#12-acceptance-criteria)

---

## 1. Product Overview

### 1.1 Product Name
**No-Show** — The Card Game

### 1.2 Product Description
No-Show is a strategic, turn-based card game where 3–4 players compete to have the lowest cumulative hand score. The objective is to be the **last player remaining** with a total score under 100. Players take turns throwing cards (in valid combinations) and picking new ones from the deck or the last-thrown pile. At strategic moments, a player may call **"Show"** to reveal all hands and resolve scoring. Players whose total score reaches or exceeds 100 are eliminated. The last player standing wins.

### 1.3 Target Platforms
- **Mobile:** iOS and Android (native via Expo)
- **Web:** Browser (React Native Web)
- **Desktop:** Optional (Expo desktop support)

### 1.4 Target Audience
- Casual card game players
- Friends playing locally (same room or remote)
- Solo players practicing against AI
- Future: Competitive online players

### 1.5 Core Value Proposition
- Simple rules, strategic depth
- Quick rounds (typically 5–15 minutes per game)
- Multiple play modes: solo vs AI, local multiplayer, online matchmaking
- Cross-platform: play on phone, tablet, or web

---

## 2. Game Modes

### 2.1 VS System (Solo vs AI Bots)

#### 2.1.1 Description
A single human player competes against AI-controlled opponents. The human makes all decisions; bots take turns automatically with simulated "thinking" delay.

#### 2.1.2 Player Count
- **Total players:** 3 or 4
- **Human:** 1
- **Bots:** 2 or 3 (user selects)

#### 2.1.3 Setup Flow
1. User taps "VS System" on home screen.
2. User is taken to **VS Setup** screen.
3. User enters their **display name** (required, 1–50 chars after trim).
4. User selects **number of bots:** 2 or 3 (radio/segmented control).
5. User taps **"Start Game"**.
6. Game initializes: 1 human + selected bots, names assigned.
7. User is taken to **Game** screen; dealing animation plays.

#### 2.1.4 Bot Behavior
- **Turn execution:** Bots take turns automatically. No user input required during bot turns.
- **Thinking delay:** 800–2000 ms (randomized) before each bot action. UI shows "thinking" indicator (e.g., spinner, pulsing avatar).
- **Strategy:** Bots use heuristics to:
  - Minimize hand score when throwing (prefer sequences, pairs, high cards).
  - Prefer picking from thrown pile if it improves hand or complements existing cards.
  - Call Show when hand score is low (e.g., ≤10) or when confident they have the lowest hand.
- **No cheating:** Bots do not see other players' hands; they use only public information (their hand, last thrown, deck count).

#### 2.1.5 End of Game
- When a player wins (all others eliminated), user is taken to **Results** screen.
- **Play Again:** Restarts game with same bot count and human name.
- **Home:** Returns to home screen.

---

### 2.2 Multiplayer (Play with Friends)

#### 2.2.1 Description
Human players create or join a room using a unique 6-character room code. All players must be in the same "room" (session) before the game starts. Real-time synchronization via WebSocket.

#### 2.2.2 Player Count
- **Minimum to start:** 3 players
- **Maximum per room:** 4 players

#### 2.2.3 Room Creation Flow
1. User taps "Multiplayer" on home screen.
2. User is taken to **Room** screen (create/join view).
3. User enters **display name** (required, 1–50 chars after trim).
4. User taps **"Create Room"**.
5. System generates a unique 6-character room code (see [Validation Rules](#7-validation-rules)).
6. User is taken to **Room Lobby**.
7. User sees: room code (prominent), list of players (initially just creator), "Share" button, "Leave" button.
8. User can **share** room code via system share sheet (e.g., "Join my No-Show game! Room code: ABC123").

#### 2.2.4 Room Joining Flow
1. User taps "Multiplayer" on home screen.
2. User is taken to **Room** screen.
3. User enters **display name** (required).
4. User enters **room code** (exactly 6 characters, case-insensitive input, normalized to uppercase for display).
5. User taps **"Join Room"**.
6. System validates room exists, is in lobby phase, and has capacity.
7. If valid: User is taken to **Room Lobby**.
8. If invalid: Error message displayed (see [Error Handling](#8-error-handling--messages)).

#### 2.2.5 Room Lobby
- **Display:**
  - Room code (large, copyable or shareable).
  - List of players: display name, owner badge (crown/star), ready status (checkmark or "Ready").
  - For each player: avatar placeholder, name, "Owner" badge if applicable, "Ready" indicator.
- **Owner actions:**
  - Mark self as Ready (toggle).
  - **Start Match** button — visible and enabled only when:
    - At least 3 players in room.
    - All players (including owner) have marked Ready.
  - Leave room (returns to create/join screen; room persists if others remain).
- **Non-owner actions:**
  - Mark self as Ready (toggle).
  - Leave room.
- **When owner starts:**
  - All players in the room are taken to **Game** screen.
  - Game state is initialized (deal, first player).
  - All clients receive same initial state.

#### 2.2.6 Room Capacity & Availability
- **Room full:** If 4 players already in room, "Join" fails with "Room is full."
- **Room not found:** Invalid or expired code: "Room not found."
- **Room in progress:** If room has already started a game: "Room not available."

#### 2.2.7 Room Owner
- The player who creates the room is the **owner**.
- Only the owner can start the match.
- If owner leaves before start, ownership may transfer to next player (or room closes — product decision).

---

### 2.3 Online (Match with Players Worldwide)

#### 2.3.1 Description
Players are matched with random opponents via a matchmaking queue. No room code; system pairs players automatically.

#### 2.3.2 Player Count
- User selects: **3 players** or **4 players** before joining queue.

#### 2.3.3 Matchmaking Flow
1. User taps "Online" on home screen.
2. User selects desired player count (3 or 4).
3. User taps **"Find Match"**.
4. User enters **matchmaking queue**.
5. **Queue UI:** Shows "Searching for players...", elapsed time, cancel button.
6. When enough players with same desired count are in queue, a game is created.
7. All matched players are taken to **Game** screen with same initial state.

#### 2.3.4 Auto-Fill (Bots)
- **Trigger:** If wait time exceeds threshold (e.g., 60 seconds), remaining slots may be filled with bots.
- **Bot names:** Human-like names (e.g., "Alex", "Jordan", "Sam") — not obviously bot names.
- **Behavior:** Same as VS System bots.
- **Indicator:** Optional — product may choose to show "Bot" badge or keep bots indistinguishable. (Recommend: show "Bot" for transparency.)

#### 2.3.5 Authentication Requirement
- Online mode requires user to be signed in (unique identity for matchmaking and anti-abuse).

---

## 3. Core Game Rules

### 3.1 Deck and Card Values

#### 3.1.1 Deck Composition
- **Standard 52-card deck**
- **Suits:** Hearts (♥), Diamonds (♦), Clubs (♣), Spades (♠)
- **Ranks:** A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K

#### 3.1.2 Card Values (for hand score calculation)
| Rank | Value |
|------|-------|
| Ace (A) | 1 |
| 2 | 2 |
| 3 | 3 |
| 4 | 4 |
| 5 | 5 |
| 6 | 6 |
| 7 | 7 |
| 8 | 8 |
| 9 | 9 |
| 10 | 10 |
| Jack (J) | 11 |
| Queen (Q) | 12 |
| King (K) | 13 |

#### 3.1.3 Rank Order (for sequences)
- Ascending: A < 2 < 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K
- Used to validate sequence throws (e.g., 7-8-9 is valid; 7-9-10 is invalid due to gap).

---

### 3.2 Game Setup (Each Round)

#### 3.2.1 Shuffle
- Deck is shuffled using a fair random shuffle (Fisher-Yates or equivalent).

#### 3.2.2 Dealing
- **Starter:** One random active player receives **8 cards**.
- **Others:** All other active players receive **7 cards**.
- **Rotation:** Cards dealt in order (e.g., P1 gets 8, P2 gets 7, P3 gets 7, P4 gets 7).

#### 3.2.3 First Player
- The player with 8 cards is the **first player** of the round (starts the turn order).

#### 3.2.4 Draw Pile
- Remaining cards form the **face-down draw pile** (deck).
- Count is visible to all players.

#### 3.2.5 Initial Open Card
- **One card** is placed face-up as the initial "last thrown" pile.
- This card is available for the first player to **pick** (instead of drawing from deck) on their first pick phase.
- If the first player picks from deck, the open card remains in the thrown pile for the next player.

---

### 3.3 Turn Structure

Each turn has **two phases**: Throw, then Pick. Both must be completed (or Show called instead of Throw) before the turn ends.

#### 3.3.1 Phase 1: Throw

**Rule:** The player must throw one or more cards from their hand.

**Valid throws:**

| Type | Description | Example |
|------|-------------|---------|
| **Single** | Any one card | K |
| **Pair** | 2 cards of same rank | 7-7 |
| **Three of a kind** | 3 cards of same rank | 7-7-7 |
| **Four of a kind** | 4 cards of same rank | 7-7-7-7 |
| **Sequence** | 3+ cards of consecutive ranks (no gaps) | 7-8-9, J-Q-K |
| **Sequence** | Suit does not matter | 7♥-8♦-9♣ is valid |

**Invalid throws:**
- 2 cards of different ranks (e.g., 7-8) — not a pair, not a sequence.
- Sequence with gap (e.g., 2-4-5, 7-9-10).
- Empty selection.

**After throw:**
- Thrown cards are placed in the **"last thrown"** pile (face-up).
- These cards are available for the **next player** to pick from (not the thrower).
- The thrower cannot pick their own thrown cards.

#### 3.3.2 Phase 2: Pick

**Rule:** After throwing, the player must pick exactly one card.

**Pick options:**

| Option | Description |
|--------|-------------|
| **From deck** | Draw the top card from the face-down deck. |
| **From last thrown** | Pick any one card from the cards in the last-thrown pile (thrown by the previous player, or the initial open card for the first player). |

**Constraint:** The player cannot pick from the last-thrown pile if they threw those cards (i.e., cannot pick their own throw).

**After pick:**
- Card is added to the player's hand.
- Hand is re-sorted (descending: K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3, 2, A).
- Turn passes to the next player (clockwise, skipping eliminated players).

---

### 3.4 Show

#### 3.4.1 When Available
- A player may call Show **only after each active player has completed at least one full turn** in the current round.
- "Full turn" = throw + pick (or Show) completed.
- Show is **not** available on the first turn of the round.
- Show is available **on the throw phase** — the player may choose to call Show instead of throwing.

#### 3.4.2 Action
- On their throw phase, before throwing, the player taps **"Show"**.
- All hands are revealed.
- Scoring is resolved.

#### 3.4.3 Scoring When Show Is Called

**Hand score** = sum of card values in the player's hand.

**Case A: Caller has the lowest hand score**
- **Caller:** Adds **0** to their total.
- **Each other player:** Adds **(their hand score − caller's hand score)** to their total.
  - Example: Caller has 12, others have 18, 25, 30. Others add 6, 13, 18 respectively.

**Case B: Any other player has a lower or equal hand score**
- **Caller:** Receives **+15 penalty** added to their total.
- **All other players:** Add **0** to their total.

**Tie for lowest:** If caller ties for lowest with another player, Case B applies (caller gets +15).

#### 3.4.4 After Show
- Round ends.
- If game over (see 3.6): show results.
- Otherwise: next round begins (new deal, new starter).

---

### 3.5 Elimination

#### 3.5.1 Threshold
- Any player whose **total score** reaches or exceeds **100** is **eliminated**.

#### 3.5.2 Effect
- Eliminated players no longer participate.
- They are skipped in turn order.
- Their cards are not shown; they are listed in scorecard as "OUT" with their final score.
- If all but one player are eliminated, the remaining player wins.

---

### 3.6 Round End and Next Round

#### 3.6.1 After Show Resolution
- Round ends.
- Check: How many active (non-eliminated) players remain?

#### 3.6.2 Game Over Conditions
- **One player remaining:** That player wins. Game ends.
- **All eliminated in same round:** The player with the **lowest total score** among those eliminated wins. Game ends.

#### 3.6.3 Next Round (if game continues)
- New deck shuffled.
- Deal again: one random active player gets 8 cards, others get 7.
- That player starts.
- Show is locked until each active player completes one full turn.
- Turn order: clockwise among active players only.

---

### 3.7 Game Over

#### 3.7.1 Win Condition
- The last player with a total score under 100 wins.

#### 3.7.2 Tie (all eliminated in same round)
- Winner = player with lowest total score among those eliminated.

#### 3.7.3 Single Player Remaining (others quit)
- If all other players leave (quit) during the game, the remaining player wins by default.

---

## 4. User Authentication

### 4.1 Sign Up
- **Required fields:** Email, password.
- **Optional:** Display name (defaults to email prefix if not provided).
- **Validation:**
  - Email: valid format, unique in system.
  - Password: minimum 6 characters.
  - Display name: 1–50 chars after trim.
- **On success:** User is signed in, redirected to home.

### 4.2 Sign In
- **Required fields:** Email, password.
- **On success:** User is signed in, redirected to home.
- **On failure:** "Invalid email or password" (no hint about which is wrong).

### 4.3 Sign Out
- Clears session.
- Redirects to auth screen (or home, per product decision).

### 4.4 Session
- Session persists across app restarts (e.g., JWT in secure storage or httpOnly cookie).
- Session check on app launch: if valid, user is "signed in"; if not, show auth or allow anonymous play for VS/Multiplayer.

### 4.5 Identity
- Each user has a unique **user ID** (UUID or similar).
- Used for: multiplayer identity, online matchmaking, profile, game history.

### 4.6 Display Name
- Stored per user.
- Used in games as the player name.
- User must be able to **change** their display name (in profile).
- Change syncs to future games; existing in-progress games may keep the name at game start.

---

## 5. Screen-by-Screen Specifications

### 5.1 Home Screen

#### 5.1.1 Layout
- **Header:** Game title "NO-SHOW", subtitle "THE CARD GAME".
- **Main content:** Four panels (or cards) in a grid/list:
  1. **VS System** — "vs bots"
  2. **Multiplayer** — "local room"
  3. **Online** — "ranked play" (disabled with "SOON" badge if not implemented)
  4. **How to Play** — "rules & tips"
- **Footer:** Quick info chips, e.g., "3–4 Players", "52 Cards", "Last under 100".
- **Profile access:** Profile icon/avatar in header or corner; tap opens Profile screen.

#### 5.1.2 Actions
- Tap VS System → Navigate to VS Setup.
- Tap Multiplayer → Navigate to Room (create/join).
- Tap Online → Navigate to Online matchmaking (or show "Coming soon" if disabled).
- Tap How to Play → Navigate to How to Play.
- Tap Profile → Navigate to Profile (or Auth if not signed in).

---

### 5.2 VS Setup Screen

#### 5.2.1 Fields
- **Display name:** Text input, required, placeholder "Your name", max 50 chars.
- **Bot count:** 2 or 3 (segmented control or radio).

#### 5.2.2 Actions
- **Start Game:** Validates name (non-empty after trim). Starts game, navigates to Game.
- **Back:** Returns to Home.

---

### 5.3 Room Screen (Create / Join)

#### 5.3.1 Layout
- **Tabs or segments:** "Create Room" | "Join Room".
- **Create:** Display name input, "Create Room" button.
- **Join:** Display name input, room code input (6 chars), "Join Room" button.

#### 5.3.2 Validation
- Display name: required, 1–50 chars.
- Room code (join): exactly 6 characters, valid charset (A–Z, 2–9, excluding O, 0, I, 1).

#### 5.3.3 Actions
- Create → Create room, navigate to Lobby.
- Join → Validate room, join if valid, navigate to Lobby; else show error.

---

### 5.4 Room Lobby Screen

#### 5.4.1 Display
- **Room code:** Large, prominent (e.g., "ABC123"). Copy and Share buttons.
- **Player list:** Each player shows:
  - Display name
  - Owner badge (if owner)
  - Ready status (checkmark or "Ready")
- **Owner:** "Start Match" button (enabled when 3+ players and all ready).
- **All:** "Ready" toggle, "Leave" button.

#### 5.4.2 Real-Time Updates
- When a player joins, list updates.
- When a player marks ready, status updates.
- When owner starts, all navigate to Game.

---

### 5.5 Game Screen (In-Play)

#### 5.5.1 Header
- **Round number:** e.g., "Round 3".
- **Turn indicator:** "Your turn" or "Alex's turn".
- **Quit button:** X or "Quit" — tap opens confirmation.
- **Scorecard access:** Button or tap to open scorecard modal.

#### 5.5.2 Main Area
- **Deck:** Face-down pile, shows remaining count (e.g., "24").
- **Last thrown:** Face-up cards from previous player's throw. Tappable to pick one (when it's player's pick phase).
- **Opponents:** Each opponent: name, card count, face-down card backs (no individual cards visible).
- **Player hand:** User's cards, sorted descending (K to A). Cards tappable to select for throw.

#### 5.5.3 Action Bar (when player's turn)
- **Throw phase:**
  - Select cards → "Throw" button (validates selection).
  - "Show" button (enabled only when Show is allowed and no cards selected).
- **Pick phase:**
  - "Pick from deck" button.
  - Tap a card in "Last thrown" to pick it (if not own throw).

#### 5.5.4 Scorecard Modal
- **Round number.**
- **Active players:** Name, current total score, turn indicator.
- **Eliminated players:** Name, "OUT", final score.
- **Left players:** Name, "LEFT" or "Left game".
- **Active count:** "X/Y active" (e.g., 3/3, 2/2 after someone leaves).
- **Close** button.

#### 5.5.5 Quit Confirmation
- "Are you sure you want to quit?" — Yes / No.
- **Yes:** In multiplayer, other players are notified; user returns to Home or Room.

---

### 5.6 Show Reveal Screen / Modal

#### 5.6.1 Display
- All hands revealed (face-up).
- Each player: name, hand, hand score (sum).
- Points added this round for each player.
- **Scoring explanation:**
  - If caller won: "You: 0 | Others: +X each (their score − your score)".
  - If caller lost: "You: +15 penalty | Others: 0".

#### 5.6.2 Actions
- **Next Round:** If game continues — close modal, start next round.
- **See Results:** If game over — navigate to Results.

---

### 5.7 Results Screen

#### 5.7.1 Display
- **Rankings:** Sorted by score (ascending: lowest first). Winner at top.
- **Winner:** Highlighted (e.g., "Winner!", trophy icon).
- **Each player:** Name, final score, place (1st, 2nd, etc).

#### 5.7.2 Actions
- **Play Again:** Restart with same setup (VS: same bot count; Multiplayer: same room/players if applicable).
- **Home:** Return to Home.

---

### 5.8 How to Play Screen

#### 5.8.1 Content
- Scrollable rules reference.
- Sections: Objective, Setup, Turn structure, Card values, Valid throws, Show rules, Elimination, Tie-breaker.
- Optional: examples, diagrams.

---

### 5.9 Profile Screen

#### 5.9.1 Display (when signed in)
- **Username / display name:** Current value.
- **Edit username:** Button or inline edit.
- **Add friends:** Placeholder button or section (UI only for now).

#### 5.9.2 Actions
- Change username → Save → Persist, show success.
- Sign out → Clear session, redirect to Auth or Home.

#### 5.9.3 When Not Signed In
- Redirect to Auth or show "Sign in to view profile".

---

### 5.10 Auth Screen

#### 5.10.1 Layout
- **Tabs:** Sign In | Sign Up.
- **Sign In:** Email, password, "Sign In" button.
- **Sign Up:** Email, password, display name (optional), "Sign Up" button.

#### 5.10.2 Validation & Errors
- Required fields, format validation.
- Clear error messages below form or inline.

---

## 6. Game State Machine

### 6.1 Phases
- **idle:** No game.
- **dealing:** Animation/transition.
- **playing:** Active round, turns in progress.
- **show:** Show called, hands revealed, scoring displayed.
- **roundEnd:** Brief state before next round or game over.
- **gameOver:** Winner determined, results shown.

### 6.2 Turn Phases (within playing)
- **throw:** Player must throw cards (or call Show if allowed).
- **pick:** Player must pick one card from deck or last thrown.

### 6.3 State Transitions
- idle → dealing (game start).
- dealing → playing (deal complete).
- playing (throw) → playing (pick) [after throw].
- playing (throw) → show [if Show called].
- playing (pick) → playing (throw) [next player, after pick].
- show → playing [next round] or gameOver [if winner].
- gameOver → idle [user exits] or dealing [Play Again].

---

## 7. Validation Rules

### 7.1 Throw Validation
- **Single:** Exactly 1 card. Always valid.
- **Pair+ same rank:** 2+ cards, all same rank. Valid.
- **Sequence:** 3+ cards, consecutive ranks, no gaps. Valid.
- **Invalid:** 2 cards different ranks; sequence with gap; empty.

### 7.2 Pick Validation
- Must pick exactly one card.
- From deck: deck must have at least one card.
- From last thrown: last thrown must have cards; player cannot pick own throw.

### 7.3 Show Validation
- Only when `canCallShow` is true (each active player has completed one full turn).
- Only on throw phase.
- No cards selected (Show replaces throw).

### 7.4 Room Code
- **Length:** 6 characters.
- **Charset:** A–Z, 2–9. Exclude: O, 0, I, 1 (avoid confusion).
- **Uniqueness:** Generated to avoid collision with active rooms.
- **Case:** Input normalized to uppercase for display and lookup.

### 7.5 Display Name
- **Trim:** Leading/trailing whitespace removed.
- **Length:** 1–50 characters after trim.
- **Empty:** Not allowed.

### 7.6 Player Count
- **VS System:** 2 or 3 bots (3 or 4 total).
- **Multiplayer:** 3–4 players.
- **Online:** 3 or 4 players (user choice).

---

## 8. Error Handling & Messages

### 8.1 Network Errors
- **Cannot reach server:** "Cannot reach server. Check your network and try again."
- **Timeout:** "Request timed out. Please try again."

### 8.2 Room Errors
- **Room not found:** "Room not found. Check the code and try again."
- **Room full:** "Room is full."
- **Room in progress:** "Room not available. The game has already started."

### 8.3 Game Action Errors
- **Invalid throw:** "Invalid throw. Select a single card, same-rank pair, or 3+ card sequence."
- **Not your turn:** "Not your turn."
- **Must pick first:** "You must pick a card before your turn ends."
- **Show not available:** "Show is not available yet. Each player must complete one turn first."
- **Cannot pick own throw:** "You cannot pick from your own thrown cards."
- **Deck empty:** "Deck is empty." (Until deck exhaustion / reshuffle is implemented.)

### 8.4 Auth Errors
- **Invalid credentials:** "Invalid email or password."
- **Email exists:** "An account with this email already exists."
- **Password too short:** "Password must be at least 6 characters."

### 8.5 Display
- Errors shown inline (near field) or as toast/banner.
- Dismissible; do not block entire UI unless critical.

---

## 9. Edge Cases & Constraints

### 9.1 Deck Exhaustion
- **Rule:** When the deck is empty, the "dead pile" (discarded cards from throws, excluding current last-thrown) is shuffled and becomes the new deck.
- **Implementation note:** Track discarded cards; when deck empties, merge and reshuffle (excluding cards in players' hands and current last-thrown).

### 9.2 Single Active Player
- If only one player remains (others eliminated or left), game ends immediately.
- That player wins.

### 9.3 All Eliminated in Same Round
- Winner = player with lowest total score among those eliminated.
- Display: "Winner: [name] (lowest score among eliminated)."

### 9.4 Skip Eliminated Players
- Turn order skips eliminated players.
- Eliminated players are not in turn rotation.

### 9.5 No Skipping Turns
- Every player must complete throw + pick (or Show) each turn.
- No "pass" or "skip" action.

### 9.6 Player Disconnect (Multiplayer / Online)
- If a player disconnects or quits:
  - Mark as "left".
  - Notify others: "[Name] left the game."
  - Update active count.
  - If only one remains, that player wins; return to Home with message.

### 9.7 Owner Leaves Before Start
- Product decision: transfer ownership to next player, or close room.
- Recommend: transfer ownership; room stays open.

---

## 10. Non-Functional Requirements

### 10.1 Real-Time Sync
- Multiplayer and online: all clients see same game state.
- Actions (throw, pick, show, next round) reflected within ~500 ms.
- WebSocket or equivalent for low-latency updates.

### 10.2 Responsiveness
- UI responds to taps within 100 ms.
- Bot "thinking" delay: 800–2000 ms.
- Loading states for: create room, join room, matchmaking.

### 10.3 Accessibility
- Text readable (min 14–16 pt for body).
- Touch targets ≥ 44×44 pt.
- Throw, Pick, Show buttons clearly visible on small screens.

### 10.4 Data Persistence
- User profiles (username) persist.
- Auth session persists.
- Room/game state: session-based (ephemeral) unless persistence is required.
- Game history: optional for stats/leaderboard.

### 10.5 Performance
- Smooth animations (60 fps where possible).
- No noticeable lag during bot turns or state updates.

---

## 11. Data Models

### 11.1 User / Profile
- `id` (UUID)
- `email` / `username`
- `display_name`
- `avatar_url` (optional)
- `created_at`, `updated_at`

### 11.2 Room
- `id`, `code` (6-char unique)
- `owner_id`
- `status`: lobby | playing | finished
- `max_players`, `min_players_to_start`
- `created_at`, `updated_at`

### 11.3 Room Player
- `id`, `room_id`, `user_id` (optional for anonymous)
- `display_name`, `is_owner`, `is_ready`
- `seat_index`

### 11.4 Game
- `id`, `mode`, `room_id`
- `status`: playing | finished
- `game_state` (JSON snapshot, optional)
- `winner_id`, `round_count`
- `created_at`, `finished_at`

### 11.5 Game Player
- `id`, `game_id`, `user_id`
- `display_name`, `player_type` (human | bot)
- `status`: active | eliminated | left
- `total_score`, `final_place`

### 11.6 Game History (for stats)
- `id`, `game_id`, `user_id`
- `display_name`, `place`, `final_score`, `mode`
- `created_at`

---

## 12. Acceptance Criteria

### 12.1 VS System
- [ ] User can enter name and select 2 or 3 bots.
- [ ] Game starts with correct player count.
- [ ] Bots take turns with visible delay.
- [ ] User can throw valid combinations and pick from deck/thrown.
- [ ] User can call Show when allowed.
- [ ] Elimination at 100 works.
- [ ] Results show winner; Play Again restarts with same bot count.

### 12.2 Multiplayer
- [ ] User can create room and get 6-char code.
- [ ] User can share code.
- [ ] Others can join with code.
- [ ] Lobby shows all players, ready status, owner.
- [ ] Owner can start when 3+ players and all ready.
- [ ] All players see same game state in real time.
- [ ] Player leave is handled; last player wins.

### 12.3 Online (when implemented)
- [ ] User can select 3 or 4 players and join queue.
- [ ] Matchmaking pairs players.
- [ ] Auto-fill with bots after timeout.
- [ ] Game behaves like multiplayer.

### 12.4 Core Rules
- [ ] Deal: 8 to starter, 7 to others.
- [ ] Valid throws enforced.
- [ ] Pick from deck or last thrown (not own).
- [ ] Show only after each player completes one turn.
- [ ] Scoring: caller wins (0 for caller, diff for others) or caller loses (+15 for caller).
- [ ] Elimination at 100.
- [ ] Deck exhaustion: reshuffle dead pile when deck empty.

### 12.5 Auth & Profile
- [ ] Sign up, sign in, sign out work.
- [ ] Session persists.
- [ ] User can change display name in profile.

---

*End of Product Requirements Document*
