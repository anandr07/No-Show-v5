import {
  Card,
  Player,
  isValidThrow,
  getHandScore,
  Rank,
} from "./gameEngine";

const RANK_ORDER: Record<string, number> = {
  A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, J: 11, Q: 12, K: 13,
};

export function botChooseThrow(hand: Card[]): Card[] {
  if (hand.length === 0) return [hand[0]];

  const sequences = findBestSequence(hand);
  if (sequences.length > 0) return sequences;

  const pairs = findBestPair(hand);
  if (pairs.length > 0) return pairs;

  const highCard = [...hand].sort((a, b) => b.value - a.value)[0];
  return [highCard];
}

function findBestSequence(hand: Card[]): Card[] {
  const sorted = [...hand].sort((a, b) => a.value - b.value);
  let bestSeq: Card[] = [];

  for (let i = 0; i < sorted.length; i++) {
    let seq = [sorted[i]];
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].value === seq[seq.length - 1].value + 1) {
        seq.push(sorted[j]);
      }
    }
    if (seq.length >= 3 && seq.length > bestSeq.length) {
      bestSeq = seq;
    }
  }

  if (bestSeq.length >= 3) {
    const totalValue = bestSeq.reduce((s, c) => s + c.value, 0);
    const avgValue = totalValue / bestSeq.length;
    if (avgValue > 6) return bestSeq;
  }
  return [];
}

function findBestPair(hand: Card[]): Card[] {
  const rankGroups: Record<string, Card[]> = {};
  for (const card of hand) {
    if (!rankGroups[card.rank]) rankGroups[card.rank] = [];
    rankGroups[card.rank].push(card);
  }

  let bestGroup: Card[] = [];
  for (const group of Object.values(rankGroups)) {
    if (group.length >= 2) {
      const groupValue = group[0].value;
      const bestValue = bestGroup[0]?.value ?? 0;
      if (group.length > bestGroup.length || (group.length === bestGroup.length && groupValue > bestValue)) {
        bestGroup = group;
      }
    }
  }

  if (bestGroup.length >= 2) return bestGroup;
  return [];
}

export function botChoosePick(
  hand: Card[],
  lastThrown: Card[]
): "deck" | "thrown" {
  if (lastThrown.length === 0) return "deck";

  const currentScore = getHandScore(hand);
  const worstCard = [...hand].sort((a, b) => b.value - a.value)[0];

  const bestThrown = [...lastThrown].sort((a, b) => a.value - b.value)[0];
  if (bestThrown && bestThrown.value < worstCard.value) {
    return "thrown";
  }

  const hasComplement = lastThrown.some((tc) => {
    return hand.some((hc) => {
      return (
        hc.rank === tc.rank ||
        Math.abs(hc.value - tc.value) === 1
      );
    });
  });

  if (hasComplement) return "thrown";
  return "deck";
}

export function botChooseCardToPick(
  hand: Card[],
  lastThrown: Card[]
): Card {
  const worstHandCard = [...hand].sort((a, b) => b.value - a.value)[0];
  const sortedThrown = [...lastThrown].sort((a, b) => a.value - b.value);
  return sortedThrown[0] ?? lastThrown[0];
}

export function botShouldCallShow(
  bot: Player,
  players: Player[],
  canShow: boolean
): boolean {
  if (!canShow) return false;

  const myScore = getHandScore(bot.hand);
  if (myScore > 20) return false;

  const activePlayers = players.filter((p) => p.status === "active" && p.id !== bot.id);
  const allHigher = activePlayers.every((_) => {
    return myScore <= 15;
  });

  return myScore <= 10 || (allHigher && myScore <= 18);
}

export function botPickCardFromHand(
  hand: Card[],
  pickedCard: Card
): Card {
  const newHand = [pickedCard, ...hand];
  const sorted = [...newHand].sort((a, b) => b.value - a.value);
  return sorted[0];
}
