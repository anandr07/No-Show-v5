import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { ONLINE_FLOW } from "@/constants/flowThemes";
import { useOnlineGame } from "@/context/OnlineGameContext";
import { useResponsive } from "@/lib/responsive";

const DISPLAY_CAP = 45;

export default function OnlineQueueScreen() {
  const insets = useSafeAreaInsets();
  const { scale, vScale, mScale } = useResponsive();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const { mode } = useLocalSearchParams<{ mode?: "online_2p" | "online_3p" }>();
  const { phase, queueStartedAt, cancelQueue, error } = useOnlineGame();

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.35 + 0.25 * (pulse.value - 1) / 0.06,
  }));

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const secondsUp = useMemo(() => {
    if (!queueStartedAt) return 1;
    const raw = Math.floor((Date.now() - queueStartedAt) / 1000);
    // Count up: 1, 2, 3 … (never 0 on screen), cap at display max
    return Math.min(DISPLAY_CAP, Math.max(1, raw + 1));
  }, [queueStartedAt, tick]);

  useEffect(() => {
    if (phase === "playing") {
      router.replace("/game-online");
    }
  }, [phase]);

  const label = useMemo(
    () =>
      mode === "online_3p"
        ? "4 seats · competitive table"
        : "3 seats · competitive table",
    [mode]
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...ONLINE_FLOW.bgGradient]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View
        style={[
          styles.header,
          { paddingTop: topInset + vScale(8, 6, 14), paddingHorizontal: scale(20, 14, 28) },
        ]}
      >
        <Pressable
          onPress={() => {
            cancelQueue();
            router.replace("/online");
          }}
          hitSlop={12}
          style={styles.backHit}
        >
          <Ionicons name="chevron-back" size={26} color={ONLINE_FLOW.accent} />
        </Pressable>
        <Text style={[styles.title, { fontSize: mScale(13, 0.5, 12, 15) }]}>
          FINDING A TABLE
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={[styles.content, { paddingHorizontal: scale(20, 14, 28) }]}>
        <Text style={[styles.modeLine, { fontSize: mScale(15, 0.5, 14, 17) }]}>{label}</Text>

        <View style={[styles.hero, { marginTop: vScale(28, 22, 36) }]}>
          <Animated.View
            style={[
              styles.glowRing,
              {
                width: scale(168, 140, 190),
                height: scale(168, 140, 190),
                borderRadius: scale(84, 70, 95),
              },
              ringStyle,
            ]}
          />
          <View
            style={[
              styles.timerCircle,
              {
                width: scale(152, 128, 172),
                height: scale(152, 128, 172),
                borderRadius: scale(76, 64, 86),
              },
            ]}
          >
            <Text style={[styles.secLabel, { fontSize: mScale(11, 0.5, 10, 12) }]}>seconds</Text>
            <Text style={[styles.timerNum, { fontSize: mScale(52, 0.55, 44, 64) }]}>
              {secondsUp}
            </Text>
          </View>
        </View>

        <View style={[styles.statusRow, { marginTop: vScale(32, 26, 40), gap: scale(10, 8, 12) }]}>
          <ActivityIndicator color={ONLINE_FLOW.accent} size="small" />
          <Text style={[styles.statusText, { fontSize: mScale(14, 0.5, 13, 16) }]}>
            Looking for open seats…
          </Text>
        </View>

        {error ? (
          <Text style={[styles.error, { fontSize: mScale(12, 0.5, 11, 14), marginTop: vScale(16, 12, 20) }]}>
            {error}
          </Text>
        ) : null}

        <Pressable
          style={[
            styles.cancelBtn,
            {
              marginTop: vScale(28, 22, 36),
              borderRadius: mScale(14, 0.5, 12, 16),
              paddingHorizontal: scale(28, 22, 34),
              paddingVertical: vScale(14, 12, 18),
            },
          ]}
          onPress={() => {
            cancelQueue();
            router.replace("/online");
          }}
        >
          <Text style={[styles.cancelText, { fontSize: mScale(15, 0.5, 14, 17) }]}>Leave queue</Text>
        </Pressable>
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
  backHit: { padding: 4 },
  title: {
    color: ONLINE_FLOW.accent,
    fontWeight: "800",
    letterSpacing: 2,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingTop: 8,
  },
  modeLine: {
    color: COLORS.textDim,
    fontWeight: "600",
    textAlign: "center",
  },
  hero: {
    alignItems: "center",
    justifyContent: "center",
  },
  glowRing: {
    position: "absolute",
    borderWidth: 2,
    borderColor: `rgba(${ONLINE_FLOW.rgb},0.45)`,
    backgroundColor: `rgba(${ONLINE_FLOW.rgb},0.08)`,
  },
  timerCircle: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  secLabel: {
    color: COLORS.textMuted,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  timerNum: {
    color: COLORS.text,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    color: COLORS.text,
    fontWeight: "600",
  },
  error: {
    color: COLORS.error,
    textAlign: "center",
  },
  cancelBtn: {
    backgroundColor: `rgba(${ONLINE_FLOW.rgb},0.2)`,
    borderWidth: 1,
    borderColor: `rgba(${ONLINE_FLOW.rgb},0.45)`,
  },
  cancelText: {
    color: COLORS.text,
    fontWeight: "700",
  },
});
