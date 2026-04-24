import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  FadeIn,
  FadeOut,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { resolvePlayerDisplayName } from "@/lib/player-display";
import { PlayerAvatarImage } from "@/components/PlayerAvatarImage";
import { playTap } from "@/lib/sound";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface PanelData {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  gradientColors: [string, string, string];
  accentColor: string;
  onPress: () => void;
  disabled?: boolean;
}

function FloatingCard({ x, y, rotate, delay, color }: { x: number; y: number; rotate: number; delay: number; color: string }) {
  const float = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(0.18, { duration: 800 });
    float.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2000 + delay }),
        withTiming(6, { duration: 2000 + delay })
      ),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ position: "absolute", left: x, top: y, transform: [{ rotate: `${rotate}deg` }] }, style]}>
      <View style={[styles.floatingCard, { borderColor: color, shadowColor: color }]}>
        <Text style={[styles.floatingCardText, { color }]}>♠</Text>
      </View>
    </Animated.View>
  );
}

function Panel({ data, index }: { data: PanelData; index: number }) {
  const scale = useSharedValue(1);
  const brightness = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(brightness.value, [0, 1], [0, 0.12]),
  }));

  const handlePressIn = () => {
    if (data.disabled) return;
    scale.value = withSpring(0.97, { damping: 20 });
    brightness.value = withTiming(1, { duration: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 20 });
    brightness.value = withTiming(0, { duration: 200 });
  };

  return (
    <Animated.View
      entering={FadeIn.delay(index * 80).duration(500)}
      style={[styles.panelOuter, animStyle]}
    >
      <Pressable
        onPress={data.disabled ? undefined : () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          data.onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.panelPressable}
      >
        <LinearGradient
          colors={data.gradientColors}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />

        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: data.accentColor }, glowStyle]} />

        <View style={styles.panelDividerRight} />

        <View style={styles.panelContent}>
          <View style={[styles.panelIconRing, { borderColor: `${data.accentColor}60`, shadowColor: data.accentColor }]}>
            {data.icon}
            {data.disabled && (
              <View style={styles.panelLockBadge}>
                <Ionicons name="lock-closed" size={9} color="#fff" />
              </View>
            )}
          </View>

          <Text style={[styles.panelTitle, { color: data.accentColor, textShadowColor: data.accentColor }]}>
            {data.title}
          </Text>
          <Text style={styles.panelSubtitle}>{data.subtitle}</Text>

          {data.disabled && (
            <View style={[styles.comingSoonBadge, { borderColor: `${data.accentColor}40` }]}>
              <Text style={[styles.comingSoonText, { color: data.accentColor }]}>SOON</Text>
            </View>
          )}
          {!data.disabled && (
            <View style={[styles.panelArrow, { borderColor: `${data.accentColor}60` }]}>
              <Ionicons name="arrow-forward" size={14} color={data.accentColor} />
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function GemBalanceChip() {
  const { gemBalance } = useSettings();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.gemChip,
        pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
      ]}
      onPress={() => {
        playTap();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/store");
      }}
      accessibilityLabel={`Gems: ${gemBalance}. Open store`}
    >
      <MaterialCommunityIcons name="diamond-stone" size={18} color="#5DADE2" />
      <Text style={styles.gemChipText} numberOfLines={1}>
        {gemBalance.toLocaleString()}
      </Text>
    </Pressable>
  );
}

interface PlayerMenuProps {
  visible: boolean;
  onClose: () => void;
  topInset: number;
}

function PlayerMenu({ visible, onClose, topInset }: PlayerMenuProps) {
  const { user, isGuest, signOut } = useAuth();
  const { displayName: savedName, avatarIndex } = useSettings();
  const displayName = resolvePlayerDisplayName({
    localName: savedName,
    authDisplayName: user?.user_metadata?.display_name,
    email: user?.email ?? null,
    fallback: "Guest",
  });

  type MenuItem = {
    id: string;
    label: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    destructive?: boolean;
    accent?: boolean;
    onPress: () => void | Promise<void>;
  };

  const commonItems: MenuItem[] = [
    {
      id: "username",
      label: isGuest ? "Playing as Guest" : "Username",
      subtitle: isGuest ? "Progress saved on this device" : displayName,
      icon: "person-outline",
      onPress: () => {
        onClose();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (!isGuest) router.push("/profile");
      },
    },
    {
      id: "past-games",
      label: "Past Games",
      subtitle: "View game history",
      icon: "time-outline",
      onPress: () => {
        onClose();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/past-games");
      },
    },
    {
      id: "statistics",
      label: "Statistics",
      subtitle: "Win rate & stats",
      icon: "stats-chart-outline",
      onPress: () => {
        onClose();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push("/statistics");
      },
    },
  ];

  const authItems: MenuItem[] = isGuest
    ? [
        {
          id: "sign-in",
          label: "Sign In",
          subtitle: "Save progress & play online",
          icon: "log-in-outline",
          accent: true,
          onPress: async () => {
            onClose();
            playTap();
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await signOut();
          },
        },
      ]
    : user
    ? [
        {
          id: "sign-out",
          label: "Sign out",
          subtitle: "Log out of this account",
          icon: "log-out-outline",
          destructive: true,
          onPress: async () => {
            onClose();
            playTap();
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await signOut();
          },
        },
      ]
    : [];

  const menuItems: MenuItem[] = [...commonItems, ...authItems];

  if (!visible) return null;

  return (
    <>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(100)}
        style={[styles.playerMenu, { top: topInset + 52, right: 12 }]}
      >
        <LinearGradient
          colors={["#0A1A12", "#06100A", "#040A06"]}
          style={styles.playerMenuGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          {menuItems.map((item, idx) => {
            const isAccent = item.accent;
            const isDestructive = item.destructive;
            const iconColor = isDestructive
              ? COLORS.error
              : isAccent
              ? COLORS.gold
              : COLORS.gold;
            const showDivider =
              isGuest && item.id === "sign-in";
            return (
              <React.Fragment key={item.id}>
                {showDivider && (
                  <View style={styles.playerMenuDivider} />
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.playerMenuItem,
                    pressed && styles.playerMenuItemPressed,
                    isAccent && styles.playerMenuItemAccent,
                  ]}
                  onPress={() => void item.onPress()}
                >
                  <View
                    style={[
                      styles.playerMenuIconWrap,
                      isDestructive && styles.playerMenuIconWrapDestructive,
                      isAccent && styles.playerMenuIconWrapAccent,
                    ]}
                  >
                    {item.id === "username" ? (
                      <PlayerAvatarImage
                        avatarIndex={avatarIndex}
                        size={28}
                        borderColor="rgba(255,215,0,0.35)"
                        backgroundColor="rgba(0,0,0,0.4)"
                      />
                    ) : (
                      <Ionicons name={item.icon} size={18} color={iconColor} />
                    )}
                  </View>
                  <View style={styles.playerMenuTextWrap}>
                    <Text
                      style={[
                        styles.playerMenuLabel,
                        isDestructive && styles.playerMenuLabelDestructive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        styles.playerMenuSubtitle,
                        isDestructive && styles.playerMenuSubtitleDestructive,
                      ]}
                      numberOfLines={1}
                    >
                      {item.subtitle}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={
                      isDestructive
                        ? "rgba(229,57,53,0.55)"
                        : isAccent
                        ? "rgba(255,215,0,0.7)"
                        : COLORS.textDim
                    }
                  />
                </Pressable>
              </React.Fragment>
            );
          })}
        </LinearGradient>
      </Animated.View>
    </>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const [playerMenuVisible, setPlayerMenuVisible] = useState(false);
  const { user, isGuest, isLoading: authLoading } = useAuth();

  // Only redirect to auth if: loading is done AND no user AND not a guest session.
  useEffect(() => {
    if (!authLoading && user === null && !isGuest) {
      router.replace("/auth");
    }
  }, [authLoading, user, isGuest]);

  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 3000 }), -1, true);
  }, []);

  const titleShimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.85, 1, 0.85]),
  }));

  const panels: PanelData[] = [
    {
      id: "vs",
      title: "VS SYSTEM",
      subtitle: "VS BOTS",
      icon: <FontAwesome5 name="robot" size={28} color={COLORS.orange} />,
      gradientColors: ["#1A0D00", "#0E0800", "#060300"],
      accentColor: COLORS.orange,
      onPress: () => {
        playTap();
        router.push("/vs-setup");
      },
    },
    {
      id: "multi",
      title: "MULTIPLAYER",
      subtitle: "LOCAL ROOM",
      icon: <Ionicons name="people" size={28} color={COLORS.blue} />,
      gradientColors: ["#00101F", "#000A14", "#000509"],
      accentColor: COLORS.blue,
      onPress: () => {
        playTap();
        router.push("/room");
      },
    },
    {
      id: "online",
      title: "ONLINE",
      subtitle: "RANKED PLAY",
      icon: <Ionicons name="globe" size={28} color={COLORS.purple} />,
      gradientColors: ["#0A0014", "#06000D", "#030007"],
      accentColor: COLORS.purple,
      onPress: () => {
        playTap();
        router.push("/online");
      },
    },
    {
      id: "how",
      title: "HOW TO PLAY",
      subtitle: "RULES & TIPS",
      icon: <MaterialCommunityIcons name="book-open-page-variant" size={28} color={COLORS.gold} />,
      gradientColors: ["#0A0900", "#060600", "#030300"],
      accentColor: COLORS.gold,
      onPress: () => {
        playTap();
        router.push("/how-to-play");
      },
    },
  ];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#020905", "#050F08", "#060F0A"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Ambient glow spots */}
      <View style={[styles.glowSpot, { left: "10%", top: "30%", backgroundColor: COLORS.orange }]} />
      <View style={[styles.glowSpot, { left: "35%", top: "20%", backgroundColor: COLORS.blue }]} />
      <View style={[styles.glowSpot, { left: "60%", top: "35%", backgroundColor: COLORS.purple }]} />
      <View style={[styles.glowSpot, { right: "8%", top: "25%", backgroundColor: COLORS.gold }]} />

      {/* Floating decorative cards */}
      <FloatingCard x={SCREEN_W * 0.03} y={SCREEN_H * 0.15} rotate={-18} delay={200} color={COLORS.orange} />
      <FloatingCard x={SCREEN_W * 0.22} y={SCREEN_H * 0.6} rotate={12} delay={500} color={COLORS.blue} />
      <FloatingCard x={SCREEN_W * 0.52} y={SCREEN_H * 0.12} rotate={-8} delay={100} color={COLORS.purple} />
      <FloatingCard x={SCREEN_W * 0.78} y={SCREEN_H * 0.55} rotate={15} delay={350} color={COLORS.gold} />

      {/* Header */}
      <Animated.View
        entering={FadeIn.duration(800)}
        style={[styles.header, { paddingTop: topInset + 12 }]}
      >
        <View style={styles.headerLeftRow}>
          <Pressable
            style={({ pressed }) => [
              styles.settingsIconBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/settings");
            }}
          >
            <Ionicons name="settings-outline" size={22} color={COLORS.gold} />
          </Pressable>
          <GemBalanceChip />
        </View>
        <View style={styles.headerCenter}>
          <Animated.View style={titleShimmerStyle}>
            <Text style={styles.logoText}>NO-SHOW</Text>
          </Animated.View>
          <Text style={styles.logoSub}>THE CARD GAME</Text>
          <View style={styles.logoDivider} />
        </View>
        <View style={styles.headerRightRow}>
          <Pressable
            style={({ pressed }) => [
              styles.storeIconBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
            ]}
            onPress={() => {
              playTap();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/store");
            }}
          >
            <MaterialCommunityIcons name="shopping-outline" size={22} color={COLORS.gold} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.playerIconBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setPlayerMenuVisible((v) => !v);
            }}
          >
            <PlayerAvatarImage
              avatarIndex={avatarIndex}
              size={38}
              borderColor="rgba(255,215,0,0.55)"
              backgroundColor="rgba(0,0,0,0.4)"
            />
          </Pressable>
        </View>
      </Animated.View>

      {/* Player menu dropdown (home only) */}
      {playerMenuVisible && (
        <View style={styles.playerMenuOverlay} pointerEvents="box-none">
          <PlayerMenu
            visible={playerMenuVisible}
            onClose={() => setPlayerMenuVisible(false)}
            topInset={topInset}
          />
        </View>
      )}

      {/* 4 Panels */}
      <View style={[styles.panelsRow, { paddingBottom: bottomInset + 8 }]}>
        {panels.map((panel, idx) => (
          <Panel key={panel.id} data={panel} index={idx} />
        ))}
      </View>

      {/* Bottom bar */}
      <Animated.View entering={FadeIn.delay(500)} style={[styles.bottomBar, { bottom: bottomInset + 4 }]}>
        <View style={styles.bottomChip}>
          <Ionicons name="people-outline" size={10} color={COLORS.textDim} />
          <Text style={styles.bottomChipText}>3–4 Players</Text>
        </View>
        <View style={styles.bottomDot} />
        <View style={styles.bottomChip}>
          <MaterialCommunityIcons name="cards" size={10} color={COLORS.textDim} />
          <Text style={styles.bottomChipText}>52 Cards</Text>
        </View>
        <View style={styles.bottomDot} />
        <View style={styles.bottomChip}>
          <Ionicons name="trophy-outline" size={10} color={COLORS.textDim} />
          <Text style={styles.bottomChipText}>Last under 100</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bgDeep,
  },
  glowSpot: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.04,
  },
  floatingCard: {
    width: 36,
    height: 50,
    borderRadius: 6,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.03)",
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  floatingCardText: {
    fontSize: 18,
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 2,
    gap: 8,
  },
  headerLeftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  headerCenter: { alignItems: "center", flex: 1, minWidth: 0 },
  gemChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(93,173,226,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(93,173,226,0.4)",
    maxWidth: 120,
  },
  gemChipText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
  },
  settingsIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,215,0,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255,215,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  storeIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,215,0,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255,215,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  playerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,215,0,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255,215,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  playerMenuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  playerMenu: {
    position: "absolute",
    minWidth: 220,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.25)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 16,
  },
  playerMenuGradient: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  playerMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  playerMenuItemPressed: {
    backgroundColor: "rgba(255,215,0,0.08)",
  },
  playerMenuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,215,0,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  playerMenuIconWrapDestructive: {
    backgroundColor: "rgba(229,57,53,0.14)",
  },
  playerMenuIconWrapAccent: {
    backgroundColor: "rgba(255,215,0,0.18)",
  },
  playerMenuItemAccent: {
    backgroundColor: "rgba(255,215,0,0.05)",
  },
  playerMenuDivider: {
    height: 1,
    backgroundColor: "rgba(255,215,0,0.15)",
    marginHorizontal: 14,
    marginVertical: 4,
  },
  playerMenuTextWrap: { flex: 1 },
  playerMenuLabelDestructive: {
    color: COLORS.error,
  },
  playerMenuSubtitleDestructive: {
    color: "rgba(229,57,53,0.75)",
  },
  playerMenuLabel: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  playerMenuSubtitle: {
    color: COLORS.textDim,
    fontSize: 12,
    marginTop: 1,
  },
  logoText: {
    color: COLORS.gold,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: 10,
    textShadowColor: "rgba(255,215,0,0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  logoSub: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 5,
    marginTop: 2,
  },
  logoDivider: {
    width: 40,
    height: 1.5,
    backgroundColor: COLORS.gold,
    opacity: 0.4,
    marginTop: 10,
    borderRadius: 1,
  },
  panelsRow: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 8,
  },
  panelOuter: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  panelPressable: {
    flex: 1,
    position: "relative",
  },
  panelDividerRight: {
    position: "absolute",
    right: 0,
    top: "15%",
    bottom: "15%",
    width: 0.5,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  panelContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 20,
  },
  panelIconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.04)",
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
    position: "relative",
  },
  panelLockBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "center",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  panelSubtitle: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  comingSoonBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  comingSoonText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  panelArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6,
  },
  bottomChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bottomChipText: {
    color: COLORS.textDim,
    fontSize: 9,
    fontWeight: "500",
  },
  bottomDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.textDim,
  },
});
