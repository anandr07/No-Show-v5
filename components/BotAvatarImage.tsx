import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { BOT_AVATARS, clampBotAvatarIndex } from "@/constants/bot-avatar";

interface BotAvatarImageProps {
  botAvatarIndex: number;
  size: number;
  borderColor?: string;
  backgroundColor?: string;
  style?: ViewStyle;
}

export function BotAvatarImage({
  botAvatarIndex,
  size,
  borderColor = "rgba(255,255,255,0.22)",
  backgroundColor = "rgba(0,0,0,0.4)",
  style,
}: BotAvatarImageProps) {
  const i = clampBotAvatarIndex(botAvatarIndex);
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
      <Image source={BOT_AVATARS[i]} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", justifyContent: "center", alignItems: "center" },
});
