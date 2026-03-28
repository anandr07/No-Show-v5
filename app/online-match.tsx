import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import COLORS from "@/constants/colors";
import { useOnlineGame } from "@/context/OnlineGameContext";
import type { Card } from "@/lib/gameEngine";
import { useResponsive } from "@/lib/responsive";

export default function OnlineMatchScreen() {
  const insets = useSafeAreaInsets();
  const { scale, vScale, mScale } = useResponsive();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const {
    state,
    playerId,
    players,
    isBotFilled,
    error,
    sendOnlineAction,
    resetOnline,
  } = useOnlineGame();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const me = state?.players.find((p) => p.id === playerId);
  const selectedCard = useMemo<Card | null>(() => {
    if (!selectedCardId || !me) return null;
    return me.hand.find((c) => c.id === selectedCardId) ?? null;
  }, [selectedCardId, me]);

  if (!state || !playerId) {
    return (
      <View style={styles.emptyContainer}>
        <LinearGradient colors={["#090016", "#04000C", "#020007"]} style={StyleSheet.absoluteFill} />
        <Text style={[styles.emptyText, { fontSize: mScale(16, 0.5, 14, 20) }]}>Waiting for match state...</Text>
      </View>
    );
  }

  const current = state.players[state.currentPlayerIndex];
  const isMyTurn = current?.id === playerId;
  const canThrow = isMyTurn && state.turnPhase === "throw";
  const canPick = isMyTurn && state.turnPhase === "pick";

  const throwOne = () => {
    if (!selectedCard || !canThrow) return;
    sendOnlineAction({ type: "THROW_CARDS", cards: [selectedCard] });
    setSelectedCardId(null);
  };

  const pickDeck = () => {
    if (!canPick) return;
    sendOnlineAction({ type: "PICK_FROM_DECK" });
  };

  const pickThrown = () => {
    if (!canPick || state.lastThrown.length === 0) return;
    sendOnlineAction({
      type: "PICK_FROM_THROWN",
      cardId: state.lastThrown[0]?.id,
    });
  };

  const callShow = () => {
    if (!canThrow || !state.canCallShow) return;
    sendOnlineAction({ type: "CALL_SHOW" });
  };

  return (
    <View style={[styles.container, { paddingHorizontal: scale(12, 8, 18), paddingBottom: vScale(12, 8, 18) }]}>
      <LinearGradient colors={["#0A2416", "#133D24", "#1B5E35"]} style={StyleSheet.absoluteFill} />
      <View style={[styles.header, { paddingTop: topInset + vScale(8, 6, 14), marginBottom: vScale(8, 6, 12) }]}>
        <Text style={[styles.headerText, { fontSize: mScale(18, 0.5, 16, 22) }]}>ONLINE MATCH</Text>
        <Pressable
          style={[styles.exitBtn, { borderRadius: mScale(8, 0.5, 7, 10), paddingHorizontal: scale(10, 8, 14), paddingVertical: vScale(6, 5, 9) }]}
          onPress={() => {
            resetOnline();
            router.replace("/online");
          }}
        >
          <Text style={[styles.exitText, { fontSize: mScale(12, 0.5, 11, 14) }]}>Exit</Text>
        </Pressable>
      </View>

      <View style={styles.infoRow}>
        <Text style={[styles.infoText, { fontSize: mScale(12, 0.5, 11, 14) }]}>Turn: {current?.name ?? "-"}</Text>
        <Text style={[styles.infoText, { fontSize: mScale(12, 0.5, 11, 14) }]}>Phase: {state.turnPhase.toUpperCase()}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={[styles.infoText, { fontSize: mScale(12, 0.5, 11, 14) }]}>Round: {state.round}</Text>
        <Text style={[styles.infoText, { fontSize: mScale(12, 0.5, 11, 14) }]}>{isBotFilled ? "Bot filled: Yes" : "Bot filled: No"}</Text>
      </View>

      <View style={styles.playersWrap}>
        {players.map((p) => {
          const gamePlayer = state.players.find((x) => x.id === p.id);
          return (
            <View key={p.id} style={styles.playerRow}>
              <Text style={[styles.playerName, { fontSize: mScale(13, 0.5, 12, 16) }]}>{p.name}</Text>
              <Text style={[styles.playerMeta, { fontSize: mScale(11, 0.5, 10, 13) }]}>
                {gamePlayer?.status ?? "active"} | Score: {gamePlayer?.totalScore ?? 0}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.cardsSection, { marginTop: vScale(12, 8, 16), gap: vScale(8, 6, 12) }]}>
        <Text style={[styles.sectionTitle, { fontSize: mScale(13, 0.5, 12, 16) }]}>Your Hand</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {me?.hand.map((c) => {
            const selected = selectedCardId === c.id;
            return (
              <Pressable
                key={c.id}
                style={[
                  styles.cardChip,
                  {
                    borderRadius: mScale(8, 0.5, 7, 10),
                    paddingHorizontal: scale(10, 8, 14),
                    paddingVertical: vScale(8, 6, 11),
                    marginRight: scale(8, 6, 10),
                  },
                  selected && styles.cardChipSelected,
                ]}
                onPress={() => setSelectedCardId((prev) => (prev === c.id ? null : c.id))}
              >
                <Text style={[styles.cardText, { fontSize: mScale(12, 0.5, 11, 14) }]}>{c.rank}{c.suit[0].toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={[styles.cardsSection, { marginTop: vScale(12, 8, 16), gap: vScale(8, 6, 12) }]}>
        <Text style={[styles.sectionTitle, { fontSize: mScale(13, 0.5, 12, 16) }]}>Last Thrown</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {state.lastThrown.map((c) => (
            <View key={c.id} style={[styles.cardChip, { borderRadius: mScale(8, 0.5, 7, 10), paddingHorizontal: scale(10, 8, 14), paddingVertical: vScale(8, 6, 11), marginRight: scale(8, 6, 10) }]}>
              <Text style={[styles.cardText, { fontSize: mScale(12, 0.5, 11, 14) }]}>{c.rank}{c.suit[0].toUpperCase()}</Text>
            </View>
          ))}
          {state.lastThrown.length === 0 ? <Text style={[styles.emptyLabel, { fontSize: mScale(12, 0.5, 11, 14), paddingVertical: vScale(8, 6, 10) }]}>No cards</Text> : null}
        </ScrollView>
      </View>

      <View style={[styles.actionRow, { gap: scale(8, 6, 12), marginTop: vScale(14, 10, 18) }]}>
        <Pressable style={[styles.actionBtn, { borderRadius: mScale(10, 0.5, 8, 13), paddingHorizontal: scale(12, 10, 16), paddingVertical: vScale(10, 8, 14) }, !canThrow && styles.disabledBtn]} onPress={throwOne}>
          <Text style={[styles.actionText, { fontSize: mScale(12, 0.5, 11, 14) }]}>Throw 1</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, { borderRadius: mScale(10, 0.5, 8, 13), paddingHorizontal: scale(12, 10, 16), paddingVertical: vScale(10, 8, 14) }, !canPick && styles.disabledBtn]} onPress={pickDeck}>
          <Text style={[styles.actionText, { fontSize: mScale(12, 0.5, 11, 14) }]}>Pick Deck</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, { borderRadius: mScale(10, 0.5, 8, 13), paddingHorizontal: scale(12, 10, 16), paddingVertical: vScale(10, 8, 14) }, !canPick && styles.disabledBtn]} onPress={pickThrown}>
          <Text style={[styles.actionText, { fontSize: mScale(12, 0.5, 11, 14) }]}>Pick Thrown</Text>
        </Pressable>
        <Pressable
          style={[
            styles.actionBtn,
            { borderRadius: mScale(10, 0.5, 8, 13), paddingHorizontal: scale(12, 10, 16), paddingVertical: vScale(10, 8, 14) },
            (!canThrow || !state.canCallShow) && styles.disabledBtn,
          ]}
          onPress={callShow}
        >
          <Text style={[styles.actionText, { fontSize: mScale(12, 0.5, 11, 14) }]}>Show</Text>
        </Pressable>
      </View>

      {error ? <Text style={[styles.error, { marginTop: vScale(10, 8, 14), fontSize: mScale(12, 0.5, 11, 14) }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: COLORS.text, fontWeight: "700" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerText: { color: COLORS.gold, fontWeight: "900", letterSpacing: 1 },
  exitBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  exitText: { color: COLORS.text, fontWeight: "700" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  infoText: { color: COLORS.textDim, fontWeight: "600" },
  playersWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: 10,
    gap: 8,
    marginTop: 8,
  },
  playerRow: { flexDirection: "row", justifyContent: "space-between" },
  playerName: { color: COLORS.text, fontWeight: "700" },
  playerMeta: { color: COLORS.textMuted },
  cardsSection: { marginTop: 12, gap: 8 },
  sectionTitle: { color: COLORS.text, fontWeight: "800" },
  cardChip: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  cardChipSelected: {
    borderColor: COLORS.gold,
    backgroundColor: "rgba(255,215,0,0.2)",
  },
  cardText: { color: COLORS.text, fontWeight: "800" },
  emptyLabel: { color: COLORS.textMuted },
  actionRow: { flexDirection: "row", flexWrap: "wrap" },
  actionBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.45)",
    backgroundColor: "rgba(255,215,0,0.12)",
  },
  actionText: { color: COLORS.gold, fontWeight: "800" },
  disabledBtn: { opacity: 0.4 },
  error: { color: COLORS.error, fontWeight: "700" },
});
