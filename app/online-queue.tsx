import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import COLORS from "@/constants/colors";
import { ONLINE_FLOW } from "@/constants/flowThemes";
import { useOnlineGame } from "@/context/OnlineGameContext";
import { useResponsive } from "@/lib/responsive";

export default function OnlineQueueScreen() {
  const insets = useSafeAreaInsets();
  const { scale, vScale, mScale } = useResponsive();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const { mode } = useLocalSearchParams<{ mode?: "online_2p" | "online_3p" }>();
  const { phase, queueStartedAt, cancelQueue, error, isBotFilled } = useOnlineGame();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (queueStartedAt) {
        setElapsed(Math.floor((Date.now() - queueStartedAt) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [queueStartedAt]);

  useEffect(() => {
    if (phase === "playing") {
      router.replace("/game-online");
    }
  }, [phase]);

  const label = useMemo(
    () =>
      mode === "online_3p"
        ? "VS 3 Players (4 at table)"
        : "VS 2 Players (3 at table)",
    [mode]
  );
  const capped = Math.min(180, elapsed);
  const progress = capped / 180;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...ONLINE_FLOW.bgGradient]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={[styles.header, { paddingTop: topInset + vScale(8, 6, 14), paddingHorizontal: scale(20, 14, 28) }]}>
        <Text style={[styles.title, { fontSize: mScale(18, 0.5, 16, 22) }]}>MATCHMAKING</Text>
      </View>

      <View style={[styles.content, { gap: vScale(10, 8, 14), paddingHorizontal: scale(20, 14, 28) }]}>
        <Text style={[styles.modeText, { fontSize: mScale(20, 0.5, 17, 24) }]}>{label}</Text>
        <Text style={[styles.statusText, { fontSize: mScale(13, 0.5, 12, 15) }]}>Searching globally for players...</Text>
        <Text style={[styles.timerText, { fontSize: mScale(44, 0.55, 36, 56) }]}>{capped}s</Text>
        <View style={[styles.progressTrack, { height: vScale(10, 8, 14) }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={[styles.ruleText, { fontSize: mScale(12, 0.5, 11, 14) }]}>
          {capped < 180
            ? `Matchmaking timeout at 180s. Bots will fill empty slots if needed.`
            : "Timeout reached. Waiting for bots to fill empty slots..."}
        </Text>
        {isBotFilled ? <Text style={[styles.botWarn, { fontSize: mScale(12, 0.5, 11, 14) }]}>Bot-filled match started (reduced points applies).</Text> : null}
        {error ? <Text style={[styles.error, { fontSize: mScale(12, 0.5, 11, 14) }]}>{error}</Text> : null}

        <Pressable
          style={[
            styles.cancelBtn,
            {
              marginTop: vScale(16, 12, 24),
              borderRadius: mScale(12, 0.5, 10, 15),
              paddingHorizontal: scale(20, 16, 26),
              paddingVertical: vScale(12, 10, 16),
            },
          ]}
          onPress={() => {
            cancelQueue();
            router.replace("/online");
          }}
        >
          <Text style={[styles.cancelText, { fontSize: mScale(14, 0.5, 12, 16) }]}>Cancel Queue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {},
  title: { color: ONLINE_FLOW.accent, fontWeight: "900", letterSpacing: 1.2 },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modeText: { color: COLORS.text, fontWeight: "800" },
  statusText: { color: COLORS.textDim, textAlign: "center" },
  timerText: { color: ONLINE_FLOW.accent, fontWeight: "900" },
  progressTrack: {
    width: "84%",
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: ONLINE_FLOW.accent,
  },
  ruleText: { color: COLORS.textMuted, textAlign: "center" },
  botWarn: { color: "#ffcc66", fontWeight: "700" },
  error: { color: COLORS.error, textAlign: "center" },
  cancelBtn: {
    borderWidth: 1,
    borderColor: `rgba(${ONLINE_FLOW.rgb},0.4)`,
  },
  cancelText: { color: COLORS.text, fontWeight: "700" },
});
