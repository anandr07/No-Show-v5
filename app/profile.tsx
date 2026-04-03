import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useSettings, type TableTheme } from "@/context/SettingsContext";
import { PlayerAvatarImage } from "@/components/PlayerAvatarImage";
import { PLAYER_AVATAR_COUNT } from "@/constants/player-avatar";
import { resolvePlayerDisplayName, sanitizeDisplayName } from "@/lib/player-display";
import { Image as ExpoImage } from "expo-image";

const GAME_TABLE_GREEN = require("@/assets/images/game-table-background.png");
const GAME_TABLE_BLUE = require("@/assets/images/game-table-blue.png");
const GAME_TABLE_RED = require("@/assets/images/game-table-red.png");

const TABLE_OPTIONS: { theme: TableTheme; label: string; image: any }[] = [
  { theme: "green", label: "Green", image: GAME_TABLE_GREEN },
  { theme: "blue", label: "Blue", image: GAME_TABLE_BLUE },
  { theme: "red", label: "Red", image: GAME_TABLE_RED },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const { user } = useAuth();
  const {
    displayName: savedDisplayName,
    avatarIndex: savedAvatarIndex,
    tableTheme: savedTableTheme,
    setDisplayName,
    setAvatarIndex,
    setTableTheme,
    isLoading: settingsLoading,
  } = useSettings();

  const [nameDraft, setNameDraft] = useState("");
  const [pickedAvatar, setPickedAvatar] = useState(0);
  const [tableDraft, setTableDraft] = useState<TableTheme>("green");
  const [savedHint, setSavedHint] = useState(false);

  useEffect(() => {
    if (settingsLoading) return;
    setNameDraft(savedDisplayName);
    setPickedAvatar(savedAvatarIndex);
    setTableDraft(savedTableTheme);
  }, [settingsLoading, savedDisplayName, savedAvatarIndex, savedTableTheme]);

  const resolvedPreview = resolvePlayerDisplayName({
    localName: nameDraft,
    authDisplayName: user?.user_metadata?.display_name,
    email: user?.email,
    fallback: "Player",
  });

  const saveProfile = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await setDisplayName(nameDraft);
    await setAvatarIndex(pickedAvatar);
    await setTableTheme(tableDraft);
    setSavedHint(true);
    setTimeout(() => setSavedHint(false), 2000);
  }, [nameDraft, pickedAvatar, tableDraft, setDisplayName, setAvatarIndex, setTableTheme]);

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
        <Text style={styles.headerTitle}>PROFILE</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomInset + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLabel}>AVATAR</Text>
          <Text style={styles.sectionHint}>
            Shown next to your name during VS games and online matches.
          </Text>

          <View style={styles.heroAvatarWrap}>
            <PlayerAvatarImage
              avatarIndex={pickedAvatar}
              size={112}
              borderColor={COLORS.border}
              backgroundColor="rgba(0,0,0,0.4)"
            />
          </View>

          <View style={styles.avatarGrid}>
            {Array.from({ length: PLAYER_AVATAR_COUNT }, (_, i) => {
              const selected = pickedAvatar === i;
              return (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.avatarCell,
                    selected && styles.avatarCellSelected,
                    pressed && styles.avatarCellPressed,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPickedAvatar(i);
                  }}
                >
                  <PlayerAvatarImage
                    avatarIndex={i}
                    size={56}
                    borderColor={
                      selected ? COLORS.gold : "rgba(255,255,255,0.15)"
                    }
                  />
                  {selected ? (
                    <View style={styles.avatarCheck}>
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.gold} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>USERNAME</Text>
          <Text style={styles.sectionHint}>
            Used in menus, VS setup, and as your default name when joining games.
          </Text>

          <TextInput
            style={styles.nameInput}
            value={nameDraft}
            onChangeText={(t) => setNameDraft(sanitizeDisplayName(t))}
            placeholder="Enter display name"
            placeholderTextColor={COLORS.textDim}
            maxLength={24}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <Text style={styles.previewLabel}>Preview</Text>
          <Text style={styles.previewName}>{resolvedPreview}</Text>

          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>TABLE THEME</Text>
          <Text style={styles.sectionHint}>Choose the casino table you want to play on.</Text>

          <View style={styles.tablePickerRow}>
            {TABLE_OPTIONS.map((opt) => {
              const selected = tableDraft === opt.theme;
              return (
                <Pressable
                  key={opt.theme}
                  style={({ pressed }) => [
                    styles.tableCell,
                    selected && styles.tableCellSelected,
                    pressed && styles.tableCellPressed,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTableDraft(opt.theme);
                  }}
                >
                  <ExpoImage
                    source={opt.image}
                    style={styles.tableCellImage}
                    contentFit="cover"
                    transition={0}
                  />
                  {selected ? (
                    <View style={styles.tableCheck}>
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.gold} />
                    </View>
                  ) : null}
                  <Text style={styles.tableCellLabel}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {user?.email ? (
            <Text style={styles.accountEmail}>Account: {user.email}</Text>
          ) : (
            <Text style={styles.accountEmail}>Playing as guest — sign in from home to link an account.</Text>
          )}

          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
            onPress={saveProfile}
          >
            <LinearGradient
              colors={[COLORS.gold, COLORS.goldDark]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Text style={styles.saveBtnText}>Save profile</Text>
          </Pressable>

          {savedHint ? (
            <Text style={styles.savedText}>Saved</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  sectionLabel: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  sectionHint: {
    color: COLORS.textDim,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  heroAvatarWrap: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 8,
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    marginTop: 12,
  },
  avatarCell: {
    borderRadius: 12,
    padding: 4,
    position: "relative",
  },
  avatarCellSelected: {
    backgroundColor: "rgba(255,215,0,0.12)",
  },
  avatarCellPressed: {
    opacity: 0.85,
  },
  avatarCheck: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 12,
  },
  nameInput: {
    marginTop: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
  },
  previewLabel: {
    color: COLORS.textDim,
    fontSize: 11,
    marginTop: 14,
    fontWeight: "600",
  },
  previewName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
  },
  accountEmail: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 16,
    lineHeight: 18,
  },
  saveBtn: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
  },
  saveBtnPressed: { opacity: 0.92 },
  saveBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  savedText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 12,
  },
  tablePickerRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginTop: 12,
  },
  tableCell: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.25)",
    padding: 0,
    alignItems: "center",
  },
  tableCellPressed: {
    opacity: 0.9,
  },
  tableCellSelected: {
    borderColor: "rgba(255,215,0,0.7)",
    backgroundColor: "rgba(255,215,0,0.08)",
  },
  tableCellImage: {
    width: "100%",
    height: 84,
  },
  tableCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
  },
  tableCellLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
    marginBottom: 10,
  },
});
