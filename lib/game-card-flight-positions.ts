/** Deck / discard / seat positions for card flight animations (VS, online, multiplayer). */

export function getDeckPos(W: number, H: number) {
  return { x: W * 0.4, y: H * 0.5 };
}

export function getDiscardPos(W: number, H: number) {
  return { x: W * 0.6, y: H * 0.5 };
}

export function getHumanPos(W: number, H: number) {
  return { x: W * 0.5, y: H * 0.82 };
}

export function getBotPos(botIdx: number, botCount: number, W: number, H: number): { x: number; y: number } {
  if (botCount === 1) return { x: W * 0.5, y: H * 0.16 };
  if (botCount === 2) {
    return botIdx === 0
      ? { x: W * 0.3, y: H * 0.16 }
      : { x: W * 0.7, y: H * 0.16 };
  }
  if (botIdx === 0) return { x: W * 0.5, y: H * 0.16 };
  if (botIdx === 1) return { x: W * 0.08, y: H * 0.5 };
  return { x: W * 0.92, y: H * 0.5 };
}

/** VS mode: human + bot `type` field. */
export function getVsPlayerScreenPos(
  playerIdx: number,
  players: { id: string; type: string }[],
  humanIdx: number,
  W: number,
  H: number,
): { x: number; y: number } {
  if (playerIdx === humanIdx) return getHumanPos(W, H);
  const bots = players.filter((p) => p.type === "bot");
  const botIdx = bots.findIndex((b) => b.id === players[playerIdx]?.id);
  return getBotPos(botIdx, bots.length, W, H);
}

/**
 * Online + multiplayer: local player at bottom; opponents use same arc as VS bots.
 */
export function getSeatScreenPosForLocalPlayer(
  playerIdx: number,
  players: { id: string }[],
  localPlayerId: string,
  W: number,
  H: number,
): { x: number; y: number } {
  const humanIdx = players.findIndex((p) => p.id === localPlayerId);
  if (playerIdx === humanIdx) return getHumanPos(W, H);
  const opponentIds = players.filter((p) => p.id !== localPlayerId).map((p) => p.id);
  const pid = players[playerIdx]?.id;
  const oppSlot = opponentIds.findIndex((id) => id === pid);
  if (oppSlot < 0) return getHumanPos(W, H);
  return getBotPos(oppSlot, opponentIds.length, W, H);
}
