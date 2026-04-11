import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  interpolate,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { Image as ExpoImage } from "expo-image";
import { Card as CardType, SUIT_SYMBOLS } from "@/lib/gameEngine";
import COLORS from "@/constants/colors";
import { useSettings } from "@/context/SettingsContext";
import { getCardBackImageSource } from "@/constants/storeCatalog";

export const FLIGHT_W = 46;
export const FLIGHT_H = 66;

export interface GameCardAnimItem {
  id: string;
  card?: CardType;
  faceDown?: boolean;
  fromPos: { x: number; y: number };
  toPos: { x: number; y: number };
  delay: number;
}

interface FlightCardProps extends GameCardAnimItem {
  onDone: (id: string) => void;
}

export function FlightCard({ id, card, faceDown, fromPos, toPos, delay, onDone }: FlightCardProps) {
  const progress = useSharedValue(0);
  const { cardBackId } = useSettings();
  const cardBackSource = getCardBackImageSource(cardBackId);
  const isRed = card && (card.suit === "hearts" || card.suit === "diamonds");
  const symbol = card ? (SUIT_SYMBOLS[card.suit] ?? "") : "";

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 1700, easing: Easing.out(Easing.cubic) }, (done) => {
        if (done) runOnJS(onDone)(id);
      })
    );
  }, []);

  const animStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const arcH = Math.min(Math.abs(dx), Math.abs(dy)) * 0.35 + 35;
    return {
      transform: [
        { translateX: t * dx },
        { translateY: t * dy - Math.sin(t * Math.PI) * arcH },
        { scale: interpolate(t, [0, 0.4, 1], [0.9, 1.28, 0.92]) },
      ],
      opacity: interpolate(t, [0, 0.08, 0.78, 1], [0, 1, 1, 0]),
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: fromPos.x - FLIGHT_W / 2,
          top: fromPos.y - FLIGHT_H / 2,
          width: FLIGHT_W,
          height: FLIGHT_H,
          zIndex: 200,
        },
        animStyle,
      ]}
    >
      {faceDown || !card ? (
        <View style={styles.flightBack}>
          <ExpoImage
            source={cardBackSource}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={0}
          />
        </View>
      ) : (
        <View
          style={[
            styles.flightFace,
            {
              shadowColor: isRed ? COLORS.cardRed : "#1A1A1A",
              borderColor: isRed ? COLORS.cardRed : "#1A1A1A",
            },
          ]}
        >
          <Text style={styles.flightRank}>{card.rank}</Text>
          <Text style={[styles.flightSuit, { color: isRed ? COLORS.cardRed : "#1A1A1A" }]}>{symbol}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flightFace: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: COLORS.cardWhite,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.75,
    shadowRadius: 14,
    elevation: 20,
  },
  flightRank: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1A1A1A",
  },
  flightSuit: {
    fontSize: 13,
    fontWeight: "700",
  },
  flightBack: {
    flex: 1,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.75,
    shadowRadius: 14,
    elevation: 20,
    overflow: "hidden",
    borderWidth: 0,
    borderColor: "transparent",
  },
});
