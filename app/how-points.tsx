import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";
import { useResponsive } from "@/lib/responsive";

export default function HowPointsScreen() {
  const insets = useSafeAreaInsets();
  const { scale, vScale, mScale } = useResponsive();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#051810", "#0A2416", "#133D24"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: topInset + vScale(8, 6, 14), paddingHorizontal: scale(16, 12, 22), marginBottom: vScale(10, 8, 14) }]}>
        <Pressable
          style={[
            styles.backBtn,
            { width: scale(52, 44, 60), height: vScale(36, 32, 42), borderRadius: mScale(10, 0.5, 8, 13) },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Ionicons name="arrow-back" size={18} color={COLORS.gold} />
        </Pressable>
        <Text style={[styles.title, { fontSize: mScale(16, 0.5, 14, 19) }]}>HOW POINTS WORK</Text>
        <View style={{ width: scale(52, 44, 60) }} />
      </View>

      <View style={[styles.card, { marginHorizontal: scale(16, 10, 24), borderRadius: mScale(16, 0.5, 12, 20), padding: mScale(16, 0.5, 12, 20), gap: vScale(8, 6, 12) }]}>
        <Text style={[styles.ruleTitle, { fontSize: mScale(14, 0.5, 13, 17) }]}>Winner Formula</Text>
        <Text style={[styles.ruleText, { fontSize: mScale(14, 0.5, 12, 17), lineHeight: mScale(21, 0.5, 18, 25) }]}>Winner gets: 100 - X</Text>
        <Text style={[styles.ruleSubText, { fontSize: mScale(12, 0.5, 11, 14), lineHeight: mScale(18, 0.5, 16, 21) }]}>
          X = winner&apos;s current score when all other players have crossed 100.
        </Text>

        <View style={[styles.divider, { marginVertical: vScale(4, 3, 6) }]} />

        <Text style={[styles.ruleTitle, { fontSize: mScale(14, 0.5, 13, 17) }]}>Example</Text>
        <Text style={[styles.ruleText, { fontSize: mScale(14, 0.5, 12, 17), lineHeight: mScale(21, 0.5, 18, 25) }]}>If winner has 60, winner gets 40 points.</Text>

        <View style={[styles.divider, { marginVertical: vScale(4, 3, 6) }]} />

        <Text style={[styles.ruleTitle, { fontSize: mScale(14, 0.5, 13, 17) }]}>Loss Penalty</Text>
        <Text style={[styles.ruleText, { fontSize: mScale(14, 0.5, 12, 17), lineHeight: mScale(21, 0.5, 18, 25) }]}>Each loss: -20 points</Text>

        <View style={[styles.divider, { marginVertical: vScale(4, 3, 6) }]} />

        <Text style={[styles.ruleTitle, { fontSize: mScale(14, 0.5, 13, 17) }]}>Important</Text>
        <Text style={[styles.ruleText, { fontSize: mScale(14, 0.5, 12, 17), lineHeight: mScale(21, 0.5, 18, 25) }]}>Points are counted only in Online mode.</Text>
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
    backgroundColor: "rgba(255,215,0,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.32)",
  },
  title: { color: COLORS.gold, fontWeight: "800", letterSpacing: 1 },
  card: {
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  ruleTitle: { color: COLORS.gold, fontWeight: "900" },
  ruleText: { color: COLORS.text, fontWeight: "700" },
  ruleSubText: { color: COLORS.textDim },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 4,
  },
});
