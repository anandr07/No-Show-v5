import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeInDown,
  FadeIn,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W_PER_H = 2.5 / 3.5;
const CARD_THUMB_W = 72;

const GAME_TABLE_GREEN = require("@/assets/images/game-table-background.png");
const GAME_TABLE_BLUE = require("@/assets/images/game-table-blue.png");
const GAME_TABLE_RED = require("@/assets/images/game-table-red.png");
const GAME_TABLE_YELLOW = require("@/assets/images/game-table-yellow.png");

const TABLE_OPTIONS: { theme: TableTheme; label: string; image: any; accent: string }[] = [
  { theme: "green",  label: "Classic",    image: GAME_TABLE_GREEN,  accent: "#2ECC71" },
  { theme: "blue",   label: "Ocean",      image: GAME_TABLE_BLUE,   accent: "#2980B9" },
  { theme: "red",    label: "Crimson",    image: GAME_TABLE_RED,    accent: "#E53935" },
  { theme: "yellow", label: "Gold Lounge",image: GAME_TABLE_YELLOW, accent: "#FFD700" },
];

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon,
  children,
  delay = 0,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(22)} style={s.sectionCard}>
      <LinearGradient
        colors={["rgba(255,215,0,0.06)", "rgba(0,0,0,0)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={s.sectionHeader}>
        <View style={s.sectionIconWrap}>
          <Ionicons name={icon} size={16} color={COLORS.gold} />
        </View>
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
    </Animated.View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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
      theme === "green" || ownedTablePremium.includes(theme as PurchasableCardBackId),
    [ownedTablePremium]
  );
  const isCardBackUnlocked = useCallback(
    (id: CardBackId) => id === "default" || ownedCardBacks.includes(id as PurchasableCardBackId),
    [ownedCardBacks]
  );

  const [nameDraft, setNameDraft]       = useState("");
  const [pickedAvatar, setPickedAvatar] = useState(0);
  const [tableDraft, setTableDraft]     = useState<TableTheme>("green");
  const [cardBackDraft, setCardBackDraft] = useState<CardBackId>("default");
  const [savedHint, setSavedHint]       = useState(false);
  const [nameFieldFocused, setNameFieldFocused] = useState(false);

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
  }, [nameDraft, pickedAvatar, tableDraft, cardBackDraft, setDisplayName, setAvatarIndex, setTableTheme, setCardBackId]);

  // Border animation for name field
  const borderAnim = useSharedValue(0);
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255,215,0,${0.15 + borderAnim.value * 0.65})`,
    shadowOpacity: borderAnim.value * 0.3,
  }));

  return (
    <View style={s.container}>
      {/* Deep layered background */}
      <LinearGradient
        colors={["#020805", "#041008", "#06180E"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.glow, { left: "5%",  top: "8%",  backgroundColor: COLORS.gold }]} />
      <View style={[s.glow, { right: "8%", top: "45%", backgroundColor: COLORS.primary }]} />

      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={[s.header, { paddingTop: topInset + 8 }]}>
        <Pressable
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.gold} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>PROFILE</Text>
          <View style={s.headerUnderline} />
        </View>
        <View style={{ width: 40 }} />
      </Animated.View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: bottomInset + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {/* ── Hero ── */}
          <Animated.View entering={FadeInDown.delay(60).springify().damping(20)} style={s.heroCard}>
            <LinearGradient
              colors={["rgba(255,215,0,0.12)", "rgba(255,215,0,0.04)", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.5, y: 0 }}
            />
            <View style={s.heroAvatarRing}>
              <PlayerAvatarImage
                avatarIndex={pickedAvatar}
                size={96}
                borderColor="rgba(255,215,0,0.6)"
                backgroundColor="rgba(0,0,0,0.5)"
              />
              <View style={s.heroAvatarBadge}>
                <Ionicons name="pencil" size={11} color="#000" />
              </View>
            </View>
            <Text style={s.heroName}>{resolvedPreview}</Text>
            {user?.email ? (
              <View style={s.heroBadge}>
                <Ionicons name="shield-checkmark" size={12} color={COLORS.primary} />
                <Text style={s.heroBadgeTxt}>{user.email}</Text>
              </View>
            ) : (
              <View style={s.heroBadgeGuest}>
                <Ionicons name="person-outline" size={12} color={COLORS.textMuted} />
                <Text style={s.heroBadgeGuestTxt}>Guest — sign in to save progress</Text>
              </View>
            )}
          </Animated.View>

          {/* ── Avatar picker ── */}
          <SectionCard title="Choose Avatar" icon="images-outline" delay={100}>
            <View style={s.avatarGrid}>
              {Array.from({ length: PLAYER_AVATAR_COUNT }, (_, i) => {
                const selected = pickedAvatar === i;
                return (
                  <Pressable
                    key={i}
                    style={({ pressed }) => [
                      s.avatarCell,
                      selected && s.avatarCellSelected,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPickedAvatar(i);
                    }}
                  >
                    <PlayerAvatarImage
                      avatarIndex={i}
                      size={52}
                      borderColor={selected ? COLORS.gold : "rgba(255,255,255,0.12)"}
                    />
                    {selected && (
                      <View style={s.avatarCheck}>
                        <Ionicons name="checkmark" size={10} color="#000" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>

          {/* ── Username ── */}
          <SectionCard title="Display Name" icon="create-outline" delay={160}>
            <Animated.View style={[s.nameInputWrap, borderStyle]}>
              <Ionicons
                name="person-outline"
                size={16}
                color={nameFieldFocused ? COLORS.gold : "rgba(255,255,255,0.3)"}
                style={{ marginRight: 10 }}
              />
              <TextInput
                style={s.nameInput}
                value={nameDraft}
                onChangeText={(t) => setNameDraft(sanitizeDisplayName(t))}
                placeholder="Enter display name"
                placeholderTextColor="rgba(255,255,255,0.22)"
                maxLength={24}
                autoCapitalize="words"
                autoCorrect={false}
                selectionColor={COLORS.gold}
                onFocus={() => { setNameFieldFocused(true); borderAnim.value = withTiming(1, { duration: 200 }); }}
                onBlur={() => { setNameFieldFocused(false); borderAnim.value = withTiming(0, { duration: 200 }); }}
              />
              <Text style={s.nameCount}>{nameDraft.length}/24</Text>
            </Animated.View>
            <View style={s.previewRow}>
              <Text style={s.previewLabel}>Preview</Text>
              <Text style={s.previewName}>{resolvedPreview}</Text>
            </View>
          </SectionCard>

          {/* ── Table theme ── */}
          <SectionCard title="Table Theme" icon="color-palette-outline" delay={220}>
            <Text style={s.cardHint}>
              Green is free · Blue, Crimson & Gold unlock in Store ({TABLE_THEME_GEM_PRICE.toLocaleString()} gems each)
            </Text>
            <View style={s.tableGrid}>
              {TABLE_OPTIONS.map((opt) => {
                const selected = tableDraft === opt.theme;
                const unlocked = isTableUnlocked(opt.theme);
                return (
                  <Pressable
                    key={opt.theme}
                    style={({ pressed }) => [
                      s.tableCell,
                      selected && { borderColor: opt.accent, borderWidth: 2 },
                      !unlocked && s.tableLocked,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => {
                      if (!unlocked) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                        Alert.alert(
                          "Locked",
                          `Unlock the ${opt.label} table in the Store for ${TABLE_THEME_GEM_PRICE.toLocaleString()} gems.`,
                          [
                            { text: "Cancel", style: "cancel" },
                            { text: "Open Store", onPress: () => router.push({ pathname: "/store", params: { tab: "table" } }) },
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
                      style={[s.tableImg, !unlocked && { opacity: 0.38 }]}
                      contentFit="cover"
                      transition={0}
                    />
                    {/* tint overlay on selected */}
                    {selected && (
                      <View style={[s.tableSelectedOverlay, { backgroundColor: opt.accent + "22" }]} />
                    )}
                    {!unlocked ? (
                      <View style={s.tableLockBadge}>
                        <Ionicons name="lock-closed" size={12} color={COLORS.gold} />
                      </View>
                    ) : selected ? (
                      <View style={[s.tableLockBadge, { backgroundColor: opt.accent + "DD" }]}>
                        <Ionicons name="checkmark" size={12} color="#000" />
                      </View>
                    ) : null}
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.72)"]}
                      style={s.tableLabelGradient}
                    >
                      <Text style={[s.tableCellLabel, selected && { color: opt.accent }]}>
                        {opt.label}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>

          {/* ── Card back ── */}
          <SectionCard title="Card Back" icon="layers-outline" delay={280}>
            <Text style={s.cardHint}>
              Classic is free · Premium backs unlock in Store ({CARD_BACK_GEM_PRICE.toLocaleString()} gems each)
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={s.cardBackRow}
            >
              {/* Default */}
              <Pressable
                style={({ pressed }) => [
                  s.cardBackTile,
                  cardBackDraft === "default" && s.cardBackTileSelected,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCardBackDraft("default"); }}
              >
                <View style={s.cardBackImgWrap}>
                  <ExpoImage
                    source={getCardBackImageSource("default")}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: 6 }]}
                    contentFit="contain"
                    transition={0}
                  />
                </View>
                {cardBackDraft === "default" && (
                  <View style={s.cardBackCheck}><Ionicons name="checkmark" size={11} color="#000" /></View>
                )}
                <Text style={s.cardBackLabel} numberOfLines={1}>Classic</Text>
              </Pressable>

              {CARD_BACK_PRODUCTS.map((p) => {
                const unlocked = isCardBackUnlocked(p.id);
                const selected = cardBackDraft === p.id;
                return (
                  <Pressable
                    key={p.id}
                    style={({ pressed }) => [
                      s.cardBackTile,
                      selected && s.cardBackTileSelected,
                      !unlocked && s.cardBackTileLocked,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => {
                      if (!unlocked) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                        Alert.alert(
                          "Locked",
                          `Unlock ${p.title} in the Store for ${CARD_BACK_GEM_PRICE.toLocaleString()} gems.`,
                          [
                            { text: "Cancel", style: "cancel" },
                            { text: "Open Store", onPress: () => router.push({ pathname: "/store", params: { tab: "cards" } }) },
                          ]
                        );
                        return;
                      }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCardBackDraft(p.id);
                    }}
                  >
                    <View style={s.cardBackImgWrap}>
                      <ExpoImage
                        source={p.image}
                        style={[StyleSheet.absoluteFillObject, { borderRadius: 6, opacity: unlocked ? 1 : 0.35 }]}
                        contentFit="contain"
                        transition={0}
                      />
                    </View>
                    {!unlocked ? (
                      <View style={s.cardBackLock}><Ionicons name="lock-closed" size={11} color={COLORS.gold} /></View>
                    ) : selected ? (
                      <View style={s.cardBackCheck}><Ionicons name="checkmark" size={11} color="#000" /></View>
                    ) : null}
                    <Text style={s.cardBackLabel} numberOfLines={1}>{p.title}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </SectionCard>

          {/* ── Save button ── */}
          <Animated.View entering={FadeInDown.delay(340).springify()}>
            <Pressable
              style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.88 }]}
              onPress={saveProfile}
            >
              <LinearGradient
                colors={[COLORS.gold, "#E6AC00"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <Ionicons name="checkmark-circle-outline" size={20} color="#000" style={{ marginRight: 8 }} />
              <Text style={s.saveBtnTxt}>Save Changes</Text>
            </Pressable>

            {savedHint && (
              <Animated.View entering={FadeIn} style={s.savedPill}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
                <Text style={s.savedTxt}>Profile saved!</Text>
              </Animated.View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  glow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.04,
  },

  // ── Header
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
    paddingTop: 8,
    gap: 14,
  },

  // ── Hero card
  heroCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255,215,0,0.2)",
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 10,
    overflow: "hidden",
  },
  heroAvatarRing: {
    position: "relative",
  },
  heroAvatarBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.gold,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#020805",
  },
  heroName: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(46,204,113,0.12)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(46,204,113,0.3)",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  heroBadgeTxt: { color: COLORS.primary, fontSize: 11, fontWeight: "700" },
  heroBadgeGuest: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  heroBadgeGuestTxt: { color: COLORS.textMuted, fontSize: 11, fontWeight: "600" },

  // ── Section card
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.13)",
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 14,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,215,0,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  cardHint: {
    color: COLORS.textDim,
    fontSize: 11,
    lineHeight: 16,
    marginTop: -6,
  },

  // ── Avatar grid
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  avatarCell: {
    borderRadius: 14,
    padding: 4,
    position: "relative",
  },
  avatarCellSelected: {
    backgroundColor: "rgba(255,215,0,0.14)",
  },
  avatarCheck: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.gold,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Name input
  nameInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
  },
  nameInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
  nameCount: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 6,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  previewLabel: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  previewName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  // ── Table grid
  tableGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tableCell: {
    width: (SCREEN_W - 32 - 32 - 10) / 2,
    height: 100,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
    position: "relative",
  },
  tableLocked: { opacity: 0.85 },
  tableImg: { ...StyleSheet.absoluteFillObject },
  tableSelectedOverlay: { ...StyleSheet.absoluteFillObject },
  tableLockBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
  },
  tableLabelGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  tableCellLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ── Card backs
  cardBackRow: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 4,
  },
  cardBackTile: {
    width: CARD_THUMB_W + 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingTop: 10,
    paddingHorizontal: 8,
    paddingBottom: 8,
    alignItems: "center",
    position: "relative",
  },
  cardBackTileSelected: {
    borderColor: "rgba(255,215,0,0.7)",
    backgroundColor: "rgba(255,215,0,0.07)",
  },
  cardBackTileLocked: { opacity: 0.9 },
  cardBackImgWrap: {
    width: CARD_THUMB_W,
    aspectRatio: CARD_W_PER_H,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#0d0d0d",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardBackCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.gold,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBackLock: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.35)",
  },
  cardBackLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "center",
    letterSpacing: 0.3,
  },

  // ── Save
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    height: 54,
    overflow: "hidden",
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  saveBtnTxt: {
    color: "#000",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  savedPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  savedTxt: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
  },
});
