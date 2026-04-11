import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";
import { ONLINE_FLOW } from "@/constants/flowThemes";
import { useAuth } from "@/context/AuthContext";
import { useOnlineGame } from "@/context/OnlineGameContext";
import { useSettings } from "@/context/SettingsContext";
import { apiRequest } from "@/lib/query-client";
import { resolveOnlineAnalyticsUserId } from "@/lib/online-analytics-user-id";
import { resolvePlayerDisplayName, sanitizeDisplayName } from "@/lib/player-display";
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
  const { displayName: savedName, isLoading: settingsLoading } = useSettings();
  const savedNameRef = useRef(savedName);
  savedNameRef.current = savedName;

  const syncNameFromProfile = useCallback(() => {
    if (settingsLoading) return;
    const resolved = resolvePlayerDisplayName({
      localName: savedName,
      authDisplayName: user?.user_metadata?.display_name,
      email: user?.email ?? null,
      fallback: "Player",
    });
    setName(resolved.slice(0, 20));
  }, [settingsLoading, savedName, user?.user_metadata?.display_name, user?.email]);

  useEffect(() => {
    syncNameFromProfile();
  }, [syncNameFromProfile]);

  useFocusEffect(
    useCallback(() => {
      syncNameFromProfile();
    }, [syncNameFromProfile])
  );

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
        // Profile screen name takes priority; use server nickname only if no local profile name.
        if (!sanitizeDisplayName(savedNameRef.current) && json.stats?.display_name?.trim()) {
          setName(json.stats.display_name.trim().slice(0, 20));
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
      <LinearGradient
        colors={[...ONLINE_FLOW.bgGradient]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <View style={styles.glowSpot} />
      <View style={[styles.header, { paddingTop: topInset + vScale(8, 6, 14), paddingHorizontal: scale(16, 12, 20) }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={ONLINE_FLOW.accent} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            ONLINE MATCHMAKING
          </Text>
        </View>
        <View style={[styles.headerRightBtns, { gap: scale(6, 4, 8) }]}>
          <Pressable
            style={[
              styles.headerOutlineBtn,
              {
                paddingVertical: vScale(6, 5, 8),
                paddingHorizontal: scale(10, 8, 12),
                borderRadius: mScale(999, 0.5, 18, 22),
                gap: scale(5, 4, 6),
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/how-points");
            }}
            accessibilityLabel="How points work"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name="help-circle-outline"
              size={mScale(15, 0.5, 13, 17)}
              color={ONLINE_FLOW.accent}
            />
            <Text
              style={[styles.headerOutlineBtnText, { fontSize: mScale(10, 0.5, 9, 12), maxWidth: scale(108, 88, 128) }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              How points work
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.headerOutlineBtn,
              {
                paddingVertical: vScale(6, 5, 8),
                paddingHorizontal: scale(10, 8, 12),
                borderRadius: mScale(999, 0.5, 18, 22),
                gap: scale(5, 4, 6),
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/leaderboard");
            }}
            accessibilityLabel="View Global Leaderboard"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name="trophy-outline"
              size={mScale(15, 0.5, 13, 17)}
              color={ONLINE_FLOW.accent}
            />
            <Text
              style={[styles.headerOutlineBtnText, { fontSize: mScale(10, 0.5, 9, 12), maxWidth: scale(108, 88, 128) }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              View Global Leaderboard
            </Text>
          </Pressable>
        </View>
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

        <View style={[styles.splitWrap, { gap: scale(12, 8, 16), flex: 1, minHeight: vScale(280, 240, 440) }]}>
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
                  stroke={ONLINE_FLOW.accent}
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
                    <MaterialCommunityIcons name={currentLevel.icon} size={24} color={ONLINE_FLOW.accent} />
                  </View>
                )}
              </View>
              <Text style={[styles.levelName, { fontSize: mScale(14, 0.5, 12, 17) }]} numberOfLines={1}>
                {loadingProfile ? "Loading..." : currentLevel.name}
              </Text>
            </View>
          </View>

          <View style={[styles.rightPanel, { gap: vScale(14, 10, 18) }]}>
            <Pressable
              style={[styles.modeCard, { borderRadius: mScale(16, 0.5, 14, 20), flex: 1 }]}
              onPress={() => startQueue("online_2p")}
            >
              <LinearGradient colors={[`rgba(${ONLINE_FLOW.rgb},0.22)`, `rgba(${ONLINE_FLOW.rgb},0.06)`]} style={StyleSheet.absoluteFill} />
              <View
                style={[
                  styles.modeRow,
                  {
                    paddingVertical: vScale(22, 16, 28),
                    paddingHorizontal: scale(16, 12, 22),
                    gap: scale(12, 8, 16),
                    flex: 1,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="account-group-outline"
                  size={mScale(34, 0.55, 28, 40)}
                  color={ONLINE_FLOW.accent}
                />
                <View style={styles.modeTextWrap}>
                  <Text style={[styles.modeTitle, { fontSize: mScale(19, 0.5, 16, 22) }]}>VS 2 Players</Text>
                  <Text style={[styles.modeSub, { fontSize: mScale(13, 0.5, 11, 15), lineHeight: mScale(19, 0.5, 16, 22) }]}>
                    3 players total — global matchmaking
                  </Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={mScale(32, 0.55, 26, 38)} color={ONLINE_FLOW.accent} />
              </View>
            </Pressable>

            <Pressable
              style={[styles.modeCard, { borderRadius: mScale(16, 0.5, 14, 20), flex: 1 }]}
              onPress={() => startQueue("online_3p")}
            >
              <LinearGradient colors={[`rgba(${ONLINE_FLOW.rgb},0.14)`, `rgba(${ONLINE_FLOW.rgb},0.04)`]} style={StyleSheet.absoluteFill} />
              <View
                style={[
                  styles.modeRow,
                  {
                    paddingVertical: vScale(22, 16, 28),
                    paddingHorizontal: scale(16, 12, 22),
                    gap: scale(12, 8, 16),
                    flex: 1,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="account-multiple-outline"
                  size={mScale(34, 0.55, 28, 40)}
                  color={ONLINE_FLOW.accent}
                />
                <View style={styles.modeTextWrap}>
                  <Text style={[styles.modeTitle, { fontSize: mScale(19, 0.5, 16, 22) }]}>VS 3 Players</Text>
                  <Text style={[styles.modeSub, { fontSize: mScale(13, 0.5, 11, 15), lineHeight: mScale(19, 0.5, 16, 22) }]}>
                    4 players total — global matchmaking
                  </Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={mScale(32, 0.55, 26, 38)} color={ONLINE_FLOW.accent} />
              </View>
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
  glowSpot: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: ONLINE_FLOW.accent,
    opacity: 0.06,
    top: "22%",
    right: "8%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerRightBtns: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0,
    flexWrap: "nowrap",
  },
  headerOutlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: `rgba(${ONLINE_FLOW.rgb},0.5)`,
    backgroundColor: `rgba(${ONLINE_FLOW.rgb},0.06)`,
  },
  headerOutlineBtnText: {
    color: ONLINE_FLOW.accent,
    fontWeight: "800",
  },
  backBtn: {
    width: 52,
    height: 36,
    borderRadius: 10,
    backgroundColor: `rgba(${ONLINE_FLOW.rgb},0.12)`,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: `rgba(${ONLINE_FLOW.rgb},0.35)`,
  },
  title: { color: ONLINE_FLOW.accent, fontSize: 15, fontWeight: "800", letterSpacing: 0.6 },
  content: { flex: 1, minHeight: 0 },
  label: { color: COLORS.textDim, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  input: {
    borderWidth: 1,
    borderColor: `rgba(${ONLINE_FLOW.rgb},0.35)`,
    color: COLORS.text,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  splitWrap: {
    flex: 1,
    flexDirection: "row",
    minHeight: 0,
  },
  leftPanel: {
    flex: 1,
    borderWidth: 1,
    borderColor: `rgba(${ONLINE_FLOW.rgb},0.38)`,
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
    borderColor: `rgba(${ONLINE_FLOW.rgb},0.45)`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: `rgba(${ONLINE_FLOW.rgb},0.14)`,
    zIndex: 5,
  },
  pointsBadgeText: { color: ONLINE_FLOW.accent, fontSize: 11, fontWeight: "900" },
  levelMapBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    borderWidth: 1,
    borderColor: `rgba(${ONLINE_FLOW.rgb},0.45)`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: `rgba(${ONLINE_FLOW.rgb},0.14)`,
    zIndex: 5,
  },
  levelMapBtnText: { color: ONLINE_FLOW.accent, fontSize: 11, fontWeight: "800" },
  rightPanel: {
    flex: 1,
    flexDirection: "column",
    alignSelf: "stretch",
    minHeight: 0,
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
    backgroundColor: `rgba(${ONLINE_FLOW.rgb},0.18)`,
    justifyContent: "center",
    alignItems: "center",
  },
  levelImage: {
    borderWidth: 1,
    borderColor: `rgba(${ONLINE_FLOW.rgb},0.45)`,
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
    minHeight: 0,
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 0,
  },
  modeTextWrap: { flex: 1 },
  modeTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  modeSub: { color: COLORS.textDim, fontSize: 12 },
  errorText: { color: COLORS.error, fontSize: 12, marginTop: 6 },
});
