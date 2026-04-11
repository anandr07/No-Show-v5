import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  ZoomIn,
  FadeIn,
  FadeInDown,
  SlideInDown,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useGame } from "@/context/GameContext";
import { useMultiplayerGame } from "@/context/MultiplayerGameContext";
import { useOnlineGame } from "@/context/OnlineGameContext";
import COLORS, { AVATAR_COLORS } from "@/constants/colors";
import {
  botAvatarIndexFromPlayersList,
  botAvatarIndexForPlayer,
} from "@/constants/bot-avatar";
import { useSettings } from "@/context/SettingsContext";
import { BotAvatarImage } from "@/components/BotAvatarImage";
import { PlayerAvatarImage } from "@/components/PlayerAvatarImage";
import { playSuccess } from "@/lib/sound";

export default function ResultsScreen() {
  const vsGame = useGame();
  const multiplayer = useMultiplayerGame();
  const online = useOnlineGame();
  const { avatarIndex } = useSettings();

  const isOnlineResults =
    online.state?.phase === "gameOver" && online.matchId != null;
  const isMultiplayer =
    !isOnlineResults && multiplayer.gameState?.phase === "gameOver";
  const state = isOnlineResults
    ? online.state!
    : isMultiplayer
      ? multiplayer.gameState!
      : vsGame.state;
  const rosterIsBot = (playerId: string) =>
    online.players.find((op) => op.id === playerId)?.isBot ?? false;
  const resolveResultsBotAvatarIndex = (playerId: string): number | null => {
    if (isOnlineResults) {
      if (!rosterIsBot(playerId)) return null;
      return botAvatarIndexForPlayer(state.players, playerId, rosterIsBot);
    }
    return botAvatarIndexFromPlayersList(state.players, playerId);
  };
  const resetGame = isOnlineResults
    ? online.resetOnline
    : isMultiplayer
      ? multiplayer.quitGame
      : vsGame.resetGame;
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const trophyIcon = useSharedValue(0.5);
  const winnerRing = useSharedValue(0.88);
  const glowPulse = useSharedValue(0);

  const trophyIconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: trophyIcon.value },
      { rotate: `${interpolate(trophyIcon.value, [0.5, 1], [-12, 0])}deg` },
    ],
  }));

  const winnerRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: winnerRing.value }],
    opacity: interpolate(winnerRing.value, [0.88, 1], [0.85, 1]),
  }));

  const glowPulseStyle = useAnimatedStyle(() => ({
    opacity: 0.42 + 0.38 * glowPulse.value,
    transform: [{ scale: 1 + 0.08 * glowPulse.value }],
  }));

  useEffect(() => {
    trophyIcon.value = withSpring(1, { damping: 10, stiffness: 140 });
    winnerRing.value = withSpring(1, { damping: 11, stiffness: 120 });
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSuccess();
  }, []);

  const totalPlayers = state.players.length;
  const getStanding = (p: (typeof state.players)[0]) => {
    if (p.status === "active") return 1;
    if (p.status === "left") return totalPlayers + 1;
    const order = p.eliminationOrder ?? 999;
    return totalPlayers - order + 1;
  };
  const sortedPlayers = [...state.players].sort((a, b) => getStanding(a) - getStanding(b));
  const winner = state.winner ?? sortedPlayers[0];

  const handlePlayAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isOnlineResults) {
      online.resetOnline();
      router.replace("/online");
    } else if (isMultiplayer) {
      multiplayer.resetToLobby();
      router.replace("/room");
    } else {
      resetGame();
      router.replace("/vs-setup");
    }
  };

  const handleHome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isOnlineResults) {
      online.resetOnline();
      router.replace("/");
    } else if (isMultiplayer) {
      multiplayer.quitGame();
    } else {
      resetGame();
      router.replace("/");
    }
  };

  const rankMedal = (rank: number) => {
    if (rank === 0) return { color: "#FFD700", icon: "trophy" as const };
    if (rank === 1) return { color: "#C0C0C0", icon: "medal" as const };
    if (rank === 2) return { color: "#CD7F32", icon: "medal" as const };
    return { color: COLORS.textMuted, icon: "remove" as const };
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#051810", "#0A2416", "#133D24"]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        entering={FadeInDown.duration(380).springify()}
        style={[styles.header, { paddingTop: topInset + 8 }]}
      >
        <Text style={styles.headerTitle}>GAME OVER</Text>
      </Animated.View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Winner spotlight */}
        <Animated.View entering={ZoomIn.springify().damping(14).stiffness(120).delay(60)} style={styles.winnerSpotlight}>
          <Animated.View style={[styles.winnerGlowPulseWrap, glowPulseStyle]} pointerEvents="none">
            <LinearGradient
              colors={["rgba(255,215,0,0.32)", "rgba(255,215,0,0.04)"]}
              style={styles.winnerGlow}
            />
          </Animated.View>
          <Animated.View style={trophyIconStyle}>
            <MaterialCommunityIcons name="trophy" size={48} color={COLORS.gold} />
          </Animated.View>
          <Animated.Text entering={FadeIn.delay(180)} style={styles.winnerLabel}>
            WINNER
          </Animated.Text>
          <Animated.View style={winnerRingStyle}>
            <View
              style={[
                styles.winnerAvatar,
                winner &&
                  resolveResultsBotAvatarIndex(winner.id) == null && {
                    backgroundColor:
                      AVATAR_COLORS[state.players.findIndex((pl) => pl.id === winner.id) % AVATAR_COLORS.length],
                  },
              ]}
            >
              {winner &&
                (resolveResultsBotAvatarIndex(winner.id) != null ? (
                  <BotAvatarImage
                    botAvatarIndex={resolveResultsBotAvatarIndex(winner.id)!}
                    size={56}
                    borderColor="rgba(255,255,255,0.25)"
                    backgroundColor="rgba(0,0,0,0.35)"
                  />
                ) : winner.type === "human" ? (
                  <PlayerAvatarImage
                    avatarIndex={avatarIndex}
                    size={56}
                    borderColor="rgba(255,255,255,0.25)"
                    backgroundColor="rgba(0,0,0,0.35)"
                  />
                ) : (
                  <Text style={styles.winnerInitial}>{winner.name[0]}</Text>
                ))}
            </View>
          </Animated.View>
          <Animated.Text entering={FadeIn.delay(260)} style={styles.winnerName}>
            {winner?.name}
          </Animated.Text>
          <Animated.Text entering={FadeIn.delay(340)} style={styles.winnerScore}>
            {winner?.totalScore ?? 0} pts
          </Animated.Text>
        </Animated.View>

        {/* Rankings */}
        <Animated.View entering={SlideInDown.delay(400)} style={styles.rankings}>
          <Text style={styles.rankingsTitle}>FINAL RANKINGS</Text>
          {sortedPlayers.map((p, rank) => {
            const medal = rankMedal(rank);
            const wBot = resolveResultsBotAvatarIndex(p.id);
            return (
              <Animated.View
                key={p.id}
                entering={SlideInDown.delay(500 + rank * 80)}
                style={[styles.rankRow, p.id === winner?.id && styles.rankRowWinner]}
              >
                <View style={styles.rankLeft}>
                  <Text style={[styles.rankNum, { color: medal.color }]}>#{rank + 1}</Text>
                  <View
                    style={[
                      styles.rankAvatar,
                      wBot == null && {
                        backgroundColor:
                          AVATAR_COLORS[state.players.findIndex((sp) => sp.id === p.id) % AVATAR_COLORS.length],
                      },
                    ]}
                  >
                    {wBot != null ? (
                      <BotAvatarImage
                        botAvatarIndex={wBot}
                        size={36}
                        borderColor="rgba(0,0,0,0.35)"
                        backgroundColor="rgba(0,0,0,0.3)"
                      />
                    ) : p.type === "human" ? (
                      <PlayerAvatarImage
                        avatarIndex={avatarIndex}
                        size={36}
                        borderColor="rgba(0,0,0,0.35)"
                        backgroundColor="rgba(0,0,0,0.3)"
                      />
                    ) : (
                      <Text style={styles.rankAvatarText}>{p.name[0]}</Text>
                    )}
                  </View>
                  <Text style={styles.rankName}>{p.name}</Text>
                  {p.status === "eliminated" && (
                    <View style={styles.outBadge}>
                      <Text style={styles.outBadgeText}>OUT</Text>
                    </View>
                  )}
                  {p.status === "left" && (
                    <View style={styles.leftBadge}>
                      <Text style={styles.leftBadgeText}>LEFT</Text>
                    </View>
                  )}
                </View>
                <View style={styles.rankRight}>
                  <Ionicons name={medal.icon} size={16} color={medal.color} />
                  <Text style={[styles.rankScore, { color: medal.color }]}>{p.totalScore}</Text>
                </View>
              </Animated.View>
            );
          })}
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={FadeIn.delay(800)} style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.playAgainBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            onPress={handlePlayAgain}
          >
            <LinearGradient colors={["#F39C12", "#D35400"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
            <MaterialCommunityIcons name="cards-playing" size={20} color="#fff" />
            <Text style={styles.playAgainText}>PLAY AGAIN</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.homeBtn, pressed && { opacity: 0.9 }]}
            onPress={handleHome}
          >
            <Ionicons name="home" size={18} color={COLORS.textMuted} />
            <Text style={styles.homeBtnText}>Home</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 8,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  headerTitle: {
    color: COLORS.gold,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 4,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 24,
    alignItems: "center",
    maxWidth: 500,
    alignSelf: "center",
    width: "100%",
  },
  winnerSpotlight: {
    alignItems: "center",
    gap: 6,
    position: "relative",
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  winnerGlowPulseWrap: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    top: 0,
    alignSelf: "center",
    overflow: "hidden",
  },
  winnerGlow: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  winnerLabel: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
  },
  winnerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: COLORS.gold,
    overflow: "hidden",
  },
  winnerInitial: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
  },
  winnerName: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
  },
  winnerScore: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: "700",
  },
  rankings: {
    width: "100%",
    gap: 8,
  },
  rankingsTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 4,
    textAlign: "center",
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  rankRowWinner: {
    backgroundColor: "rgba(255,215,0,0.1)",
    borderColor: "rgba(255,215,0,0.3)",
  },
  rankLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rankNum: {
    fontSize: 14,
    fontWeight: "800",
    width: 28,
  },
  rankAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  rankAvatarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  rankName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  outBadge: {
    backgroundColor: COLORS.eliminated,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  outBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },
  leftBadge: {
    backgroundColor: COLORS.error,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  leftBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },
  rankRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rankScore: {
    fontSize: 18,
    fontWeight: "800",
  },
  actions: {
    width: "100%",
    gap: 10,
  },
  playAgainBtn: {
    borderRadius: 16,
    overflow: "hidden",
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  playAgainText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 2,
  },
  homeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  homeBtnText: {
    color: COLORS.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
});
