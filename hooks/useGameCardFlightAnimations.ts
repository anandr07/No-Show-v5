import { useState, useEffect, useRef, useCallback } from "react";
import { useWindowDimensions } from "react-native";
import type { Card as CardType } from "@/lib/gameEngine";
import { getDeckPos, getDiscardPos } from "@/lib/game-card-flight-positions";
import type { GameCardAnimItem } from "@/components/FlightCard";

/**
 * Throw / pick flight animations (same logic as VS + online). Pass a resolver that maps
 * `playerIdx` to screen coordinates for the current table layout.
 */
export function useGameCardFlightAnimations(
  getPlayerScreenPos: (playerIdx: number, W: number, H: number) => { x: number; y: number },
  enabled: boolean,
  lastThrown: CardType[],
  lastThrownByPlayerId: string | null | undefined,
  turnPhase: string,
  currentPlayerIndex: number,
  players: { id: string }[],
) {
  const { width: W, height: H } = useWindowDimensions();
  const dimRef = useRef({ W, H });
  useEffect(() => {
    dimRef.current = { W, H };
  }, [W, H]);

  const [animations, setAnimations] = useState<GameCardAnimItem[]>([]);
  const prevAnimStateRef = useRef<{
    thrownKey: string;
    thrownCards: CardType[];
    phase: string;
    playerIdx: number;
    initialized: boolean;
  }>({ thrownKey: "", thrownCards: [], phase: "", playerIdx: -1, initialized: false });

  const addAnim = useCallback((anim: Omit<GameCardAnimItem, "id">) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setAnimations((prev) => [...prev, { ...anim, id }]);
  }, []);

  const removeAnim = useCallback((id: string) => {
    setAnimations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const prev = prevAnimStateRef.current;
    const newKey = lastThrown.map((c) => c.id).join(",");

    if (!prev.initialized) {
      prevAnimStateRef.current = {
        thrownKey: newKey,
        thrownCards: [...lastThrown],
        phase: turnPhase,
        playerIdx: currentPlayerIndex,
        initialized: true,
      };
      return;
    }

    const { W: lW, H: lH } = dimRef.current;
    const DECK = getDeckPos(lW, lH);
    const DISCARD = getDiscardPos(lW, lH);

    if (lastThrown.length > 0 && newKey !== prev.thrownKey && newKey !== "") {
      const throwerId = lastThrownByPlayerId;
      const throwerIdx = players.findIndex((p) => p.id === throwerId);
      if (throwerIdx >= 0) {
        const fromPos = getPlayerScreenPos(throwerIdx, lW, lH);
        lastThrown.slice(0, 3).forEach((card, i) => {
          addAnim({ card, fromPos, toPos: DISCARD, delay: i * 55 });
        });
      }
    }

    if (prev.phase === "pick" && turnPhase === "throw" && prev.playerIdx >= 0) {
      const pickerPos = getPlayerScreenPos(prev.playerIdx, lW, lH);
      const prevCount = prev.thrownCards.length;
      const newCount = lastThrown.length;

      if (prevCount > newCount) {
        const pickedCard = prev.thrownCards.find((c) => !lastThrown.some((nc) => nc.id === c.id));
        if (pickedCard) {
          addAnim({ card: pickedCard, fromPos: DISCARD, toPos: pickerPos, delay: 0 });
        }
      } else {
        addAnim({ faceDown: true, fromPos: DECK, toPos: pickerPos, delay: 0 });
      }
    }

    prevAnimStateRef.current = {
      thrownKey: newKey,
      thrownCards: [...lastThrown],
      phase: turnPhase,
      playerIdx: currentPlayerIndex,
      initialized: true,
    };
  }, [
    enabled,
    lastThrown,
    lastThrownByPlayerId,
    turnPhase,
    currentPlayerIndex,
    players,
    getPlayerScreenPos,
    addAnim,
  ]);

  useEffect(() => {
    if (!enabled) {
      prevAnimStateRef.current = {
        thrownKey: "",
        thrownCards: [],
        phase: "",
        playerIdx: -1,
        initialized: false,
      };
      setAnimations([]);
    }
  }, [enabled]);

  return { animations, removeAnim };
}
