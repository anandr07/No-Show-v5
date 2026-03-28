export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;
}

export type PlayerType = "human" | "bot";
export type PlayerStatus = "active" | "eliminated" | "left";

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  hand: Card[];
  totalScore: number;
  status: PlayerStatus;
  roundScore?: number;
  isReady?: boolean;
  /** 1 = first eliminated, 2 = second, etc. Used for standings. */
  eliminationOrder?: number;
}

export type GamePhase =
  | "idle"
  | "dealing"
  | "playing"
  | "show"
  | "roundEnd"
  | "gameOver";
export type TurnPhase = "throw" | "pick";

export interface GameState {
  players: Player[];
  deck: Card[];
  openCard: Card | null;
  lastThrown: Card[];
  lastThrownByPlayerId: string | null; // Player who threw lastThrown; cannot pick own cards
  pendingThrown: Card[] | null; // Current player's thrown cards, held until they pick
  currentPlayerIndex: number;
  turnPhase: TurnPhase;
  phase: GamePhase;
  round: number;
  showCallerIndex: number | null;
  selectedCards: string[];
  canCallShow: boolean;
  turnsCompletedThisRound: number; // Show allowed only after each player completes 1 turn (Use Case 7)
  roundScores: { playerId: string; score: number; delta: number }[];
  winner: Player | null;
  hasPickedThisPhase: boolean;
  dealerIndex: number;
  turnOrder: number[];
  activeCount: number;
}

const RANK_ORDER: Record<Rank, number> = {
  A: 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
};

export function getCardValue(rank: Rank): number {
  return RANK_ORDER[rank];
}

export function createDeck(): Card[] {
  const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
  const ranks: Rank[] = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        id: `${rank}-${suit}-${Date.now() + Math.random()}`,
        suit,
        rank,
        value: RANK_ORDER[rank],
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => b.value - a.value);
}

export function getHandScore(hand: Card[]): number {
  return hand.reduce((sum, c) => sum + c.value, 0);
}

// Use Case 1: 8 cards to first player, 7 to others. Use Case 2: Player with 8 cards starts.
export function dealCards(
  players: Player[],
  deck: Card[]
): { players: Player[]; deck: Card[]; openCard: Card | null; starterIndex: number } {
  const shuffled = shuffleDeck(deck);
  const activePlayers = players.filter((p) => p.status === "active");
  const starterIndex = Math.floor(Math.random() * activePlayers.length);

  let deckCursor = 0;
  const newPlayers = players.map((p) => ({ ...p, hand: [] as Card[] }));

  activePlayers.forEach((p, idx) => {
    const count = idx === starterIndex ? 8 : 7;
    const playerInAll = newPlayers.findIndex((np) => np.id === p.id);
    newPlayers[playerInAll].hand = sortHand(
      shuffled.slice(deckCursor, deckCursor + count)
    );
    deckCursor += count;
  });

  const remaining = shuffled.slice(deckCursor);
  // Use Case 3: 1 card face up, rest face down
  const openCard = remaining.length > 0 ? remaining[0] : null;
  const deckAfterOpen = remaining.length > 1 ? remaining.slice(1) : [];

  return {
    players: newPlayers,
    deck: deckAfterOpen,
    openCard,
    starterIndex: newPlayers.findIndex(
      (p) => p.id === activePlayers[starterIndex].id
    ),
  };
}

// Use Case 4: Single card, sequence 3+, or 2+ similar cards
export function isValidThrow(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  if (cards.length === 1) return true;

  if (cards.length >= 2) {
    const allSameRank = cards.every((c) => c.rank === cards[0].rank);
    if (allSameRank) return true;
  }

  if (cards.length >= 3) {
    const sorted = [...cards].sort((a, b) => a.value - b.value);
    let isSeq = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].value !== sorted[i - 1].value + 1) {
        isSeq = false;
        break;
      }
    }
    if (isSeq) return true;
  }

  return false;
}

export function getThrowError(cards: Card[]): string {
  if (cards.length === 0) return "Select cards to throw";
  if (cards.length === 2) {
    if (!cards.every((c) => c.rank === cards[0].rank)) {
      return "2 cards must be same rank";
    }
  }
  if (cards.length >= 3) {
    const allSameRank = cards.every((c) => c.rank === cards[0].rank);
    if (!allSameRank) {
      const sorted = [...cards].sort((a, b) => a.value - b.value);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].value !== sorted[i - 1].value + 1) {
          return "Sequence must be consecutive ranks (no gaps)";
        }
      }
    }
  }
  return "";
}

export function computeShowScores(
  callerIndex: number,
  players: Player[]
): { playerId: string; score: number; delta: number }[] {
  const activePlayers = players.filter((p) => p.status === "active");
  const callerScore = getHandScore(activePlayers[callerIndex]?.hand ?? []);
  const lowestOther = activePlayers
    .filter((_, i) => i !== callerIndex)
    .reduce(
      (min, p) => Math.min(min, getHandScore(p.hand)),
      Number.MAX_SAFE_INTEGER
    );

  const callerWon = callerScore <= lowestOther;

  return activePlayers.map((p, i) => {
    const score = getHandScore(p.hand);
    let delta: number;
    if (i === callerIndex) {
      delta = callerWon ? 0 : 15;
    } else {
      delta = callerWon ? Math.max(0, score - callerScore) : 0;
    }
    return { playerId: p.id, score, delta };
  });
}

export function getActiveTurnOrder(
  players: Player[],
  startIndex: number
): number[] {
  const order: number[] = [];
  const n = players.length;
  for (let i = 0; i < n; i++) {
    const idx = (startIndex + i) % n;
    if (players[idx].status === "active") {
      order.push(idx);
    }
  }
  return order;
}

export function getNextActiveIndex(
  players: Player[],
  currentIndex: number
): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (currentIndex + i) % n;
    if (players[idx].status === "active") return idx;
  }
  return currentIndex;
}

// A-Z and 2-9, excluding O/0, I/1 for clarity
const ROOM_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export function normalizeRoomCodeForJoin(input: string): string {
  return input.trim().toUpperCase();
}

export function createPlayer(
  name: string,
  type: PlayerType,
  id?: string
): Player {
  return {
    id: id ?? Date.now().toString() + Math.random().toString(36).substr(2, 9),
    name,
    type,
    hand: [],
    totalScore: 0,
    status: "active",
    isReady: type === "bot",
  };
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

export const SUIT_COLORS: Record<Suit, string> = {
  hearts: "#D32F2F",
  diamonds: "#D32F2F",
  clubs: "#1A1A1A",
  spades: "#1A1A1A",
};
