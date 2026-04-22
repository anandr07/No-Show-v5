import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setSoundEnabled as setSoundEnabledInStore } from "@/lib/sound";
import { sanitizeDisplayName } from "@/lib/player-display";
import { clampAvatarIndex } from "@/constants/player-avatar";
import { getApiUrl } from "@/lib/api-url";
import { authClient } from "@/lib/auth-client";
import {
  type CardBackId,
  type PurchasableCardBackId,
  type PremiumTableThemeId,
  type TableThemeId,
  CARD_BACK_PRODUCTS,
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

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await authClient.getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const base = getApiUrl();
  return fetch(`${base}${path}`, { ...options, headers, credentials: "include" });
}

interface PlayerMeResponse {
  profile: { displayName: string; avatarIndex: number } | null;
  settings: {
    soundEnabled: boolean;
    hapticsEnabled: boolean;
    notificationsEnabled: boolean;
    activeCardBackId: string;
    activeTableTheme: string;
  } | null;
  gemBalance: number;
  ownedCardBacks: string[];
  ownedTableThemes: string[];
}

const HAPTICS_KEY = "@noshow/haptics_enabled";

async function fetchPlayerData(): Promise<PlayerMeResponse | null> {
  try {
    const res = await apiFetch("/api/player/me");
    if (!res.ok) return null;
    return (await res.json()) as PlayerMeResponse;
  } catch {
    return null;
  }
}

// ─── Context types ────────────────────────────────────────────────────────────

interface SettingsContextValue {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  notificationsEnabled: boolean;
  /** In-game / menu display name (persisted locally and in DB). */
  displayName: string;
  /** 0 .. PLAYER_AVATAR_COUNT - 1 */
  avatarIndex: number;
  tableTheme: TableTheme;
  /** Soft currency (gems). Server-authoritative for logged-in users. */
  gemBalance: number;
  /** One-time remove-ads purchase (local flag; verify with receipt in production). */
  adsFreePurchased: boolean;
  /** Cosmetic backs unlocked with gems. */
  ownedCardBacks: PurchasableCardBackId[];
  /** Active card back for deck / flights (`default` = bundled art). */
  cardBackId: CardBackId;
  /** Unlocked premium table felts (`blue`, `red`, `yellow`). Green is always available. */
  ownedTablePremium: PremiumTableThemeId[];
  setSoundEnabled: (enabled: boolean) => Promise<void>;
  setHapticsEnabled: (enabled: boolean) => Promise<void>;
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
  /** Spend gems to unlock blue/red/yellow table; equips it on success. */
  purchaseTableThemeWithGems: (id: PremiumTableThemeId) => Promise<boolean>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
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

  // Whether the user is authenticated (non-guest), used for deciding whether to sync.
  const isAuthenticated = useRef(false);

  // ── Bootstrap: load from AsyncStorage, then hydrate from server if logged in ──
  useEffect(() => {
    (async () => {
      try {
        const [sound, haptics, notif, name, avatar, theme, gems, adsFree, ownedRaw, cbRaw, tablePremRaw] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.SOUND_ENABLED),
            AsyncStorage.getItem(HAPTICS_KEY),
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

        // Apply local values first for immediate UI
        if (sound !== null) {
          const enabled = sound === "true";
          setSoundEnabledState(enabled);
          setSoundEnabledInStore(enabled);
        }
        if (haptics !== null) setHapticsEnabledState(haptics === "true");
        if (notif !== null) setNotificationsEnabledState(notif === "true");
        if (name !== null) setDisplayNameState(name);
        if (avatar !== null) {
          const n = parseInt(avatar, 10);
          if (!Number.isNaN(n)) setAvatarIndexState(clampAvatarIndex(n));
        }
        const tablePremiumOwned = parseOwnedTablePremium(tablePremRaw);
        setOwnedTablePremiumState(tablePremiumOwned);

        let loadedTable: TableThemeId = "green";
        if (theme === "green" || theme === "blue" || theme === "red" || theme === "yellow") {
          loadedTable = theme;
        }
        if (loadedTable !== "green" && !tablePremiumOwned.includes(loadedTable as PremiumTableThemeId)) {
          loadedTable = "green";
          void AsyncStorage.setItem(STORAGE_KEYS.TABLE_THEME, "green");
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
        // ignore local read errors
      }

      // ── Hydrate from server (server wins for gems / cosmetics / active equips) ──
      const token = await authClient.getStoredToken();
      if (token) {
        isAuthenticated.current = true;
        const serverData = await fetchPlayerData();
        if (serverData) {
          // Gem balance — server is authoritative
          const serverGems = serverData.gemBalance ?? 0;
          setGemBalanceState(serverGems);
          void AsyncStorage.setItem(STORAGE_KEYS.GEM_BALANCE, String(serverGems));

          // Profile fields
          if (serverData.profile) {
            const sName = serverData.profile.displayName ?? "";
            if (sName) {
              setDisplayNameState(sName);
              void AsyncStorage.setItem(STORAGE_KEYS.DISPLAY_NAME, sName);
            }
            const sAvatar = serverData.profile.avatarIndex ?? 0;
            setAvatarIndexState(clampAvatarIndex(sAvatar));
            void AsyncStorage.setItem(STORAGE_KEYS.AVATAR_INDEX, String(sAvatar));
          }

          // Owned cosmetics
          const sCardBacks = serverData.ownedCardBacks.filter(
            (x): x is PurchasableCardBackId => VALID_PURCHASABLE_IDS.has(x as PurchasableCardBackId)
          );
          setOwnedCardBacksState(sCardBacks);
          void AsyncStorage.setItem(STORAGE_KEYS.OWNED_CARD_BACKS, JSON.stringify(sCardBacks));

          const sTablePremium = serverData.ownedTableThemes.filter(
            (x): x is PremiumTableThemeId => isPremiumTableThemeId(x)
          );
          setOwnedTablePremiumState(sTablePremium);
          void AsyncStorage.setItem(STORAGE_KEYS.OWNED_TABLE_PREMIUM, JSON.stringify(sTablePremium));

          // Active equips from server
          if (serverData.settings) {
            const s = serverData.settings;
            const sCbId = parseCardBackId(s.activeCardBackId, sCardBacks);
            setCardBackIdState(sCbId);
            void AsyncStorage.setItem(STORAGE_KEYS.CARD_BACK_ID, sCbId);

            const sTheme = s.activeTableTheme as TableThemeId;
            if (sTheme === "green" || sTablePremium.includes(sTheme as PremiumTableThemeId)) {
              setTableThemeState(sTheme);
              void AsyncStorage.setItem(STORAGE_KEYS.TABLE_THEME, sTheme);
            }

            // Sound / haptics / notifications from server (authoritative across devices)
            setSoundEnabledState(s.soundEnabled);
            setSoundEnabledInStore(s.soundEnabled);
            void AsyncStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(s.soundEnabled));

            setHapticsEnabledState(s.hapticsEnabled);
            void AsyncStorage.setItem(HAPTICS_KEY, String(s.hapticsEnabled));

            setNotificationsEnabledState(s.notificationsEnabled);
            void AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, String(s.notificationsEnabled));
          }
        }
      }

      setIsLoading(false);
    })();
  }, []);

  // ── Fire-and-forget server sync helpers ─────────────────────────────────────

  const syncSettings = useCallback(
    (patch: {
      sound_enabled?: boolean;
      haptics_enabled?: boolean;
      notifications_enabled?: boolean;
      active_card_back_id?: string;
      active_table_theme?: string;
    }) => {
      if (!isAuthenticated.current) return;
      void apiFetch("/api/player/settings", {
        method: "PUT",
        body: JSON.stringify(patch),
      });
    },
    []
  );

  const syncProfile = useCallback(
    (patch: { display_name?: string; avatar_index?: number }) => {
      if (!isAuthenticated.current) return;
      void apiFetch("/api/player/profile", {
        method: "PUT",
        body: JSON.stringify(patch),
      });
    },
    []
  );

  // ── Setting setters ──────────────────────────────────────────────────────────

  const setSoundEnabled = useCallback(async (enabled: boolean) => {
    setSoundEnabledState(enabled);
    setSoundEnabledInStore(enabled);
    void AsyncStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(enabled));
    syncSettings({ sound_enabled: enabled });
  }, [syncSettings]);

  const setHapticsEnabled = useCallback(async (enabled: boolean) => {
    setHapticsEnabledState(enabled);
    void AsyncStorage.setItem(HAPTICS_KEY, String(enabled));
    syncSettings({ haptics_enabled: enabled });
  }, [syncSettings]);

  const setNotificationsEnabled = useCallback(async (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    void AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, String(enabled));
    syncSettings({ notifications_enabled: enabled });
  }, [syncSettings]);

  const setDisplayName = useCallback(async (name: string) => {
    const next = sanitizeDisplayName(name);
    setDisplayNameState(next);
    void AsyncStorage.setItem(STORAGE_KEYS.DISPLAY_NAME, next);
    syncProfile({ display_name: next });
  }, [syncProfile]);

  const setAvatarIndex = useCallback(async (index: number) => {
    const next = clampAvatarIndex(index);
    setAvatarIndexState(next);
    void AsyncStorage.setItem(STORAGE_KEYS.AVATAR_INDEX, String(next));
    syncProfile({ avatar_index: next });
  }, [syncProfile]);

  const setTableTheme = useCallback(
    async (theme: TableTheme) => {
      if (theme !== "green" && !ownedTablePremium.includes(theme as PremiumTableThemeId)) return;
      setTableThemeState(theme);
      void AsyncStorage.setItem(STORAGE_KEYS.TABLE_THEME, theme);
      syncSettings({ active_table_theme: theme });
    },
    [ownedTablePremium, syncSettings]
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
    void AsyncStorage.setItem(STORAGE_KEYS.ADS_FREE, String(purchased));
  }, []);

  const purchaseCardBackWithGems = useCallback(
    async (id: PurchasableCardBackId) => {
      if (ownedCardBacks.includes(id)) return false;

      // Authenticated users: let the server handle the gem deduction atomically.
      if (isAuthenticated.current) {
        try {
          const res = await apiFetch("/api/player/cosmetics/purchase", {
            method: "POST",
            body: JSON.stringify({ cosmetic_type: "card_back", item_id: id }),
          });
          const data = await res.json() as { success?: boolean; new_gem_balance?: number; error?: string };
          if (!res.ok) return false;
          const newBalance = data.new_gem_balance ?? 0;
          setGemBalanceState(newBalance);
          void AsyncStorage.setItem(STORAGE_KEYS.GEM_BALANCE, String(newBalance));
          const next = [...ownedCardBacks, id];
          setOwnedCardBacksState(next);
          void AsyncStorage.setItem(STORAGE_KEYS.OWNED_CARD_BACKS, JSON.stringify(next));
          return true;
        } catch {
          return false;
        }
      }

      // Guest users: local-only
      const spent = await trySpendGems(CARD_BACK_GEM_PRICE_LOCAL);
      if (!spent) return false;
      const next = [...ownedCardBacks, id];
      setOwnedCardBacksState(next);
      void AsyncStorage.setItem(STORAGE_KEYS.OWNED_CARD_BACKS, JSON.stringify(next));
      return true;
    },
    [ownedCardBacks, trySpendGems]
  );

  const setCardBackId = useCallback(
    async (id: CardBackId) => {
      if (id !== "default" && !ownedCardBacks.includes(id as PurchasableCardBackId)) return;
      setCardBackIdState(id);
      void AsyncStorage.setItem(STORAGE_KEYS.CARD_BACK_ID, id);
      syncSettings({ active_card_back_id: id });
    },
    [ownedCardBacks, syncSettings]
  );

  const purchaseTableThemeWithGems = useCallback(
    async (id: PremiumTableThemeId) => {
      if (ownedTablePremium.includes(id)) return false;

      if (isAuthenticated.current) {
        try {
          const res = await apiFetch("/api/player/cosmetics/purchase", {
            method: "POST",
            body: JSON.stringify({ cosmetic_type: "table_theme", item_id: id }),
          });
          const data = await res.json() as { success?: boolean; new_gem_balance?: number; error?: string };
          if (!res.ok) return false;
          const newBalance = data.new_gem_balance ?? 0;
          setGemBalanceState(newBalance);
          void AsyncStorage.setItem(STORAGE_KEYS.GEM_BALANCE, String(newBalance));
          const next = [...ownedTablePremium, id];
          setOwnedTablePremiumState(next);
          void AsyncStorage.setItem(STORAGE_KEYS.OWNED_TABLE_PREMIUM, JSON.stringify(next));
          // Auto-equip the purchased theme
          setTableThemeState(id);
          void AsyncStorage.setItem(STORAGE_KEYS.TABLE_THEME, id);
          syncSettings({ active_table_theme: id });
          return true;
        } catch {
          return false;
        }
      }

      // Guest users: local-only
      const spent = await trySpendGems(TABLE_THEME_GEM_PRICE_LOCAL);
      if (!spent) return false;
      const next = [...ownedTablePremium, id];
      setOwnedTablePremiumState(next);
      void AsyncStorage.setItem(STORAGE_KEYS.OWNED_TABLE_PREMIUM, JSON.stringify(next));
      setTableThemeState(id);
      void AsyncStorage.setItem(STORAGE_KEYS.TABLE_THEME, id);
      return true;
    },
    [ownedTablePremium, trySpendGems, syncSettings]
  );

  return (
    <SettingsContext.Provider
      value={{
        soundEnabled,
        hapticsEnabled,
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
        setHapticsEnabled,
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

// Fallback gem prices for guest-local purchases (keep in sync with storeCatalog.ts)
const CARD_BACK_GEM_PRICE_LOCAL = 100;
const TABLE_THEME_GEM_PRICE_LOCAL = 1000;

const defaultSettings: SettingsContextValue = {
  soundEnabled: true,
  hapticsEnabled: true,
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
  setHapticsEnabled: async () => {},
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
