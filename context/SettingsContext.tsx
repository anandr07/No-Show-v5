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
import {
  type CardBackId,
  type PurchasableCardBackId,
  type PremiumTableThemeId,
  type TableThemeId,
  CARD_BACK_GEM_PRICE,
  CARD_BACK_PRODUCTS,
  TABLE_THEME_GEM_PRICE,
  isPremiumTableThemeId,
} from "@/constants/storeCatalog";

/** Re-export for screens that already import `TableTheme` from here. */
export type TableTheme = TableThemeId;

const STORAGE_KEYS = {
  SOUND_ENABLED: "@noshow/sound_enabled",
  NOTIFICATIONS_ENABLED: "@noshow/notifications_enabled",
  DISPLAY_NAME: "@noshow/display_name",
  AVATAR_INDEX: "@noshow/avatar_index",
  TABLE_THEME: "@noshow/table_theme",
  GEM_BALANCE: "@noshow/gem_balance",
  ADS_FREE: "@noshow/ads_free",
  OWNED_CARD_BACKS: "@noshow/owned_card_backs",
  CARD_BACK_ID: "@noshow/card_back_id",
  OWNED_TABLE_PREMIUM: "@noshow/owned_table_premium",
} as const;

const VALID_PURCHASABLE_IDS = new Set<PurchasableCardBackId>(
  CARD_BACK_PRODUCTS.map((p) => p.id)
);

function parseOwnedCardBacks(raw: string | null): PurchasableCardBackId[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown[];
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is PurchasableCardBackId =>
        typeof x === "string" && VALID_PURCHASABLE_IDS.has(x as PurchasableCardBackId)
    );
  } catch {
    return [];
  }
}

function parseCardBackId(raw: string | null, owned: PurchasableCardBackId[]): CardBackId {
  if (raw === "default" || raw === null) return "default";
  if (VALID_PURCHASABLE_IDS.has(raw as PurchasableCardBackId) && owned.includes(raw as PurchasableCardBackId)) {
    return raw as PurchasableCardBackId;
  }
  return "default";
}

function parseOwnedTablePremium(raw: string | null): PremiumTableThemeId[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown[];
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is PremiumTableThemeId => isPremiumTableThemeId(x));
  } catch {
    return [];
  }
}

interface SettingsContextValue {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  /** In-game / menu display name (persisted locally). */
  displayName: string;
  /** 0 .. PLAYER_AVATAR_COUNT - 1 */
  avatarIndex: number;
  tableTheme: TableTheme;
  /** Soft currency (gems). */
  gemBalance: number;
  /** One-time remove-ads purchase (local flag; verify with receipt in production). */
  adsFreePurchased: boolean;
  /** Cosmetic backs unlocked with gems. */
  ownedCardBacks: PurchasableCardBackId[];
  /** Active card back for deck / flights (`default` = bundled art). */
  cardBackId: CardBackId;
  /** Unlocked premium table felts (`blue`, `red`). Green is always available. */
  ownedTablePremium: PremiumTableThemeId[];
  setSoundEnabled: (enabled: boolean) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
  setAvatarIndex: (index: number) => Promise<void>;
  setTableTheme: (theme: TableTheme) => Promise<void>;
  addGems: (amount: number) => Promise<void>;
  trySpendGems: (amount: number) => Promise<boolean>;
  setAdsFreePurchased: (purchased: boolean) => Promise<void>;
  /** Spend gems to unlock; returns false if already owned or insufficient balance. */
  purchaseCardBackWithGems: (id: PurchasableCardBackId) => Promise<boolean>;
  setCardBackId: (id: CardBackId) => Promise<void>;
  /** Spend gems to unlock blue/red table; equips it on success. */
  purchaseTableThemeWithGems: (id: PremiumTableThemeId) => Promise<boolean>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [displayName, setDisplayNameState] = useState("");
  const [avatarIndex, setAvatarIndexState] = useState(0);
  const [tableTheme, setTableThemeState] = useState<TableTheme>("green");
  const [gemBalance, setGemBalanceState] = useState(0);
  const [adsFreePurchased, setAdsFreePurchasedState] = useState(false);
  const [ownedCardBacks, setOwnedCardBacksState] = useState<PurchasableCardBackId[]>([]);
  const [cardBackId, setCardBackIdState] = useState<CardBackId>("default");
  const [ownedTablePremium, setOwnedTablePremiumState] = useState<PremiumTableThemeId[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sound, notif, name, avatar, theme, gems, adsFree, ownedRaw, cbRaw, tablePremRaw] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.SOUND_ENABLED),
            AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED),
            AsyncStorage.getItem(STORAGE_KEYS.DISPLAY_NAME),
            AsyncStorage.getItem(STORAGE_KEYS.AVATAR_INDEX),
            AsyncStorage.getItem(STORAGE_KEYS.TABLE_THEME),
            AsyncStorage.getItem(STORAGE_KEYS.GEM_BALANCE),
            AsyncStorage.getItem(STORAGE_KEYS.ADS_FREE),
            AsyncStorage.getItem(STORAGE_KEYS.OWNED_CARD_BACKS),
            AsyncStorage.getItem(STORAGE_KEYS.CARD_BACK_ID),
            AsyncStorage.getItem(STORAGE_KEYS.OWNED_TABLE_PREMIUM),
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
        const tablePremiumOwned = parseOwnedTablePremium(tablePremRaw);
        setOwnedTablePremiumState(tablePremiumOwned);

        let loadedTable: TableThemeId = "green";
        if (
          theme === "green" ||
          theme === "blue" ||
          theme === "red" ||
          theme === "yellow"
        ) {
          loadedTable = theme;
        }
        if (loadedTable !== "green" && !tablePremiumOwned.includes(loadedTable as PremiumTableThemeId)) {
          loadedTable = "green";
          try {
            await AsyncStorage.setItem(STORAGE_KEYS.TABLE_THEME, "green");
          } catch {
            // ignore
          }
        }
        setTableThemeState(loadedTable);
        if (gems !== null) {
          const n = parseInt(gems, 10);
          if (!Number.isNaN(n) && n >= 0) setGemBalanceState(n);
        }
        if (adsFree === "true") setAdsFreePurchasedState(true);
        const owned = parseOwnedCardBacks(ownedRaw);
        setOwnedCardBacksState(owned);
        setCardBackIdState(parseCardBackId(cbRaw, owned));
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

  const setTableTheme = useCallback(
    async (theme: TableTheme) => {
      if (theme !== "green" && !ownedTablePremium.includes(theme as PremiumTableThemeId)) {
        return;
      }
      setTableThemeState(theme);
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.TABLE_THEME, theme);
      } catch {
        // ignore
      }
    },
    [ownedTablePremium]
  );

  const addGems = useCallback(async (amount: number) => {
    const n = Math.max(0, Math.floor(amount));
    if (n === 0) return;
    setGemBalanceState((prev) => {
      const next = prev + n;
      void AsyncStorage.setItem(STORAGE_KEYS.GEM_BALANCE, String(next));
      return next;
    });
  }, []);

  const trySpendGems = useCallback(async (amount: number) => {
    const n = Math.max(0, Math.floor(amount));
    if (n === 0) return true;
    let success = false;
    setGemBalanceState((prev) => {
      if (prev < n) return prev;
      success = true;
      const next = prev - n;
      void AsyncStorage.setItem(STORAGE_KEYS.GEM_BALANCE, String(next));
      return next;
    });
    return success;
  }, []);

  const setAdsFreePurchased = useCallback(async (purchased: boolean) => {
    setAdsFreePurchasedState(purchased);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ADS_FREE, String(purchased));
    } catch {
      // ignore
    }
  }, []);

  const persistOwned = useCallback(async (next: PurchasableCardBackId[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.OWNED_CARD_BACKS, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const purchaseCardBackWithGems = useCallback(
    async (id: PurchasableCardBackId) => {
      if (ownedCardBacks.includes(id)) return false;
      const spent = await trySpendGems(CARD_BACK_GEM_PRICE);
      if (!spent) return false;
      const next = [...ownedCardBacks, id];
      setOwnedCardBacksState(next);
      await persistOwned(next);
      return true;
    },
    [ownedCardBacks, trySpendGems, persistOwned]
  );

  const setCardBackId = useCallback(
    async (id: CardBackId) => {
      if (id !== "default" && !ownedCardBacks.includes(id as PurchasableCardBackId)) return;
      setCardBackIdState(id);
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.CARD_BACK_ID, id);
      } catch {
        // ignore
      }
    },
    [ownedCardBacks]
  );

  const persistOwnedTablePremium = useCallback(async (next: PremiumTableThemeId[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.OWNED_TABLE_PREMIUM, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const purchaseTableThemeWithGems = useCallback(
    async (id: PremiumTableThemeId) => {
      if (ownedTablePremium.includes(id)) return false;
      const spent = await trySpendGems(TABLE_THEME_GEM_PRICE);
      if (!spent) return false;
      const next = [...ownedTablePremium, id];
      setOwnedTablePremiumState(next);
      await persistOwnedTablePremium(next);
      return true;
    },
    [ownedTablePremium, trySpendGems, persistOwnedTablePremium]
  );

  return (
    <SettingsContext.Provider
      value={{
        soundEnabled,
        notificationsEnabled,
        displayName,
        avatarIndex,
        tableTheme,
        gemBalance,
        adsFreePurchased,
        ownedCardBacks,
        cardBackId,
        ownedTablePremium,
        setSoundEnabled,
        setNotificationsEnabled,
        setDisplayName,
        setAvatarIndex,
        setTableTheme,
        addGems,
        trySpendGems,
        setAdsFreePurchased,
        purchaseCardBackWithGems,
        setCardBackId,
        purchaseTableThemeWithGems,
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
  gemBalance: 0,
  adsFreePurchased: false,
  ownedCardBacks: [],
  cardBackId: "default",
  ownedTablePremium: [],
  setSoundEnabled: async () => {},
  setNotificationsEnabled: async () => {},
  setDisplayName: async () => {},
  setAvatarIndex: async () => {},
  setTableTheme: async () => {},
  addGems: async () => {},
  trySpendGems: async () => false,
  setAdsFreePurchased: async () => {},
  purchaseCardBackWithGems: async () => false,
  setCardBackId: async () => {},
  purchaseTableThemeWithGems: async () => false,
  isLoading: false,
};

export function useSettings() {
  const ctx = useContext(SettingsContext);
  return ctx ?? defaultSettings;
}
