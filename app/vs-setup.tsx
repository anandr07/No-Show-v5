import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  ScrollView,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  ZoomIn,
  FadeIn,
  SlideInDown,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useGame } from "@/context/GameContext";
import COLORS, { AVATAR_COLORS } from "@/constants/colors";
import { playSuccess } from "@/lib/sound";

const { width: SCREEN_W } = Dimensions.get("window");

const BOT_NAMES = ["Alex", "Sam", "Jordan", "Taylor", "Morgan"];

function PlayerCard({ name, index, isHuman }: { name: string; index: number; isHuman: boolean }) {
  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <Animated.View entering={FadeIn.delay(index * 60)} style={styles.playerCard}>
      <LinearGradient
        colors={[`${avatarColor}22`, `${avatarColor}06`]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.playerAvatar, { backgroundColor: avatarColor }]}>
        {isHuman
          ? <Ionicons name="person" size={18} color="#fff" />
          : <FontAwesome5 name="robot" size={14} color="#fff" />
        }
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{name || "You"}</Text>
        <Text style={styles.playerType}>{isHuman ? "Human" : "Bot AI"}</Text>
      </View>
      <View style={[styles.playerBadge, { borderColor: isHuman ? COLORS.gold : `${avatarColor}60`, backgroundColor: isHuman ? "rgba(255,215,0,0.1)" : `${avatarColor}18` }]}>
        <Text style={[styles.playerBadgeText, { color: isHuman ? COLORS.gold : avatarColor }]}>
          {isHuman ? "YOU" : "BOT"}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function VsSetupScreen() {
  const { startVsGame } = useGame();
  const insets = useSafeAreaInsets();
  const [playerName, setPlayerName] = useState("You");
  const [botCount, setBotCount] = useState(2);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const totalPlayers = botCount + 1;

  const robotPulse = useSharedValue(1);
  useEffect(() => {
    robotPulse.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      true
    );
  }, []);

  const robotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: robotPulse.value }],
  }));

  const handleStart = () => {
    const name = playerName.trim() || "You";
    startVsGame(name, botCount);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSuccess();
    router.push("/game");
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.bgDeep, "#0A0500", "#060300"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={[styles.glowSpot]} />

      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.back();
        }}>
          <Ionicons name="arrow-back" size={20} color={COLORS.orange} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>VS SYSTEM</Text>
          <Text style={styles.headerSub}>SETUP</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.iconWrap, robotStyle]}>
          <LinearGradient
            colors={[COLORS.orange, COLORS.orangeDark]}
            style={styles.iconGradient}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
          >
            <FontAwesome5 name="robot" size={36} color="#fff" />
          </LinearGradient>
          <View style={styles.iconRingOuter} />
        </Animated.View>

        <Animated.View entering={SlideInDown.delay(120)} style={styles.section}>
          <Text style={styles.label}>YOUR NAME</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person" size={16} color={COLORS.textDim} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={playerName}
              onChangeText={setPlayerName}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.textDim}
              maxLength={16}
              returnKeyType="done"
              selectionColor={COLORS.orange}
            />
          </View>
        </Animated.View>

        <Animated.View entering={SlideInDown.delay(200)} style={styles.section}>
          <Text style={styles.label}>NUMBER OF OPPONENTS</Text>
          <View style={styles.botSelector}>
            {[2, 3].map((count) => (
              <Pressable
                key={count}
                style={[styles.botOption, botCount === count && styles.botOptionSelected]}
                onPress={() => {
                  setBotCount(count);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                {botCount === count && (
                  <LinearGradient
                    colors={[`${COLORS.orange}30`, `${COLORS.orange}10`]}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <View style={styles.botOptionRow}>
                  <FontAwesome5 name="robot" size={14} color={botCount === count ? COLORS.orange : COLORS.textDim} />
                  <Text style={[styles.botOptionNum, botCount === count && styles.botOptionNumSelected]}>
                    {count}
                  </Text>
                </View>
                <Text style={[styles.botOptionLabel, botCount === count && styles.botOptionLabelSelected]}>
                  {count === 2 ? "Beginner" : "Advanced"}
                </Text>
                {botCount === count && (
                  <View style={styles.botOptionCheck}>
                    <Ionicons name="checkmark" size={10} color={COLORS.orange} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(300)} style={styles.section}>
          <Text style={styles.label}>TABLE · {totalPlayers} PLAYERS</Text>
          <View style={styles.playerPreview}>
            <PlayerCard name={playerName || "You"} index={0} isHuman />
            {BOT_NAMES.slice(0, botCount).map((name, idx) => (
              <PlayerCard key={name} name={name} index={idx + 1} isHuman={false} />
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={SlideInDown.delay(400)}>
          <Pressable
            style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}
            onPress={handleStart}
          >
            <LinearGradient
              colors={[COLORS.orange, COLORS.orangeDark]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <MaterialCommunityIcons name="cards-playing" size={22} color="#fff" />
            <Text style={styles.startBtnText}>DEAL THE CARDS</Text>
            <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.8)" />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  glowSpot: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.orange,
    opacity: 0.04,
    top: "20%",
    left: "50%",
    transform: [{ translateX: -150 }],
  },
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
    backgroundColor: `${COLORS.orange}18`,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: `${COLORS.orange}35`,
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    color: COLORS.orange,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 3,
  },
  headerSub: {
    color: COLORS.textDim,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 3,
    marginTop: 1,
  },
  content: {
    paddingTop: 8,
    gap: 22,
    paddingHorizontal: 20,
    maxWidth: 500,
    alignSelf: "center",
    width: "100%",
  },
  iconWrap: {
    alignSelf: "center",
    position: "relative",
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  iconRingOuter: {
    position: "absolute",
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: `${COLORS.orange}30`,
  },
  section: { gap: 10 },
  label: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: `${COLORS.orange}30`,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
  },
  botSelector: {
    flexDirection: "row",
    gap: 10,
  },
  botOption: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.09)",
    overflow: "hidden",
    gap: 4,
    position: "relative",
  },
  botOptionSelected: {
    borderColor: `${COLORS.orange}80`,
  },
  botOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  botOptionNum: {
    color: COLORS.textDim,
    fontSize: 24,
    fontWeight: "800",
  },
  botOptionNumSelected: { color: COLORS.orange },
  botOptionLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  botOptionLabelSelected: { color: `${COLORS.orange}CC` },
  botOptionCheck: {
    position: "absolute",
    top: 6,
    right: 8,
  },
  playerPreview: {
    gap: 6,
  },
  playerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  playerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  playerInfo: { flex: 1, gap: 2 },
  playerName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  playerType: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: "500",
  },
  playerBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  playerBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  startBtn: {
    borderRadius: 16,
    overflow: "hidden",
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  startBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  startBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 2,
  },
});
