import React from "react";
import { View, Text, StyleSheet } from "react-native";
import COLORS from "@/constants/colors";

/** Plain View (no Reanimated) so mounting beside avatars never races Modal teardown / native driver. */
export function QuickChatBubble({ text }: { text: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text} numberOfLines={4}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    maxWidth: 168,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 8,
  },
  text: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 16,
  },
});
