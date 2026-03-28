# No-Show Card Game

A full-featured strategic card game app built with Expo React Native, featuring a dark casino theme with 3D table effects and animated card throws.

## Architecture

- **Frontend**: Expo Router (file-based routing), React Native, Reanimated animations
- **Backend**: Express.js + WebSocket server for multiplayer rooms
- **Database**: Neon Postgres via Drizzle ORM (`server/db.ts`)
- **Auth**: JWT auth routes exist server-side but login is **not required** to play — players enter a name directly in setup screens
- **State**: React Context (`GameContext`, `MultiplayerGameContext`) for game state

## Design System

- **Background**: `#060F0A` (near-black deep green)
- **Felt table**: `#1C6038` with perspective 3D transform (rotateX 8deg)
- **Gold**: `#FFD700` — accents, borders, scoreboards
- **Orange** `#E67E22` — VS System mode
- **Blue** `#2980B9` — Multiplayer mode
- **Purple** `#9B59B6` — Online (coming soon)
- **Fonts**: Inter (400, 500, 600, 700) via expo-google-fonts

## App Structure

```
app/
  _layout.tsx          # Root layout: QueryClient, GameProviders, KeyboardProvider
  index.tsx            # Home screen — 4-panel layout (VS / Multi / Online / How-to)
  vs-setup.tsx         # VS System setup — player name input, bot count selector
  game.tsx             # Main game screen — 3D felt table, card throw animations, overlays
  game-multiplayer.tsx # Multiplayer game (mirrors game.tsx for network play)
  results.tsx          # Results/rankings screen with trophy animation
  how-to-play.tsx      # Rules reference
  room.tsx             # Multiplayer room (create/join/lobby)

components/
  Card.tsx             # Card & CardBack components with spring animations
  ErrorBoundary.tsx    # Error boundary

context/
  GameContext.tsx         # Full VS game state + bot AI integration
  MultiplayerGameContext.tsx  # WebSocket multiplayer state

constants/
  colors.ts            # Full design token set (bg, felt, gold, orange, blue, purple...)

lib/
  gameEngine.ts        # Core game logic (throws, picks, scoring, Show mechanic)
  auth-client.ts       # JWT auth helper (server auth still available, not enforced in UI)
  query-client.ts      # React Query + API fetch helpers
```

## Game Features

- **VS System**: Play against 2–3 AI bots with strategy engine
- **Multiplayer**: Room-based play via WebSocket with 6-character room codes
- **Full Game Rules**: No-Show card game — throw/pick turns, Show mechanic, scoring, elimination
- **3D Game Table**: Perspective-transformed felt surface with ambient glow
- **Card Throw Animations**: Flying card animation when cards are thrown
- **Show Scorecard**: Detailed round reveal overlay with hand cards, deltas, totals

## Key Design Decisions

- Auth gate removed from frontend — no login screen shown to user
- Players enter their name directly in VS setup or room creation screens
- `lib/auth-client.ts` and server auth routes still exist but are not enforced
- `lib/supabase.ts` is a stub (`export const supabase = null`)

## Ports

- **Frontend (Expo)**: 8081
- **Backend (Express)**: 5000 (also serves a landing page)
