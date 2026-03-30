import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";

import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { useMultiplayerGame } from "@/context/MultiplayerGameContext";
import { PlayerAvatarImage } from "@/components/PlayerAvatarImage";
import { BotAvatarImage } from "@/components/BotAvatarImage";
import { resolvePlayerDisplayName } from "@/lib/player-display";
import { Card, CardBack } from "@/components/Card";
import { playCardFlip, playTap, playCardDeal, playShow } from "@/lib/sound";
import {
  Card as CardType,
  getThrowError,
  isValidThrow,
  SUIT_SYMBOLS,
} from "@/lib/gameEngine";
import COLORS, { AVATAR_COLORS } from "@/constants/colors";
import { FlightCard } from "@/components/FlightCard";
import { useGameCardFlightAnimations } from "@/hooks/useGameCardFlightAnimations";
import { getSeatScreenPosForLocalPlayer } from "@/lib/game-card-flight-positions";
import { GameQuickChatFab, GameQuickChatSheet } from "@/components/GameQuickChatDock";
import { QuickChatBubble } from "@/components/QuickChatBubble";
import { getQuickChatText } from "@/constants/quickChatMessages";

const GAME_TABLE_BACKGROUND = require("@/assets/images/game-table-background.png");

interface OppZoneProps {
  player: { id: string; name: string; hand: CardType[]; status: string };
  isTurn: boolean;
  avatarColor: string;
  compact?: boolean;
  isBot?: boolean;
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

export default function GameMultiplayerScreen() {
  const { user } = useAuth();
  const { avatarIndex, displayName: savedDisplayName } = useSettings();
  const {
    gameState: state,
    playerId,
    error: contextError,
    clearError,
    selectCard,
    deselectCard,
    throwSelectedCards,
    pickFromDeck,
    pickFromThrown,
    callShow,
    nextRound,
    quitGame,
    selectedCards,
    quickChatEvents,
    sendQuickChat,
  } = useMultiplayerGame();

  const insets = useSafeAreaInsets();
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [showConfirmShow, setShowConfirmShow] = useState(false);
  const [throwError, setThrowError] = useState("");
  const [quickChatOpen, setQuickChatOpen] = useState(false);
  const notifRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const getPlayerScreenPos = useCallback(
    (playerIdx: number, W: number, H: number) =>
      getSeatScreenPosForLocalPlayer(playerIdx, state?.players ?? [], playerId ?? "", W, H),
    [state?.players, playerId],
  );

  const flightAnimEnabled = Boolean(state && playerId && state.phase === "playing");

  const { animations, removeAnim } = useGameCardFlightAnimations(
    getPlayerScreenPos,
    flightAnimEnabled,
    state?.lastThrown ?? [],
    state?.lastThrownByPlayerId,
    state?.turnPhase ?? "",
    state?.currentPlayerIndex ?? 0,
    state?.players ?? [],
  );

  useEffect(() => {
    if (state?.phase === "show") setShowReveal(true);
  }, [state?.phase]);

  const prevPhaseRef = useRef<string | undefined>(state?.phase);
  useEffect(() => {
    if (state?.phase === "playing" && prevPhaseRef.current !== "playing") {
      playCardDeal();
    }
    prevPhaseRef.current = state?.phase;
  }, [state?.phase]);

  const prevTurnRef = useRef<string | null>(null);
  useEffect(() => {
    const currentPlayer = state?.players[state.currentPlayerIndex];
    const isMyTurn = currentPlayer?.id === playerId;
    if (
      state?.phase === "playing" &&
      isMyTurn &&
      prevTurnRef.current !== playerId
    ) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    prevTurnRef.current = currentPlayer?.id ?? null;
  }, [state?.phase, state?.currentPlayerIndex, state?.players, playerId]);

  // Pick first, then throw: show pick options when turnPhase is "pick"
  const showPickOptions = Boolean(state && state.turnPhase === "pick" && state.players[state.currentPlayerIndex]?.id === playerId);

  if (!state || !playerId) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.tableBackground}>
          <Image
            source={GAME_TABLE_BACKGROUND}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={0}
          />
          <View style={styles.tableBgDim} pointerEvents="none" />
        </View>
        <Animated.View entering={ZoomIn} style={{ zIndex: 1 }}>
          <MaterialCommunityIcons name="cards-playing" size={60} color={COLORS.gold} />
        </Animated.View>
        <Text style={[styles.dealingText, { zIndex: 1 }]}>Loading...</Text>
      </View>
    );
  }

  if (state.phase === "gameOver") {
    router.replace("/results");
    return null;
  }

  const humanPlayer = state.players.find((p) => p.id === playerId);
  const opponents = state.players.filter((p) => p.id !== playerId && p.status === "active");
  const youRowName = resolvePlayerDisplayName({
    localName: savedDisplayName,
    authDisplayName: user?.user_metadata?.display_name,
    email: user?.email ?? null,
    fallback: humanPlayer?.name ?? "You",
  });
  const currentPlayer = state.players[state.currentPlayerIndex];
  const isHumanTurn = currentPlayer?.id === playerId;
  const humanHand = humanPlayer?.hand ?? [];
  const canPickFromThrown = Boolean(
    showPickOptions && isHumanTurn && state.lastThrown.length > 0 &&
    (state.lastThrownByPlayerId ?? "") !== playerId
  );

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const leftInset = Platform.OS === "web" ? 0 : insets.left;
  const rightInset = Platform.OS === "web" ? 0 : insets.right;

  const handleCardPress = (card: CardType) => {
    if (!isHumanTurn || state.turnPhase !== "throw") return;
    const isSelected = selectedCards.includes(card.id);
    if (isSelected) {
      deselectCard(card.id);
    } else {
      selectCard(card.id);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playTap();
  };

  const handleThrow = () => {
    const selectedCardsList = humanHand.filter((c) => selectedCards.includes(c.id));
    const error = getThrowError(selectedCardsList);
    if (error) {
      setThrowError(error);
      if (notifRef.current) clearTimeout(notifRef.current);
      notifRef.current = setTimeout(() => setThrowError(""), 2200);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!isValidThrow(selectedCardsList)) return;
    throwSelectedCards();
    setThrowError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playCardFlip();
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
    // Defer to next tick so overlay unmount completes before state updates from server
    setTimeout(() => {
      try {
        callShow();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        playShow();
      } catch (e) {
        // Swallow any error to prevent crash
      }
    }, 0);
  };

  const handleQuit = () => {
    Alert.alert("Quit Game?", "You will leave the match. Other players will be notified.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Quit",
        style: "destructive",
        onPress: () => quitGame(),
      },
    ]);
  };

  const opp1 = opponents[0];
  const opp2 = opponents[1];
  const opp3 = opponents[2];
  const opp1Idx = opp1 ? state.players.findIndex((p) => p.id === opp1.id) : -1;
  const opp2Idx = opp2 ? state.players.findIndex((p) => p.id === opp2.id) : -1;
  const opp3Idx = opp3 ? state.players.findIndex((p) => p.id === opp3.id) : -1;

  const quickChatByPlayer = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of quickChatEvents) {
      const t = getQuickChatText(e.messageId);
      if (t) m.set(e.playerId, t);
    }
    return m;
  }, [quickChatEvents]);

  const CenterPiles = () => (
    <View style={styles.centerPiles}>
      <View style={styles.pilesRow}>
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

      {!isHumanTurn && currentPlayer && (
        <Animated.View entering={FadeIn} style={styles.botThinkingBadge}>
          <Ionicons name="hourglass-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.botThinkingText}>
            {`${currentPlayer.name}'s turn…`}
          </Text>
        </Animated.View>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.tableBackground}>
        <Image
          source={GAME_TABLE_BACKGROUND}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
        />
        <View style={styles.tableBgDim} pointerEvents="none" />
      </View>

      <View style={[styles.gameContent, {
        paddingTop: topInset + 36,
        paddingBottom: bottomInset + 4,
        paddingLeft: leftInset + 8,
        paddingRight: rightInset + 8,
      }]}>

        {opponents.length === 1 && opp1 && (
          <View style={styles.oppNorthSingle}>
            <OppZone
              player={opp1}
              isTurn={opp1Idx === state.currentPlayerIndex}
              avatarColor={AVATAR_COLORS[opp1Idx % AVATAR_COLORS.length]}
              isBot={false}
              quickChatText={quickChatByPlayer.get(opp1.id) ?? null}
            />
          </View>
        )}

        {opponents.length === 2 && (
          <View style={styles.oppNorthRow}>
            {opp1 && (
              <OppZone
                player={opp1}
                isTurn={opp1Idx === state.currentPlayerIndex}
                avatarColor={AVATAR_COLORS[opp1Idx % AVATAR_COLORS.length]}
                isBot={false}
                quickChatText={quickChatByPlayer.get(opp1.id) ?? null}
              />
            )}
            {opp2 && (
              <OppZone
                player={opp2}
                isTurn={opp2Idx === state.currentPlayerIndex}
                avatarColor={AVATAR_COLORS[opp2Idx % AVATAR_COLORS.length]}
                isBot={false}
                quickChatText={quickChatByPlayer.get(opp2.id) ?? null}
              />
            )}
          </View>
        )}

        {opponents.length === 3 && opp1 && (
          <View style={styles.oppNorthSingle}>
            <OppZone
              player={opp1}
              isTurn={opp1Idx === state.currentPlayerIndex}
              avatarColor={AVATAR_COLORS[opp1Idx % AVATAR_COLORS.length]}
              isBot={false}
              quickChatText={quickChatByPlayer.get(opp1.id) ?? null}
            />
          </View>
        )}

        <View style={styles.centerRow}>
          {opponents.length === 3 && opp2 && (
            <View style={styles.sideOpp}>
              <OppZone
                player={opp2}
                isTurn={opp2Idx === state.currentPlayerIndex}
                avatarColor={AVATAR_COLORS[opp2Idx % AVATAR_COLORS.length]}
                compact
                isBot={false}
                quickChatText={quickChatByPlayer.get(opp2.id) ?? null}
              />
            </View>
          )}

          <CenterPiles />

          {opponents.length === 3 && opp3 && (
            <View style={styles.sideOpp}>
              <OppZone
                player={opp3}
                isTurn={opp3Idx === state.currentPlayerIndex}
                avatarColor={AVATAR_COLORS[opp3Idx % AVATAR_COLORS.length]}
                compact
                isBot={false}
                quickChatText={quickChatByPlayer.get(opp3.id) ?? null}
              />
            </View>
          )}
        </View>

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

            {(throwError || contextError) ? (
              <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.errorPill}>
                <Ionicons name="alert-circle" size={12} color="#fff" />
                <Text style={styles.errorText}>{contextError || throwError}</Text>
                {contextError ? (
                  <Pressable onPress={clearError} hitSlop={8} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={16} color="#fff" />
                  </Pressable>
                ) : null}
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
                const isSelected = selectedCards.includes(card.id);
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
                      disabled={!isHumanTurn || state.turnPhase !== "throw"}
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

            <View style={styles.actionCol}>
              {(state.canCallShow ?? false) && isHumanTurn && state.turnPhase === "throw" && (
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

              {isHumanTurn && state.turnPhase === "throw" && (
                <Pressable
                  style={[styles.throwBtn, selectedCards.length === 0 && styles.throwBtnOff]}
                  onPress={handleThrow}
                  disabled={selectedCards.length === 0}
                >
                  <Ionicons name="send" size={13} color="#000" />
                  <Text style={styles.throwBtnText}>
                    {selectedCards.length > 0 ? `THROW (${selectedCards.length})` : "THROW"}
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
        onPick={sendQuickChat}
      />

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

      {animations.map((anim) => (
        <FlightCard key={anim.id} {...anim} onDone={removeAnim} />
      ))}

      {/* Scoreboard overlay (avoids Modal+Reanimated crash) */}
      {showScoreModal && (
        <View style={styles.scoreOverlay} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowScoreModal(false)} />
          <View style={styles.scoreModal}>
            <Text style={styles.modalTitle}>Scoreboard — Round {state.round}</Text>
            {state.players.map((p, idx) => (
              <View key={p.id} style={[styles.scoreRow, p.id === playerId && styles.scoreRowMe]}>
                <View style={styles.scoreLeft}>
                  <View
                    style={[
                      styles.scoreAvatar,
                      p.id !== playerId && { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] },
                    ]}
                  >
                    {p.id === playerId ? (
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
                  <Text style={styles.scoreNameTxt}>{p.name}</Text>
                  {p.id === playerId && (
                    <View style={styles.youTag}>
                      <Text style={styles.youTagTxt}>YOU</Text>
                    </View>
                  )}
                  {p.status === "eliminated" && (
                    <View style={styles.outTag}>
                      <Text style={styles.outTagTxt}>OUT</Text>
                    </View>
                  )}
                  {p.status === "left" && (
                    <View style={styles.leftTag}>
                      <Text style={styles.leftTagTxt}>LEFT</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.scorePts, p.totalScore >= 80 && styles.scorePtsDanger]}>{p.totalScore}</Text>
              </View>
            ))}
            <Pressable style={styles.closeBtn} onPress={() => setShowScoreModal(false)}>
              <Text style={styles.closeBtnTxt}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Show confirmation overlay (absolute View avoids Modal+Reanimated crash on Android) */}
      {showConfirmShow && (
        <View style={styles.confirmShowOverlay} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowConfirmShow(false)} />
          <View style={styles.confirmShowModal}>
            <Text style={styles.confirmShowTitle}>Call Show?</Text>
            <Text style={styles.confirmShowMessage}>Reveal all hands and score the round?</Text>
            <View style={styles.confirmShowBtns}>
              <Pressable style={styles.confirmShowCancel} onPress={() => setShowConfirmShow(false)}>
                <Text style={styles.confirmShowCancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmShowOk} onPress={handleConfirmShow}>
                <Text style={styles.confirmShowOkTxt}>Show!</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Show reveal overlay - rectangular scorecard for landscape */}
      {showReveal && (
        <View style={styles.showRevealOverlay} pointerEvents="box-none">
          <View style={styles.modalBg}>
            <View style={styles.showModal}>
              <Text style={styles.showModalTitle}>✦ SHOW! ✦</Text>
              {state.showCallerIndex !== null && state.players[state.showCallerIndex]?.id === playerId && (
                <Text style={styles.showModalSubtitle}>You called Show</Text>
              )}
              {(state.roundScores ?? []).some((s) => s.delta === 15) && (
                <View style={styles.showPenaltyBox}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                  <Text style={styles.showPenaltyText}>
                    Shower penalty: lower score → shower +15 pts, others 0 pts
                  </Text>
                </View>
              )}
              <ScrollView showsVerticalScrollIndicator={false} style={styles.showScroll}>
                {(state.roundScores ?? []).map((score) => {
                  const p = state.players.find((pl) => pl.id === score.playerId);
                  const hand = p?.hand ?? [];
                  const isMe = p?.id === playerId;
                  return (
                    <View key={score.playerId} style={[styles.showRow, isMe && styles.showRowMe]}>
                      <View style={styles.showRowLeft}>
                        <View style={[styles.showAvatar, { backgroundColor: AVATAR_COLORS[state.players.findIndex((pl) => pl.id === score.playerId) % AVATAR_COLORS.length] }]}>
                          <Text style={styles.showAvatarTxt}>{p?.name?.[0] ?? "?"}</Text>
                        </View>
                        <Text style={styles.showName}>{isMe ? "You" : p?.name ?? "—"}</Text>
                      </View>
                      <View style={styles.showCards}>
                        {hand.slice(0, 5).map((c, i) => (
                          <View key={c?.id ?? `card-${i}`} style={styles.showMiniCard}>
                            <Text
                              style={[
                                styles.showMiniCardTxt,
                                { color: c?.suit === "hearts" || c?.suit === "diamonds" ? COLORS.cardRed : "#1A1A1A" },
                              ]}
                            >
                              {c?.rank ?? ""}
                              {c?.suit ? (SUIT_SYMBOLS[c.suit] ?? "") : ""}
                            </Text>
                          </View>
                        ))}
                        {hand.length > 5 && (
                          <Text style={styles.showMore}>+{hand.length - 5}</Text>
                        )}
                      </View>
                      <View style={styles.showScores}>
                        <Text style={styles.showHandScore}>{score.score} pts</Text>
                        <Text style={[styles.showDeltaTxt, score.delta > 0 ? styles.deltaBad : styles.deltaGood]}>
                          {score.delta === 15 ? "+15 penalty" : score.delta === 0 ? "+0" : `+${score.delta}`}
                        </Text>
                        <Text style={styles.showTotalTxt}>{p?.totalScore ?? score.delta} total</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              <Pressable
                style={styles.nextRoundBtn}
                onPress={() => {
                  setShowReveal(false);
                  if ((state.phase as string) === "gameOver") {
                    router.replace("/results");
                  } else {
                    nextRound();
                  }
                }}
              >
                <Text style={styles.nextRoundTxt}>
                  {(state.phase as string) === "gameOver" ? "See Results →" : `Next Round ${state.round + 1} →`}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "column" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
  },
  dealingText: { color: COLORS.gold, fontSize: 22, fontWeight: "700", letterSpacing: 2 },
  tableBackground: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  tableBgDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.14)",
  },
  gameContent: {
    flex: 1,
    justifyContent: "space-between",
    gap: 6,
  },
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
    top: -2,
    right: -2,
    width: 10,
    height: 10,
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
  showBtnText: { color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 1.5 },
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
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 6,
  },
  throwBtnOff: { opacity: 0.35 },
  throwBtnText: { color: "#000", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
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
  errorText: { color: "#fff", fontSize: 10, fontWeight: "600", flexShrink: 1 },
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
  },
  topCenter: { flex: 1 },
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
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    alignItems: "center",
  },
  scoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  confirmShowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  showRevealOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  confirmShowModal: {
    backgroundColor: "#0E2D1A",
    borderRadius: 18,
    padding: 24,
    width: "80%",
    maxWidth: 340,
    borderWidth: 2,
    borderColor: COLORS.gold,
    gap: 16,
  },
  confirmShowTitle: { color: COLORS.gold, fontSize: 20, fontWeight: "900", textAlign: "center" },
  confirmShowMessage: { color: COLORS.text, fontSize: 15, textAlign: "center", lineHeight: 22 },
  confirmShowBtns: { flexDirection: "row", gap: 12, marginTop: 8 },
  confirmShowCancel: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  confirmShowCancelTxt: { color: COLORS.textMuted, fontSize: 15, fontWeight: "700" },
  confirmShowOk: {
    flex: 1,
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  confirmShowOkTxt: { color: "#000", fontSize: 15, fontWeight: "900" },
  scoreModal: {
    backgroundColor: "#0E2D1A",
    borderRadius: 18,
    padding: 20,
    width: "72%",
    maxWidth: 440,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  modalTitle: { color: COLORS.gold, fontSize: 16, fontWeight: "800", textAlign: "center", letterSpacing: 1, marginBottom: 4 },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  scoreRowMe: { backgroundColor: "rgba(255,215,0,0.1)", borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" },
  scoreLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  scoreAvatar: { width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  scoreAvatarTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  scoreNameTxt: { color: COLORS.text, fontSize: 13, fontWeight: "600" },
  youTag: {
    backgroundColor: "rgba(255,215,0,0.2)",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.4)",
  },
  youTagTxt: { color: COLORS.gold, fontSize: 8, fontWeight: "800" },
  outTag: { backgroundColor: COLORS.eliminated, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  outTagTxt: { color: "#fff", fontSize: 8, fontWeight: "800" },
  leftTag: { backgroundColor: "rgba(255,100,100,0.4)", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  leftTagTxt: { color: "#ff6b6b", fontSize: 8, fontWeight: "800" },
  scorePts: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  scorePtsDanger: { color: COLORS.error },
  closeBtn: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, paddingVertical: 9, alignItems: "center", marginTop: 4 },
  closeBtnTxt: { color: COLORS.textMuted, fontSize: 13, fontWeight: "600" },
  showModal: {
    backgroundColor: "#0E2D1A",
    borderRadius: 16,
    padding: 16,
    width: "90%",
    maxWidth: 460,
    borderWidth: 2,
    borderColor: COLORS.gold,
    gap: 10,
    maxHeight: "85%",
  },
  showModalTitle: { color: COLORS.gold, fontSize: 22, fontWeight: "900", textAlign: "center", letterSpacing: 2 },
  showModalSubtitle: { color: COLORS.textMuted, fontSize: 12, textAlign: "center", marginTop: -2 },
  showPenaltyBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(244,67,54,0.15)",
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  showPenaltyText: { color: COLORS.text, fontSize: 11, fontWeight: "600", flex: 1, flexShrink: 1 },
  showScroll: { maxHeight: 180, marginVertical: 2 },
  showRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    marginBottom: 6,
  },
  showRowMe: { backgroundColor: "rgba(255,215,0,0.12)", borderWidth: 1, borderColor: "rgba(255,215,0,0.4)" },
  showRowLeft: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 70 },
  showAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  showAvatarTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  showName: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  showCards: { flexDirection: "row", flex: 1, gap: 3, flexWrap: "wrap", alignItems: "center", minWidth: 0 },
  showMiniCard: {
    backgroundColor: COLORS.cardWhite,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
  },
  showMiniCardTxt: { fontSize: 10, fontWeight: "700" },
  showMore: { color: COLORS.textMuted, fontSize: 10, alignSelf: "center" },
  showScores: { alignItems: "flex-end", minWidth: 68 },
  showHandScore: { color: COLORS.gold, fontSize: 12, fontWeight: "700" },
  showDeltaTxt: { fontSize: 11, fontWeight: "800", marginTop: 1 },
  showTotalTxt: { color: COLORS.textMuted, fontSize: 10, fontWeight: "600", marginTop: 1 },
  deltaBad: { color: COLORS.error },
  deltaGood: { color: COLORS.primary },
  nextRoundBtn: { backgroundColor: COLORS.gold, borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 4 },
  nextRoundTxt: { color: "#000", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
});
