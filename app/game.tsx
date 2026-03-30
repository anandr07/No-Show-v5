import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Alert,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  FadeIn,
  FadeOut,
  ZoomIn,
  SlideInDown,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";

const GAME_TABLE_BACKGROUND = require("@/assets/images/game-table-background.png");

import { useGame } from "@/context/GameContext";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { PlayerAvatarImage } from "@/components/PlayerAvatarImage";
import { BotAvatarImage } from "@/components/BotAvatarImage";
import { botAvatarIndexFromPlayersList } from "@/constants/bot-avatar";
import { resolvePlayerDisplayName } from "@/lib/player-display";
import { Card, CardBack } from "@/components/Card";
import { playCardFlip, playTap, playCardDeal, playShow } from "@/lib/sound";
import {
  Card as CardType,
  getThrowError,
  SUIT_SYMBOLS,
} from "@/lib/gameEngine";
import COLORS, { AVATAR_COLORS } from "@/constants/colors";
import { FlightCard } from "@/components/FlightCard";
import { GameQuickChatFab, GameQuickChatSheet } from "@/components/GameQuickChatDock";
import { QuickChatBubble } from "@/components/QuickChatBubble";
import { useGameCardFlightAnimations } from "@/hooks/useGameCardFlightAnimations";
import { useQuickChatBubbles } from "@/hooks/useQuickChatBubbles";
import { getVsPlayerScreenPos } from "@/lib/game-card-flight-positions";

const { height: SCREEN_H } = Dimensions.get("window");

// ─── Opponent Zone ────────────────────────────────────────────────────────────

interface OppZoneProps {
  player: { id: string; name: string; hand: CardType[]; status: string };
  isTurn: boolean;
  avatarColor: string;
  compact?: boolean;
  isBot?: boolean;
  /** When `isBot`, index 0..2 among bot opponents for portrait art. */
  botAvatarIndex?: number;
  quickChatText?: string | null;
}

function OppZone({ player, isTurn, avatarColor, compact, isBot, botAvatarIndex = 0, quickChatText }: OppZoneProps) {
  const glow = useSharedValue(0);

  useEffect(() => {
    if (isTurn) {
      glow.value = withRepeat(
        withSequence(withTiming(1, { duration: 600 }), withTiming(0.4, { duration: 600 })),
        -1,
        true
      );
    } else {
      glow.value = withTiming(0, { duration: 300 });
    }
  }, [isTurn]);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(glow.value, [0, 1], [0, 0.9]),
    borderColor: isTurn
      ? `rgba(255,215,0,${interpolate(glow.value, [0, 1], [0.3, 0.9])})`
      : "rgba(255,255,255,0.15)",
  }));

  const cardCount = Math.min(player.hand.length, 6);

  const botImgSize = compact ? 50 : 58;

  return (
    <View style={compact ? styles.oppZoneCompact : styles.oppZone}>
      {quickChatText ? (
        <View style={styles.oppChatAbove}>
          <QuickChatBubble text={quickChatText} />
        </View>
      ) : null}
      <Animated.View style={[styles.oppAvatarRing, compact && styles.oppAvatarRingCompact, glowStyle]}>
        {isBot ? (
          <BotAvatarImage
            botAvatarIndex={botAvatarIndex}
            size={botImgSize}
            borderColor="rgba(0,0,0,0.35)"
            backgroundColor="rgba(0,0,0,0.35)"
          />
        ) : (
          <View style={[styles.oppAvatar, compact && styles.oppAvatarCompact, { backgroundColor: avatarColor }]}>
            <Text style={styles.oppInitial}>{player.name[0]?.toUpperCase() ?? "?"}</Text>
          </View>
        )}
        {isTurn && <View style={styles.turnDot} />}
      </Animated.View>
      <Text style={styles.oppName} numberOfLines={1}>{player.name}</Text>
      <View style={styles.oppCardsRow}>
        {Array.from({ length: cardCount }).map((_, ci) => (
          <CardBack key={ci} size="small" style={{ marginLeft: ci > 0 ? -18 : 0 }} />
        ))}
      </View>
      <Text style={styles.oppMeta}>{player.hand.length} cards</Text>
    </View>
  );
}

// ─── Main Game Screen ─────────────────────────────────────────────────────────

export default function GameScreen() {
  const {
    state,
    selectCard,
    deselectCard,
    throwSelectedCards,
    pickFromDeck,
    pickFromThrown,
    callShow,
    nextRound,
    resetGame,
    isBotThinking,
  } = useGame();
  const { user } = useAuth();
  const { avatarIndex, displayName: savedDisplayName } = useSettings();

  const insets = useSafeAreaInsets();

  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [showConfirmShow, setShowConfirmShow] = useState(false);
  const [throwError, setThrowError] = useState("");
  const [quickChatOpen, setQuickChatOpen] = useState(false);
  const notifRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const vsHumanIdx = state.players.findIndex((p) => p.type === "human");
  const getPlayerScreenPos = useCallback(
    (playerIdx: number, W: number, H: number) =>
      getVsPlayerScreenPos(playerIdx, state.players, vsHumanIdx, W, H),
    [state.players, vsHumanIdx],
  );

  const { animations, removeAnim } = useGameCardFlightAnimations(
    getPlayerScreenPos,
    state.phase === "playing",
    state.lastThrown,
    state.lastThrownByPlayerId,
    state.turnPhase,
    state.currentPlayerIndex,
    state.players,
  );

  const { pushBubble, textByPlayerId: quickChatByPlayer } = useQuickChatBubbles();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const leftInset = Platform.OS === "web" ? 0 : insets.left;
  const rightInset = Platform.OS === "web" ? 0 : insets.right;

  // Pulse for interactive elements
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1,
      true
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  useEffect(() => {
    if (state.phase === "show") setShowReveal(true);
  }, [state.phase]);

  const prevPhaseRef = useRef(state.phase);
  useEffect(() => {
    if (state.phase === "playing" && prevPhaseRef.current !== "playing") {
      playCardDeal();
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase]);

  const humanIndex = state.players.findIndex((p) => p.type === "human");
  const prevTurnRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      state.phase === "playing" &&
      humanIndex >= 0 &&
      state.currentPlayerIndex === humanIndex &&
      prevTurnRef.current !== state.currentPlayerIndex
    ) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    prevTurnRef.current = state.currentPlayerIndex;
  }, [state.phase, state.currentPlayerIndex, humanIndex]);

  if (state.phase === "idle" || state.phase === "dealing" || state.players.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={[COLORS.bgDeep, COLORS.tableDark]} style={StyleSheet.absoluteFill} />
        <Animated.View entering={ZoomIn}>
          <View style={styles.loadingIcon}>
            <MaterialCommunityIcons name="cards-playing" size={52} color={COLORS.gold} />
          </View>
        </Animated.View>
        <Animated.Text entering={FadeIn.delay(200)} style={styles.dealingText}>Dealing Cards…</Animated.Text>
      </View>
    );
  }

  if (state.phase === "gameOver") {
    router.replace("/results");
    return null;
  }

  const humanPlayer = state.players.find((p) => p.type === "human");
  const youRowName = resolvePlayerDisplayName({
    localName: savedDisplayName,
    authDisplayName: user?.user_metadata?.display_name,
    email: user?.email ?? null,
    fallback: humanPlayer?.name ?? "You",
  });
  const opponents = state.players.filter((p) => p.type === "bot");
  const currentPlayer = state.players[state.currentPlayerIndex];
  const isHumanTurn = currentPlayer?.type === "human" && currentPlayer.id === humanPlayer?.id;
  const humanHand = humanPlayer?.hand ?? [];
  const showPickOptions = state.turnPhase === "pick" && isHumanTurn;
  const canPickFromThrown = Boolean(
    showPickOptions && isHumanTurn && state.lastThrown.length > 0 &&
    (state.lastThrownByPlayerId ?? "") !== humanPlayer?.id
  );

  const handleCardPress = (card: CardType) => {
    if (!isHumanTurn || isBotThinking || state.turnPhase !== "throw") return;
    const isSelected = state.selectedCards.includes(card.id);
    if (isSelected) deselectCard(card.id);
    else selectCard(card.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playTap();
  };

  const handleThrow = () => {
    const player = state.players[state.currentPlayerIndex];
    if (!player || player.type !== "human") return;
    const selectedCards = player.hand.filter((c) => state.selectedCards.includes(c.id));
    const error = getThrowError(selectedCards);
    if (error) {
      setThrowError(error);
      if (notifRef.current) clearTimeout(notifRef.current);
      notifRef.current = setTimeout(() => setThrowError(""), 2200);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const success = throwSelectedCards();
    if (success) {
      setThrowError("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      playCardFlip();
    }
  };

  const handlePickFromDeck = () => {
    pickFromDeck();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playCardFlip();
  };

  const handlePickFromThrown = (card: CardType) => {
    pickFromThrown(card);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playCardFlip();
  };

  const handleShow = () => {
    if (!(state.canCallShow ?? false)) return;
    setShowConfirmShow(true);
  };

  const handleConfirmShow = () => {
    setShowConfirmShow(false);
    setTimeout(() => {
      try {
        callShow();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        playShow();
      } catch {}
    }, 0);
  };

  const handleQuit = () => {
    Alert.alert("Quit Game?", "Your progress will be lost.", [
      { text: "Cancel", style: "cancel" },
      { text: "Quit", style: "destructive", onPress: () => { resetGame(); router.replace("/"); } },
    ]);
  };

  const opp1 = opponents[0];
  const opp2 = opponents[1];
  const opp3 = opponents[2];
  const opp1Idx = opp1 ? state.players.findIndex((p) => p.id === opp1.id) : -1;
  const opp2Idx = opp2 ? state.players.findIndex((p) => p.id === opp2.id) : -1;
  const opp3Idx = opp3 ? state.players.findIndex((p) => p.id === opp3.id) : -1;

  const CenterPiles = () => (
    <View style={styles.centerPiles}>
      <View style={styles.pilesRow}>
        {/* Deck */}
        <Pressable
          onPress={showPickOptions && isHumanTurn ? handlePickFromDeck : undefined}
          style={styles.pileWrap}
        >
          {showPickOptions && isHumanTurn && (
            <Animated.View style={[styles.pickHintBadge, pulseStyle]}>
              <Text style={styles.pickHintText}>Tap to Pick</Text>
            </Animated.View>
          )}
          <Animated.View style={showPickOptions && isHumanTurn ? pulseStyle : undefined}>
            <CardBack size="medium" />
          </Animated.View>
          <Text style={styles.pileLabel}>DECK</Text>
        </Pressable>

        <View style={styles.pileArrow}>
          <Text style={styles.pileArrowText}>⇄</Text>
        </View>

        {/* Thrown pile */}
        <View style={styles.pileWrap}>
          {showPickOptions && isHumanTurn && canPickFromThrown && (
            <Animated.View style={[styles.pickHintBadge, pulseStyle]}>
              <Text style={styles.pickHintText}>Tap to Pick</Text>
            </Animated.View>
          )}
          <View style={styles.thrownBox}>
            {state.lastThrown.length === 0 ? (
              <View style={styles.emptyPile}>
                <Text style={styles.emptyPileText}>Empty</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thrownScroll}>
                {state.lastThrown.map((card, ci) => (
                  <Card
                    key={card.id}
                    card={card}
                    size="medium"
                    style={{ marginLeft: ci > 0 ? -20 : 0 }}
                    onPress={canPickFromThrown ? () => handlePickFromThrown(card) : undefined}
                    disabled={!canPickFromThrown}
                  />
                ))}
              </ScrollView>
            )}
          </View>
          <Text style={styles.pileLabel}>THROWN</Text>
        </View>
      </View>

      {/* Turn indicator */}
      {!isHumanTurn && (
        <Animated.View entering={FadeIn} style={styles.botThinkingBadge}>
          <FontAwesome5 name="robot" size={11} color={COLORS.textMuted} />
          <Text style={styles.botThinkingText}>
            {currentPlayer?.name ?? "Bot"} is thinking…
          </Text>
        </Animated.View>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      {/* ── TABLE BACKGROUND (full-screen art) ── */}
      <View style={styles.tableBackground}>
        <Image
          source={GAME_TABLE_BACKGROUND}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
        />
        <View style={styles.tableBgDim} pointerEvents="none" />
      </View>

      {/* ── GAME CONTENT ── */}
      <View style={[styles.gameContent, {
        paddingTop: topInset + 36,
        paddingBottom: bottomInset + 4,
        paddingLeft: leftInset + 8,
        paddingRight: rightInset + 8,
      }]}>

        {/* 1 opponent: single north */}
        {opponents.length === 1 && opp1 && (
          <View style={styles.oppNorthSingle}>
            <OppZone player={opp1} isTurn={opp1Idx === state.currentPlayerIndex}
              avatarColor={AVATAR_COLORS[opp1Idx % AVATAR_COLORS.length]} isBot
              botAvatarIndex={opponents.findIndex((o) => o.id === opp1.id)}
              quickChatText={quickChatByPlayer.get(opp1.id) ?? null} />
          </View>
        )}

        {/* 2 opponents: row */}
        {opponents.length === 2 && (
          <View style={styles.oppNorthRow}>
            {opp1 && <OppZone player={opp1} isTurn={opp1Idx === state.currentPlayerIndex}
              avatarColor={AVATAR_COLORS[opp1Idx % AVATAR_COLORS.length]} isBot
              botAvatarIndex={opponents.findIndex((o) => o.id === opp1.id)}
              quickChatText={quickChatByPlayer.get(opp1.id) ?? null} />}
            {opp2 && <OppZone player={opp2} isTurn={opp2Idx === state.currentPlayerIndex}
              avatarColor={AVATAR_COLORS[opp2Idx % AVATAR_COLORS.length]} isBot
              botAvatarIndex={opponents.findIndex((o) => o.id === opp2.id)}
              quickChatText={quickChatByPlayer.get(opp2.id) ?? null} />}
          </View>
        )}

        {/* 3 opponents: north + sides */}
        {opponents.length === 3 && opp1 && (
          <View style={styles.oppNorthSingle}>
            <OppZone player={opp1} isTurn={opp1Idx === state.currentPlayerIndex}
              avatarColor={AVATAR_COLORS[opp1Idx % AVATAR_COLORS.length]} isBot
              botAvatarIndex={opponents.findIndex((o) => o.id === opp1.id)}
              quickChatText={quickChatByPlayer.get(opp1.id) ?? null} />
          </View>
        )}

        {/* Center: sides + table */}
        <View style={styles.centerRow}>
          {opponents.length === 3 && opp2 && (
            <View style={styles.sideOpp}>
              <OppZone player={opp2} isTurn={opp2Idx === state.currentPlayerIndex}
                avatarColor={AVATAR_COLORS[opp2Idx % AVATAR_COLORS.length]} compact isBot
                botAvatarIndex={opponents.findIndex((o) => o.id === opp2.id)}
                quickChatText={quickChatByPlayer.get(opp2.id) ?? null} />
            </View>
          )}

          <CenterPiles />

          {opponents.length === 3 && opp3 && (
            <View style={styles.sideOpp}>
              <OppZone player={opp3} isTurn={opp3Idx === state.currentPlayerIndex}
                avatarColor={AVATAR_COLORS[opp3Idx % AVATAR_COLORS.length]} compact isBot
                botAvatarIndex={opponents.findIndex((o) => o.id === opp3.id)}
                quickChatText={quickChatByPlayer.get(opp3.id) ?? null} />
            </View>
          )}
        </View>

        {/* ── PLAYER HAND ── */}
        <View style={styles.handArea}>
          <View style={styles.handTopRow}>
            <View style={styles.handTopCenterWrap}>
              <View style={styles.handTopCenteredRow}>
                {isHumanTurn && state.turnPhase === "pick" && (
                  <Animated.View entering={ZoomIn} style={[styles.phaseBadge, styles.phasePick]}>
                    <Text style={styles.phaseText}>↑ PICK</Text>
                  </Animated.View>
                )}
              </View>
            </View>

            {throwError ? (
              <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.errorPill}>
                <Ionicons name="alert-circle" size={12} color="#fff" />
                <Text style={styles.errorText}>{throwError}</Text>
              </Animated.View>
            ) : null}
          </View>

          <View style={styles.handRow}>
            <GameQuickChatFab onPress={() => setQuickChatOpen(true)} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.handScrollView}
              contentContainerStyle={[styles.handScroll, { paddingRight: 206 }]}
            >
                {humanHand.map((card, idx) => {
                  const isSelected = state.selectedCards.includes(card.id);
                  return (
                    <Animated.View
                      key={card.id}
                      entering={FadeIn.delay(idx * 25)}
                      style={{
                        marginLeft: idx > 0 ? -14 : 0,
                        marginTop: isSelected ? -16 : 0,
                        zIndex: isSelected ? 10 : idx,
                      }}
                    >
                      <Card
                        card={card}
                        selected={isSelected}
                        onPress={() => handleCardPress(card)}
                        size="medium"
                        disabled={!isHumanTurn || isBotThinking || state.turnPhase !== "throw"}
                      />
                    </Animated.View>
                  );
                })}
            </ScrollView>

            <View style={styles.meAside} pointerEvents="box-none">
              <View style={styles.meAsideInner}>
                {humanPlayer && quickChatByPlayer.get(humanPlayer.id) ? (
                  <View style={styles.meChatAbove}>
                    <QuickChatBubble text={quickChatByPlayer.get(humanPlayer.id)!} />
                  </View>
                ) : null}
                <View style={styles.meAsideRow}>
                  <View style={styles.meAvatar}>
                    <PlayerAvatarImage
                      avatarIndex={avatarIndex}
                      size={54}
                      borderColor={COLORS.border}
                      backgroundColor="rgba(0,0,0,0.35)"
                    />
                  </View>
                  <View style={styles.meAsideTextCol}>
                    <Text style={styles.meName} numberOfLines={1}>{youRowName}</Text>
                    <Text style={styles.meScore}>{humanPlayer?.totalScore ?? 0} pts</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Action buttons — absolute right so hand can span full width and stay visually centered */}
            <View style={styles.actionCol}>
              {(state.canCallShow ?? false) && isHumanTurn && state.turnPhase === "throw" && !isBotThinking && (
                <Animated.View entering={ZoomIn}>
                  <Pressable style={styles.showBtn} onPress={handleShow}>
                    <LinearGradient
                      colors={[COLORS.accent, "#C0392B"]}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                    <Text style={styles.showBtnText}>SHOW</Text>
                  </Pressable>
                </Animated.View>
              )}

              {isHumanTurn && state.turnPhase === "throw" && !isBotThinking && (
                <Pressable
                  style={[styles.throwBtn, state.selectedCards.length === 0 && styles.throwBtnOff]}
                  onPress={handleThrow}
                  disabled={state.selectedCards.length === 0}
                >
                  <Ionicons name="send" size={13} color="#000" />
                  <Text style={styles.throwBtnText}>
                    {state.selectedCards.length > 0 ? `THROW (${state.selectedCards.length})` : "THROW"}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </View>

      <GameQuickChatSheet
        open={quickChatOpen}
        onOpenChange={setQuickChatOpen}
        onPick={(messageId) => {
          if (humanPlayer) pushBubble(humanPlayer.id, messageId);
        }}
      />

      {/* ── TOP BAR OVERLAY ── */}
      <View style={[styles.topBar, { top: topInset + 4, left: leftInset + 8, right: rightInset + 8 }]}>
        <Pressable style={styles.iconBtn} onPress={handleQuit}>
          <Ionicons name="close" size={16} color={COLORS.textMuted} />
        </Pressable>

        <View style={styles.topCenter} />

        <View style={styles.topBarRight}>
          <View style={styles.roundBadge} accessibilityLabel={`Round ${state.round}`}>
            <MaterialCommunityIcons name="counter" size={15} color={COLORS.gold} />
            <Text style={styles.roundBadgeText}>{state.round}</Text>
          </View>
          <Pressable style={styles.iconBtn} onPress={() => setShowScoreModal(true)}>
            <Ionicons name="stats-chart" size={16} color={COLORS.gold} />
          </Pressable>
        </View>
      </View>

      {/* ── CARD FLIGHT ANIMATIONS (throw / pick-discard / pick-deck) ── */}
      {animations.map((anim) => (
        <FlightCard key={anim.id} {...anim} onDone={removeAnim} />
      ))}

      {/* ── SCOREBOARD OVERLAY ── */}
      {showScoreModal && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.overlayContainer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowScoreModal(false)} />
          <Animated.View entering={ZoomIn.duration(250)} style={styles.scoreModal}>
            <LinearGradient
              colors={["#0E2D1A", "#081A10"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.scoreModalBorder} />

            <View style={styles.scoreModalHeader}>
              <MaterialCommunityIcons name="trophy" size={18} color={COLORS.gold} />
              <Text style={styles.scoreModalTitle}>Scoreboard — Round {state.round}</Text>
            </View>

            <View style={styles.scoreRowsContainer}>
              {state.players.map((p, idx) => {
                const isMe = p.id === humanPlayer?.id;
                const danger = p.totalScore >= 80;
                const botIdx = botAvatarIndexFromPlayersList(state.players, p.id);
                return (
                  <View key={p.id} style={[styles.scoreRow, isMe && styles.scoreRowMe]}>
                    <View
                      style={[
                        styles.scoreAvatar,
                        botIdx == null && { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] },
                      ]}
                    >
                      {botIdx != null ? (
                        <BotAvatarImage
                          botAvatarIndex={botIdx}
                          size={26}
                          borderColor="rgba(0,0,0,0.35)"
                          backgroundColor="rgba(0,0,0,0.3)"
                        />
                      ) : p.type === "human" ? (
                        <PlayerAvatarImage
                          avatarIndex={avatarIndex}
                          size={26}
                          borderColor="rgba(0,0,0,0.35)"
                          backgroundColor="rgba(0,0,0,0.3)"
                        />
                      ) : (
                        <Text style={styles.scoreAvatarTxt}>{p.name?.[0] ?? "?"}</Text>
                      )}
                    </View>
                    <Text style={styles.scoreNameTxt} numberOfLines={1}>{p.name}</Text>
                    {isMe && <View style={styles.youTag}><Text style={styles.youTagTxt}>YOU</Text></View>}
                    {p.status === "eliminated" && <View style={styles.outTag}><Text style={styles.outTagTxt}>OUT</Text></View>}
                    <View style={styles.scoreBarWrap}>
                      <View style={[styles.scoreBarFill, {
                        width: `${Math.min(p.totalScore, 100)}%`,
                        backgroundColor: danger ? COLORS.error : COLORS.primary,
                      }]} />
                    </View>
                    <Text style={[styles.scorePts, danger && styles.scorePtsDanger]}>
                      {p.totalScore}
                    </Text>
                  </View>
                );
              })}
            </View>

            <Pressable style={styles.closeBtn} onPress={() => setShowScoreModal(false)}>
              <Text style={styles.closeBtnTxt}>Close</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── CONFIRM SHOW OVERLAY ── */}
      {showConfirmShow && (
        <View style={styles.overlayContainer} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowConfirmShow(false)} />
          <Animated.View entering={ZoomIn.springify().damping(20)} style={styles.confirmModal}>
            <LinearGradient colors={["#0E2D1A", "#061508"]} style={StyleSheet.absoluteFill} />
            <View style={styles.confirmModalBorder} />
            <View style={styles.confirmIconWrap}>
              <MaterialCommunityIcons name="cards-playing" size={32} color={COLORS.gold} />
            </View>
            <Text style={styles.confirmTitle}>Call Show?</Text>
            <Text style={styles.confirmMsg}>Reveal all hands and score the round.</Text>
            <View style={styles.confirmBtns}>
              <Pressable style={styles.confirmCancel} onPress={() => setShowConfirmShow(false)}>
                <Text style={styles.confirmCancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmOk} onPress={handleConfirmShow}>
                <LinearGradient colors={[COLORS.gold, COLORS.goldDark]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <Text style={styles.confirmOkTxt}>Show!</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      )}

      {/* ── SHOW REVEAL SCORECARD ── */}
      {showReveal && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.overlayContainer}>
          <LinearGradient
            colors={["rgba(0,0,0,0.92)", "rgba(0,5,0,0.95)"]}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View entering={SlideInDown.springify().damping(18)} style={styles.showModal}>
            <LinearGradient
              colors={["#0F3020", "#081A10", "#050F08"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
            <View style={styles.showModalBorderDecor} />

            {/* Header */}
            <View style={styles.showModalHeader}>
              <MaterialCommunityIcons name="cards-playing" size={22} color={COLORS.gold} />
              <Text style={styles.showModalTitle}>✦  SHOW!  ✦</Text>
              <MaterialCommunityIcons name="cards-playing" size={22} color={COLORS.gold} />
            </View>

            {state.showCallerIndex !== null && state.players[state.showCallerIndex]?.id === humanPlayer?.id && (
              <Text style={styles.showModalCaller}>You called Show</Text>
            )}
            {state.showCallerIndex !== null && state.players[state.showCallerIndex]?.id !== humanPlayer?.id && (
              <Text style={styles.showModalCaller}>{state.players[state.showCallerIndex]?.name} called Show</Text>
            )}

            {(state.roundScores ?? []).some((s) => s.delta === 15) && (
              <Animated.View entering={FadeIn.delay(300)} style={styles.penaltyBox}>
                <Ionicons name="alert-circle" size={14} color={COLORS.error} />
                <Text style={styles.penaltyText}>
                  Shower had lowest score — +15 penalty
                </Text>
              </Animated.View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={styles.showScroll}>
              {(state.roundScores ?? []).map((score, si) => {
                const p = state.players.find((pl) => pl.id === score.playerId);
                const hand = p?.hand ?? [];
                const isMe = p?.id === humanPlayer?.id;
                const pIdx = state.players.findIndex((pl) => pl.id === score.playerId);
                const avatarColor = AVATAR_COLORS[pIdx % AVATAR_COLORS.length];
                const botIdx = p ? botAvatarIndexFromPlayersList(state.players, p.id) : null;
                return (
                  <Animated.View
                    key={score.playerId}
                    entering={FadeIn.delay(200 + si * 100)}
                    style={[styles.showRow, isMe && styles.showRowMe]}
                  >
                    <LinearGradient
                      colors={isMe ? [`${avatarColor}20`, `${avatarColor}08`] : ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.02)"]}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />

                    <View
                      style={[
                        styles.showRowAvatar,
                        botIdx == null && { backgroundColor: avatarColor },
                      ]}
                    >
                      {botIdx != null ? (
                        <BotAvatarImage
                          botAvatarIndex={botIdx}
                          size={34}
                          borderColor="rgba(255,255,255,0.2)"
                          backgroundColor="rgba(0,0,0,0.35)"
                        />
                      ) : p?.type === "human" ? (
                        <PlayerAvatarImage
                          avatarIndex={avatarIndex}
                          size={34}
                          borderColor="rgba(255,255,255,0.2)"
                          backgroundColor="rgba(0,0,0,0.35)"
                        />
                      ) : (
                        <Text style={styles.showRowAvatarTxt}>{p?.name?.[0] ?? "?"}</Text>
                      )}
                    </View>

                    <View style={styles.showRowLeft}>
                      <Text style={styles.showRowName}>{isMe ? "You" : p?.name ?? "—"}</Text>
                      <View style={styles.showMiniCards}>
                        {hand.slice(0, 4).map((c, i) => {
                          const isRed = c?.suit === "hearts" || c?.suit === "diamonds";
                          return (
                            <View key={c?.id ?? i} style={styles.showMiniCard}>
                              <Text style={[styles.showMiniCardTxt, { color: isRed ? COLORS.cardRed : COLORS.cardBlack }]}>
                                {c?.rank ?? ""}{c?.suit ? (SUIT_SYMBOLS[c.suit] ?? "") : ""}
                              </Text>
                            </View>
                          );
                        })}
                        {hand.length > 4 && <Text style={styles.showMore}>+{hand.length - 4}</Text>}
                      </View>
                    </View>

                    <View style={styles.showRowRight}>
                      <Text style={styles.showHandScore}>{score.score} pts</Text>
                      <Text style={[styles.showDelta,
                        score.delta === 15 ? styles.deltaBad :
                        score.delta === 0 ? styles.deltaGood : styles.deltaNeutral]}>
                        {score.delta === 15 ? "+15 ⚠" : score.delta === 0 ? "+0 ✓" : `+${score.delta}`}
                      </Text>
                      <Text style={styles.showTotal}>{p?.totalScore ?? score.delta} total</Text>
                    </View>
                  </Animated.View>
                );
              })}
            </ScrollView>

            <Pressable
              style={styles.nextRoundBtn}
              onPress={() => {
                setShowReveal(false);
                if ((state.phase as string) === "gameOver") router.replace("/results");
                else nextRound();
              }}
            >
              <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
              <Text style={styles.nextRoundTxt}>
                {(state.phase as string) === "gameOver" ? "See Final Results →" : `Next Round ${state.round + 1} →`}
              </Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── LOADING ──
  loadingContainer: {
    flex: 1, justifyContent: "center", alignItems: "center", gap: 20,
  },
  loadingIcon: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "rgba(255,215,0,0.1)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: COLORS.border,
  },
  dealingText: {
    color: COLORS.gold, fontSize: 20, fontWeight: "700", letterSpacing: 3,
  },

  // ── TABLE BACKGROUND ──
  tableBackground: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  /** Slight vignette so cards and UI stay readable on the photo. */
  tableBgDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.14)",
  },

  // ── GAME CONTENT ──
  gameContent: {
    flex: 1,
    justifyContent: "space-between",
    gap: 6,
  },

  // ── OPPONENTS ──
  oppNorthSingle: {
    alignItems: "center",
    paddingTop: 2,
  },
  oppNorthRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
  },
  oppChatAbove: {
    alignItems: "center",
    marginBottom: 4,
    maxWidth: 200,
  },
  oppZone: {
    alignItems: "center",
    gap: 3,
    minWidth: 80,
  },
  oppZoneCompact: {
    alignItems: "center",
    gap: 2,
    minWidth: 70,
  },
  oppAvatarRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 8,
  },
  oppAvatarRingCompact: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  oppAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: "center",
    alignItems: "center",
  },
  oppAvatarCompact: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  oppInitial: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  turnDot: {
    position: "absolute",
    top: -2, right: -2,
    width: 10, height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: "#000",
  },
  oppName: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  oppCardsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  oppMeta: {
    color: COLORS.textDim,
    fontSize: 9,
    fontWeight: "500",
  },

  // ── CENTER ──
  centerRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sideOpp: {
    justifyContent: "center",
    alignItems: "center",
    width: 90,
  },
  centerPiles: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  pilesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  pileWrap: {
    alignItems: "center",
    gap: 4,
  },
  pickHintBadge: {
    backgroundColor: COLORS.gold,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  pickHintText: {
    color: "#000",
    fontSize: 9,
    fontWeight: "800",
  },
  pileLabel: {
    color: COLORS.textDim,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  pileArrow: {
    alignItems: "center",
  },
  pileArrowText: {
    color: COLORS.textDim,
    fontSize: 18,
  },
  thrownBox: {
    minWidth: 52,
    height: 76,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyPile: {
    width: 52,
    height: 76,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyPileText: {
    color: COLORS.textDim,
    fontSize: 9,
    fontWeight: "600",
  },
  thrownScroll: {
    alignItems: "center",
    paddingHorizontal: 2,
  },
  botThinkingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  botThinkingText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },

  // ── HAND AREA ──
  handArea: {
    paddingHorizontal: 4,
    gap: 4,
    paddingBottom: 2,
  },
  handTopRow: {
    width: "100%",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  handTopCenterWrap: {
    width: "100%",
    alignItems: "center",
  },
  handTopCenteredRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 8,
  },
  meAside: {
    position: "absolute",
    right: 88,
    top: 0,
    bottom: 0,
    width: 118,
    justifyContent: "center",
    paddingLeft: 0,
  },
  meAsideInner: {
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 4,
  },
  meAsideRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
  },
  meChatAbove: {
    alignSelf: "flex-start",
    maxWidth: 170,
  },
  meAsideTextCol: {
    flexShrink: 1,
    alignItems: "flex-start",
  },
  meAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: "hidden",
  },
  meName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "left",
    maxWidth: 72,
  },
  meScore: {
    color: COLORS.textDim,
    fontSize: 9,
    fontWeight: "500",
    textAlign: "left",
  },
  errorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: "92%",
    alignSelf: "center",
  },
  errorText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    flexShrink: 1,
  },
  phaseBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  phasePick: {
    backgroundColor: "rgba(52,152,219,0.15)",
    borderColor: "rgba(52,152,219,0.4)",
  },
  phaseText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  handRow: {
    position: "relative",
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 72,
  },
  handScrollView: {
    flex: 1,
    alignSelf: "stretch",
  },
  handScroll: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    paddingRight: 12,
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
  },
  actionCol: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    flexDirection: "column",
    alignItems: "center",
    gap: 7,
    width: 88,
  },
  showBtn: {
    borderRadius: 16,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  showBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  throwBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  throwBtnOff: {
    opacity: 0.3,
  },
  throwBtnText: {
    color: "#000",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  // ── TOP BAR ──
  topBar: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 20,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  topCenter: {
    flex: 1,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roundBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  roundBadgeText: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: "800",
    minWidth: 14,
    textAlign: "center",
  },

  // ── OVERLAYS ──
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    backgroundColor: "rgba(0,0,0,0.85)",
  },

  // Score modal
  scoreModal: {
    width: "82%",
    maxWidth: 460,
    borderRadius: 20,
    padding: 20,
    overflow: "hidden",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.25)",
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  scoreModalBorder: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 2,
    backgroundColor: COLORS.gold,
    opacity: 0.4,
  },
  scoreModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    marginBottom: 4,
  },
  scoreModalTitle: {
    color: COLORS.gold,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
  },
  scoreRowsContainer: { gap: 6 },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  scoreRowMe: {
    backgroundColor: "rgba(255,215,0,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.25)",
  },
  scoreAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  scoreAvatarTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  scoreNameTxt: {
    color: COLORS.text, fontSize: 13, fontWeight: "600", flex: 1,
  },
  youTag: {
    backgroundColor: "rgba(255,215,0,0.15)",
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
    borderWidth: 1, borderColor: "rgba(255,215,0,0.4)",
  },
  youTagTxt: { color: COLORS.gold, fontSize: 8, fontWeight: "900" },
  outTag: {
    backgroundColor: COLORS.eliminated,
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  outTagTxt: { color: "#fff", fontSize: 8, fontWeight: "900" },
  scoreBarWrap: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    maxWidth: 80,
  },
  scoreBarFill: { height: "100%", borderRadius: 2 },
  scorePts: {
    color: COLORS.text, fontSize: 15, fontWeight: "800", minWidth: 36, textAlign: "right",
  },
  scorePtsDanger: { color: COLORS.error },
  closeBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10, paddingVertical: 10, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  closeBtnTxt: { color: COLORS.textMuted, fontSize: 14, fontWeight: "700" },

  // Confirm show modal
  confirmModal: {
    width: "82%", maxWidth: 340,
    borderRadius: 22, padding: 24,
    overflow: "hidden", gap: 12,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
    alignItems: "center",
  },
  confirmModalBorder: {
    position: "absolute", top: 0, left: 0, right: 0, height: 2,
    backgroundColor: COLORS.gold, opacity: 0.5,
  },
  confirmIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(255,215,0,0.1)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  confirmTitle: {
    color: COLORS.gold, fontSize: 22, fontWeight: "900", textAlign: "center",
  },
  confirmMsg: {
    color: COLORS.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20,
  },
  confirmBtns: { flexDirection: "row", gap: 10, width: "100%", marginTop: 4 },
  confirmCancel: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12,
    paddingVertical: 12, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  confirmCancelTxt: { color: COLORS.textMuted, fontSize: 15, fontWeight: "700" },
  confirmOk: {
    flex: 1, borderRadius: 12, paddingVertical: 12,
    alignItems: "center", overflow: "hidden",
    shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
  },
  confirmOkTxt: { color: "#000", fontSize: 15, fontWeight: "900" },

  // Show reveal modal
  showModal: {
    width: "90%", maxWidth: 520,
    maxHeight: SCREEN_H * 0.82,
    borderRadius: 22,
    padding: 20,
    overflow: "hidden",
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 24,
  },
  showModalBorderDecor: {
    position: "absolute", top: 0, left: 0, right: 0, height: 2.5,
    backgroundColor: COLORS.gold, opacity: 0.6,
  },
  showModalHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 10,
  },
  showModalTitle: {
    color: COLORS.gold, fontSize: 20, fontWeight: "900", letterSpacing: 3,
    textShadowColor: COLORS.gold, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
  },
  showModalCaller: {
    color: COLORS.textMuted, fontSize: 12, fontWeight: "600",
    textAlign: "center", letterSpacing: 0.5,
  },
  penaltyBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(229,57,53,0.12)",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(229,57,53,0.25)",
  },
  penaltyText: {
    color: COLORS.error, fontSize: 11, fontWeight: "600", flex: 1,
  },
  showScroll: { maxHeight: SCREEN_H * 0.44 },
  showRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 12, padding: 10, marginBottom: 6,
    overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  showRowMe: {
    borderColor: "rgba(255,215,0,0.3)",
  },
  showRowAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  showRowAvatarTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  showRowLeft: { flex: 1, gap: 4 },
  showRowName: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  showMiniCards: {
    flexDirection: "row", alignItems: "center", gap: 3, flexWrap: "wrap",
  },
  showMiniCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.12)",
  },
  showMiniCardTxt: { fontSize: 10, fontWeight: "700" },
  showMore: {
    color: COLORS.textDim, fontSize: 10, fontWeight: "600",
  },
  showRowRight: { alignItems: "flex-end", gap: 3 },
  showHandScore: {
    color: COLORS.text, fontSize: 15, fontWeight: "800",
  },
  showDelta: { fontSize: 11, fontWeight: "700" },
  deltaBad: { color: COLORS.error },
  deltaGood: { color: COLORS.primary },
  deltaNeutral: { color: COLORS.textMuted },
  showTotal: {
    color: COLORS.textDim, fontSize: 10, fontWeight: "500",
  },
  nextRoundBtn: {
    borderRadius: 14, overflow: "hidden",
    paddingVertical: 14, alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  nextRoundTxt: {
    color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 1,
  },
});
