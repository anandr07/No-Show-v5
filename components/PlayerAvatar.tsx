import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import COLORS, { AVATAR_COLORS } from "@/constants/colors";

interface PlayerAvatarProps {
  name: string;
  index: number;
  isCurrentTurn?: boolean;
  isEliminated?: boolean;
  hasLeft?: boolean;
  cardCount?: number;
  score?: number;
  style?: ViewStyle;
  size?: "small" | "medium" | "large";
  showScore?: boolean;
}

export function PlayerAvatar({
  name,
  index,
  isCurrentTurn = false,
  isEliminated = false,
  hasLeft = false,
  cardCount,
  score,
  style,
  size = "medium",
  showScore = false,
}: PlayerAvatarProps) {
  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initials = name
    .split(" ")
    .map((w) => w[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

  const dims = SIZE_MAP[size];
  const opacity = isEliminated || hasLeft ? 0.4 : 1;

  return (
    <View style={[styles.container, style, { opacity }]}>
      <View
        style={[
          styles.avatarRing,
          {
            width: dims.ring,
            height: dims.ring,
            borderRadius: dims.ring / 2,
            borderColor: isCurrentTurn ? COLORS.gold : "rgba(255,255,255,0.2)",
            borderWidth: isCurrentTurn ? 2.5 : 1.5,
          },
        ]}
      >
        <View
          style={[
            styles.avatar,
            {
              width: dims.size,
              height: dims.size,
              borderRadius: dims.size / 2,
              backgroundColor: avatarColor,
            },
          ]}
        >
          <Text style={[styles.initials, { fontSize: dims.font }]}>{initials}</Text>
        </View>
      </View>

      {isCurrentTurn && (
        <View style={styles.turnIndicator}>
          <View style={styles.turnDot} />
        </View>
      )}

      <Text
        style={[styles.name, { fontSize: dims.nameFont }]}
        numberOfLines={1}
      >
        {name}
        {isEliminated ? " OUT" : hasLeft ? " LEFT" : ""}
      </Text>

      {cardCount !== undefined && (
        <View style={styles.cardCountBadge}>
          <Text style={styles.cardCountText}>{cardCount} cards</Text>
        </View>
      )}

      {showScore && score !== undefined && (
        <Text style={styles.scoreText}>{score} pts</Text>
      )}
    </View>
  );
}

const SIZE_MAP = {
  small: { ring: 42, size: 36, font: 12, nameFont: 9 },
  medium: { ring: 54, size: 46, font: 16, nameFont: 11 },
  large: { ring: 70, size: 60, font: 20, nameFont: 13 },
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 4,
  },
  avatarRing: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  initials: {
    color: "#FFF",
    fontWeight: "700",
  },
  name: {
    color: COLORS.text,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 80,
  },
  cardCountBadge: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  cardCountText: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: "600",
  },
  turnIndicator: {
    position: "absolute",
    top: -4,
    right: -4,
  },
  turnDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.gold,
    borderWidth: 1.5,
    borderColor: "#000",
  },
  scoreText: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: "700",
  },
});
