import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Alert,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import COLORS from "@/constants/colors";
import { HOW_PLAY_FLOW } from "@/constants/flowThemes";
import { useSettings } from "@/context/SettingsContext";
import {
  ADS_FREE_PRICE_LABEL,
  CARD_BACK_GEM_PRICE,
  CARD_BACK_PRODUCTS,
  GEM_PACK_PRODUCTS,
  TABLE_THEME_GEM_PRICE,
  TABLE_THEME_PRODUCTS,
  getTableThemeImageSource,
  isPremiumTableTheme,
  type PurchasableCardBackId,
  type PremiumTableThemeId,
} from "@/constants/storeCatalog";

type StoreTab = "ads" | "gems" | "cards" | "table";

const TABS: { id: StoreTab; label: string }[] = [
  { id: "ads", label: "Ads Free" },
  { id: "gems", label: "Buy Gems" },
  { id: "cards", label: "Cards" },
  { id: "table", label: "Table" },
];

/** Landscape preview for table felts in Store (width ÷ height). */
const TABLE_STORE_W_PER_H = 16 / 9;
/** Portrait playing-card preview for card backs in Store. */
const CARD_STORE_W_PER_H = 2.5 / 3.5;

export default function StoreScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<StoreTab>("gems");
  const {
    gemBalance,
    adsFreePurchased,
    ownedCardBacks,
    ownedTablePremium,
    addGems,
    setAdsFreePurchased,
    purchaseCardBackWithGems,
    purchaseTableThemeWithGems,
  } = useSettings();

  const unownedCardBacks = useMemo(
    () => CARD_BACK_PRODUCTS.filter((p) => !ownedCardBacks.includes(p.id)),
    [ownedCardBacks]
  );

  const unownedPremiumTables = useMemo(
    () =>
      TABLE_THEME_PRODUCTS.filter(
        (row) =>
          row.gemPrice != null &&
          !ownedTablePremium.includes(row.theme as PremiumTableThemeId)
      ),
    [ownedTablePremium]
  );

  const storePad = 16;
  const storeGap = 10;
  const usableStoreW = width - storePad * 2;

  /** Split full width when tiles stay readable; otherwise horizontal scroll with peek. */
  const cardTileLayout = useMemo(() => {
    const n = unownedCardBacks.length;
    if (n === 0) return { mode: "empty" as const };
    const gaps = (n - 1) * storeGap;
    const equalTileW = Math.floor((usableStoreW - gaps) / n);
    const minTileW = 88;
    if (equalTileW >= minTileW || n === 1) {
      return { mode: "fill" as const };
    }
    const thumbW = Math.max(92, Math.min(Math.floor((usableStoreW - storeGap) / 2.15), 150));
    return { mode: "scroll" as const, tileW: thumbW + 12, thumbW };
  }, [unownedCardBacks.length, usableStoreW, storeGap]);

  const tableTileLayout = useMemo(() => {
    const n = unownedPremiumTables.length;
    if (n === 0) return { mode: "empty" as const };
    const gaps = (n - 1) * storeGap;
    const equalTileW = Math.floor((usableStoreW - gaps) / n);
    const minTileW = 96;
    if (equalTileW >= minTileW || n === 1) {
      return { mode: "fill" as const };
    }
    const thumbW = Math.max(100, Math.min(Math.floor((usableStoreW - storeGap) / 2.15), 220));
    return { mode: "scroll" as const, tileW: thumbW + 16, thumbW };
  }, [unownedPremiumTables.length, usableStoreW, storeGap]);

  useEffect(() => {
    const t = params.tab;
    if (t === "ads" || t === "gems" || t === "cards" || t === "table") {
      setTab(t);
    }
  }, [params.tab]);

  const onBuyGems = useCallback(
    (pack: (typeof GEM_PACK_PRODUCTS)[number]) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const detail = `${pack.priceLabel} · includes ${pack.gemsGranted.toLocaleString()} gems`;
      if (__DEV__) {
        Alert.alert(pack.title, detail, [
          { text: "Cancel", style: "cancel" },
          {
            text: "Simulate purchase",
            onPress: () => {
              void addGems(pack.gemsGranted);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ]);
        return;
      }
      Alert.alert(
        pack.title,
        `${detail}\n\nComplete this purchase in the App Store or Google Play once in-app billing is linked.`,
        [{ text: "OK" }]
      );
    },
    [addGems]
  );

  const onBuyAdsFree = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (adsFreePurchased) return;
    if (__DEV__) {
      Alert.alert("Remove ads", `${ADS_FREE_PRICE_LABEL} one-time`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Simulate purchase",
          onPress: () => {
            void setAdsFreePurchased(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]);
      return;
    }
    Alert.alert(
      "Remove ads",
      `${ADS_FREE_PRICE_LABEL} one-time purchase.\n\nConnect your App Store / Play product ID to enable checkout.`,
      [{ text: "OK" }]
    );
  }, [adsFreePurchased, setAdsFreePurchased]);

  const onBuyCardBack = useCallback(
    async (id: PurchasableCardBackId) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (gemBalance < CARD_BACK_GEM_PRICE) {
        Alert.alert("Not enough gems", `You need ${CARD_BACK_GEM_PRICE} gems. Visit Buy Gems to top up.`);
        return;
      }
      Alert.alert(
        "Unlock card back",
        `Spend ${CARD_BACK_GEM_PRICE} gems? Equip it later from Profile.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unlock",
            onPress: async () => {
              const ok = await purchaseCardBackWithGems(id);
              if (ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            },
          },
        ]
      );
    },
    [gemBalance, purchaseCardBackWithGems]
  );

  const onBuyTableTheme = useCallback(
    async (row: (typeof TABLE_THEME_PRODUCTS)[number]) => {
      const { theme } = row;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!isPremiumTableTheme(theme)) return;
      if (gemBalance < TABLE_THEME_GEM_PRICE) {
        Alert.alert("Not enough gems", `You need ${TABLE_THEME_GEM_PRICE.toLocaleString()} gems. Visit Buy Gems to top up.`);
        return;
      }
      Alert.alert(
        "Unlock table theme",
        `Spend ${TABLE_THEME_GEM_PRICE.toLocaleString()} gems for ${row.title}? Equip it later from Profile.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unlock",
            onPress: async () => {
              const ok = await purchaseTableThemeWithGems(theme);
              if (ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            },
          },
        ]
      );
    },
    [gemBalance, purchaseTableThemeWithGems]
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[...HOW_PLAY_FLOW.bgGradient]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={[styles.header, { paddingTop: topInset + 10, paddingHorizontal: 16 + insets.left }]}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Ionicons name="arrow-back" size={22} color={HOW_PLAY_FLOW.accent} />
        </Pressable>
        <Text style={styles.headerTitle}>STORE</Text>
        <View style={styles.gemPill}>
          <MaterialCommunityIcons name="diamond-stone" size={16} color="#5DADE2" />
          <Text style={styles.gemPillText}>{gemBalance.toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            style={[styles.tabBtn, tab === t.id && styles.tabBtnOn]}
            onPress={() => {
              Haptics.selectionAsync();
              setTab(t.id);
            }}
          >
            <Text style={[styles.tabBtnText, tab === t.id && styles.tabBtnTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.tabContent}>
      {tab === "ads" && (
        <ScrollView
          style={styles.tabScroll}
          contentContainerStyle={[styles.scrollPad, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.adsHero}>
            <View style={styles.adsIconStack}>
              <Image
                source={require("@/assets/images/store/no-ads.png")}
                style={StyleSheet.absoluteFillObject}
                contentFit="contain"
                transition={0}
              />
            </View>
            <Text style={styles.adsTitle}>Play without interruptions</Text>
            <Text style={styles.adsSub}>Remove ads for a cleaner experience.</Text>
            <Text style={styles.adsPrice}>{ADS_FREE_PRICE_LABEL}</Text>
            {adsFreePurchased ? (
              <View style={styles.ownedBadge}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                <Text style={styles.ownedBadgeText}>You own Remove Ads</Text>
              </View>
            ) : (
              <Pressable style={styles.primaryCta} onPress={onBuyAdsFree}>
                <LinearGradient
                  colors={[COLORS.gold, COLORS.goldDark]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                <Text style={styles.primaryCtaText}>Remove ads</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      )}

      {tab === "gems" && (
        <ScrollView
          style={styles.tabScroll}
          contentContainerStyle={[styles.scrollPad, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionHint}>Tap a pack to purchase. Bonus gems shown for each tier.</Text>
          {GEM_PACK_PRODUCTS.map((pack) => (
            <Pressable key={pack.id} style={styles.gemPackRow} onPress={() => onBuyGems(pack)}>
              <View style={styles.gemPackImgClip}>
                <Image
                  source={pack.image}
                  style={styles.gemPackImgFill}
                  contentFit="cover"
                  contentPosition="top"
                  transition={0}
                />
              </View>
              <View style={styles.gemPackMeta}>
                <Text style={styles.gemPackTitle}>{pack.title}</Text>
                <Text style={styles.gemPackSub}>{pack.subtitle}</Text>
                <Text style={styles.gemPackGems}>+{pack.gemsGranted.toLocaleString()} gems</Text>
              </View>
              <Text style={styles.gemPackPrice}>{pack.priceLabel}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {tab === "cards" && (
        <ScrollView
          style={styles.tabScroll}
          contentContainerStyle={[
            styles.storeTilesScrollContent,
            { paddingHorizontal: storePad, paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <Text style={styles.sectionHint}>
            Unlock premium backs with gems. The Classic back is free — equip everything from Profile. Owned backs
            are not listed here.
          </Text>
          {unownedCardBacks.length === 0 ? (
            <Text style={styles.storeEmptyText}>
              You own every premium card back. Open Profile to choose which one to use.
            </Text>
          ) : cardTileLayout.mode === "fill" ? (
            <View style={[styles.storeTileRowFill, { gap: storeGap }]}>
              {unownedCardBacks.map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.storeTileCard, styles.storeTileCardFlex]}
                  onPress={() => void onBuyCardBack(p.id)}
                >
                  <View
                    style={[
                      styles.storeTileImgClip,
                      styles.storeTileImgClipStretch,
                      { aspectRatio: CARD_STORE_W_PER_H },
                    ]}
                  >
                    <Image
                      source={p.image}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="contain"
                      transition={0}
                    />
                  </View>
                  <Text style={styles.storeTileTitle} numberOfLines={2}>
                    {p.title}
                  </Text>
                  <View style={styles.storeTileCostRow}>
                    <MaterialCommunityIcons name="diamond-stone" size={11} color="#5DADE2" />
                    <Text style={styles.storeTileCostText}>{CARD_BACK_GEM_PRICE.toLocaleString()}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={[styles.storeTileRow, { paddingRight: storePad }]}
            >
              {unownedCardBacks.map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.storeTileCard, { width: cardTileLayout.tileW }]}
                  onPress={() => void onBuyCardBack(p.id)}
                >
                  <View
                    style={[
                      styles.storeTileImgClip,
                      { width: cardTileLayout.thumbW, aspectRatio: CARD_STORE_W_PER_H },
                    ]}
                  >
                    <Image
                      source={p.image}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="contain"
                      transition={0}
                    />
                  </View>
                  <Text style={styles.storeTileTitle} numberOfLines={2}>
                    {p.title}
                  </Text>
                  <View style={styles.storeTileCostRow}>
                    <MaterialCommunityIcons name="diamond-stone" size={11} color="#5DADE2" />
                    <Text style={styles.storeTileCostText}>{CARD_BACK_GEM_PRICE.toLocaleString()}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </ScrollView>
      )}

      {tab === "table" && (
        <ScrollView
          style={styles.tabScroll}
          contentContainerStyle={[
            styles.storeTilesScrollContent,
            { paddingHorizontal: storePad, paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <Text style={styles.sectionHint}>
            Unlock premium felts with gems. The green table is free — equip tables from Profile. Purchased themes are
            not listed here.
          </Text>
          {unownedPremiumTables.length === 0 ? (
            <Text style={styles.storeEmptyText}>
              You own every premium table. Open Profile to pick your felt.
            </Text>
          ) : tableTileLayout.mode === "fill" ? (
            <View style={[styles.storeTileRowFill, { gap: storeGap }]}>
              {unownedPremiumTables.map((row) => (
                <Pressable
                  key={row.theme}
                  style={[styles.storeTileCard, styles.storeTileCardFlex]}
                  onPress={() => void onBuyTableTheme(row)}
                >
                  <View
                    style={[
                      styles.storeTileImgClip,
                      styles.storeTileImgClipStretch,
                      { aspectRatio: TABLE_STORE_W_PER_H },
                    ]}
                  >
                    <Image
                      source={getTableThemeImageSource(row.theme)}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="cover"
                      transition={0}
                    />
                  </View>
                  <Text style={styles.storeTileTitle} numberOfLines={2}>
                    {row.title}
                  </Text>
                  <View style={styles.storeTileCostRow}>
                    <MaterialCommunityIcons name="diamond-stone" size={11} color="#5DADE2" />
                    <Text style={styles.storeTileCostText}>
                      {(row.gemPrice ?? TABLE_THEME_GEM_PRICE).toLocaleString()}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={[styles.storeTileRow, { paddingRight: storePad }]}
            >
              {unownedPremiumTables.map((row) => (
                <Pressable
                  key={row.theme}
                  style={[styles.storeTileCard, { width: tableTileLayout.tileW }]}
                  onPress={() => void onBuyTableTheme(row)}
                >
                  <View
                    style={[
                      styles.storeTileImgClip,
                      { width: tableTileLayout.thumbW, aspectRatio: TABLE_STORE_W_PER_H },
                    ]}
                  >
                    <Image
                      source={getTableThemeImageSource(row.theme)}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="cover"
                      transition={0}
                    />
                  </View>
                  <Text style={styles.storeTileTitle} numberOfLines={2}>
                    {row.title}
                  </Text>
                  <View style={styles.storeTileCostRow}>
                    <MaterialCommunityIcons name="diamond-stone" size={11} color="#5DADE2" />
                    <Text style={styles.storeTileCostText}>
                      {(row.gemPrice ?? TABLE_THEME_GEM_PRICE).toLocaleString()}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </ScrollView>
      )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bgDeep },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    gap: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `rgba(${HOW_PLAY_FLOW.rgb},0.12)`,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: `rgba(${HOW_PLAY_FLOW.rgb},0.35)`,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: HOW_PLAY_FLOW.accent,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
  },
  gemPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(93,173,226,0.45)",
  },
  gemPillText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
    minWidth: 28,
  },
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  tabBtn: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  tabBtnOn: {
    backgroundColor: `rgba(${HOW_PLAY_FLOW.rgb},0.2)`,
    borderColor: `rgba(${HOW_PLAY_FLOW.rgb},0.45)`,
  },
  tabBtnText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  tabBtnTextOn: {
    color: HOW_PLAY_FLOW.accent,
  },
  tabContent: {
    flex: 1,
    minHeight: 0,
  },
  tabScroll: {
    flex: 1,
  },
  scrollPad: {
    paddingHorizontal: 16,
    gap: 12,
  },
  sectionHint: {
    color: COLORS.textDim,
    fontSize: 12,
    marginBottom: 4,
    lineHeight: 18,
  },
  adsHero: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 12,
  },
  adsIconStack: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  adsCross: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  adsTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  adsSub: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  adsPrice: {
    color: HOW_PLAY_FLOW.accent,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 8,
  },
  ownedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(46,204,113,0.15)",
    borderWidth: 1,
    borderColor: "rgba(46,204,113,0.35)",
  },
  ownedBadgeText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  primaryCta: {
    marginTop: 20,
    borderRadius: 14,
    overflow: "hidden",
    paddingVertical: 16,
    paddingHorizontal: 48,
    minWidth: 220,
    alignItems: "center",
  },
  primaryCtaText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  gemPackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  /** Shorter clip + top anchoring hides embedded titles at the bottom of pack art. */
  gemPackImgClip: {
    width: 72,
    height: 60,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  gemPackImgFill: {
    width: 72,
    height: 84,
  },
  gemPackMeta: { flex: 1, minWidth: 0, gap: 2 },
  gemPackTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  gemPackSub: { color: COLORS.textDim, fontSize: 11 },
  gemPackGems: { color: "#5DADE2", fontSize: 12, fontWeight: "700", marginTop: 2 },
  gemPackPrice: { color: HOW_PLAY_FLOW.accent, fontSize: 14, fontWeight: "900" },
  storeEmptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 20,
    paddingHorizontal: 12,
  },
  storeTilesScrollContent: {
    gap: 8,
    paddingTop: 2,
  },
  storeTileRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    paddingTop: 4,
  },
  storeTileRowFill: {
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    paddingTop: 4,
  },
  storeTileCard: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  storeTileCardFlex: {
    flex: 1,
    minWidth: 0,
  },
  storeTileImgClip: {
    alignSelf: "center",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  storeTileImgClipStretch: {
    width: "100%",
    alignSelf: "stretch",
  },
  storeTileTitle: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 6,
    textAlign: "center",
    width: "100%",
    minHeight: 28,
  },
  storeTileCostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  storeTileCostText: {
    color: "#5DADE2",
    fontSize: 12,
    fontWeight: "800",
  },
});
