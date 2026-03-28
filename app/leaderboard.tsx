import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import COLORS from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { useOnlineGame } from "@/context/OnlineGameContext";
import { useResponsive } from "@/lib/responsive";

interface LeaderboardRow {
  user_id: string;
  display_name: string;
  online_points_total: number;
  current_level: number;
  global_rank: number;
}

const LEVEL_NAMES = [
  "Beginner Table",
  "Chip Collector",
  "High Roller",
  "Elite Gambler",
  "Kingpin",
  "Legend of the Table",
];

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { scale, vScale, mScale } = useResponsive();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { userId } = useOnlineGame();

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await apiRequest("GET", "/api/online/leaderboard");
        const json = (await res.json()) as { leaderboard?: LeaderboardRow[] };
        setRows(json.leaderboard ?? []);
      } catch (e) {
        setError("Unable to load leaderboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const myRow = rows.find((r) => r.user_id === userId);

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#040A06", "#07140B", "#0A1C10"]} style={StyleSheet.absoluteFill} />
      <View style={[styles.header, { paddingTop: topInset + vScale(8, 6, 14), paddingHorizontal: scale(14, 10, 20), marginBottom: vScale(8, 6, 12) }]}>
        <Pressable style={[styles.backBtn, { width: scale(50, 42, 58), height: vScale(34, 30, 40), borderRadius: mScale(10, 0.5, 8, 13) }]} onPress={() => router.back()}>
          <Text style={[styles.backText, { fontSize: mScale(12, 0.5, 11, 14) }]}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { fontSize: mScale(15, 0.5, 13, 18) }]}>GLOBAL LEADERBOARD</Text>
        <View style={{ width: scale(50, 42, 58) }} />
      </View>

      {myRow ? (
        <View style={[styles.meCard, { marginHorizontal: scale(12, 8, 18), borderRadius: mScale(12, 0.5, 10, 16), padding: mScale(10, 0.5, 8, 13) }]}>
          <Text style={[styles.meText, { fontSize: mScale(14, 0.5, 12, 17) }]}>You: Rank #{myRow.global_rank}</Text>
          <Text style={[styles.meSub, { fontSize: mScale(12, 0.5, 11, 14) }]}>
            {myRow.online_points_total} pts • {LEVEL_NAMES[Math.max(0, Math.min(5, myRow.current_level - 1))]}
          </Text>
        </View>
      ) : null}

      {loading ? <Text style={styles.info}>Loading...</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={{ padding: scale(12, 8, 18), paddingBottom: vScale(20, 14, 28) }}
        renderItem={({ item }) => (
          <View style={[styles.row, { gap: scale(10, 8, 14), borderRadius: mScale(12, 0.5, 10, 16), paddingHorizontal: scale(10, 8, 14), paddingVertical: vScale(9, 8, 12), marginBottom: vScale(8, 6, 12) }]}>
            <Text style={[styles.rank, { width: scale(42, 34, 52), fontSize: mScale(13, 0.5, 12, 16) }]}>#{item.global_rank}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { fontSize: mScale(13, 0.5, 12, 16) }]}>{item.display_name}</Text>
              <Text style={[styles.level, { fontSize: mScale(11, 0.5, 10, 13) }]}>
                L{item.current_level} • {LEVEL_NAMES[Math.max(0, Math.min(5, item.current_level - 1))]}
              </Text>
            </View>
            <Text style={[styles.points, { fontSize: mScale(14, 0.5, 12, 17) }]}>{item.online_points_total}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  backText: { color: COLORS.text, fontWeight: "700" },
  title: { color: COLORS.gold, fontWeight: "900", letterSpacing: 1 },
  meCard: {
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
    backgroundColor: "rgba(255,215,0,0.09)",
    gap: 2,
  },
  meText: { color: COLORS.gold, fontWeight: "800" },
  meSub: { color: COLORS.text },
  info: { color: COLORS.textDim, textAlign: "center", marginTop: 12 },
  error: { color: COLORS.error, textAlign: "center", marginTop: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  rank: { width: 42, color: COLORS.gold, fontWeight: "900" },
  name: { color: COLORS.text, fontWeight: "700" },
  level: { color: COLORS.textMuted, marginTop: 1 },
  points: { color: COLORS.text, fontWeight: "900" },
});
