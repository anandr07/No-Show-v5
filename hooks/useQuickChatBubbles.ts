import { useState, useCallback, useMemo } from "react";
import { getQuickChatText } from "@/constants/quickChatMessages";

export interface QuickChatBubbleEntry {
  id: string;
  playerId: string;
  messageId: number;
}

const DISPLAY_MS = 4500;

export function useQuickChatBubbles() {
  const [bubbles, setBubbles] = useState<QuickChatBubbleEntry[]>([]);

  const pushBubble = useCallback((playerId: string, messageId: number) => {
    const id = `qc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setBubbles((prev) => [...prev.filter((b) => b.playerId !== playerId), { id, playerId, messageId }]);
    setTimeout(() => {
      setBubbles((prev) => prev.filter((b) => b.id !== id));
    }, DISPLAY_MS);
  }, []);

  const textByPlayerId = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of bubbles) {
      const t = getQuickChatText(b.messageId);
      if (t) m.set(b.playerId, t);
    }
    return m;
  }, [bubbles]);

  return { bubbles, pushBubble, textByPlayerId };
}
