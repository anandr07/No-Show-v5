import COLORS from "./colors";

/** Matches `index.tsx` multiplayer panel */
export const MULTIPLAYER_FLOW = {
  accent: COLORS.blue,
  accentDark: COLORS.blueDark,
  bgGradient: ["#00101F", "#000A14", "#000509"] as const,
  rgb: "41,128,185" as const,
} as const;

/** Matches `index.tsx` online panel */
export const ONLINE_FLOW = {
  accent: COLORS.purple,
  accentDark: COLORS.purpleDark,
  bgGradient: ["#0A0014", "#06000D", "#030007"] as const,
  rgb: "155,89,182" as const,
} as const;

/** Matches `index.tsx` HOW TO PLAY panel */
export const HOW_PLAY_FLOW = {
  accent: COLORS.gold,
  accentDark: COLORS.goldDark,
  bgGradient: ["#0A0900", "#060600", "#030300"] as const,
  rgb: "255,215,0" as const,
} as const;
