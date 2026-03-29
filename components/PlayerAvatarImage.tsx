import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { PLAYER_AVATARS, clampAvatarIndex } from "@/constants/player-avatar";

interface PlayerAvatarImageProps {
  avatarIndex: number;
  size: number;
  borderColor?: string;
  backgroundColor?: string;
  style?: ViewStyle;
}

/** Circular avatar image from the selectable set; falls back to person icon if asset missing. */
export function PlayerAvatarImage({
  avatarIndex,
  size,
  borderColor = "rgba(255,255,255,0.2)",
  backgroundColor = "rgba(0,0,0,0.35)",
  style,
}: PlayerAvatarImageProps) {
  const i = clampAvatarIndex(avatarIndex);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor,
          backgroundColor,
        },
        style,
      ]}
    >
      <Image
        source={PLAYER_AVATARS[i]}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={120}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
});
