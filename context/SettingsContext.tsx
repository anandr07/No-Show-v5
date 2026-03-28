import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setSoundEnabled as setSoundEnabledInStore } from "@/lib/sound";

const STORAGE_KEYS = {
  SOUND_ENABLED: "@noshow/sound_enabled",
  NOTIFICATIONS_ENABLED: "@noshow/notifications_enabled",
} as const;

interface SettingsContextValue {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sound, notif] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.SOUND_ENABLED),
          AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED),
        ]);
        if (sound !== null) {
          const enabled = sound === "true";
          setSoundEnabledState(enabled);
          setSoundEnabledInStore(enabled);
        }
        if (notif !== null) setNotificationsEnabledState(notif === "true");
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setSoundEnabled = useCallback(async (enabled: boolean) => {
    setSoundEnabledState(enabled);
    setSoundEnabledInStore(enabled);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(enabled));
    } catch {
      // ignore
    }
  }, []);

  const setNotificationsEnabled = useCallback(async (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, String(enabled));
    } catch {
      // ignore
    }
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        soundEnabled,
        notificationsEnabled,
        setSoundEnabled,
        setNotificationsEnabled,
        isLoading,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

const defaultSettings: SettingsContextValue = {
  soundEnabled: true,
  notificationsEnabled: true,
  setSoundEnabled: async () => {},
  setNotificationsEnabled: async () => {},
  isLoading: false,
};

export function useSettings() {
  const ctx = useContext(SettingsContext);
  return ctx ?? defaultSettings;
}
