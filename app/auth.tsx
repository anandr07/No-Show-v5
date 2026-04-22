import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  FadeIn,
  FadeOut,
  FadeInDown,
  interpolate,
  SlideInUp,
  SlideOutDown,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import COLORS from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

const { width: W, height: H } = Dimensions.get("window");
const isLandscape = W > H;

// ─── Floating suit symbols ────────────────────────────────────────────────────

const SUITS = ["♠", "♥", "♦", "♣"] as const;
const SUIT_COLORS = ["#FFD700", "#E53935", "#E53935", "#FFD700"] as const;

interface FloatingSuit {
  x: number;
  y: number;
  suit: string;
  color: string;
  rotate: number;
  delay: number;
  size: number;
}

const FLOATING: FloatingSuit[] = Array.from({ length: 14 }, (_, i) => ({
  x: (i * 77 + 30) % (W - 40),
  y: (i * 113 + 20) % (H - 40),
  suit: SUITS[i % 4],
  color: SUIT_COLORS[i % 4],
  rotate: (i * 37) % 360 - 180,
  delay: i * 300,
  size: 16 + (i % 4) * 6,
}));

function FloatParticle({ item }: { item: FloatingSuit }) {
  const y = useSharedValue(0);
  const op = useSharedValue(0);

  useEffect(() => {
    op.value = withTiming(0.13, { duration: 1000 + item.delay });
    y.value = withRepeat(
      withSequence(
        withTiming(-14, { duration: 2400 + item.delay }),
        withTiming(8, { duration: 2400 + item.delay })
      ),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${item.rotate}deg` }],
    opacity: op.value,
  }));

  return (
    <Animated.Text
      style={[
        {
          position: "absolute",
          left: item.x,
          top: item.y,
          fontSize: item.size,
          color: item.color,
        },
        style,
      ]}
    >
      {item.suit}
    </Animated.Text>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  secure?: boolean;
  keyboardType?: "default" | "email-address";
  placeholder: string;
  returnKeyType?: "next" | "done";
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput>;
}

function Field({
  label,
  value,
  onChangeText,
  icon,
  secure,
  keyboardType = "default",
  placeholder,
  returnKeyType = "next",
  onSubmitEditing,
  inputRef,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderAnim = useSharedValue(0);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(255,215,0,${interpolate(borderAnim.value, [0, 1], [0.2, 0.85])})`,
    shadowOpacity: interpolate(borderAnim.value, [0, 1], [0, 0.35]),
  }));

  const handleFocus = () => {
    setFocused(true);
    borderAnim.value = withTiming(1, { duration: 220 });
  };
  const handleBlur = () => {
    setFocused(false);
    borderAnim.value = withTiming(0, { duration: 220 });
  };

  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <Animated.View style={[fieldStyles.row, borderStyle]}>
        <Ionicons
          name={icon}
          size={17}
          color={focused ? COLORS.gold : "rgba(255,255,255,0.35)"}
          style={{ marginRight: 8 }}
        />
        <TextInput
          ref={inputRef}
          style={fieldStyles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.25)"
          secureTextEntry={secure && hidden}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={handleFocus}
          onBlur={handleBlur}
          selectionColor={COLORS.gold}
        />
        {secure && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <Ionicons
              name={hidden ? "eye-off-outline" : "eye-outline"}
              size={17}
              color="rgba(255,255,255,0.38)"
            />
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 11,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 0,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

type Mode = "landing" | "signin" | "signup";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, continueAsGuest, isLoading: authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>("landing");

  // form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // card shimmer
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 3500 }), -1, true);
  }, []);
  const logoShimmer = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.82, 1, 0.82]),
  }));

  const clearForm = useCallback(() => {
    setName("");
    setEmail("");
    setPassword("");
    setConfirm("");
    setError("");
  }, []);

  const switchMode = useCallback(
    (next: Mode) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      clearForm();
      setMode(next);
    },
    [clearForm]
  );

  const handleSignIn = useCallback(async () => {
    setError("");
    if (!email.trim()) return setError("Enter your email.");
    if (!password) return setError("Enter your password.");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    const { error: err } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (err) setError(err);
  }, [email, password, signIn]);

  const handleSignUp = useCallback(async () => {
    setError("");
    if (!name.trim()) return setError("Enter a display name.");
    if (!email.trim()) return setError("Enter your email.");
    if (!password) return setError("Enter a password.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    const { error: err } = await signUp(
      email.trim().toLowerCase(),
      password,
      name.trim()
    );
    setLoading(false);
    if (err) setError(err);
  }, [name, email, password, confirm, signUp]);

  const handleGuest = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await continueAsGuest();
  }, [continueAsGuest]);

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bgDeep, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  const topPad = Platform.OS === "web" ? 24 : insets.top + 8;
  const botPad = Platform.OS === "web" ? 24 : insets.bottom + 8;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Full-screen gradient background */}
      <LinearGradient
        colors={["#020805", "#041108", "#061610"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient glow spots */}
      <View style={[s.glow, { left: "10%", top: "15%", backgroundColor: COLORS.gold }]} />
      <View style={[s.glow, { right: "12%", top: "55%", backgroundColor: COLORS.primary }]} />
      <View style={[s.glow, { left: "40%", bottom: "10%", backgroundColor: COLORS.blue }]} />

      {/* Floating cards */}
      {FLOATING.map((item, i) => (
        <FloatParticle key={i} item={item} />
      ))}

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: topPad, paddingBottom: botPad },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo ── */}
        <Animated.View
          entering={FadeIn.duration(700)}
          style={s.logoWrap}
        >
          <View style={s.logoSuitRow}>
            {(["♠", "♥", "♦", "♣"] as const).map((suit, i) => (
              <Text
                key={suit}
                style={[
                  s.logoSuit,
                  { color: i % 2 === 0 ? COLORS.gold : "#E53935" },
                ]}
              >
                {suit}
              </Text>
            ))}
          </View>
          <Animated.Text style={[s.logoTitle, logoShimmer]}>NO-SHOW</Animated.Text>
          <Text style={s.logoSub}>THE CARD GAME</Text>
          <View style={s.logoDivider} />
        </Animated.View>

        {/* ── Landing ── */}
        {mode === "landing" && (
          <Animated.View
            entering={FadeInDown.springify().damping(22)}
            exiting={FadeOut.duration(180)}
            style={s.card}
          >
            <LinearGradient
              colors={["rgba(255,215,0,0.06)", "rgba(255,215,0,0.02)"]}
              style={StyleSheet.absoluteFill}
              borderRadius={20}
            />
            <MaterialCommunityIcons
              name="cards-playing"
              size={40}
              color={COLORS.gold}
              style={{ alignSelf: "center", marginBottom: 4 }}
            />
            <Text style={s.cardTitle}>Welcome back</Text>
            <Text style={s.cardSub}>Sign in to save your progress, rank up, and play online.</Text>

            <View style={s.btnCol}>
              <Pressable
                style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]}
                onPress={() => switchMode("signin")}
              >
                <LinearGradient
                  colors={[COLORS.gold, COLORS.goldDark]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  borderRadius={14}
                />
                <Ionicons name="log-in-outline" size={18} color="#000" />
                <Text style={s.primaryBtnTxt}>Sign In</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [s.outlineBtn, pressed && s.pressed]}
                onPress={() => switchMode("signup")}
              >
                <Ionicons name="person-add-outline" size={18} color={COLORS.gold} />
                <Text style={s.outlineBtnTxt}>Create Account</Text>
              </Pressable>

              <View style={s.dividerRow}>
                <View style={s.dividerLine} />
                <Text style={s.dividerTxt}>or</Text>
                <View style={s.dividerLine} />
              </View>

              <Pressable
                style={({ pressed }) => [s.ghostBtn, pressed && s.pressed]}
                onPress={handleGuest}
              >
                <Ionicons name="person-outline" size={17} color="rgba(255,255,255,0.5)" />
                <Text style={s.ghostBtnTxt}>Continue as Guest</Text>
              </Pressable>
            </View>

            <Text style={s.guestNote}>
              Guest progress is saved only on this device.
            </Text>
          </Animated.View>
        )}

        {/* ── Sign In ── */}
        {mode === "signin" && (
          <Animated.View
            entering={SlideInUp.springify().damping(22)}
            exiting={SlideOutDown.duration(180)}
            style={s.card}
          >
            <LinearGradient
              colors={["rgba(255,215,0,0.06)", "rgba(255,215,0,0.02)"]}
              style={StyleSheet.absoluteFill}
              borderRadius={20}
            />

            <Pressable style={s.backRow} onPress={() => switchMode("landing")}>
              <Ionicons name="arrow-back" size={18} color={COLORS.gold} />
              <Text style={s.backTxt}>Back</Text>
            </Pressable>

            <Text style={s.cardTitle}>Sign In</Text>
            <Text style={s.cardSub}>Welcome back — your stats are waiting.</Text>

            <View style={s.formCol}>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                icon="mail-outline"
                keyboardType="email-address"
                placeholder="you@example.com"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                icon="lock-closed-outline"
                secure
                placeholder="••••••••"
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
                inputRef={passwordRef}
              />

              {error ? (
                <Animated.View entering={FadeIn} style={s.errorBox}>
                  <Ionicons name="alert-circle-outline" size={14} color={COLORS.error} />
                  <Text style={s.errorTxt}>{error}</Text>
                </Animated.View>
              ) : null}

              <Pressable
                style={({ pressed }) => [s.primaryBtn, pressed && s.pressed]}
                onPress={handleSignIn}
                disabled={loading}
              >
                <LinearGradient
                  colors={[COLORS.gold, COLORS.goldDark]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  borderRadius={14}
                />
                {loading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Ionicons name="log-in-outline" size={18} color="#000" />
                    <Text style={s.primaryBtnTxt}>Sign In</Text>
                  </>
                )}
              </Pressable>

              <Pressable onPress={() => switchMode("signup")} style={s.switchRow}>
                <Text style={s.switchTxt}>No account? </Text>
                <Text style={s.switchLink}>Create one →</Text>
              </Pressable>
            </View>

            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerTxt}>or</Text>
              <View style={s.dividerLine} />
            </View>

            <Pressable
              style={({ pressed }) => [s.ghostBtn, pressed && s.pressed]}
              onPress={handleGuest}
            >
              <Ionicons name="person-outline" size={17} color="rgba(255,255,255,0.5)" />
              <Text style={s.ghostBtnTxt}>Continue as Guest</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── Sign Up ── */}
        {mode === "signup" && (
          <Animated.View
            entering={SlideInUp.springify().damping(22)}
            exiting={SlideOutDown.duration(180)}
            style={s.card}
          >
            <LinearGradient
              colors={["rgba(46,204,113,0.07)", "rgba(46,204,113,0.02)"]}
              style={StyleSheet.absoluteFill}
              borderRadius={20}
            />

            <Pressable style={s.backRow} onPress={() => switchMode("landing")}>
              <Ionicons name="arrow-back" size={18} color={COLORS.gold} />
              <Text style={s.backTxt}>Back</Text>
            </Pressable>

            <Text style={s.cardTitle}>Create Account</Text>
            <Text style={s.cardSub}>Join No-Show and climb the leaderboard.</Text>

            <View style={s.formCol}>
              <Field
                label="Display Name"
                value={name}
                onChangeText={setName}
                icon="person-outline"
                placeholder="Your name at the table"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                icon="mail-outline"
                keyboardType="email-address"
                placeholder="you@example.com"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                inputRef={emailRef}
              />
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                icon="lock-closed-outline"
                secure
                placeholder="Min. 6 characters"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                inputRef={passwordRef}
              />
              <Field
                label="Confirm Password"
                value={confirm}
                onChangeText={setConfirm}
                icon="shield-checkmark-outline"
                secure
                placeholder="Repeat password"
                returnKeyType="done"
                onSubmitEditing={handleSignUp}
                inputRef={confirmRef}
              />

              {/* Strength hint */}
              {password.length > 0 && (
                <Animated.View entering={FadeIn} style={s.strengthRow}>
                  {[0, 1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={[
                        s.strengthBar,
                        {
                          backgroundColor:
                            password.length >= (i + 1) * 3
                              ? i < 2
                                ? COLORS.warning
                                : COLORS.primary
                              : "rgba(255,255,255,0.12)",
                        },
                      ]}
                    />
                  ))}
                  <Text style={s.strengthLabel}>
                    {password.length < 6
                      ? "Too short"
                      : password.length < 9
                      ? "Weak"
                      : password.length < 12
                      ? "Good"
                      : "Strong"}
                  </Text>
                </Animated.View>
              )}

              {error ? (
                <Animated.View entering={FadeIn} style={s.errorBox}>
                  <Ionicons name="alert-circle-outline" size={14} color={COLORS.error} />
                  <Text style={s.errorTxt}>{error}</Text>
                </Animated.View>
              ) : null}

              <Pressable
                style={({ pressed }) => [s.greenBtn, pressed && s.pressed]}
                onPress={handleSignUp}
                disabled={loading}
              >
                <LinearGradient
                  colors={[COLORS.primary, COLORS.primaryDark]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  borderRadius={14}
                />
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="rocket-outline" size={18} color="#fff" />
                    <Text style={s.greenBtnTxt}>Create Account</Text>
                  </>
                )}
              </Pressable>

              <Pressable onPress={() => switchMode("signin")} style={s.switchRow}>
                <Text style={s.switchTxt}>Already have an account? </Text>
                <Text style={s.switchLink}>Sign in →</Text>
              </Pressable>
            </View>

            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerTxt}>or</Text>
              <View style={s.dividerLine} />
            </View>

            <Pressable
              style={({ pressed }) => [s.ghostBtn, pressed && s.pressed]}
              onPress={handleGuest}
            >
              <Ionicons name="person-outline" size={17} color="rgba(255,255,255,0.5)" />
              <Text style={s.ghostBtnTxt}>Continue as Guest</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 24,
  },

  // ── Glow ──
  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.05,
  },

  // ── Logo ──
  logoWrap: {
    alignItems: "center",
    gap: 4,
    paddingTop: 8,
  },
  logoSuitRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 6,
  },
  logoSuit: {
    fontSize: 22,
    fontWeight: "900",
  },
  logoTitle: {
    fontSize: 38,
    fontWeight: "900",
    color: COLORS.gold,
    letterSpacing: 6,
    textShadowColor: COLORS.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  logoSub: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,215,0,0.55)",
    letterSpacing: 3,
  },
  logoDivider: {
    width: 60,
    height: 1.5,
    backgroundColor: "rgba(255,215,0,0.3)",
    borderRadius: 1,
    marginTop: 8,
  },

  // ── Card panel ──
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255,215,0,0.18)",
    padding: 24,
    gap: 16,
    overflow: "hidden",
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backTxt: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: "700",
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  cardSub: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },

  // ── Form ──
  formCol: { gap: 14 },
  btnCol: { gap: 12 },

  // ── Buttons ──
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 14,
    overflow: "hidden",
  },
  primaryBtnTxt: {
    color: "#000",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  greenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 14,
    overflow: "hidden",
  },
  greenBtnTxt: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,215,0,0.45)",
    backgroundColor: "rgba(255,215,0,0.05)",
  },
  outlineBtnTxt: {
    color: COLORS.gold,
    fontSize: 15,
    fontWeight: "800",
  },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  ghostBtnTxt: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "700",
  },
  pressed: { opacity: 0.75 },

  // ── Divider ──
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  dividerTxt: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    fontWeight: "600",
  },

  // ── Switch ──
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 2,
  },
  switchTxt: { color: COLORS.textMuted, fontSize: 13 },
  switchLink: { color: COLORS.gold, fontSize: 13, fontWeight: "800" },

  // ── Error ──
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(229,57,53,0.12)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(229,57,53,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorTxt: { color: COLORS.error, fontSize: 12, fontWeight: "600", flex: 1 },

  // ── Password strength ──
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: "700",
    width: 50,
    textAlign: "right",
  },

  // ── Guest note ──
  guestNote: {
    textAlign: "center",
    color: COLORS.textDim,
    fontSize: 11,
    lineHeight: 16,
  },
});
