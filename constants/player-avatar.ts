/** Eight selectable profile / in-game avatars (PNG in assets/images/avatars). */

export const PLAYER_AVATAR_COUNT = 8;

export const PLAYER_AVATARS = [
  require("@/assets/images/avatars/avatar-1.png"),
  require("@/assets/images/avatars/avatar-2.png"),
  require("@/assets/images/avatars/avatar-3.png"),
  require("@/assets/images/avatars/avatar-4.png"),
  require("@/assets/images/avatars/avatar-5.png"),
  require("@/assets/images/avatars/avatar-6.png"),
  require("@/assets/images/avatars/avatar-7.png"),
  require("@/assets/images/avatars/avatar-8.png"),
] as const;

export function clampAvatarIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;
  const i = Math.floor(index);
  if (i < 0) return 0;
  if (i >= PLAYER_AVATAR_COUNT) return PLAYER_AVATAR_COUNT - 1;
  return i;
}
