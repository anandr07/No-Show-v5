/** Three bot portrait assets (online fill + VS bots). */

export const BOT_AVATAR_COUNT = 3;

export const BOT_AVATARS = [
  require("@/assets/images/bot-avatars/bot-1.png"),
  require("@/assets/images/bot-avatars/bot-2.png"),
  require("@/assets/images/bot-avatars/bot-3.png"),
] as const;

export function clampBotAvatarIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;
  const i = Math.floor(index);
  const m = ((i % BOT_AVATAR_COUNT) + BOT_AVATAR_COUNT) % BOT_AVATAR_COUNT;
  return m;
}

/** Nth bot among opponents (0-based) → avatar 0..2. */
export function botAvatarIndexForOpponentSlot(opponentSlotIndex: number): number {
  return clampBotAvatarIndex(opponentSlotIndex);
}

/**
 * Among `opponents`, count bots in order; return avatar index for `playerId` if they are a bot.
 */
export function botAvatarIndexForPlayer(
  opponents: readonly { id: string }[],
  playerId: string,
  isBot: (id: string) => boolean
): number | null {
  if (!isBot(playerId)) return null;
  let n = 0;
  for (const o of opponents) {
    if (!isBot(o.id)) continue;
    if (o.id === playerId) return clampBotAvatarIndex(n);
    n += 1;
  }
  return clampBotAvatarIndex(0);
}

/** VS / shared table: walk `players` in order; nth bot gets avatar n % 3. */
export function botAvatarIndexFromPlayersList(
  players: readonly { id: string; type: string }[],
  playerId: string
): number | null {
  const p = players.find((x) => x.id === playerId);
  if (!p || p.type !== "bot") return null;
  let n = 0;
  for (const pl of players) {
    if (pl.type !== "bot") continue;
    if (pl.id === playerId) return clampBotAvatarIndex(n);
    n += 1;
  }
  return 0;
}
