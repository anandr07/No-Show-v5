import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  FlatList,
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

interface OnlineGameRow {
  match_id: string;
  mode: string;
  ended_at: string | null;
  is_bot_filled: boolean;
  won: boolean;
  points_delta: number;
}

function modeLabel(mode: string): string {
  if (mode === "online_2p") return "Head-to-head";
  if (mode === "online_3p") return "Table (3–4 players)";
  return mode.replace(/_/g, " ");
}

function formatEndedAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function PastGamesScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const { user } = useAuth();
  const [games, setGames] = useState<OnlineGameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const uid = await resolveOnlineAnalyticsUserId(user?.id);
      if (!uid) {
        setGames([]);
        return;
      }
      const res = await apiRequest("GET", `/api/online/history/${uid}?limit=50`);
      const json = (await res.json()) as { games?: OnlineGameRow[] };
      setGames(Array.isArray(json.games) ? json.games : []);
    } catch {
      setError("Could not load online match history.");
      setGames([]);
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
        <Text style={styles.headerTitle}>PAST GAMES</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.hint}>Online ranked matches only</Text>

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
      ) : games.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.placeholderIcon}>
            <MaterialCommunityIcons name="history" size={64} color={COLORS.gold} />
          </View>
          <Text style={styles.placeholderTitle}>No online games yet</Text>
          <Text style={styles.placeholderSubtitle}>
            Finished ranked online matches appear here. VS bots and local multiplayer are not saved.
          </Text>
        </View>
      ) : (
        <FlatList
          data={games}
          keyExtractor={(item) => item.match_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.badge, item.won ? styles.badgeWin : styles.badgeLoss]}>
                <Text style={[styles.badgeText, item.won ? styles.badgeTextWin : styles.badgeTextLoss]}>
                  {item.won ? "WIN" : "LOSS"}
                </Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{modeLabel(item.mode)}</Text>
                <Text style={styles.rowMeta}>
                  {formatEndedAt(item.ended_at)}
                  {item.is_bot_filled ? " · Bot fill" : ""}
                </Text>
              </View>
              <Text
                style={[
                  styles.points,
                  item.points_delta > 0 ? styles.pointsPos : item.points_delta < 0 ? styles.pointsNeg : styles.pointsZero,
                ]}
              >
                {item.points_delta > 0 ? "+" : ""}
                {item.points_delta} pts
              </Text>
            </View>
          )}
        />
      )}
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
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.15)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 44,
    alignItems: "center",
  },
  badgeWin: { backgroundColor: "rgba(34,197,94,0.2)" },
  badgeLoss: { backgroundColor: "rgba(239,68,68,0.18)" },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  badgeTextWin: { color: "#4ade80" },
  badgeTextLoss: { color: "#f87171" },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  rowMeta: { color: COLORS.textDim, fontSize: 12 },
  points: { fontSize: 14, fontWeight: "800" },
  pointsPos: { color: "#4ade80" },
  pointsNeg: { color: "#f87171" },
  pointsZero: { color: COLORS.textMuted },
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
