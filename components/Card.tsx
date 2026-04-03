import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { Card as CardType, SUIT_SYMBOLS, SUIT_COLORS } from "@/lib/gameEngine";
import COLORS from "@/constants/colors";

interface CardProps {
  card: CardType;
  selected?: boolean;
  onPress?: () => void;
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  style?: object;
}

export function Card({
  card,
  selected = false,
  onPress,
  size = "medium",
  disabled = false,
  style,
}: CardProps) {
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);

  const dims = SIZE_MAP[size];
  const suitColor = SUIT_COLORS[card.suit];
  const symbol = SUIT_SYMBOLS[card.suit];

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: lift.value },
    ],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(1.06, { damping: 15 });
    lift.value = withSpring(-10, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
    lift.value = withSpring(0, { damping: 15 });
  };

  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={disabled ? undefined : handlePressIn}
        onPressOut={disabled ? undefined : handlePressOut}
        disabled={disabled}
        style={({ pressed }) => [
          styles.card,
          {
            width: dims.width,
            height: dims.height,
            borderRadius: dims.radius,
            borderWidth: selected ? 2.5 : 1.5,
            borderColor: selected ? COLORS.gold : "rgba(0,0,0,0.15)",
          },
          selected && styles.selectedCard,
          Platform.OS === "web" && pressed && { opacity: 0.9 },
        ]}
      >
        <View style={[styles.corner, styles.topLeft]}>
          <Text style={[styles.rankText, { color: suitColor, fontSize: dims.rankFont }]}>
            {card.rank}
          </Text>
          <Text style={[styles.suitSmall, { color: suitColor, fontSize: dims.suitSmall }]}>
            {symbol}
          </Text>
        </View>

        <Text style={[styles.centerSuit, { color: suitColor, fontSize: dims.suitLarge }]}>
          {symbol}
        </Text>

        <View style={[styles.corner, styles.bottomRight]}>
          <Text style={[styles.suitSmall, { color: suitColor, fontSize: dims.suitSmall }]}>
            {symbol}
          </Text>
          <Text style={[styles.rankText, { color: suitColor, fontSize: dims.rankFont }]}>
            {card.rank}
          </Text>
        </View>

        {selected && <View style={styles.selectedOverlay} />}
      </Pressable>
    </Animated.View>
  );
}

interface CardBackProps {
  style?: object;
  size?: "small" | "medium" | "large";
  count?: number;
}

export function CardBack({ style, size = "medium", count }: CardBackProps) {
  const dims = SIZE_MAP[size];
  const cardBackSource = require("@/assets/images/card-back.png");
  return (
    <View
      style={[
        styles.cardBack,
        {
          width: dims.width,
          height: dims.height,
          borderRadius: dims.radius,
        },
        style,
      ]}
    >
      <View style={[styles.cardBackClip, { borderRadius: dims.radius }]} pointerEvents="none">
        <ExpoImage
          source={cardBackSource}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
        />
      </View>
      {count !== undefined && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const SIZE_MAP = {
  small: { width: 36, height: 52, radius: 4, rankFont: 8, suitSmall: 7, suitLarge: 18 },
  medium: { width: 52, height: 76, radius: 6, rankFont: 11, suitSmall: 9, suitLarge: 26 },
  large: { width: 68, height: 100, radius: 8, rankFont: 14, suitSmall: 11, suitLarge: 34 },
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardWhite,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 12,
    position: "relative",
    overflow: "hidden",
  },
  selectedCard: {
    backgroundColor: "#FFFDE7",
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 16,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,215,0,0.12)",
  },
  corner: {
    position: "absolute",
    alignItems: "center",
  },
  topLeft: {
    top: 3,
    left: 3,
  },
  bottomRight: {
    bottom: 3,
    right: 3,
    transform: [{ rotate: "180deg" }],
  },
  rankText: {
    fontWeight: "800",
    lineHeight: 13,
  },
  suitSmall: {
    lineHeight: 11,
  },
  centerSuit: {
    textAlign: "center",
  },
  cardBack: {
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 12,
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
  },
  cardBackClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  countBadge: {
    position: "absolute",
    bottom: -6,
    right: -6,
    backgroundColor: COLORS.gold,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  countText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#000",
  },
});
