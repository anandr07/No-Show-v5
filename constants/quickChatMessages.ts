/** Predefined quick-chat lines (index = messageId sent over the wire). */

export interface QuickChatEvent {
  id: string;
  playerId: string;
  messageId: number;
}

export const QUICK_CHAT_MESSAGES: readonly string[] = [
  "Bluff! 😏",
  "I dare you 😈",
  "Try me 😉",
  "You sure about that? 🤨",
  "Big talk 👀",
  "Feeling lucky? 🍀",
  "Read me if you can 🧠",
  "Not so easy 😎",
  "Easy win 😎",
  "Told you! 😏",
  "Too good 🔥",
  "That’s how it’s done 💪",
  "King of the table 👑",
  "Unstoppable 🚀",
  "On a roll 🔥",
  "Ouch 😬",
  "That hurt 💔",
  "So close 😩",
  "My luck today 😭",
  "Not again 🤦‍♂️",
  "I had that! 😤",
  "One more round 😏",
  "Nice hand 👏",
  "Well played 👍",
  "Good game 🤝",
  "Respect 🙌",
  "That was close 🤝",
  "Lucky win 😏",
  "Beginner’s luck 😉",
  "Is that all? 😴",
  "Try harder 😎",
  "You got lucky 🍀",
  "I’m just warming up 🔥",
  "😎 Cool",
  "😂 Laugh",
  "😡 Angry",
  "😲 Shocked",
  "😭 Cry",
  "😏 Smirk",
  "🤯 Mind blown",
  "🥶 Nervous",
] as const;

export const QUICK_CHAT_MESSAGE_COUNT = QUICK_CHAT_MESSAGES.length;

export function isValidQuickChatMessageId(id: unknown): id is number {
  return typeof id === "number" && Number.isInteger(id) && id >= 0 && id < QUICK_CHAT_MESSAGE_COUNT;
}

export function getQuickChatText(messageId: number): string | null {
  if (!isValidQuickChatMessageId(messageId)) return null;
  return QUICK_CHAT_MESSAGES[messageId] ?? null;
}
