import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useOnlineGame } from "@/context/OnlineGameContext";
import { apiRequest } from "@/lib/query-client";
import { resolveOnlineAnalyticsUserId } from "@/lib/online-analytics-user-id";
import { useResponsive } from "@/lib/responsive";
const LEVEL_IMAGES: Record<number, number> = {
  1: require("@/assets/images/levels/beginner-table.png"),
  2: require("@/assets/images/levels/chip-collector.png"),
  3: require("@/assets/images/levels/high-roller.png"),
  4: require("@/assets/images/levels/elite-gambler.png"),
  5: require("@/assets/images/levels/kingpin.png"),
  6: require("@/assets/images/levels/legend-of-the-table.png"),
};

const LEVELS = [
  { level: 1, name: "Beginner Table", min: 0, max: 999, icon: "cards-outline" as const },
  { level: 2, name: "Chip Collector", min: 1000, max: 1999, icon: "poker-chip" as const },
  { level: 3, name: "High Roller", min: 2000, max: 2999, icon: "cash-multiple" as const },
  { level: 4, name: "Elite Gambler", min: 3000, max: 3999, icon: "trophy-outline" as const },
  { level: 5, name: "Kingpin", min: 4000, max: 4999, icon: "crown-outline" as const },
  { level: 6, name: "Legend of the Table", min: 5000, max: null, icon: "cards-spade-outline" as const },
];

function computeLevel(points: number) {
  const found = LEVELS.find((lvl) => points >= lvl.min && (lvl.max === null || points <= lvl.max));
  return found ?? LEVELS[0];
}

export default function OnlineScreen() {
  const insets = useSafeAreaInsets();
  const { scale, vScale, mScale } = useResponsive();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const [name, setName] = useState("Player");
  const [onlinePoints, setOnlinePoints] = useState(0);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const { joinQueue, error, resetOnline, userId } = useOnlineGame();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const uid = await resolveOnlineAnalyticsUserId(user?.id ?? userId ?? undefined);
        if (!uid) return;
        const res = await apiRequest("GET", `/api/online/profile/${uid}`);
        const json = (await res.json()) as {
          stats?: { online_points_total?: number; display_name?: string };
        };
        const pts = Number(json.stats?.online_points_total ?? 0);
        setOnlinePoints(Number.isFinite(pts) ? pts : 0);
        if (json.stats?.display_name) {
          setName(json.stats.display_name);
        }
      } catch {
        // keep defaults
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [userId, user?.id]);

  const startQueue = async (mode: "online_2p" | "online_3p") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetOnline();
    await joinQueue(mode, name.trim() || "Player");
    router.push({ pathname: "/online-queue", params: { mode } });
  };

  const currentLevel = useMemo(() => computeLevel(onlinePoints), [onlinePoints]);
  const progress = useMemo(() => {
    if (currentLevel.max === null) return 1;
    const range = currentLevel.max - currentLevel.min + 1;
    return Math.max(0, Math.min(1, (onlinePoints - currentLevel.min) / range));
  }, [currentLevel, onlinePoints]);
  const ringSize = mScale(168, 0.65, 146, 192);
  const strokeWidth = mScale(10, 0.5, 8, 12);
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#051810", "#0A2416", "#133D24"]} style={StyleSheet.absoluteFill} />
      <View style={[styles.header, { paddingTop: topInset + vScale(8, 6, 14), paddingHorizontal: scale(16, 12, 20) }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={COLORS.gold} />
        </Pressable>
        <Text style={styles.title}>ONLINE MATCHMAKING</Text>
        <View style={{ width: 52 }} />
      </View>

      <View style={[styles.content, { padding: scale(20, 14, 24), gap: vScale(14, 10, 18) }]}>
        <Text style={[styles.label, { fontSize: mScale(11, 0.5, 10, 13) }]}>PLAYER NAME</Text>
        <TextInput
          style={[
            styles.input,
            {
              borderRadius: mScale(12, 0.5, 10, 14),
              paddingHorizontal: scale(14, 12, 18),
              paddingVertical: vScale(12, 10, 14),
            },
          ]}
          value={name}
          onChangeText={setName}
          maxLength={20}
          placeholder="Enter your name"
          placeholderTextColor={COLORS.textDim}
        />

        <View style={[styles.splitWrap, { gap: scale(12, 8, 16), minHeight: vScale(260, 220, 420) }]}>
          <View
            style={[
              styles.leftPanel,
              {
                borderRadius: mScale(14, 0.5, 12, 18),
                paddingHorizontal: scale(14, 10, 18),
                paddingVertical: vScale(12, 10, 16),
                gap: vScale(6, 4, 10),
                paddingTop: vScale(34, 28, 46),
              },
            ]}
          >
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsBadgeText}>{onlinePoints} pts</Text>
            </View>
            <Pressable
              style={styles.levelMapBtn}
              hitSlop={10}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/levels-map");
              }}
            >
              <Text style={styles.levelMapBtnText}>View all levels</Text>
            </Pressable>
            <View style={[styles.levelContentWrap, { marginTop: vScale(-8, -12, -3) }]}>
              <Text style={[styles.levelLabel, { fontSize: mScale(10, 0.5, 9, 12) }]}>CURRENT LEVEL</Text>
              <View style={[styles.levelRingWrap, { width: ringSize + 16, height: ringSize + 16 }]}>
              <Svg width={ringSize} height={ringSize} style={styles.levelRingSvg}>
                <Circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={radius}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                <Circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={radius}
                  stroke={COLORS.gold}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={dashOffset}
                  fill="transparent"
                  transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                />
              </Svg>
                {LEVEL_IMAGES[currentLevel.level] ? (
                  <Image
                    source={LEVEL_IMAGES[currentLevel.level]}
                    style={[
                      styles.levelImage,
                      {
                        width: ringSize - 22,
                        height: ringSize - 22,
                        borderRadius: (ringSize - 22) / 2,
                      },
                    ]}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.levelIconWrap,
                      {
                        width: ringSize - 22,
                        height: ringSize - 22,
                        borderRadius: (ringSize - 22) / 2,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name={currentLevel.icon} size={24} color={COLORS.gold} />
                  </View>
                )}
              </View>
              <Text style={[styles.levelName, { fontSize: mScale(14, 0.5, 12, 17) }]} numberOfLines={1}>
                {loadingProfile ? "Loading..." : currentLevel.name}
              </Text>
            </View>
          </View>

          <View style={[styles.rightPanel, { gap: vScale(12, 8, 16) }]}>
            <Pressable style={[styles.modeCard, { borderRadius: mScale(14, 0.5, 12, 18) }]} onPress={() => startQueue("online_2p")}>
              <LinearGradient colors={["rgba(255,215,0,0.18)", "rgba(255,215,0,0.06)"]} style={StyleSheet.absoluteFill} />
              <View style={[styles.modeRow, { paddingVertical: vScale(15, 12, 20), paddingHorizontal: scale(14, 10, 18), gap: scale(10, 8, 14) }]}>
                <MaterialCommunityIcons name="account-group-outline" size={24} color={COLORS.gold} />
                <View style={styles.modeTextWrap}>
                  <Text style={[styles.modeTitle, { fontSize: mScale(16, 0.5, 14, 19) }]}>VS 2 Players</Text>
                  <Text style={[styles.modeSub, { fontSize: mScale(12, 0.5, 11, 14) }]}>3 players total — global matchmaking</Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={24} color={COLORS.gold} />
              </View>
            </Pressable>

            <Pressable style={[styles.modeCard, { borderRadius: mScale(14, 0.5, 12, 18) }]} onPress={() => startQueue("online_3p")}>
              <LinearGradient colors={["rgba(46,204,113,0.18)", "rgba(46,204,113,0.06)"]} style={StyleSheet.absoluteFill} />
              <View style={[styles.modeRow, { paddingVertical: vScale(15, 12, 20), paddingHorizontal: scale(14, 10, 18), gap: scale(10, 8, 14) }]}>
                <MaterialCommunityIcons name="account-multiple-outline" size={24} color={COLORS.primary} />
                <View style={styles.modeTextWrap}>
                  <Text style={[styles.modeTitle, { fontSize: mScale(16, 0.5, 14, 19) }]}>VS 3 Players</Text>
                  <Text style={[styles.modeSub, { fontSize: mScale(12, 0.5, 11, 14) }]}>4 players total — global matchmaking</Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={24} color={COLORS.primary} />
              </View>
            </Pressable>

            <Pressable
              style={[styles.linkBtn, { marginTop: vScale(8, 6, 12), borderRadius: mScale(12, 0.5, 10, 14), paddingVertical: vScale(12, 10, 16) }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/how-points");
              }}
            >
              <Text style={[styles.linkText, { fontSize: mScale(14, 0.5, 12, 16) }]}>How points work</Text>
            </Pressable>
            <Pressable
              style={[styles.linkBtn, { borderRadius: mScale(12, 0.5, 10, 14), paddingVertical: vScale(12, 10, 16) }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/leaderboard");
              }}
            >
              <Text style={[styles.linkText, { fontSize: mScale(14, 0.5, 12, 16) }]}>View Global Leaderboard</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 52,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,215,0,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.32)",
  },
  title: { color: COLORS.gold, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  content: { flex: 1 },
  label: { color: COLORS.textDim, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    color: COLORS.text,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  splitWrap: {
    flex: 1,
    flexDirection: "row",
  },
  leftPanel: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  levelContentWrap: {
    alignItems: "center",
    justifyContent: "flex-start",
  },
  pointsBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,215,0,0.12)",
    zIndex: 5,
  },
  pointsBadgeText: { color: COLORS.gold, fontSize: 11, fontWeight: "900" },
  levelMapBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.45)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,215,0,0.12)",
    zIndex: 5,
  },
  levelMapBtnText: { color: COLORS.gold, fontSize: 11, fontWeight: "800" },
  rightPanel: {
    flex: 1,
    justifyContent: "center",
  },
  levelRingWrap: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  levelRingSvg: {
    position: "absolute",
  },
  levelIconWrap: {
    backgroundColor: "rgba(255,215,0,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  levelImage: {
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.45)",
  },
  levelLabel: { color: COLORS.textDim, fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  levelName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    marginTop: -2,
    maxWidth: "92%",
  },
  modeCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
    position: "relative",
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  modeTextWrap: { flex: 1 },
  modeTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  modeSub: { color: COLORS.textDim, fontSize: 12 },
  linkBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
    alignItems: "center",
  },
  linkText: { color: COLORS.gold, fontWeight: "700" },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: 6 },
});
