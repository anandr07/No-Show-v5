import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";
import { ONLINE_FLOW } from "@/constants/flowThemes";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { resolveOnlineAnalyticsUserId } from "@/lib/online-analytics-user-id";
import { useResponsive } from "@/lib/responsive";

const LEVELS = [
  { level: 1, name: "Beginner Table", min: 0, max: 999 },
  { level: 2, name: "Chip Collector", min: 1000, max: 1999 },
  { level: 3, name: "High Roller", min: 2000, max: 2999 },
  { level: 4, name: "Elite Gambler", min: 3000, max: 3999 },
  { level: 5, name: "Kingpin", min: 4000, max: 4999 },
  { level: 6, name: "Legend of the Table", min: 5000, max: null },
] as const;

const LEVEL_IMAGES: Record<number, number> = {
  1: require("@/assets/images/levels/beginner-table.png"),
  2: require("@/assets/images/levels/chip-collector.png"),
  3: require("@/assets/images/levels/high-roller.png"),
  4: require("@/assets/images/levels/elite-gambler.png"),
  5: require("@/assets/images/levels/kingpin.png"),
  6: require("@/assets/images/levels/legend-of-the-table.png"),
};

function getCurrentLevel(points: number) {
  return (
    LEVELS.find((l) => points >= l.min && (l.max === null || points <= l.max)) ??
    LEVELS[0]
  );
}

export default function LevelsMapScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { scale, vScale, mScale } = useResponsive();
  const isLandscape = width > height;
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const [points, setPoints] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const uid = await resolveOnlineAnalyticsUserId(user?.id);
        if (!uid) return;
        const res = await apiRequest("GET", `/api/online/profile/${uid}`);
        const json = (await res.json()) as { stats?: { online_points_total?: number } };
        const p = Number(json.stats?.online_points_total ?? 0);
        setPoints(Number.isFinite(p) ? p : 0);
      } catch {
        // ignore
      }
    })();
  }, [user?.id]);

  const current = useMemo(() => getCurrentLevel(points), [points]);
  const cardSize = useMemo(() => {
    if (isLandscape) {
      // Fill available vertical space under header in landscape.
      const availableHeight = height - (topInset + 8) - 52 - 24;
      return Math.max(190, Math.min(380, Math.floor(availableHeight)));
    }
    const usableWidth = width - 32; // container horizontal padding
    return Math.max(170, Math.min(usableWidth, 360));
  }, [isLandscape, width, height, topInset]);
  const cardImageSize = useMemo(() => Math.floor(cardSize * 0.56), [cardSize]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...ONLINE_FLOW.bgGradient]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <View style={[styles.header, { paddingTop: topInset + vScale(8, 6, 14), paddingHorizontal: scale(16, 12, 22), marginBottom: vScale(8, 4, 12) }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Ionicons name="arrow-back" size={18} color={ONLINE_FLOW.accent} />
        </Pressable>
        <Text style={styles.title}>LEVEL MAP</Text>
        <View style={{ width: scale(52, 44, 60) }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLandscape ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.horizontalMapContent, { paddingHorizontal: scale(4, 2, 10) }]}
          >
            {LEVELS.map((lvl, idx) => (
              <View key={lvl.level} style={styles.horizontalNode}>
                <View
                  style={[
                    styles.levelSquareCard,
                    { width: cardSize, height: cardSize, borderRadius: mScale(14, 0.5, 12, 18), padding: mScale(10, 0.5, 8, 14) },
                    lvl.level === current.level && styles.levelCardCurrent,
                  ]}
                >
                  <Image
                    source={LEVEL_IMAGES[lvl.level]}
                    style={[styles.levelImageSquare, { width: cardImageSize, height: cardImageSize, borderRadius: mScale(12, 0.5, 10, 16) }]}
                    resizeMode="contain"
                  />
                  <Text style={[styles.levelNameSquare, { marginTop: vScale(6, 4, 9), fontSize: mScale(13, 0.5, 12, 16) }]} numberOfLines={2}>
                    L{lvl.level} · {lvl.name}
                  </Text>
                  <Text style={[styles.levelRangeSquare, { fontSize: mScale(11, 0.5, 10, 13), marginTop: vScale(2, 1, 4) }]}>
                    {lvl.max === null ? `${lvl.min}+` : `${lvl.min}-${lvl.max}`}
                  </Text>
                  {lvl.level === current.level ? (
                    <View style={styles.currentBadgeSquare}>
                      <Text style={styles.currentBadgeText}>CURRENT</Text>
                    </View>
                  ) : null}
                </View>
                {idx < LEVELS.length - 1 ? (
                  <View style={[styles.connectorWrapHorizontal, { paddingHorizontal: scale(8, 6, 12) }]}>
                    <Ionicons name="arrow-forward" size={18} color={ONLINE_FLOW.accent} />
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : (
          LEVELS.map((lvl, idx) => (
            <View key={lvl.level}>
              <View style={[styles.levelCard, { borderRadius: mScale(14, 0.5, 12, 18), gap: scale(12, 8, 16), paddingHorizontal: scale(10, 8, 14), paddingVertical: vScale(10, 8, 14) }, lvl.level === current.level && styles.levelCardCurrent]}>
                <Image source={LEVEL_IMAGES[lvl.level]} style={[styles.levelImage, { width: mScale(78, 0.6, 66, 100), height: mScale(78, 0.6, 66, 100), borderRadius: mScale(12, 0.5, 10, 16) }]} resizeMode="contain" />
                <View style={styles.levelInfo}>
                  <Text style={[styles.levelName, { fontSize: mScale(14, 0.5, 12, 17) }]}>L{lvl.level} · {lvl.name}</Text>
                  <Text style={[styles.levelRange, { fontSize: mScale(12, 0.5, 10, 14), marginTop: vScale(2, 1, 4) }]}>
                    {lvl.max === null ? `${lvl.min}+ points` : `${lvl.min} - ${lvl.max} points`}
                  </Text>
                </View>
                {lvl.level === current.level ? (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>CURRENT</Text>
                  </View>
                ) : null}
              </View>
              {idx < LEVELS.length - 1 ? (
                <View style={[styles.connectorWrap, { paddingVertical: vScale(6, 4, 10) }]}>
                  <Ionicons name="arrow-down" size={18} color={ONLINE_FLOW.accent} />
                </View>
              ) : null}
            </View>
          ))
        )}
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
  title: { color: ONLINE_FLOW.accent, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 2,
    flexGrow: 1,
    justifyContent: "center",
  },
  horizontalMapContent: {
    paddingVertical: 0,
    flexGrow: 1,
    alignItems: "center",
  },
  horizontalNode: {
    flexDirection: "row",
    alignItems: "center",
  },
  levelCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  levelCardCurrent: {
    borderColor: `rgba(${ONLINE_FLOW.rgb},0.55)`,
    backgroundColor: `rgba(${ONLINE_FLOW.rgb},0.12)`,
  },
  levelImage: {
    width: 78,
    height: 78,
  },
  levelInfo: { flex: 1, minWidth: 0 },
  levelName: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  levelRange: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  currentBadge: {
    borderWidth: 1,
    borderColor: `rgba(${ONLINE_FLOW.rgb},0.5)`,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: `rgba(${ONLINE_FLOW.rgb},0.18)`,
  },
  currentBadgeText: { color: ONLINE_FLOW.accent, fontSize: 10, fontWeight: "900", letterSpacing: 0.4 },
  connectorWrap: { alignItems: "center", paddingVertical: 6 },
  connectorWrapHorizontal: {
    justifyContent: "center",
    alignItems: "center",
  },
  levelSquareCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  levelImageSquare: {
    width: 104,
    height: 104,
  },
  levelNameSquare: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 6,
  },
  levelRangeSquare: {
    color: COLORS.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  currentBadgeSquare: {
    position: "absolute",
    top: 8,
    right: 8,
    borderWidth: 1,
    borderColor: `rgba(${ONLINE_FLOW.rgb},0.5)`,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: `rgba(${ONLINE_FLOW.rgb},0.18)`,
  },
});
