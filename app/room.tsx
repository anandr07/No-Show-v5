import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import Animated, { ZoomIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import COLORS, { AVATAR_COLORS } from "@/constants/colors";
import { useMultiplayerGame } from "@/context/MultiplayerGameContext";
import { normalizeRoomCodeForJoin } from "@/lib/gameEngine";
import { getApiUrl } from "@/lib/query-client";

type Phase = "home" | "create" | "join" | "lobby";

export default function RoomScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [phase, setPhase] = useState<Phase>("home");
  const [playerName, setPlayerName] = useState("Player");
  const [roomCode, setRoomCode] = useState("");

  const {
    room,
    playerId: myId,
    error,
    isConnecting,
    createRoom,
    joinRoom,
    clearError,
    setReady,
    startGame,
    leaveRoom,
    shareCode,
  } = useMultiplayerGame();
  const apiHost = (() => {
    try {
      return new URL(getApiUrl()).host;
    } catch {
      return "localhost:5000";
    }
  })();

  const handleCreate = () => {
    clearError();
    const name = playerName.trim() || "Player";
    createRoom(name);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleJoin = () => {
    clearError();
    const name = playerName.trim() || "Player";
    const code = normalizeRoomCodeForJoin(roomCode);
    if (code.length !== 6) {
      return;
    }
    joinRoom(code, name);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleReady = () => {
    const me = room?.players.find((p) => p.id === myId);
    setReady(!me?.isReady);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleStartGame = () => {
    if (room && room.players.length < 3) {
      Alert.alert("Need more players", "Need 3+ players and everyone ready to start.");
      return;
    }
    if (room && !room.players.every((p) => p.isReady)) {
      Alert.alert("Not all ready", "Need 3+ players and everyone ready to start.");
      return;
    }
    startGame();
  };

  const handleLeave = () => {
    leaveRoom();
    setPhase("home");
  };

  const me = room?.players.find((p) => p.id === myId);
  const isOwner = me?.isOwner ?? false;
  const allReady = room?.players.every((p) => p.isReady) ?? false;
  const canStart = isOwner && (room?.players.length ?? 0) >= 3 && allReady;

  const displayPhase = room ? "lobby" : phase;

  const renderHome = () => (
    <View style={styles.pageContent}>
      <Animated.View entering={ZoomIn.delay(100)} style={styles.iconWrap}>
        <LinearGradient colors={["#2980B9", "#1A5276"]} style={styles.iconGradient}>
          <Ionicons name="people" size={32} color="#fff" />
        </LinearGradient>
      </Animated.View>
      <Animated.View entering={SlideInDown.delay(150)} style={styles.section}>
        <Text style={styles.label}>YOUR NAME</Text>
        <TextInput
          style={styles.input}
          value={playerName}
          onChangeText={setPlayerName}
          placeholder="Enter your name"
          placeholderTextColor={COLORS.textDim}
          maxLength={16}
        />
      </Animated.View>
      <Animated.View entering={SlideInDown.delay(250)} style={styles.twoButtons}>
        <Pressable
          style={({ pressed }) => [styles.halfBtn, styles.createBtn, pressed && { opacity: 0.9 }]}
          onPress={() => setPhase("create")}
        >
          <Ionicons name="add-circle" size={22} color="#fff" />
          <Text style={styles.halfBtnText}>Create{"\n"}Room</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.halfBtn, styles.joinBtn, pressed && { opacity: 0.9 }]}
          onPress={() => setPhase("join")}
        >
          <Ionicons name="enter" size={22} color="#fff" />
          <Text style={styles.halfBtnText}>Join{"\n"}Room</Text>
        </Pressable>
      </Animated.View>
    </View>
  );

  const renderCreate = () => (
    <View style={styles.pageContent}>
      <Animated.View entering={ZoomIn.delay(100)} style={styles.section}>
        <Text style={styles.bigTitle}>Create a Room</Text>
        <Text style={styles.bigSub}>Share your room code with friends to play together</Text>
      </Animated.View>
      {error ? (
        <View style={styles.errorSection}>
          <View style={styles.errorBadge}>
            <Ionicons name="alert-circle" size={14} color="#fff" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <Text style={styles.errorHint}>
            • Server running? npm run server:dev{"\n"}
            • Try in browser first (press W in Expo){"\n"}
            • Firewall: run scripts\allow-firewall.ps1 as Admin{"\n"}
            • Phone: same WiFi as PC ({apiHost})
          </Text>
        </View>
      ) : null}
      <Pressable
        style={({ pressed }) => [styles.mainActionBtn, pressed && { opacity: 0.9 }]}
        onPress={handleCreate}
        disabled={isConnecting}
      >
        <LinearGradient colors={["#2980B9", "#1A5276"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
        {isConnecting ? (
          <Text style={styles.mainActionText}>Connecting...</Text>
        ) : (
          <>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.mainActionText}>Create Room as {playerName || "Player"}</Text>
          </>
        )}
      </Pressable>
    </View>
  );

  const renderJoin = () => (
    <View style={styles.pageContent}>
      <Animated.View entering={ZoomIn} style={styles.section}>
        <Text style={styles.bigTitle}>Join a Room</Text>
        <Text style={styles.bigSub}>Enter the 6-character code shared by your friend</Text>
      </Animated.View>
      <View style={styles.section}>
        <Text style={styles.label}>ROOM CODE</Text>
        <TextInput
          style={[styles.input, styles.codeInput]}
          value={roomCode}
          onChangeText={(t) => setRoomCode(t.toUpperCase())}
          placeholder="XXXXXX"
          placeholderTextColor={COLORS.textDim}
          maxLength={6}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>
      {error ? (
        <View style={styles.errorSection}>
          <View style={styles.errorBadge}>
            <Ionicons name="alert-circle" size={14} color="#fff" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <Text style={styles.errorHint}>
            {error === "Room not found"
              ? `• Both devices on same WiFi as PC?\n• Server restarted? Create room again\n• Double-check the 6-character code\n• Owner: keep lobby open until others join\n• Current API host: ${apiHost}`
              : `• Server running? npm run server:dev\n• Firewall: scripts\\allow-firewall.ps1 as Admin\n• Phone: same WiFi as PC (${apiHost})`}
          </Text>
        </View>
      ) : null}
      <Pressable
        style={({ pressed }) => [styles.mainActionBtn, pressed && { opacity: 0.9 }]}
        onPress={handleJoin}
        disabled={isConnecting}
      >
        <LinearGradient colors={["#27AE60", "#145A32"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
        {isConnecting ? (
          <Text style={styles.mainActionText}>Joining...</Text>
        ) : (
          <>
            <Ionicons name="enter" size={20} color="#fff" />
            <Text style={styles.mainActionText}>Join Room</Text>
          </>
        )}
      </Pressable>
    </View>
  );

  const renderLobby = () => (
    <View style={styles.pageContent}>
      <View style={styles.lobbyHeader}>
        <View>
          <Text style={styles.lobbyTitle}>Room Lobby</Text>
          <Text style={styles.lobbySub}>{room?.players.length ?? 0}/4 players</Text>
        </View>
        <Pressable style={styles.shareBtn} onPress={shareCode}>
          <Ionicons name="share-outline" size={18} color={COLORS.gold} />
          <View style={styles.codeChip}>
            <Text style={styles.codeChipText}>{room?.code}</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView style={styles.playersList} showsVerticalScrollIndicator={false}>
        {room?.players.map((p, idx) => (
          <View key={p.id} style={[styles.lobbyPlayerRow, p.id === myId && styles.lobbyPlayerRowMe]}>
            <View style={[styles.lobbyAvatar, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }]}>
              <Text style={styles.lobbyAvatarText}>{p.name[0]}</Text>
            </View>
            <Text style={styles.lobbyPlayerName}>{p.name}</Text>
            {p.isOwner && (
              <View style={styles.ownerBadge}>
                <MaterialCommunityIcons name="crown" size={10} color="#000" />
                <Text style={styles.ownerBadgeText}>HOST</Text>
              </View>
            )}
            {p.id === myId && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>YOU</Text>
              </View>
            )}
            <View style={[styles.readyBadge, p.isReady ? styles.readyBadgeOn : styles.readyBadgeOff]}>
              <Text style={styles.readyBadgeText}>{p.isReady ? "READY" : "WAITING"}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {(room?.players.length ?? 0) < 3 && (
        <Text style={styles.needMoreText}>Waiting for {3 - (room?.players.length ?? 0)} more player(s)...</Text>
      )}

      {!allReady && (room?.players.length ?? 0) >= 3 && (
        <Text style={styles.needMoreText}>Everyone must be ready to start</Text>
      )}

      <View style={styles.lobbyActions}>
        {/* Ready button - tap to toggle; green = ready, grey = not ready */}
        <Pressable
          style={[styles.readyBtn, me?.isReady && styles.readyBtnOn]}
          onPress={handleReady}
        >
          <Ionicons name={me?.isReady ? "checkmark-circle" : "checkmark-circle-outline"} size={20} color={me?.isReady ? "#000" : "#9CA3AF"} />
          <Text style={[styles.readyBtnText, me?.isReady && styles.readyBtnTextOn]}>
            Ready
          </Text>
        </Pressable>

        {isOwner && (
          <Pressable
            style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
            onPress={handleStartGame}
            disabled={!canStart}
          >
            <LinearGradient
              colors={canStart ? ["#F39C12", "#D35400"] : ["#333", "#222"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <MaterialCommunityIcons name="cards-playing" size={18} color="#fff" />
            <Text style={styles.startBtnText}>START GAME</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#051810", "#0A2416"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: topInset + 8, paddingLeft: insets.left + 12 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            if (displayPhase === "lobby") {
              handleLeave();
            } else if (phase !== "home") {
              setPhase("home");
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.gold} />
        </Pressable>
        <Text style={styles.headerTitle}>MULTIPLAYER</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 24, paddingHorizontal: insets.left + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {displayPhase === "home" && renderHome()}
        {displayPhase === "create" && renderCreate()}
        {displayPhase === "join" && renderJoin()}
        {displayPhase === "lobby" && renderLobby()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,215,0,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
  },
  headerTitle: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 2,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 8,
  },
  pageContent: {
    flex: 1,
    gap: 20,
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
  },
  iconWrap: { alignSelf: "center" },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2980B9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  section: { gap: 10 },
  label: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
  },
  codeInput: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 6,
    textAlign: "center",
  },
  twoButtons: {
    flexDirection: "row",
    gap: 12,
  },
  halfBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
  },
  createBtn: {
    backgroundColor: "#2980B9",
  },
  joinBtn: {
    backgroundColor: "#27AE60",
  },
  halfBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  bigTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  bigSub: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  errorSection: { gap: 8 },
  errorBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  errorHint: {
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  errorText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  mainActionBtn: {
    borderRadius: 16,
    overflow: "hidden",
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  mainActionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
  },
  lobbyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lobbyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },
  lobbySub: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,215,0,0.1)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
  },
  codeChip: {
    backgroundColor: COLORS.gold,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  codeChipText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
  playersList: {
    maxHeight: 220,
  },
  lobbyPlayerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  lobbyPlayerRowMe: {
    backgroundColor: "rgba(255,215,0,0.08)",
    borderColor: "rgba(255,215,0,0.25)",
  },
  lobbyAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  lobbyAvatarText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  lobbyPlayerName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  ownerBadge: {
    backgroundColor: COLORS.gold,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ownerBadgeText: {
    color: "#000",
    fontSize: 9,
    fontWeight: "800",
  },
  youBadge: {
    backgroundColor: "rgba(255,215,0,0.2)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.4)",
  },
  youBadgeText: {
    color: COLORS.gold,
    fontSize: 9,
    fontWeight: "800",
  },
  readyBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  readyBadgeOn: { backgroundColor: "#27AE60" },
  readyBadgeOff: { backgroundColor: "rgba(255,255,255,0.1)" },
  readyBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  needMoreText: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: "center",
    fontWeight: "500",
  },
  lobbyActions: {
    gap: 10,
  },
  readyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: "#4B5563",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#6B7280",
  },
  readyBtnOn: {
    backgroundColor: "#22C55E",
    borderColor: "#16A34A",
  },
  readyBtnText: {
    color: "#9CA3AF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
  readyBtnTextOn: {
    color: "#000",
  },
  startBtn: {
    borderRadius: 16,
    overflow: "hidden",
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  startBtnDisabled: {
    opacity: 0.5,
  },
  startBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
});
