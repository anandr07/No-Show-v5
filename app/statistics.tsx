import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { resolveOnlineAnalyticsUserId } from "@/lib/online-analytics-user-id";

const LEVEL_NAMES = [
  "Beginner Table",
  "Chip Collector",
  "High Roller",
  "Elite Gambler",
  "Kingpin",
  "Legend of the Table",
];

interface OnlineStats {
  display_name?: string;
  online_points_total?: number;
  online_wins?: number;
  online_losses?: number;
  online_games_played?: number;
  current_level?: number;
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

export default function StatisticsScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const { user } = useAuth();
  const [stats, setStats] = useState<OnlineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const uid = await resolveOnlineAnalyticsUserId(user?.id);
      if (!uid) {
        setStats(null);
        return;
      }
      const res = await apiRequest("GET", `/api/online/profile/${uid}`);
      const json = (await res.json()) as { stats?: OnlineStats | null };
      const s = json.stats;
      setStats({
        display_name: s?.display_name,
        online_points_total: Number(s?.online_points_total ?? 0),
        online_wins: Number(s?.online_wins ?? 0),
        online_losses: Number(s?.online_losses ?? 0),
        online_games_played: Number(s?.online_games_played ?? 0),
        current_level: Number(s?.current_level ?? 1),
      });
    } catch {
      setError("Could not load online statistics.");
      setStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const wins = stats?.online_wins ?? 0;
  const losses = stats?.online_losses ?? 0;
  const played = stats?.online_games_played ?? 0;
  const decided = wins + losses;
  const winRate = decided > 0 ? Math.round((wins / decided) * 1000) / 10 : 0;
  const pts = stats?.online_points_total ?? 0;
  const lvl = Math.max(1, Math.min(6, stats?.current_level ?? 1));
  const levelName = LEVEL_NAMES[lvl - 1] ?? LEVEL_NAMES[0];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#051810", "#0A2416", "#133D24"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.gold} />
        </Pressable>
        <Text style={styles.headerTitle}>STATISTICS</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.hint}>Online ranked mode only</Text>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); void load(); }}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : stats == null && !error ? (
        <View style={styles.emptyWrap}>
          <View style={styles.placeholderIcon}>
            <MaterialCommunityIcons name="chart-bar" size={64} color={COLORS.gold} />
          </View>
          <Text style={styles.placeholderTitle}>No online stats yet</Text>
          <Text style={styles.placeholderSubtitle}>
            Sign in or play online ranked matches to build your profile. VS bots and local games are not
            included.
          </Text>
        </View>
      ) : stats ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />
          }
        >
          {stats?.display_name ? (
            <Text style={styles.displayName}>{stats.display_name}</Text>
          ) : null}

          <View style={styles.grid}>
            <StatCard label="Online points" value={String(pts)} sub={levelName} />
            <StatCard label="Games played" value={String(played)} sub={`Level ${lvl}`} />
            <StatCard label="Wins" value={String(wins)} />
            <StatCard label="Losses" value={String(losses)} />
            <StatCard label="Win rate" value={`${winRate}%`} sub={decided > 0 ? `${wins}W / ${losses}L` : "—"} />
          </View>
        </ScrollView>
      ) : null}
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
    paddingBottom: 8,
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
  hint: {
    color: COLORS.textDim,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  displayName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 16,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  statCard: {
    width: "48%",
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.15)",
    padding: 16,
    marginBottom: 4,
  },
  statLabel: { color: COLORS.textDim, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  statValue: { color: COLORS.gold, fontSize: 24, fontWeight: "800" },
  statSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 6 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  errorText: { color: "#f87171", textAlign: "center", marginBottom: 12 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,215,0,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
  },
  retryText: { color: COLORS.gold, fontWeight: "700" },
  emptyWrap: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 32,
  },
  placeholderIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,215,0,0.08)",
    borderWidth: 2,
    borderColor: "rgba(255,215,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  placeholderTitle: {
    color: COLORS.gold,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 12,
  },
  placeholderSubtitle: {
    color: COLORS.textMuted,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
