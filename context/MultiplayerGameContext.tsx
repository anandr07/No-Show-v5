import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { Share, Alert } from "react-native";
import { router } from "expo-router";
import type { GameState, Card } from "@/lib/gameEngine";
import { getWebSocketUrl } from "@/lib/query-client";
import { isValidQuickChatMessageId, type QuickChatEvent } from "@/constants/quickChatMessages";

export type { QuickChatEvent };

type MultiplayerPhase = "idle" | "lobby" | "playing";

interface RoomPlayer {
  id: string;
  name: string;
  isReady: boolean;
  isOwner: boolean;
}

interface RoomInfo {
  code: string;
  players: RoomPlayer[];
  phase: string;
}

interface MultiplayerContextValue {
  phase: MultiplayerPhase;
  room: RoomInfo | null;
  gameState: GameState | null;
  playerId: string | null;
  roomCode: string | null;
  error: string;
  isConnecting: boolean;

  createRoom: (playerName: string) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  clearError: () => void;
  setReady: (ready: boolean) => void;
  startGame: () => void;
  leaveRoom: () => void;
  shareCode: () => void;

  selectCard: (cardId: string) => void;
  deselectCard: (cardId: string) => void;
  clearSelection: () => void;
  throwSelectedCards: () => void;
  pickFromDeck: () => void;
  pickFromThrown: (card: Card) => void;
  callShow: () => void;
  nextRound: () => void;
  quitGame: () => void;
  resetToLobby: () => void;

  selectedCards: string[];
  quickChatEvents: QuickChatEvent[];
  sendQuickChat: (messageId: number) => void;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

export function MultiplayerGameProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<MultiplayerPhase>("idle");
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [quickChatEvents, setQuickChatEvents] = useState<QuickChatEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingActionRef = useRef<"create" | "join" | null>(null);
  const pendingNameRef = useRef("");
  const pendingCodeRef = useRef("");

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    pendingActionRef.current = null;
  }, []);

  const pushQuickChat = useCallback((playerId: string, messageId: number) => {
    const id = `qc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setQuickChatEvents((prev) => [...prev.filter((b) => b.playerId !== playerId), { id, playerId, messageId }]);
    setTimeout(() => {
      setQuickChatEvents((prev) => prev.filter((b) => b.id !== id));
    }, 4500);
  }, []);

  const handleMessage = useCallback(
    (msg: { type: string; [key: string]: unknown }) => {
      if (msg.type === "ROOM_CREATED") {
        const roomData = msg.room as RoomInfo;
        setPlayerId(msg.playerId as string);
        setRoom(roomData ? { ...roomData, players: [...(roomData.players || [])] } : null);
        setRoomCode(roomData?.code ?? null);
        setIsConnecting(false);
        setPhase("lobby");
      } else if (msg.type === "ROOM_JOINED") {
        const roomData = msg.room as RoomInfo;
        setPlayerId(msg.playerId as string);
        setRoom(roomData ? { ...roomData, players: [...(roomData.players || [])] } : null);
        setRoomCode(roomData?.code ?? null);
        setIsConnecting(false);
        setPhase("lobby");
      } else if (msg.type === "ROOM_UPDATED") {
        const roomData = msg.room as RoomInfo;
        if (roomData) {
          setRoom({ ...roomData, players: [...(roomData.players || [])] });
        }
      } else if (msg.type === "GAME_STARTED") {
        setQuickChatEvents([]);
        setGameState(msg.state as GameState);
        setPhase("playing");
        router.replace("/game-multiplayer");
      } else if (msg.type === "QUICK_CHAT") {
        const pid = msg.playerId as string;
        const mid = msg.messageId;
        if (typeof pid === "string" && isValidQuickChatMessageId(mid)) {
          pushQuickChat(pid, mid);
        }
      } else if (msg.type === "GAME_STATE_UPDATE") {
        setGameState(msg.state as GameState);
        setError(""); // Clear any prior action error on successful state update
      } else if (msg.type === "PLAYER_LEFT") {
        if (msg.state) {
          setGameState(msg.state as GameState);
        }
        if (msg.room) {
          const roomData = msg.room as RoomInfo;
          setRoom(roomData ? { ...roomData, players: [...(roomData.players || [])] } : null);
        }
        if (msg.lastPlayerRemaining) {
          setPhase("idle");
          setRoom(null);
          setGameState(null);
          setPlayerId(null);
          setRoomCode(null);
          closeWs();
          Alert.alert("Game Ended", "All other players left. Returning to home…", [
            { text: "OK", onPress: () => router.replace("/") },
          ]);
        } else if (msg.playerName) {
          Alert.alert("Player Left", `${msg.playerName} has left the game.`);
        }
      } else if (msg.type === "ERROR") {
        setError(msg.message as string);
        setIsConnecting(false);
      } else if (msg.type === "GAME_ACTION_ERROR") {
        const m = String(msg.message ?? "");
        if (m === "Not in show phase") return;
        setError(m);
      }
    },
    [closeWs, pushQuickChat]
  );

  const connectAndSend = useCallback(
    (action: "create" | "join", playerName: string, code?: string) => {
      // Always close any existing connection before opening a new one so the
      // server-side room state stays consistent (no stale WS holding a room slot).
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      try {
        const wsUrl = getWebSocketUrl("/ws");
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            handleMessage(msg);
          } catch {}
        };

        ws.onerror = () => {
          setError("Cannot reach server. Check your network and try again.");
          setIsConnecting(false);
        };

        ws.onopen = () => {
          if (action === "create") {
            ws.send(JSON.stringify({ type: "CREATE_ROOM", playerName }));
          } else {
            ws.send(
              JSON.stringify({
                type: "JOIN_ROOM",
                playerName,
                roomCode: code,
              })
            );
          }
        };

        return ws;
      } catch {
        setError("Could not connect to server");
        setIsConnecting(false);
        return null;
      }
    },
    [handleMessage]
  );

  const createRoom = useCallback(
    (playerName: string) => {
      setError("");
      setIsConnecting(true);
      connectAndSend("create", playerName.trim() || "Player");
    },
    [connectAndSend]
  );

  const clearError = useCallback(() => setError(""), []);

  const joinRoom = useCallback(
    (code: string, playerName: string) => {
      setError("");
      if (code.trim().length !== 6) {
        setError("Room code must be 6 characters");
        return;
      }
      setIsConnecting(true);
      connectAndSend("join", playerName.trim() || "Player", code.trim().toUpperCase());
    },
    [connectAndSend]
  );

  const setReady = useCallback((ready: boolean) => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "SET_READY", ready }));
    }
  }, []);

  const startGame = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "START_GAME" }));
    }
  }, []);

  const leaveRoom = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "LEAVE_ROOM" }));
      closeWs();
    }
    setPhase("idle");
    setRoom(null);
    setGameState(null);
    setPlayerId(null);
    setRoomCode(null);
    setSelectedCards([]);
    setQuickChatEvents([]);
  }, [closeWs]);

  const quitGame = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "GAME_QUIT" }));
      closeWs();
    }
    setPhase("idle");
    setRoom(null);
    setGameState(null);
    setPlayerId(null);
    setRoomCode(null);
    setSelectedCards([]);
    setQuickChatEvents([]);
    router.replace("/");
  }, [closeWs]);

  const resetToLobby = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "GAME_QUIT" }));
      closeWs();
    }
    setPhase("idle");
    setRoom(null);
    setGameState(null);
    setPlayerId(null);
    setRoomCode(null);
    setSelectedCards([]);
    setQuickChatEvents([]);
  }, [closeWs]);

  const shareCode = useCallback(() => {
    if (room?.code) {
      Share.share({ message: `Join my No-Show card game! Room code: ${room.code}` });
    }
  }, [room?.code]);

  const sendAction = useCallback((action: object) => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "GAME_ACTION", action }));
    }
  }, []);

  const sendQuickChat = useCallback((messageId: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "QUICK_CHAT", messageId }));
    }
  }, []);

  const selectCard = useCallback((cardId: string) => {
    setSelectedCards((prev) => (prev.includes(cardId) ? prev : [...prev, cardId]));
  }, []);

  const deselectCard = useCallback((cardId: string) => {
    setSelectedCards((prev) => prev.filter((id) => id !== cardId));
  }, []);

  const clearSelection = useCallback(() => setSelectedCards([]), []);

  const throwSelectedCards = useCallback(() => {
    const state = gameState;
    if (!state || !playerId) return;
    const myIndex = state.players.findIndex((p) => p.id === playerId);
    if (myIndex < 0) return;
    const player = state.players[myIndex];
    const cards = player.hand.filter((c) => selectedCards.includes(c.id));
    if (cards.length === 0) return;

    sendAction({ type: "THROW_CARDS", playerId, cards });
    setSelectedCards([]);
  }, [gameState, playerId, selectedCards, sendAction]);

  const pickFromDeck = useCallback(() => {
    if (!playerId) return;
    sendAction({ type: "PICK_FROM_DECK", playerId });
  }, [playerId, sendAction]);

  const pickFromThrown = useCallback(
    (card: Card) => {
      if (!playerId) return;
      sendAction({ type: "PICK_FROM_THROWN", playerId, cardId: card.id });
    },
    [playerId, sendAction]
  );

  const callShow = useCallback(() => {
    if (!playerId) return;
    sendAction({ type: "CALL_SHOW", playerId });
  }, [playerId, sendAction]);

  const nextRound = useCallback(() => {
    if (!playerId) return;
    sendAction({ type: "NEXT_ROUND", playerId });
  }, [playerId, sendAction]);

  // Close WebSocket only on unmount (not when phase changes - that was closing the connection when entering lobby!)
  useEffect(() => {
    return () => closeWs();
  }, [closeWs]);

  return (
    <MultiplayerContext.Provider
      value={{
        phase,
        room,
        gameState,
        playerId,
        roomCode,
        error,
        isConnecting,
        selectedCards,
        createRoom,
        joinRoom,
        clearError,
        setReady,
        startGame,
        leaveRoom,
        shareCode,
        selectCard,
        deselectCard,
        clearSelection,
        throwSelectedCards,
        pickFromDeck,
        pickFromThrown,
        callShow,
        nextRound,
        quitGame,
        resetToLobby,
        quickChatEvents,
        sendQuickChat,
      }}
    >
      {children}
    </MultiplayerContext.Provider>
  );
}

export function useMultiplayerGame() {
  const ctx = useContext(MultiplayerContext);
  if (!ctx) throw new Error("useMultiplayerGame must be used within MultiplayerGameProvider");
  return ctx;
}
