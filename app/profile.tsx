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
  Alert,
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
import {
  TABLE_THEME_GEM_PRICE,
  CARD_BACK_GEM_PRICE,
  CARD_BACK_PRODUCTS,
  getCardBackImageSource,
  type CardBackId,
  type PurchasableCardBackId,
} from "@/constants/storeCatalog";

const CARD_W_PER_H = 2.5 / 3.5;
const PROFILE_CARD_THUMB_W = 76;

const GAME_TABLE_GREEN = require("@/assets/images/game-table-background.png");
const GAME_TABLE_BLUE = require("@/assets/images/game-table-blue.png");
const GAME_TABLE_RED = require("@/assets/images/game-table-red.png");
const GAME_TABLE_YELLOW = require("@/assets/images/game-table-yellow.png");

const TABLE_OPTIONS: { theme: TableTheme; label: string; image: any }[] = [
  { theme: "green", label: "Green", image: GAME_TABLE_GREEN },
  { theme: "blue", label: "Blue", image: GAME_TABLE_BLUE },
  { theme: "red", label: "Red", image: GAME_TABLE_RED },
  { theme: "yellow", label: "Gold", image: GAME_TABLE_YELLOW },
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
    ownedTablePremium,
    ownedCardBacks,
    cardBackId: savedCardBackId,
    setCardBackId,
    isLoading: settingsLoading,
  } = useSettings();

  const isTableUnlocked = useCallback(
    (theme: TableTheme) =>
      theme === "green" || ownedTablePremium.includes(theme as PremiumTableThemeId),
    [ownedTablePremium]
  );

  const isCardBackUnlocked = useCallback(
    (id: CardBackId) =>
      id === "default" || ownedCardBacks.includes(id as PurchasableCardBackId),
    [ownedCardBacks]
  );

  const [nameDraft, setNameDraft] = useState("");
  const [pickedAvatar, setPickedAvatar] = useState(0);
  const [tableDraft, setTableDraft] = useState<TableTheme>("green");
  const [cardBackDraft, setCardBackDraft] = useState<CardBackId>("default");
  const [savedHint, setSavedHint] = useState(false);

  useEffect(() => {
    if (settingsLoading) return;
    setNameDraft(savedDisplayName);
    setPickedAvatar(savedAvatarIndex);
    setTableDraft(savedTableTheme);
    setCardBackDraft(savedCardBackId);
  }, [settingsLoading, savedDisplayName, savedAvatarIndex, savedTableTheme, savedCardBackId]);

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
    await setCardBackId(cardBackDraft);
    setSavedHint(true);
    setTimeout(() => setSavedHint(false), 2000);
  }, [
    nameDraft,
    pickedAvatar,
    tableDraft,
    cardBackDraft,
    setDisplayName,
    setAvatarIndex,
    setTableTheme,
    setCardBackId,
  ]);

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
          nestedScrollEnabled
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
          <Text style={styles.sectionHint}>
            Choose the casino table for VS and online games. Green is free; unlock blue, red, or gold lounge in the
            Store ({TABLE_THEME_GEM_PRICE.toLocaleString()} gems each), then pick your table here.
          </Text>

          <View style={styles.tablePickerRow}>
            {TABLE_OPTIONS.map((opt) => {
              const selected = tableDraft === opt.theme;
              const unlocked = isTableUnlocked(opt.theme);
              return (
                <Pressable
                  key={opt.theme}
                  style={({ pressed }) => [
                    styles.tableCell,
                    selected && styles.tableCellSelected,
                    pressed && styles.tableCellPressed,
                    !unlocked && styles.tableCellLocked,
                  ]}
                  onPress={() => {
                    if (!unlocked) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                      Alert.alert(
                        "Locked table",
                        `Unlock the ${opt.label} table in the Store for ${TABLE_THEME_GEM_PRICE.toLocaleString()} gems.`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Open Store",
                            onPress: () =>
                              router.push({ pathname: "/store", params: { tab: "table" } }),
                          },
                        ]
                      );
                      return;
                    }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTableDraft(opt.theme);
                  }}
                >
                  <ExpoImage
                    source={opt.image}
                    style={[styles.tableCellImage, !unlocked && styles.tableCellImageDim]}
                    contentFit="cover"
                    transition={0}
                  />
                  {!unlocked ? (
                    <View style={styles.tableLockBadge}>
                      <Ionicons name="lock-closed" size={14} color={COLORS.gold} />
                    </View>
                  ) : null}
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

          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>CARD BACK</Text>
          <Text style={styles.sectionHint}>
            Deck art in VS and online games. Classic is free; buy premium backs in the Store (
            {CARD_BACK_GEM_PRICE.toLocaleString()} gems each), then equip the one you want here.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={styles.cardBackRow}
          >
            <Pressable
              style={({ pressed }) => [
                styles.cardBackTile,
                cardBackDraft === "default" && styles.cardBackTileSelected,
                pressed && styles.cardBackTilePressed,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setCardBackDraft("default");
              }}
            >
              <View
                style={[
                  styles.cardBackImgClip,
                  {
                    width: PROFILE_CARD_THUMB_W,
                    aspectRatio: CARD_W_PER_H,
                  },
                ]}
              >
                <ExpoImage
                  source={getCardBackImageSource("default")}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="contain"
                  transition={0}
                />
              </View>
              {cardBackDraft === "default" ? (
                <View style={styles.cardBackCheck}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.gold} />
                </View>
              ) : null}
              <Text style={styles.cardBackTileLabel} numberOfLines={2}>
                Classic
              </Text>
            </Pressable>

            {CARD_BACK_PRODUCTS.map((p) => {
              const unlocked = isCardBackUnlocked(p.id);
              const selected = cardBackDraft === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={({ pressed }) => [
                    styles.cardBackTile,
                    selected && styles.cardBackTileSelected,
                    pressed && styles.cardBackTilePressed,
                    !unlocked && styles.cardBackTileLocked,
                  ]}
                  onPress={() => {
                    if (!unlocked) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                      Alert.alert(
                        "Locked card back",
                        `Unlock ${p.title} in the Store for ${CARD_BACK_GEM_PRICE.toLocaleString()} gems.`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Open Store",
                            onPress: () =>
                              router.push({ pathname: "/store", params: { tab: "cards" } }),
                          },
                        ]
                      );
                      return;
                    }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCardBackDraft(p.id);
                  }}
                >
                  <View
                    style={[
                      styles.cardBackImgClip,
                      {
                        width: PROFILE_CARD_THUMB_W,
                        aspectRatio: CARD_W_PER_H,
                      },
                    ]}
                  >
                    <ExpoImage
                      source={p.image}
                      style={[StyleSheet.absoluteFillObject, !unlocked && styles.cardBackImgDim]}
                      contentFit="contain"
                      transition={0}
                    />
                  </View>
                  {!unlocked ? (
                    <View style={styles.cardBackLockBadge}>
                      <Ionicons name="lock-closed" size={12} color={COLORS.gold} />
                    </View>
                  ) : null}
                  {selected ? (
                    <View style={styles.cardBackCheck}>
                      <Ionicons name="checkmark-circle" size={16} color={COLORS.gold} />
                    </View>
                  ) : null}
                  <Text style={styles.cardBackTileLabel} numberOfLines={2}>
                    {p.title}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

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
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
    marginTop: 12,
  },
  tableCell: {
    flex: 1,
    minWidth: 72,
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
  tableCellLocked: {
    opacity: 0.92,
  },
  tableCellImage: {
    width: "100%",
    height: 84,
  },
  tableCellImageDim: {
    opacity: 0.45,
  },
  tableLockBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 12,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
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
  cardBackRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 4,
    paddingRight: 4,
    marginTop: 12,
  },
  cardBackTile: {
    width: PROFILE_CARD_THUMB_W + 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
    alignItems: "center",
    position: "relative",
  },
  cardBackTileSelected: {
    borderColor: "rgba(255,215,0,0.7)",
    backgroundColor: "rgba(255,215,0,0.08)",
  },
  cardBackTilePressed: {
    opacity: 0.9,
  },
  cardBackTileLocked: {
    opacity: 0.95,
  },
  cardBackImgClip: {
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cardBackImgDim: {
    opacity: 0.42,
  },
  cardBackLockBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 10,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
  },
  cardBackCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
  },
  cardBackTileLabel: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 6,
    minHeight: 28,
    width: "100%",
  },
});
