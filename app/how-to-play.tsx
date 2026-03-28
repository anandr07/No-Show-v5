import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";

const sections = [
  {
    icon: "flag" as const,
    title: "OBJECTIVE",
    color: "#FFD700",
    content: "Be the last player with a total score under 100 points. The player who reaches 100 or more is eliminated.",
  },
  {
    icon: "layers" as const,
    title: "SETUP",
    color: "#3498DB",
    content: "A standard 52-card deck is shuffled and dealt. One random player gets 8 cards and goes first. Everyone else gets 7 cards. The remaining deck is placed face-down.",
  },
  {
    icon: "refresh" as const,
    title: "TURN STRUCTURE",
    color: "#2ECC71",
    content: "Each turn has two phases:\n\n1. THROW: You must throw one or more cards from your hand\n2. PICK: You must pick exactly one card — from the draw deck OR from the cards just thrown by the previous player",
  },
  {
    icon: "checkmark-circle" as const,
    title: "VALID THROWS",
    color: "#E67E22",
    content: "• Single card: Any 1 card\n• Same rank pair: 2 or more cards of the same rank (e.g., K-K, 7-7-7)\n• Sequence: 3+ consecutive ranks (e.g., 7-8-9, J-Q-K). Suit doesn't matter. No gaps allowed.",
  },
  {
    icon: "eye" as const,
    title: "CALLING SHOW",
    color: "#9B59B6",
    content: "After each player has completed at least one turn, you may call 'Show' during your throw phase.\n\nAll hands are revealed and scored:\n• If you have the LOWEST score: you get +0, others add (their score − your score)\n• If someone else has a LOWER or EQUAL score: you get +15 penalty, others get +0",
  },
  {
    icon: "bar-chart" as const,
    title: "CARD VALUES",
    color: "#E74C3C",
    content: "Ace (A) = 1 point\n2 through 10 = face value\nJack (J) = 11 points\nQueen (Q) = 12 points\nKing (K) = 13 points",
  },
  {
    icon: "skull" as const,
    title: "ELIMINATION",
    color: "#E74C3C",
    content: "Any player whose total score reaches 100 or more is eliminated. They no longer participate in subsequent rounds.",
  },
  {
    icon: "trophy" as const,
    title: "WINNING",
    color: "#FFD700",
    content: "The last player with a score under 100 wins. If all remaining players are eliminated in the same round, the player with the lowest score wins.",
  },
];

export default function HowToPlayScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.bgDeep, "#030A06", "#040D08"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: topInset + 8, paddingLeft: insets.left + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.gold} />
        </Pressable>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="cards-playing" size={20} color={COLORS.gold} />
          <Text style={styles.headerTitle}>HOW TO PLAY</Text>
          <MaterialCommunityIcons name="cards-playing" size={20} color={COLORS.gold} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomInset + 24, paddingHorizontal: insets.left + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((section, idx) => (
          <Animated.View key={section.title} entering={FadeIn.delay(idx * 60)} style={styles.section}>
            <View style={[styles.sectionHeader, { borderLeftColor: section.color }]}>
              <View style={[styles.sectionIcon, { backgroundColor: `${section.color}20` }]}>
                <Ionicons name={section.icon} size={18} color={section.color} />
              </View>
              <Text style={[styles.sectionTitle, { color: section.color }]}>{section.title}</Text>
            </View>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </Animated.View>
        ))}

        {/* Card value table */}
        <Animated.View entering={FadeIn.delay(sections.length * 60)} style={styles.cardTable}>
          <Text style={styles.cardTableTitle}>QUICK REFERENCE — CARD VALUES</Text>
          <View style={styles.cardTableGrid}>
            {["A=1", "2-10", "J=11", "Q=12", "K=13"].map((v) => (
              <View key={v} style={styles.cardTableCell}>
                <Text style={styles.cardTableText}>{v}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 2,
  },
  content: {
    paddingTop: 12,
    gap: 16,
    maxWidth: 640,
    alignSelf: "center",
    width: "100%",
  },
  section: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderLeftWidth: 3,
    paddingLeft: 8,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  sectionContent: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "400",
  },
  cardTable: {
    backgroundColor: "rgba(255,215,0,0.08)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
    gap: 12,
  },
  cardTableTitle: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  cardTableGrid: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  cardTableCell: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  cardTableText: {
    color: COLORS.cardBlack,
    fontSize: 13,
    fontWeight: "700",
  },
});
