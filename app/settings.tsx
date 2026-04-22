import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Switch,
  Linking,
  Alert,
  ScrollView,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";
import { useSettings } from "@/context/SettingsContext";
import { playTap } from "@/lib/sound";

// ─── Toggle row ───────────────────────────────────────────────────────────────

interface ToggleRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
  accentColor?: string;
}

function ToggleRow({ icon, label, subtitle, value, onChange, accentColor = COLORS.gold }: ToggleRowProps) {
  return (
    <View style={row.wrap}>
      <View style={[row.iconWrap, { backgroundColor: accentColor + "20" }]}>
        <Ionicons name={icon} size={19} color={accentColor} />
      </View>
      <View style={row.text}>
        <Text style={row.label}>{label}</Text>
        <Text style={row.sub}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "rgba(255,255,255,0.1)", true: accentColor + "55" }}
        thumbColor={value ? accentColor : "#555"}
        ios_backgroundColor="rgba(255,255,255,0.1)"
      />
    </View>
  );
}

// ─── Tappable row ─────────────────────────────────────────────────────────────

interface TapRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  onPress: () => void;
  accentColor?: string;
  destructive?: boolean;
  rightNode?: React.ReactNode;
}

function TapRow({ icon, label, subtitle, onPress, accentColor = COLORS.gold, destructive, rightNode }: TapRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [row.wrap, pressed && row.pressed, destructive && row.destructiveWrap]}
      onPress={onPress}
    >
      <View style={[row.iconWrap, destructive ? row.iconDestructive : { backgroundColor: accentColor + "20" }]}>
        <Ionicons name={icon} size={19} color={destructive ? COLORS.error : accentColor} />
      </View>
      <View style={row.text}>
        <Text style={[row.label, destructive && { color: COLORS.error }]}>{label}</Text>
        <Text style={row.sub}>{subtitle}</Text>
      </View>
      {rightNode ?? <Ionicons name="chevron-forward" size={16} color={destructive ? "rgba(229,57,53,0.5)" : COLORS.textDim} />}
    </Pressable>
  );
}

const row = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 14,
  },
  pressed: { backgroundColor: "rgba(255,215,0,0.05)" },
  destructiveWrap: {},
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  iconDestructive: {
    backgroundColor: "rgba(229,57,53,0.15)",
  },
  text: { flex: 1 },
  label: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  sub: {
    color: COLORS.textDim,
    fontSize: 11,
    marginTop: 2,
  },
});

// ─── Group card ───────────────────────────────────────────────────────────────

function Group({
  title,
  children,
  delay = 0,
}: {
  title?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(22)}>
      {title && <Text style={g.groupLabel}>{title}</Text>}
      <View style={g.card}>
        <LinearGradient
          colors={["rgba(255,215,0,0.05)", "rgba(0,0,0,0)"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        {children}
      </View>
    </Animated.View>
  );
}

const g = StyleSheet.create({
  groupLabel: {
    color: "rgba(255,215,0,0.55)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.12)",
    overflow: "hidden",
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginLeft: 70,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const {
    soundEnabled,
    hapticsEnabled,
    notificationsEnabled,
    setSoundEnabled,
    setHapticsEnabled,
    setNotificationsEnabled,
  } = useSettings();

  const handleSoundToggle = async (value: boolean) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setSoundEnabled(value);
    if (value) playTap();
  };

  const handleHapticsToggle = async (value: boolean) => {
    if (value) await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setHapticsEnabled(value);
  };

  const handleNotificationsToggle = async (value: boolean) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setNotificationsEnabled(value);
  };

  const handleRateUs = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const StoreReview = await import("expo-store-review");
      if (await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview();
      } else {
        const storeUrl =
          Platform.OS === "ios"
            ? "https://apps.apple.com/app/idXXXXXXXXX"
            : Platform.OS === "android"
            ? "https://play.google.com/store/apps/details?id=com.anandraj.noshowcardgame"
            : null;
        if (storeUrl) {
          const canOpen = await Linking.canOpenURL(storeUrl);
          if (canOpen) await Linking.openURL(storeUrl);
          else Alert.alert("Rate Us", "Thank you for playing No-Show!");
        } else {
          Alert.alert("Rate Us", "Thank you for playing No-Show!");
        }
      }
    } catch {
      Alert.alert("Rate Us", "Thank you for playing No-Show!");
    }
  };

  return (
    <View style={s.container}>
      {/* Background */}
      <LinearGradient
        colors={["#020805", "#041008", "#06180E"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.glow, { left: "5%",  top: "12%", backgroundColor: COLORS.gold }]} />
      <View style={[s.glow, { right: "6%", top: "55%", backgroundColor: COLORS.cyan }]} />

      {/* Header */}
      <Animated.View entering={FadeIn.duration(380)} style={[s.header, { paddingTop: topInset + 8 }]}>
        <Pressable
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.gold} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>SETTINGS</Text>
          <View style={s.headerUnderline} />
        </View>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: bottomInset + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Audio & Haptics ── */}
        <Group title="Audio & Haptics" delay={60}>
          <ToggleRow
            icon="volume-high"
            label="Sound Effects"
            subtitle="Card flips, dealing, game actions"
            value={soundEnabled}
            onChange={handleSoundToggle}
          />
          <View style={g.separator} />
          <ToggleRow
            icon="phone-portrait-outline"
            label="Haptic Feedback"
            subtitle="Vibrations on taps and game events"
            value={hapticsEnabled}
            onChange={handleHapticsToggle}
            accentColor={COLORS.cyan}
          />
          <View style={g.separator} />
          <ToggleRow
            icon="notifications-outline"
            label="Notifications"
            subtitle="Game reminders & updates"
            value={notificationsEnabled}
            onChange={handleNotificationsToggle}
            accentColor={COLORS.cyan}
          />
        </Group>

        {/* ── Appearance ── */}
        <Group title="Appearance" delay={140}>
          <TapRow
            icon="color-palette-outline"
            label="Profile & Customisation"
            subtitle="Avatar, table theme, card back"
            onPress={() => { playTap(); router.push("/profile"); }}
          />
          <View style={g.separator} />
          <TapRow
            icon="storefront-outline"
            label="Store"
            subtitle="Gems, card backs, table themes"
            onPress={() => { playTap(); router.push("/store"); }}
            accentColor={COLORS.purple}
          />
        </Group>

        {/* ── Gameplay ── */}
        <Group title="Gameplay" delay={200}>
          <TapRow
            icon="book-outline"
            label="How to Play"
            subtitle="Rules, scoring, and tips"
            onPress={() => { playTap(); router.push("/how-to-play"); }}
            accentColor={COLORS.primary}
          />
          <View style={g.separator} />
          <TapRow
            icon="trophy-outline"
            label="Leaderboard"
            subtitle="Global online rankings"
            onPress={() => { playTap(); router.push("/leaderboard"); }}
            accentColor={COLORS.orange}
          />
        </Group>

        {/* ── About ── */}
        <Group title="About" delay={260}>
          <TapRow
            icon={Platform.OS === "ios" ? "logo-apple-appstore" : "logo-google-playstore"}
            label="Rate No-Show"
            subtitle="Enjoying the game? Leave a review!"
            onPress={handleRateUs}
            accentColor={COLORS.gold}
          />
          <View style={g.separator} />
          <TapRow
            icon="mail-outline"
            label="Send Feedback"
            subtitle="Bug reports & suggestions"
            onPress={async () => {
              const url = "mailto:support@noshowgame.com?subject=Feedback";
              if (await Linking.canOpenURL(url)) await Linking.openURL(url);
            }}
            accentColor={COLORS.blue}
          />
        </Group>

        {/* ── App info chip ── */}
        <Animated.View entering={FadeInDown.delay(320).springify()} style={s.infoChip}>
          <MaterialCommunityIcons name="cards-playing" size={16} color="rgba(255,215,0,0.4)" />
          <Text style={s.infoTxt}>No-Show Card Game</Text>
          <Text style={s.infoVersion}>v1.0.0</Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  glow: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.045,
  },

  // ── Header
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
    backgroundColor: "rgba(255,215,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: { alignItems: "center", gap: 4 },
  headerTitle: {
    color: COLORS.gold,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 3,
  },
  headerUnderline: {
    width: 32,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,215,0,0.5)",
  },

  scroll: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 20,
  },

  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  infoTxt: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 12,
    fontWeight: "700",
  },
  infoVersion: {
    color: "rgba(255,215,0,0.3)",
    fontSize: 11,
    fontWeight: "700",
  },
});
