import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { GameState, Card } from "@/lib/gameEngine";
import { getWebSocketUrl } from "@/lib/query-client";
import { useAuth } from "@/context/AuthContext";
import {
  ensureGuestOnlineUserId,
  isValidUuid,
} from "@/lib/online-analytics-user-id";
import { isValidQuickChatMessageId, type QuickChatEvent } from "@/constants/quickChatMessages";

type QueueMode = "online_2p" | "online_3p";
type OnlinePhase = "idle" | "queueing" | "matched" | "playing" | "finished";

interface OnlinePlayerInfo {
  id: string;
  name: string;
  isBot: boolean;
}

interface OnlineGameContextValue {
  phase: OnlinePhase;
  mode: QueueMode | null;
  playerId: string | null;
  userId: string | null;
  matchId: string | null;
  players: OnlinePlayerInfo[];
  state: GameState | null;
  isBotFilled: boolean;
  error: string;
  queueStartedAt: number | null;
  selectedCards: string[];

  joinQueue: (mode: QueueMode, playerName: string) => Promise<void>;
  cancelQueue: () => void;
  sendOnlineAction: (action: object) => void;
  resetOnline: () => void;
  clearError: () => void;
  selectCard: (cardId: string) => void;
  deselectCard: (cardId: string) => void;
  clearSelection: () => void;
  throwSelectedCards: () => void;
  pickFromDeck: () => void;
  pickFromThrown: (card: Card) => void;
  callShow: () => void;
  nextRound: () => void;
  quickChatEvents: QuickChatEvent[];
  sendQuickChat: (messageId: number) => void;
}

const OnlineGameContext = createContext<OnlineGameContextValue | null>(null);

export function OnlineGameProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<OnlinePhase>("idle");
  const [mode, setMode] = useState<QueueMode | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [players, setPlayers] = useState<OnlinePlayerInfo[]>([]);
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState("");
  const [isBotFilled, setIsBotFilled] = useState(false);
  const [queueStartedAt, setQueueStartedAt] = useState<number | null>(null);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [quickChatEvents, setQuickChatEvents] = useState<QuickChatEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const pushQuickChat = useCallback((playerId: string, messageId: number) => {
    const id = `qc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setQuickChatEvents((prev) => [...prev.filter((b) => b.playerId !== playerId), { id, playerId, messageId }]);
    setTimeout(() => {
      setQuickChatEvents((prev) => prev.filter((b) => b.id !== id));
    }, 4500);
  }, []);

  const handleMessage = useCallback((msg: { type: string; [key: string]: unknown }) => {
    if (msg.type === "QUEUE_STATUS") {
      if (msg.status === "queued") {
        setPhase("queueing");
        setError("");
      } else if (msg.status === "cancelled") {
        setPhase("idle");
      }
      return;
    }

    if (msg.type === "MATCH_FOUND") {
      setQuickChatEvents([]);
      setPhase("playing");
      setMatchId(msg.matchId as string);
      setPlayerId((msg.playerId as string) ?? null);
      setPlayers((msg.players as OnlinePlayerInfo[]) ?? []);
      setState((msg.state as GameState) ?? null);
      setIsBotFilled(Boolean(msg.isBotFilled));
      setError("");
      setSelectedCards([]);
      return;
    }

    if (msg.type === "ONLINE_QUICK_CHAT") {
      const pid = msg.playerId as string;
      const mid = msg.messageId;
      if (typeof pid === "string" && isValidQuickChatMessageId(mid)) {
        pushQuickChat(pid, mid);
      }
      return;
    }

    if (msg.type === "ONLINE_STATE_UPDATE") {
      setState((msg.state as GameState) ?? null);
      setError("");
      return;
    }

    if (msg.type === "ONLINE_MATCH_FINISHED") {
      setPhase("finished");
      return;
    }

    if (msg.type === "ONLINE_ERROR" || msg.type === "GAME_ACTION_ERROR") {
      setError(String(msg.message ?? "Online error"));
      return;
    }
  }, [pushQuickChat]);

  const connectSocket = useCallback(() => {
    const wsUrl = getWebSocketUrl("/ws-online");

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch {
        // ignore
      }
    };
    ws.onerror = () => setError("Cannot reach online server.");
    ws.onclose = () => {
      setPhase((prev) => (prev === "finished" ? "finished" : "idle"));
    };
    return ws;
  }, [handleMessage]);

  const joinQueue = useCallback(async (queueMode: QueueMode, playerName: string) => {
    setError("");
    const id = isValidUuid(user?.id)
      ? user.id
      : await ensureGuestOnlineUserId();
    setUserId(id);
    setMode(queueMode);
    setQueueStartedAt(Date.now());

    const ws = connectSocket();
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "QUEUE_JOIN",
          mode: queueMode,
          playerName: playerName.trim() || "Player",
          userId: id,
        })
      );
    };
  }, [connectSocket, user?.id]);

  const cancelQueue = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "QUEUE_CANCEL" }));
    }
    setPhase("idle");
    setQueueStartedAt(null);
    setMode(null);
  }, []);

  const sendOnlineAction = useCallback((action: object) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: "ONLINE_ACTION",
        action,
      })
    );
  }, []);

  const sendQuickChat = useCallback((messageId: number) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "ONLINE_QUICK_CHAT", messageId }));
  }, []);

  const clearError = useCallback(() => setError(""), []);

  const selectCard = useCallback((cardId: string) => {
    setSelectedCards((prev) => (prev.includes(cardId) ? prev : [...prev, cardId]));
  }, []);

  const deselectCard = useCallback((cardId: string) => {
    setSelectedCards((prev) => prev.filter((id) => id !== cardId));
  }, []);

  const clearSelection = useCallback(() => setSelectedCards([]), []);

  const throwSelectedCards = useCallback(() => {
    if (!state || !playerId) return;
    const myIndex = state.players.findIndex((p) => p.id === playerId);
    if (myIndex < 0) return;
    const player = state.players[myIndex];
    const cards = player.hand.filter((c) => selectedCards.includes(c.id));
    if (cards.length === 0) return;
    sendOnlineAction({ type: "THROW_CARDS", cards });
    setSelectedCards([]);
  }, [state, playerId, selectedCards, sendOnlineAction]);

  const pickFromDeck = useCallback(() => {
    sendOnlineAction({ type: "PICK_FROM_DECK" });
  }, [sendOnlineAction]);

  const pickFromThrown = useCallback(
    (card: Card) => {
      sendOnlineAction({ type: "PICK_FROM_THROWN", cardId: card.id });
    },
    [sendOnlineAction]
  );

  const callShow = useCallback(() => {
    sendOnlineAction({ type: "CALL_SHOW" });
  }, [sendOnlineAction]);

  const nextRound = useCallback(() => {
    sendOnlineAction({ type: "NEXT_ROUND" });
  }, [sendOnlineAction]);

  useEffect(() => {
    if (!state || !playerId) return;
    const me = state.players.find((p) => p.id === playerId);
    const handIds = new Set((me?.hand ?? []).map((c) => c.id));
    setSelectedCards((prev) => prev.filter((id) => handIds.has(id)));
  }, [state, playerId]);

  const resetOnline = useCallback(() => {
    closeSocket();
    setPhase("idle");
    setMode(null);
    setPlayerId(null);
    setMatchId(null);
    setPlayers([]);
    setState(null);
    setError("");
    setQueueStartedAt(null);
    setIsBotFilled(false);
    setSelectedCards([]);
    setQuickChatEvents([]);
  }, [closeSocket]);

  const value = useMemo<OnlineGameContextValue>(
    () => ({
      phase,
      mode,
      playerId,
      userId,
      matchId,
      players,
      state,
      isBotFilled,
      error,
      queueStartedAt,
      selectedCards,
      joinQueue,
      cancelQueue,
      sendOnlineAction,
      resetOnline,
      clearError,
      selectCard,
      deselectCard,
      clearSelection,
      throwSelectedCards,
      pickFromDeck,
      pickFromThrown,
      callShow,
      nextRound,
      quickChatEvents,
      sendQuickChat,
    }),
    [
      phase,
      mode,
      playerId,
      userId,
      matchId,
      players,
      state,
      isBotFilled,
      error,
      queueStartedAt,
      selectedCards,
      joinQueue,
      cancelQueue,
      sendOnlineAction,
      resetOnline,
      clearError,
      selectCard,
      deselectCard,
      clearSelection,
      throwSelectedCards,
      pickFromDeck,
      pickFromThrown,
      callShow,
      nextRound,
      quickChatEvents,
      sendQuickChat,
    ]
  );

  return <OnlineGameContext.Provider value={value}>{children}</OnlineGameContext.Provider>;
}

export function useOnlineGame() {
  const ctx = useContext(OnlineGameContext);
  if (!ctx) throw new Error("useOnlineGame must be used within OnlineGameProvider");
  return ctx;
}
