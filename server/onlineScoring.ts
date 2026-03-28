export function computeWinnerPointsBase(winningScoreX: number): number {
  if (winningScoreX < 0 || winningScoreX > 99) {
    throw new Error("winningScoreX must be between 0 and 99");
  }
  return 100 - winningScoreX;
}

export function computeWinnerPointsFinal(
  winningScoreX: number,
  isBotFilled: boolean,
  botReductionFactor: number
): number {
  const base = computeWinnerPointsBase(winningScoreX);
  if (!isBotFilled) return base;
  if (botReductionFactor <= 0 || botReductionFactor > 1) {
    throw new Error("botReductionFactor must be between 0 and 1");
  }
  return Math.max(1, Math.floor(base * botReductionFactor));
}

export function computeLevel(points: number): number {
  if (points < 1000) return 1;
  if (points < 2000) return 2;
  if (points < 3000) return 3;
  if (points < 4000) return 4;
  if (points < 5000) return 5;
  return 6;
}
