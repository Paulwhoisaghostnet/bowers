import {
  Store,
  Infinity,
  Settings2,
  ListChecks,
  TrendingUp,
  Layers,
  Palette,
  ListPlus,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export const STEPS_STANDARD = ["Contract Style", "Configuration", "Review", "Deploy"];
export const STEPS_CUSTOM = ["Contract Style", "Modules", "Configuration", "Review", "Deploy"];

export const BOWERS_STYLE_IDS = [
  "bowers-marketplace",
  "bowers-open-edition",
  "bowers-allowlist",
  "bowers-bonding-curve",
  "bowers-unified",
  "bowers-mint-oe",
  "bowers-mint-allowlist",
  "bowers-mint-bonding-curve",
  "bowers-custom",
] as const;

export function isBowersStyle(styleId: string): boolean {
  return (BOWERS_STYLE_IDS as readonly string[]).includes(styleId);
}

export function getSteps(styleId: string): string[] {
  return styleId === "bowers-custom" ? STEPS_CUSTOM : STEPS_STANDARD;
}

export const MINT_ONLY_STYLE_IDS = [
  "bowers-mint-oe",
  "bowers-mint-allowlist",
  "bowers-mint-bonding-curve",
];

export function isMintOnlyStyle(styleId: string): boolean {
  return MINT_ONLY_STYLE_IDS.includes(styleId);
}

export function hasCreateTokenFlow(styleId: string): boolean {
  return [
    "bowers-open-edition",
    "bowers-allowlist",
    "bowers-bonding-curve",
    "bowers-unified",
    "bowers-mint-oe",
    "bowers-mint-allowlist",
    "bowers-mint-bonding-curve",
  ].includes(styleId);
}

export interface WizardState {
  styleId: string;
  name: string;
  symbol: string;
  metadataBaseUri: string;
  collectionDescription: string;
  coverImageUri: string;
  homepage: string;
  selectedModules: string[];
}

export const DEFAULT_MODULES = [
  "fa2-core",
  "royalties",
  "admin-mint",
  "listings",
  "offers",
  "blacklist",
];

export const defaultState: WizardState = {
  styleId: "",
  name: "",
  symbol: "",
  metadataBaseUri: "",
  collectionDescription: "",
  coverImageUri: "",
  homepage: "",
  selectedModules: [...DEFAULT_MODULES],
};

export function isValidTezosAddress(addr: string): boolean {
  return /^(tz[1-3]|KT1)[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr);
}

export const styleIcons: Record<string, LucideIcon> = {
  "bowers-marketplace": Store,
  "bowers-open-edition": Infinity,
  "bowers-allowlist": ListChecks,
  "bowers-bonding-curve": TrendingUp,
  "bowers-unified": Layers,
  "bowers-mint-oe": Palette,
  "bowers-mint-allowlist": ListPlus,
  "bowers-mint-bonding-curve": BarChart3,
  "bowers-custom": Settings2,
};
