import type { ImageSourcePropType } from "react-native";

/** Default in-game card back (bundled). */
export type DefaultCardBackId = "default";

/** Purchasable cosmetic card backs (100 gems each). */
export type PurchasableCardBackId =
  | "red_gold"
  | "green_club"
  | "purple_heart"
  | "blue_crystal"
  | "golden_diamond"
  | "nebula_highroll"
  | "ruby_fortune"
  | "gilded_chest";

export type CardBackId = DefaultCardBackId | PurchasableCardBackId;

export const CARD_BACK_GEM_PRICE = 100;

export const GEM_PACK_IMAGES: Record<string, ImageSourcePropType> = {
  pouch: require("@/assets/images/store/gems/pouch.png"),
  handful: require("@/assets/images/store/gems/handful.png"),
  bag: require("@/assets/images/store/gems/bag.png"),
  box: require("@/assets/images/store/gems/box.png"),
  chest: require("@/assets/images/store/gems/chest.png"),
  crate: require("@/assets/images/store/gems/crate.png"),
  vault: require("@/assets/images/store/gems/vault.png"),
  treasure: require("@/assets/images/store/gems/treasure.png"),
  mountain: require("@/assets/images/store/gems/mountain.png"),
};

export const CARD_BACK_IMAGES: Record<PurchasableCardBackId, ImageSourcePropType> = {
  red_gold: require("@/assets/images/store/cards/red_gold.png"),
  green_club: require("@/assets/images/store/cards/green_club.png"),
  purple_heart: require("@/assets/images/store/cards/purple_heart.png"),
  blue_crystal: require("@/assets/images/store/cards/blue_crystal.png"),
  golden_diamond: require("@/assets/images/store/cards/golden_diamond.png"),
  nebula_highroll: require("@/assets/images/store/cards/nebula_highroll.png"),
  ruby_fortune: require("@/assets/images/store/cards/ruby_fortune.png"),
  gilded_chest: require("@/assets/images/store/cards/gilded_chest.png"),
};

export interface GemPackProduct {
  id: string;
  title: string;
  /** Shown on the pack row. */
  subtitle: string;
  priceLabel: string;
  priceUsd: number;
  /** Bonus gems granted when purchase completes (for UI + dev simulation). */
  gemsGranted: number;
  image: ImageSourcePropType;
}

/** Dollar IAP tiers — hook product IDs to App Store / Play Billing in production. */
export const GEM_PACK_PRODUCTS: GemPackProduct[] = [
  {
    id: "gems_pouch_1",
    title: "Pouch of Gems",
    subtitle: "Starter pack",
    priceLabel: "$1.00",
    priceUsd: 1,
    gemsGranted: 20,
    image: GEM_PACK_IMAGES.pouch,
  },
  {
    id: "gems_handful_5",
    title: "Handful of Gems",
    subtitle: "Popular",
    priceLabel: "$5.00",
    priceUsd: 5,
    gemsGranted: 120,
    image: GEM_PACK_IMAGES.handful,
  },
  {
    id: "gems_bag_10",
    title: "Bag of Gems",
    subtitle: "Great value",
    priceLabel: "$10.00",
    priceUsd: 10,
    gemsGranted: 260,
    image: GEM_PACK_IMAGES.bag,
  },
  {
    id: "gems_box_15",
    title: "Box of Gems",
    subtitle: "Serious play",
    priceLabel: "$15.00",
    priceUsd: 15,
    gemsGranted: 410,
    image: GEM_PACK_IMAGES.box,
  },
  {
    id: "gems_chest_30",
    title: "Chest of Gems",
    subtitle: "Big stack",
    priceLabel: "$30.00",
    priceUsd: 30,
    gemsGranted: 890,
    image: GEM_PACK_IMAGES.chest,
  },
  {
    id: "gems_crate_50",
    title: "Crate of Gems",
    subtitle: "Heavy haul",
    priceLabel: "$50.00",
    priceUsd: 50,
    gemsGranted: 1570,
    image: GEM_PACK_IMAGES.crate,
  },
  {
    id: "gems_vault_100",
    title: "Vault of Gems",
    subtitle: "Vault clearance",
    priceLabel: "$100.00",
    priceUsd: 100,
    gemsGranted: 3320,
    image: GEM_PACK_IMAGES.vault,
  },
  {
    id: "gems_treasure_250",
    title: "Treasure of Gems",
    subtitle: "Treasure trove",
    priceLabel: "$250.00",
    priceUsd: 250,
    gemsGranted: 9200,
    image: GEM_PACK_IMAGES.treasure,
  },
  {
    id: "gems_mountain_500",
    title: "Mountain of Gems",
    subtitle: "Ultimate",
    priceLabel: "$500.00",
    priceUsd: 500,
    gemsGranted: 20000,
    image: GEM_PACK_IMAGES.mountain,
  },
];

export interface CardBackProduct {
  id: PurchasableCardBackId;
  title: string;
  description: string;
  image: ImageSourcePropType;
}

export const CARD_BACK_PRODUCTS: CardBackProduct[] = [
  {
    id: "red_gold",
    title: "Royal Ruby",
    description: "Red & gold ornate back",
    image: CARD_BACK_IMAGES.red_gold,
  },
  {
    id: "green_club",
    title: "Emerald Club",
    description: "Green & gold club back",
    image: CARD_BACK_IMAGES.green_club,
  },
  {
    id: "purple_heart",
    title: "Amethyst Heart",
    description: "Purple & gold heart back",
    image: CARD_BACK_IMAGES.purple_heart,
  },
  {
    id: "blue_crystal",
    title: "Sapphire Diamond",
    description: "Blue crystal back",
    image: CARD_BACK_IMAGES.blue_crystal,
  },
  {
    id: "golden_diamond",
    title: "Gilded Diamond",
    description: "Gold gem & filigree back",
    image: CARD_BACK_IMAGES.golden_diamond,
  },
  {
    id: "nebula_highroll",
    title: "Nebula High Roller",
    description: "Cosmic chips & gold back",
    image: CARD_BACK_IMAGES.nebula_highroll,
  },
  {
    id: "ruby_fortune",
    title: "Ruby Fortune",
    description: "Red velvet casino back",
    image: CARD_BACK_IMAGES.ruby_fortune,
  },
  {
    id: "gilded_chest",
    title: "Cavern Hoard",
    description: "Treasure chest back",
    image: CARD_BACK_IMAGES.gilded_chest,
  },
];

export const ADS_FREE_PRICE_LABEL = "$3.99";

/** In-game table felt (Profile + Store). Green is default & free; others unlock with gems. */
export type TableThemeId = "green" | "blue" | "red" | "yellow";
export type PremiumTableThemeId = Exclude<TableThemeId, "green">;

export const TABLE_THEME_GEM_PRICE = 1000;

export const TABLE_THEME_IMAGES: Record<TableThemeId, ImageSourcePropType> = {
  green: require("@/assets/images/game-table-background.png"),
  blue: require("@/assets/images/game-table-blue.png"),
  red: require("@/assets/images/game-table-red.png"),
  yellow: require("@/assets/images/game-table-yellow.png"),
};

export interface TableThemeProduct {
  theme: TableThemeId;
  title: string;
  subtitle: string;
  gemPrice: number | null;
}

export const TABLE_THEME_PRODUCTS: TableThemeProduct[] = [
  {
    theme: "green",
    title: "Green table",
    subtitle: "Free · default",
    gemPrice: null,
  },
  {
    theme: "blue",
    title: "Blue table",
    subtitle: "Cool casino felt",
    gemPrice: TABLE_THEME_GEM_PRICE,
  },
  {
    theme: "red",
    title: "Red table",
    subtitle: "Crimson felt",
    gemPrice: TABLE_THEME_GEM_PRICE,
  },
  {
    theme: "yellow",
    title: "Gold lounge",
    subtitle: "Yellow felt · classic room",
    gemPrice: TABLE_THEME_GEM_PRICE,
  },
];

export function getTableThemeImageSource(theme: TableThemeId): ImageSourcePropType {
  return TABLE_THEME_IMAGES[theme];
}

export function isPremiumTableTheme(theme: TableThemeId): theme is PremiumTableThemeId {
  return theme !== "green";
}

/** Validates persisted premium table ids (AsyncStorage, etc.). */
export function isPremiumTableThemeId(value: unknown): value is PremiumTableThemeId {
  return value === "blue" || value === "red" || value === "yellow";
}

export function getCardBackImageSource(id: CardBackId): ImageSourcePropType {
  if (id === "default") {
    return require("@/assets/images/card-back.png");
  }
  return CARD_BACK_IMAGES[id];
}
