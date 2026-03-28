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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";
import { useSettings } from "@/context/SettingsContext";
import { playTap } from "@/lib/sound";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const { soundEnabled, notificationsEnabled, setSoundEnabled, setNotificationsEnabled } = useSettings();

  const handleSoundToggle = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setSoundEnabled(value);
    if (value) playTap();
  };

  const handleNotificationsToggle = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setNotificationsEnabled(value);
  };

  const handleRateUs = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const StoreReview = await import("expo-store-review");
      if (await StoreReview.isAvailableAsync()) {
        await StoreReview.requestReview();
      } else {
        const storeUrl =
          Platform.OS === "ios"
            ? "https://apps.apple.com/app/idXXXXXXXXX"
            : Platform.OS === "android"
              ? "https://play.google.com/store/apps/details?id=com.yourapp"
              : null;
        if (storeUrl) {
          const canOpen = await Linking.canOpenURL(storeUrl);
          if (canOpen) await Linking.openURL(storeUrl);
        }
        Alert.alert("Rate Us", "Thank you for playing No-Show! Your feedback helps us improve.");
      }
    } catch {
      Alert.alert("Rate Us", "Thank you for playing No-Show! Your feedback helps us improve.");
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#051810", "#0A2416", "#133D24"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.gold} />
        </Pressable>
        <Text style={styles.headerTitle}>SETTINGS</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Sound */}
        <View style={styles.settingRow}>
          <View style={styles.settingIconWrap}>
            <Ionicons name="volume-high" size={22} color={COLORS.gold} />
          </View>
          <View style={styles.settingTextWrap}>
            <Text style={styles.settingLabel}>Sound</Text>
            <Text style={styles.settingSubtitle}>Game sound effects</Text>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={handleSoundToggle}
            trackColor={{ false: "#333", true: "rgba(255,215,0,0.4)" }}
            thumbColor={soundEnabled ? COLORS.gold : "#888"}
          />
        </View>

        {/* Notifications */}
        <View style={styles.settingRow}>
          <View style={styles.settingIconWrap}>
            <Ionicons name="notifications" size={22} color={COLORS.gold} />
          </View>
          <View style={styles.settingTextWrap}>
            <Text style={styles.settingLabel}>Notifications</Text>
            <Text style={styles.settingSubtitle}>Game reminders & updates</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationsToggle}
            trackColor={{ false: "#333", true: "rgba(255,215,0,0.4)" }}
            thumbColor={notificationsEnabled ? COLORS.gold : "#888"}
          />
        </View>

        {/* Rate Us */}
        <Pressable
          style={({ pressed }) => [styles.settingRow, styles.rateRow, pressed && styles.settingRowPressed]}
          onPress={handleRateUs}
        >
          <View style={styles.settingIconWrap}>
            <MaterialCommunityIcons name="star" size={22} color={COLORS.gold} />
          </View>
          <View style={styles.settingTextWrap}>
            <Text style={styles.settingLabel}>Rate Us</Text>
            <Text style={styles.settingSubtitle}>Enjoying the game? Leave a review</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textDim} />
        </Pressable>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,215,0,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
  },
  headerTitle: {
    color: COLORS.gold,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.12)",
  },
  settingRowPressed: {
    backgroundColor: "rgba(255,215,0,0.06)",
  },
  rateRow: {
    marginBottom: 0,
  },
  settingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,215,0,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  settingTextWrap: { flex: 1 },
  settingLabel: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  settingSubtitle: {
    color: COLORS.textDim,
    fontSize: 13,
    marginTop: 2,
  },
});
