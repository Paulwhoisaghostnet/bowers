import { Layers, Gem, Users, Crown, Store, type LucideIcon } from "lucide-react";

export const STEPS = ["Contract Style", "Configuration", "Review", "Deploy"];

export interface WizardState {
  styleId: string;
  name: string;
  symbol: string;
  adminModel: string;
  royaltiesEnabled: boolean;
  royaltyPercent: number;
  minterListEnabled: boolean;
  metadataBaseUri: string;
  royaltyBps: number;
  royaltyRecipient: string;
  minOfferPerUnitMutez: number;
}

export const defaultState: WizardState = {
  styleId: "",
  name: "",
  symbol: "",
  adminModel: "single",
  royaltiesEnabled: false,
  royaltyPercent: 10,
  minterListEnabled: false,
  metadataBaseUri: "",
  royaltyBps: 500,
  royaltyRecipient: "",
  minOfferPerUnitMutez: 100000,
};

export function isValidTezosAddress(addr: string): boolean {
  return /^(tz[1-3]|KT1)[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr);
}

export const styleIcons: Record<string, LucideIcon> = {
  "fa2-basic": Layers,
  "fa2-royalties": Gem,
  "fa2-multiminter": Users,
  "fa2-full": Crown,
  "bowers-marketplace": Store,
};
