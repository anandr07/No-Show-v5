import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Platform,
  Alert,
} from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { useMultiplayerGame } from "@/context/MultiplayerGameContext";
import { Card, CardBack } from "@/components/Card";
import { playCardFlip, playTap, playCardDeal, playShow } from "@/lib/sound";
import {
  Card as CardType,
  getThrowError,
  isValidThrow,
  SUIT_SYMBOLS,
} from "@/lib/gameEngine";
import COLORS, { AVATAR_COLORS } from "@/constants/colors";

export default function GameMultiplayerScreen() {
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
  } = useMultiplayerGame();

  const insets = useSafeAreaInsets();
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [showConfirmShow, setShowConfirmShow] = useState(false);
  const [throwError, setThrowError] = useState("");
  const notifRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        <LinearGradient colors={["#0A2416", "#1B5E35"]} style={StyleSheet.absoluteFill} />
        <Animated.View entering={ZoomIn}>
          <MaterialCommunityIcons name="cards-playing" size={60} color={COLORS.gold} />
        </Animated.View>
        <Text style={styles.dealingText}>Loading...</Text>
      </View>
    );
  }

  if (state.phase === "gameOver") {
    router.replace("/results");
    return null;
  }

  const humanPlayer = state.players.find((p) => p.id === playerId);
  const opponents = state.players.filter((p) => p.id !== playerId && p.status === "active");
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

  const renderOpponents = () => {
    if (opponents.length === 3) {
      const north = opponents[0];
      const west = opponents[1];
      const east = opponents[2];
      const renderSide = (opp: typeof west) => {
        const playerIdx = state.players.findIndex((p) => p.id === opp.id);
        const isTurn = playerIdx === state.currentPlayerIndex;
        const avatarColor = AVATAR_COLORS[playerIdx % AVATAR_COLORS.length];
        return (
          <View key={opp.id} style={styles.oppZoneSide}>
            <View style={[styles.oppAvatarRing, isTurn && styles.oppAvatarRingActive]}>
              <View style={[styles.oppAvatar, { backgroundColor: avatarColor }]}>
                <Text style={styles.oppInitial}>{opp.name[0]}</Text>
              </View>
              {isTurn && <View style={styles.turnDot} />}
            </View>
            <Text style={styles.oppName} numberOfLines={1}>{opp.name}</Text>
            <View style={styles.oppCardsRow}>
              {Array.from({ length: Math.min(opp.hand.length, 6) }).map((_, ci) => (
                <CardBack key={ci} size="medium" style={[styles.oppCard, { marginLeft: ci > 0 ? -22 : 0 }]} />
              ))}
            </View>
            <Text style={styles.oppMeta}>{opp.hand.length} cards</Text>
          </View>
        );
      };
      return (
        <>
          <View style={styles.oppNorthRow}>
            {north && (() => {
              const playerIdx = state.players.findIndex((p) => p.id === north.id);
              const isTurn = playerIdx === state.currentPlayerIndex;
              const avatarColor = AVATAR_COLORS[playerIdx % AVATAR_COLORS.length];
              return (
                <View key={north.id} style={styles.oppZone}>
                  <View style={[styles.oppAvatarRing, isTurn && styles.oppAvatarRingActive]}>
                    <View style={[styles.oppAvatar, { backgroundColor: avatarColor }]}>
                      <Text style={styles.oppInitial}>{north.name[0]}</Text>
                    </View>
                    {isTurn && <View style={styles.turnDot} />}
                  </View>
                  <Text style={styles.oppName} numberOfLines={1}>{north.name}</Text>
                  <View style={styles.oppCardsRow}>
                    {Array.from({ length: Math.min(north.hand.length, 6) }).map((_, ci) => (
                      <CardBack key={ci} size="medium" style={[styles.oppCard, { marginLeft: ci > 0 ? -22 : 0 }]} />
                    ))}
                  </View>
                  <Text style={styles.oppMeta}>{north.hand.length} cards</Text>
                </View>
              );
            })()}
          </View>
          <View style={styles.centerRow}>
            <View style={styles.oppWest}>{west && renderSide(west)}</View>
            <View style={styles.centerContent}>
              <View style={styles.pickAreaRow}>
                  <Pressable
                    onPress={showPickOptions && isHumanTurn ? handlePickFromDeck : undefined}
                    style={[styles.pileWrap, showPickOptions && isHumanTurn && styles.pileGlow]}
                  >
                    {showPickOptions && isHumanTurn && (
                      <Animated.View entering={ZoomIn} style={styles.pickCardHint}>
                        <Text style={styles.pickCardHintText}>Pick a Card</Text>
                      </Animated.View>
                    )}
                    <CardBack size="medium" />
                    <Text style={styles.pileLabel}>DECK</Text>
                  </Pressable>
                  <View style={styles.centerDivider}>
                    <Text style={styles.arrowText}>↔</Text>
                  </View>
                  <View style={styles.pileWrap}>
                    {showPickOptions && isHumanTurn && (
                      <Animated.View entering={ZoomIn} style={styles.pickCardHint}>
                        <Text style={styles.pickCardHintText}>Pick a Card</Text>
                      </Animated.View>
                    )}
                    <View style={styles.thrownBox}>
                      {state.lastThrown.length === 0 ? (
                        <View style={styles.emptyBox}>
                          <Text style={styles.emptyBoxText}>—</Text>
                        </View>
                      ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thrownScroll}>
                          {state.lastThrown.map((card, ci) => (
                            <Card
                              key={card.id}
                              card={card}
                              size="medium"
                              style={{ marginLeft: ci > 0 ? -18 : 0 }}
                              onPress={canPickFromThrown ? () => handlePickFromThrown(card) : undefined}
                              disabled={!canPickFromThrown}
                            />
                          ))}
                        </ScrollView>
                      )}
                    </View>
                    <Text style={styles.pileLabel}>LAST THROWN</Text>
                  </View>
                </View>
              <View style={styles.thrownRow}>
                {(isHumanTurn && state.turnPhase === "pick" && (state as { pendingThrown?: CardType[] }).pendingThrown?.length) ? (
                  <View style={styles.pileWrap}>
                    <View style={styles.thrownBox}>
                      <View style={styles.selectedPreviewRow}>
                        <Text style={styles.arrowText}>→</Text>
                        {(state as { pendingThrown: CardType[] }).pendingThrown.map((card, ci) => (
                          <Card key={card.id} card={card} size="medium" style={{ marginLeft: ci > 0 ? -18 : 0 }} />
                        ))}
                      </View>
                    </View>
                    <Text style={styles.pileLabel}>YOUR THROW</Text>
                  </View>
                ) : isHumanTurn && state.turnPhase === "throw" && selectedCards.length > 0 ? (
                  <View style={styles.pileWrap}>
                    <View style={styles.thrownBox}>
                      <View style={styles.selectedPreviewRow}>
                        <Text style={styles.arrowText}>→</Text>
                        {humanHand.filter((c) => selectedCards.includes(c.id)).map((card, ci) => (
                          <Card key={card.id} card={card} size="medium" style={{ marginLeft: ci > 0 ? -18 : 0 }} />
                        ))}
                      </View>
                    </View>
                    <Text style={styles.pileLabel}>YOUR THROW</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.oppEast}>{east && renderSide(east)}</View>
          </View>
        </>
      );
    }

    return (
      <>
        <View style={styles.opponentsRow}>
          {opponents.map((opp) => {
            const playerIdx = state.players.findIndex((p) => p.id === opp.id);
            const isTurn = playerIdx === state.currentPlayerIndex;
            const avatarColor = AVATAR_COLORS[playerIdx % AVATAR_COLORS.length];
            return (
              <View key={opp.id} style={styles.oppZone}>
                <View style={[styles.oppAvatarRing, isTurn && styles.oppAvatarRingActive]}>
                  <View style={[styles.oppAvatar, { backgroundColor: avatarColor }]}>
                    <Text style={styles.oppInitial}>{opp.name[0]}</Text>
                  </View>
                  {isTurn && <View style={styles.turnDot} />}
                </View>
                <Text style={styles.oppName} numberOfLines={1}>{opp.name}</Text>
                <View style={styles.oppCardsRow}>
                  {Array.from({ length: Math.min(opp.hand.length, 6) }).map((_, ci) => (
                    <CardBack key={ci} size="medium" style={[styles.oppCard, { marginLeft: ci > 0 ? -22 : 0 }]} />
                  ))}
                </View>
                <Text style={styles.oppMeta}>{opp.hand.length} cards</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.centerRow}>
          <View style={styles.pickAreaRow}>
              <Pressable
                onPress={showPickOptions && isHumanTurn ? handlePickFromDeck : undefined}
                style={[styles.pileWrap, showPickOptions && isHumanTurn && styles.pileGlow]}
              >
                {showPickOptions && isHumanTurn && (
                  <Animated.View entering={ZoomIn} style={styles.pickCardHint}>
                    <Text style={styles.pickCardHintText}>Pick a Card</Text>
                  </Animated.View>
                )}
                <CardBack size="medium" />
                <Text style={styles.pileLabel}>DECK</Text>
              </Pressable>
              <View style={styles.centerDivider}>
                <Text style={styles.arrowText}>↔</Text>
              </View>
              <View style={styles.pileWrap}>
                {showPickOptions && isHumanTurn && (
                  <Animated.View entering={ZoomIn} style={styles.pickCardHint}>
                    <Text style={styles.pickCardHintText}>Pick a Card</Text>
                  </Animated.View>
                )}
                <View style={styles.thrownBox}>
                  {state.lastThrown.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyBoxText}>—</Text>
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thrownScroll}>
                      {state.lastThrown.map((card, ci) => (
                        <Card
                          key={card.id}
                          card={card}
                          size="medium"
                          style={{ marginLeft: ci > 0 ? -18 : 0 }}
                          onPress={canPickFromThrown ? () => handlePickFromThrown(card) : undefined}
                          disabled={!canPickFromThrown}
                        />
                      ))}
                    </ScrollView>
                  )}
                </View>
                <Text style={styles.pileLabel}>LAST THROWN</Text>
              </View>
            </View>
          <View style={styles.thrownRow}>
            {(isHumanTurn && state.turnPhase === "pick" && (state as { pendingThrown?: CardType[] }).pendingThrown?.length) ? (
              <View style={styles.pileWrap}>
                <View style={styles.thrownBox}>
                  <View style={styles.selectedPreviewRow}>
                    <Text style={styles.arrowText}>→</Text>
                    {(state as { pendingThrown: CardType[] }).pendingThrown.map((card, ci) => (
                      <Card key={card.id} card={card} size="medium" style={{ marginLeft: ci > 0 ? -18 : 0 }} />
                    ))}
                  </View>
                </View>
                <Text style={styles.pileLabel}>YOUR THROW</Text>
              </View>
            ) : isHumanTurn && state.turnPhase === "throw" && selectedCards.length > 0 ? (
              <View style={styles.pileWrap}>
                <View style={styles.thrownBox}>
                  <View style={styles.selectedPreviewRow}>
                    <Text style={styles.arrowText}>→</Text>
                    {humanHand.filter((c) => selectedCards.includes(c.id)).map((card, ci) => (
                      <Card key={card.id} card={card} size="medium" style={{ marginLeft: ci > 0 ? -18 : 0 }} />
                    ))}
                  </View>
                </View>
                <Text style={styles.pileLabel}>YOUR THROW</Text>
              </View>
            ) : null}
          </View>
        </View>
      </>
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#0A2416", "#133D24", "#1B5E35"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={[styles.tableArea, { paddingTop: topInset, paddingBottom: bottomInset, paddingLeft: leftInset, paddingRight: rightInset }]}>
        <View style={styles.feltOval}>
          <LinearGradient
            colors={["rgba(0,0,0,0.15)", "transparent", "rgba(255,255,255,0.08)"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </View>

        {renderOpponents()}

        <View style={styles.handArea}>
          {(throwError || contextError) ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.errorPill, { marginBottom: 4 }]}>
              <Ionicons name="alert-circle" size={13} color="#fff" />
              <Text style={styles.errorText}>{contextError || throwError}</Text>
              {contextError ? (
                <Pressable onPress={clearError} hitSlop={8} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={16} color="#fff" />
                </Pressable>
              ) : null}
            </Animated.View>
          ) : null}

          <View style={styles.handRow}>
            <View style={styles.handCardsWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.handScroll}>
                {humanHand.map((card, idx) => {
                  const isSelected = selectedCards.includes(card.id);
                  return (
                    <Animated.View
                      key={card.id}
                      entering={FadeIn.delay(idx * 30)}
                      style={{ marginLeft: idx > 0 ? -12 : 0, marginTop: isSelected ? -14 : 0 }}
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
            </View>
            <View style={styles.handActionBtns}>
            {(state.canCallShow ?? false) && isHumanTurn && state.turnPhase === "throw" && (
              <Animated.View entering={ZoomIn}>
                <Pressable style={styles.showBtn} onPress={handleShow}>
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
                <Ionicons name="send" size={14} color="#000" />
                <Text style={styles.throwBtnText}>
                  THROW{selectedCards.length > 0 ? ` (${selectedCards.length})` : ""}
                </Text>
              </Pressable>
            )}
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.topBarOverlay, { top: topInset, left: leftInset, right: rightInset }]}>
        <Pressable style={styles.iconBtn} onPress={handleQuit}>
          <Ionicons name="close" size={18} color={COLORS.textMuted} />
        </Pressable>
        <View style={styles.topCenter} />
        <Pressable style={styles.iconBtn} onPress={() => setShowScoreModal(true)}>
          <Ionicons name="stats-chart" size={18} color={COLORS.gold} />
        </Pressable>
      </View>

      {/* Scoreboard overlay (avoids Modal+Reanimated crash) */}
      {showScoreModal && (
        <View style={styles.scoreOverlay} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowScoreModal(false)} />
          <View style={styles.scoreModal}>
            <Text style={styles.modalTitle}>Scoreboard — Round {state.round}</Text>
            {state.players.map((p, idx) => (
              <View key={p.id} style={[styles.scoreRow, p.id === playerId && styles.scoreRowMe]}>
                <View style={styles.scoreLeft}>
                  <View style={[styles.scoreAvatar, { backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length] }]}>
                    <Text style={styles.scoreAvatarTxt}>{p.name?.[0] ?? "?"}</Text>
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
  tableArea: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between", overflow: "hidden" },
  feltOval: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: COLORS.felt,
    borderWidth: 6,
    borderColor: "rgba(255,215,0,0.35)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
    overflow: "hidden",
  },
  oppNorthRow: { alignItems: "center", paddingTop: 12, flexShrink: 0, zIndex: 2 },
  oppWest: { justifyContent: "center", alignItems: "flex-end", paddingRight: 8, minWidth: 100, zIndex: 2 },
  oppEast: { justifyContent: "center", alignItems: "flex-start", paddingLeft: 8, minWidth: 100, zIndex: 2 },
  oppZoneSide: { alignItems: "center", gap: 4, maxWidth: 130 },
  centerContent: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 16, flex: 1, zIndex: 2 },
  pickAreaRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  opponentsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 36,
    paddingTop: 12,
    flexShrink: 0,
    zIndex: 2,
  },
  oppZone: { alignItems: "center", gap: 4, maxWidth: 130 },
  oppAvatarRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  oppAvatarRingActive: { borderColor: COLORS.gold, borderWidth: 2.5 },
  oppAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  oppInitial: { color: "#fff", fontSize: 16, fontWeight: "700" },
  turnDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.gold,
    borderWidth: 1.5,
    borderColor: "#000",
  },
  oppName: { color: COLORS.text, fontSize: 12, fontWeight: "600", textAlign: "center" },
  oppCardsRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  oppCard: { borderRadius: 3 },
  oppMeta: { color: COLORS.textDim, fontSize: 10, fontWeight: "500", textAlign: "center", marginTop: 2 },
  centerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 16, flex: 1, zIndex: 2 },
  pileWrap: { alignItems: "center", gap: 4, position: "relative" },
  pileGlow: { shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 14, elevation: 10 },
  countBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: COLORS.gold,
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#000",
  },
  countBadgeText: { color: "#000", fontSize: 10, fontWeight: "800" },
  pileLabel: { color: COLORS.textDim, fontSize: 8, fontWeight: "700", letterSpacing: 1.5, marginTop: 2, textAlign: "center", alignSelf: "center" },
  pickCardHint: {
    backgroundColor: COLORS.gold,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  pickCardHintText: { color: "#000", fontSize: 10, fontWeight: "700" },
  tapHint: {
    position: "absolute",
    top: -22,
    backgroundColor: COLORS.gold,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  tapHintText: { color: "#000", fontSize: 8, fontWeight: "700" },
  centerDivider: { alignItems: "center" },
  arrowText: { color: COLORS.textDim, fontSize: 20 },
  thrownRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  thrownBox: { minWidth: 52, height: 76, justifyContent: "center", alignItems: "center" },
  selectedPreviewRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  emptyBox: {
    width: 52,
    height: 76,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  emptyBoxText: { color: COLORS.textDim, fontSize: 20 },
  thrownScroll: { alignItems: "center", paddingHorizontal: 4 },
  handArea: {
    width: "100%",
    paddingTop: 6,
    paddingHorizontal: 12,
    paddingBottom: 6,
    flexShrink: 0,
    zIndex: 5,
    alignItems: "center",
  },
  handRow: { flexDirection: "row", alignItems: "center", width: "100%", gap: 12 },
  handCardsWrapper: { flex: 1, justifyContent: "center", alignItems: "center", minWidth: 0 },
  handScroll: { paddingVertical: 6, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  handActionBtns: { flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 },
  showBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 7,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 5,
  },
  showBtnText: { color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 1.5 },
  throwBtn: {
    backgroundColor: COLORS.gold,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
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
    flexShrink: 1,
  },
  errorText: { color: "#fff", fontSize: 10, fontWeight: "600", flexShrink: 1 },
  topBarOverlay: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 10,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  topCenter: { flex: 1, alignItems: "center", gap: 3 },
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
