import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QUICK_CHAT_MESSAGES } from "@/constants/quickChatMessages";
import COLORS from "@/constants/colors";

/**
 * Quick-chat picker. Overlay uses in-tree full-screen View (not Modal) — see scoreboard overlays
 * in game screens for the same pattern.
 */

export function GameQuickChatFab({
  onPress,
  accentColor = COLORS.gold,
}: {
  onPress: () => void;
  accentColor?: string;
}) {
  return (
    <Pressable
      style={[styles.fabInline, { borderColor: `${accentColor}55` }]}
      onPress={onPress}
      accessibilityLabel="Quick chat"
      hitSlop={6}
    >
      <Ionicons name="chatbubble-ellipses" size={22} color={accentColor} />
    </Pressable>
  );
}

interface GameQuickChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (messageId: number) => void;
  accentColor?: string;
}

export function GameQuickChatSheet({
  open,
  onOpenChange,
  onPick,
  accentColor = COLORS.gold,
}: GameQuickChatSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();

  const sheetMaxH = Math.min(windowH * 0.72, 520);

  const handlePick = useCallback(
    (messageId: number) => {
      onOpenChange(false);
      setTimeout(() => {
        onPick(messageId);
      }, 0);
    },
    [onPick, onOpenChange]
  );

  if (!open) return null;

  return (
    <View style={styles.overlayHost} pointerEvents="box-none">
      <View style={styles.overlay} pointerEvents="auto">
        <Pressable
          style={styles.backdrop}
          onPress={() => onOpenChange(false)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss quick chat"
        />
        <View style={[styles.sheet, { maxHeight: sheetMaxH }]} pointerEvents="box-none">
          <View
            style={[
              styles.sheetInner,
              { paddingBottom: Math.max(insets.bottom, 8) + 8, borderColor: `${accentColor}40` },
            ]}
            pointerEvents="auto"
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: accentColor }]}>Quick chat</Text>
              <Pressable onPress={() => onOpenChange(false)} hitSlop={12} accessibilityRole="button">
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </Pressable>
            </View>
            <ScrollView
              style={[styles.scroll, { maxHeight: sheetMaxH - 56 }]}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              {QUICK_CHAT_MESSAGES.map((label, messageId) => (
                <Pressable
                  key={messageId}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { backgroundColor: `${accentColor}22` },
                  ]}
                  onPress={() => handlePick(messageId)}
                >
                  <Text style={styles.rowText}>{label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fabInline: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 8,
    flexShrink: 0,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 8,
  },
  overlayHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
    elevation: 9998,
    pointerEvents: "box-none",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    width: "100%",
    position: "relative",
    zIndex: 1,
  },
  sheetInner: {
    backgroundColor: "#0E1A12",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  scroll: {},
  scrollContent: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  rowText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
});
