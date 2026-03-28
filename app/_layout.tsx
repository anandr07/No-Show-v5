import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { GameProvider } from "@/context/GameContext";
import { MultiplayerGameProvider } from "@/context/MultiplayerGameContext";
import { OnlineGameProvider } from "@/context/OnlineGameContext";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="vs-setup" />
      <Stack.Screen name="game" />
      <Stack.Screen name="game-multiplayer" />
      <Stack.Screen name="results" />
      <Stack.Screen name="how-to-play" />
      <Stack.Screen name="room" />
      <Stack.Screen name="online" />
      <Stack.Screen name="online-queue" />
      <Stack.Screen name="online-match" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="levels-map" />
      <Stack.Screen name="how-points" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="past-games" />
      <Stack.Screen name="statistics" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <AuthProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <GameProvider>
                  <MultiplayerGameProvider>
                    <OnlineGameProvider>
                      <RootLayoutNav />
                    </OnlineGameProvider>
                  </MultiplayerGameProvider>
                </GameProvider>
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </SettingsProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
