import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setSoundEnabled as setSoundEnabledInStore } from "@/lib/sound";
import { sanitizeDisplayName } from "@/lib/player-display";
import { clampAvatarIndex } from "@/constants/player-avatar";

export type TableTheme = "green" | "blue" | "red";

const STORAGE_KEYS = {
  SOUND_ENABLED: "@noshow/sound_enabled",
  NOTIFICATIONS_ENABLED: "@noshow/notifications_enabled",
  DISPLAY_NAME: "@noshow/display_name",
  AVATAR_INDEX: "@noshow/avatar_index",
  TABLE_THEME: "@noshow/table_theme",
} as const;

interface SettingsContextValue {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  /** In-game / menu display name (persisted locally). */
  displayName: string;
  /** 0 .. PLAYER_AVATAR_COUNT - 1 */
  avatarIndex: number;
  tableTheme: TableTheme;
  setSoundEnabled: (enabled: boolean) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
  setAvatarIndex: (index: number) => Promise<void>;
  setTableTheme: (theme: TableTheme) => Promise<void>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [displayName, setDisplayNameState] = useState("");
  const [avatarIndex, setAvatarIndexState] = useState(0);
  const [tableTheme, setTableThemeState] = useState<TableTheme>("green");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sound, notif, name, avatar, theme] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.SOUND_ENABLED),
          AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED),
          AsyncStorage.getItem(STORAGE_KEYS.DISPLAY_NAME),
          AsyncStorage.getItem(STORAGE_KEYS.AVATAR_INDEX),
          AsyncStorage.getItem(STORAGE_KEYS.TABLE_THEME),
        ]);
        if (sound !== null) {
          const enabled = sound === "true";
          setSoundEnabledState(enabled);
          setSoundEnabledInStore(enabled);
        }
        if (notif !== null) setNotificationsEnabledState(notif === "true");
        if (name !== null) setDisplayNameState(name);
        if (avatar !== null) {
          const n = parseInt(avatar, 10);
          if (!Number.isNaN(n)) setAvatarIndexState(clampAvatarIndex(n));
        }
        if (theme === "green" || theme === "blue" || theme === "red") {
          setTableThemeState(theme);
        }
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

  const setDisplayName = useCallback(async (name: string) => {
    const next = sanitizeDisplayName(name);
    setDisplayNameState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DISPLAY_NAME, next);
    } catch {
      // ignore
    }
  }, []);

  const setAvatarIndex = useCallback(async (index: number) => {
    const next = clampAvatarIndex(index);
    setAvatarIndexState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AVATAR_INDEX, String(next));
    } catch {
      // ignore
    }
  }, []);

  const setTableTheme = useCallback(async (theme: TableTheme) => {
    setTableThemeState(theme);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TABLE_THEME, theme);
    } catch {
      // ignore
    }
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        soundEnabled,
        notificationsEnabled,
        displayName,
        avatarIndex,
        tableTheme,
        setSoundEnabled,
        setNotificationsEnabled,
        setDisplayName,
        setAvatarIndex,
        setTableTheme,
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
  displayName: "",
  avatarIndex: 0,
  tableTheme: "green",
  setSoundEnabled: async () => {},
  setNotificationsEnabled: async () => {},
  setDisplayName: async () => {},
  setAvatarIndex: async () => {},
  setTableTheme: async () => {},
  isLoading: false,
};

export function useSettings() {
  const ctx = useContext(SettingsContext);
  return ctx ?? defaultSettings;
}
